import {createHash} from 'node:crypto';
import {stripeClient,db,estadoProveedor} from '../lib/billing.js';
export const config={api:{bodyParser:false}};
const TIPOS=new Set(['customer.subscription.created','customer.subscription.updated','customer.subscription.deleted','invoice.paid','invoice.payment_failed']);
async function rawBody(req){
  const partes=[];let n=0;
  for await(const parte of req){n+=Buffer.byteLength(parte);if(n>262144)throw new Error('payload_demasiado_grande');partes.push(Buffer.from(parte));}
  return Buffer.concat(partes);
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(process.env.PAYMENT_PROVIDER!=='stripe'||!process.env.STRIPE_SECRET_KEY||!process.env.STRIPE_WEBHOOK_SECRET)return res.status(503).json({error:'webhook_no_configurado'});
  let event,raw;const stripe=stripeClient();
  try{raw=await rawBody(req);event=stripe.webhooks.constructEvent(raw,req.headers['stripe-signature'],process.env.STRIPE_WEBHOOK_SECRET);}
  catch(_){return res.status(400).json({error:'firma_o_payload_invalido'});}
  if(event.livemode!==process.env.STRIPE_SECRET_KEY.startsWith('sk_live_'))return res.status(400).json({error:'modo_pago_no_coincide'});
  if(!TIPOS.has(event.type))return res.status(200).json({received:true,ignored:true});
  try{
    const obj=event.data.object;
    const id=event.type.startsWith('customer.subscription.')?obj.id:obj.subscription||obj.parent?.subscription_details?.subscription;
    if(!id)return res.status(200).json({received:true,ignored:true});
    // Releer el estado actual: Stripe no garantiza el orden de sus eventos.
    const sub=await stripe.subscriptions.retrieve(typeof id==='string'?id:id.id,{expand:['latest_invoice']});
    const uid=sub.metadata?.euclidian_user_id,codigo=sub.metadata?.euclidian_plan;
    if(!uid||!codigo)throw new Error('identidad_pago_no_disponible');
    const estado=estadoProveedor(sub);
    const planes=await db(`planes_suscripcion?select=codigo,stripe_price_id&codigo=eq.${encodeURIComponent(codigo)}&activo=is.true&limit=1`);
    if(planes[0]?.stripe_price_id!==estado.price)throw new Error('precio_pago_no_coincide');
    const resultado=await db('rpc/euclidian_aplicar_evento_pago',{method:'POST',body:JSON.stringify({
      p_evento_id:event.id,p_tipo:event.type,p_creado:event.created,
      p_hash:createHash('sha256').update(raw).digest('hex'),p_user_id:uid,
      p_customer_id:typeof sub.customer==='string'?sub.customer:sub.customer.id,
      p_suscripcion_id:sub.id,p_plan:codigo,p_estado:estado.estado,
      p_inicio:estado.inicio,p_fin:estado.fin,p_cancelar:sub.cancel_at_period_end===true,
      p_factura:sub.latest_invoice?.status||null
    })});
    return res.status(200).json({received:true,duplicado:resultado.duplicado===true});
  }catch(_){return res.status(503).json({error:'evento_pendiente_reintento'});}
}
