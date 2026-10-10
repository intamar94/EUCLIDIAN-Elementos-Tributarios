import {verificarUsuario} from '../lib/auth-server.js';
import {configuracionCobro,stripeClient,db,accesoPago,planPago} from '../lib/billing.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  const config=configuracionCobro();
  if(!config.enabled)return res.status(503).json({error:'cobro_no_habilitado'});
  try{
    const user=await verificarUsuario(req);
    if(!user)return res.status(401).json({error:'sesion_requerida'});
    if(req.body?.action==='portal'){
      const acceso=await accesoPago(user.id);
      if(acceso.proveedor!=='stripe'||!acceso.proveedor_customer_id)return res.status(409).json({error:'cliente_pago_no_configurado'});
      const session=await stripeClient().billingPortal.sessions.create({customer:acceso.proveedor_customer_id,return_url:`${config.origen}/app.html`});
      return res.status(200).json({url:session.url});
    }
    const codigo=String(req.body?.plan_codigo||'pro');
    if(!/^[a-z0-9_-]{1,80}$/.test(codigo))return res.status(400).json({error:'plan_invalido'});
    const plan=await planPago(codigo);
    if(!plan)return res.status(409).json({error:'plan_sin_precio_configurado'});
    const acceso=await accesoPago(user.id);
    if(acceso.proveedor_suscripcion_id&&acceso.estado!=='canceled')return res.status(409).json({error:'gestiona_suscripcion_existente'});
    const stripe=stripeClient();
    const price=await stripe.prices.retrieve(plan.stripe_price_id);
    if(!price.active||price.type!=='recurring'||price.recurring?.interval!=='month'||price.recurring.interval_count!==1
      ||price.currency!==String(plan.moneda).toLowerCase()||price.unit_amount!==Math.round(Number(plan.precio_mensual)*100)){
      return res.status(409).json({error:'precio_proveedor_no_coincide'});
    }
    let customer=acceso.proveedor_customer_id;
    if(!customer){
      const c=await stripe.customers.create({email:user.email,metadata:{euclidian_user_id:user.id}},
        {idempotencyKey:`euclidian-customer-${user.id}`});
      customer=c.id;
      await db(`accesos_suscripcion?user_id=eq.${encodeURIComponent(user.id)}`,{method:'PATCH',
        headers:{Prefer:'return=representation'},body:JSON.stringify({proveedor:'stripe',proveedor_customer_id:customer})});
    }
    let reserva=await db('rpc/euclidian_reservar_checkout',{method:'POST',body:JSON.stringify({p_user_id:user.id})});
    if(reserva.ocupado)return res.status(409).json({error:'checkout_en_preparacion'});
    if(reserva.existente)return res.status(409).json({error:'gestiona_suscripcion_existente'});
    try{
    if(reserva.session_id){
      const anterior=await stripe.checkout.sessions.retrieve(reserva.session_id);
      if(anterior.status==='open')return res.status(200).json({url:anterior.url});
      if(anterior.status==='complete'&&!(acceso.estado==='canceled'&&anterior.subscription===acceso.proveedor_suscripcion_id))return res.status(409).json({error:'pago_pendiente_confirmacion'});
      reserva=await db('rpc/euclidian_reservar_checkout',{method:'POST',body:JSON.stringify({p_user_id:user.id,p_clave:reserva.clave,p_reiniciar:true})});
    }
    const metadata={euclidian_user_id:user.id,euclidian_plan:plan.codigo};
    const session=await stripe.checkout.sessions.create({mode:'subscription',customer,
      line_items:[{price:plan.stripe_price_id,quantity:1}],client_reference_id:user.id,
      metadata,subscription_data:{metadata},
      success_url:`${config.origen}/app.html?pago=confirmando`,cancel_url:`${config.origen}/app.html?pago=cancelado`},
      {idempotencyKey:`euclidian-checkout-${reserva.clave}`});
    await db(`accesos_suscripcion?user_id=eq.${encodeURIComponent(user.id)}&checkout_clave=eq.${reserva.clave}`,{method:'PATCH',
      body:JSON.stringify({checkout_session_id:session.id})});
    return res.status(200).json({url:session.url});
    }finally{
      await db(`accesos_suscripcion?user_id=eq.${encodeURIComponent(user.id)}&checkout_clave=eq.${reserva.clave}`,{method:'PATCH',
        body:JSON.stringify({checkout_bloqueado_hasta:null})});
    }
  }catch(_){return res.status(502).json({error:'checkout_no_disponible'});}
}
