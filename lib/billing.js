import Stripe from 'stripe';

export function configuracionCobro(){
  const url=process.env.EUCLIDIAN_APP_URL;
  let origen;
  try{const u=new URL(url);if(u.protocol==='https:'&&u.pathname==='/'&&!u.search&&!u.hash&&!u.username&&!u.password)origen=u.origin;}catch(_){/* fail closed */}
  const enabled=process.env.PAYMENT_PROVIDER==='stripe'
    &&process.env.EUCLIDIAN_BILLING_ENABLED==='true'
    &&process.env.EUCLIDIAN_PRICING_PUBLICADO==='true'
    &&!!process.env.STRIPE_SECRET_KEY&&!!process.env.STRIPE_WEBHOOK_SECRET&&!!origen;
  return {enabled,origen};
}
export function stripeClient(){
  return new Stripe(process.env.STRIPE_SECRET_KEY,{timeout:10000,maxNetworkRetries:1,httpClient:Stripe.createFetchHttpClient()});
}
export async function db(path,options={}){
  const key=process.env.SUPABASE_SERVICE_KEY;
  if(!key||!process.env.SUPABASE_URL)throw new Error('base_no_configurada');
  const r=await fetch(`${process.env.SUPABASE_URL}/rest/v1/${path}`,{
    ...options,signal:AbortSignal.timeout(10000),
    headers:{apikey:key,Authorization:`Bearer ${key}`,'Content-Type':'application/json',...options.headers}
  });
  if(!r.ok)throw new Error('base_pago_no_disponible');
  return r.status===204?null:r.json();
}
export async function accesoPago(uid){
  const rows=await db(`accesos_suscripcion?select=proveedor,proveedor_customer_id,proveedor_suscripcion_id,estado&user_id=eq.${encodeURIComponent(uid)}&limit=1`);
  if(!rows[0])throw new Error('cuenta_no_creada');
  return rows[0];
}
export async function planPago(codigo){
  const rows=await db(`planes_suscripcion?select=codigo,stripe_price_id,precio_mensual,moneda&codigo=eq.${encodeURIComponent(codigo)}&activo=is.true&limit=1`);
  const plan=rows[0];
  if(!plan?.stripe_price_id||!(Number(plan.precio_mensual)>0))return null;
  return plan;
}
export function estadoProveedor(sub){
  const item=sub.items?.data?.[0];
  if(!item||sub.items.data.length!==1)throw new Error('suscripcion_items_invalidos');
  const inicio=sub.current_period_start??item.current_period_start;
  const fin=sub.current_period_end??item.current_period_end;
  let estado=['active','trialing','past_due','canceled','unpaid','incomplete'].includes(sub.status)?sub.status:'canceled';
  // No hay prueba abierta ni acceso concedido solo por llegar a la página de éxito.
  if(estado==='trialing')estado='incomplete';
  if(estado==='active'&&sub.latest_invoice?.status!=='paid')estado='past_due';
  return {estado,inicio:Number.isFinite(inicio)?new Date(inicio*1000).toISOString():null,
    fin:Number.isFinite(fin)?new Date(fin*1000).toISOString():null,price:item.price?.id};
}
