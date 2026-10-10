import assert from 'node:assert/strict';
import {Readable} from 'node:stream';
import Stripe from 'stripe';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.SUPABASE_SERVICE_KEY='service-test';
process.env.STRIPE_SECRET_KEY='sk_test_contract';
process.env.STRIPE_WEBHOOK_SECRET='whsec_contract';
process.env.PAYMENT_PROVIDER='stripe';
process.env.EUCLIDIAN_APP_URL='https://euclidian.example/';
process.env.EUCLIDIAN_BILLING_ENABLED='true';
process.env.EUCLIDIAN_PRICING_PUBLICADO='true';
const {default:webhook}=await import('../api/payment-webhook.js');
const {default:checkout}=await import('../api/checkout.js');
const {estadoAcceso}=await import('../lib/auth-server.js');
const {estadoProveedor,configuracionCobro}=await import('../lib/billing.js');
const uid='00000000-0000-4000-8000-000000000001';
const stripe=new Stripe('sk_test_contract');
function res(){return {code:200,body:null,setHeader(){},status(n){this.code=n;return this;},json(x){this.body=x;return this;}};}
function json(x,status=200){return new Response(JSON.stringify(x),{status,headers:{'content-type':'application/json'}});}
function evento(type='customer.subscription.updated',livemode=false){return {id:'evt_contract',created:Math.floor(Date.now()/1000),type,livemode,data:{object:{id:'sub_contract'}}};}
function request(event,signature){const payload=JSON.stringify(event);const req=Readable.from([Buffer.from(payload)]);req.method='POST';req.headers={'stripe-signature':signature??stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_contract'})};return req;}
const sub={id:'sub_contract',customer:'cus_contract',status:'active',metadata:{euclidian_user_id:uid,euclidian_plan:'pro'},latest_invoice:{status:'paid'},items:{data:[{price:{id:'price_pro'},current_period_start:Math.floor(Date.now()/1000)-10,current_period_end:Math.floor(Date.now()/1000)+86400}]}};
let aplicado,calls;
function upstream({duplicate=false,fail=false,subscription=sub}={}){
  aplicado=null;calls=[];
  global.fetch=async(url,options={})=>{
    calls.push(String(url));
    if(String(url).startsWith('https://api.stripe.com/v1/subscriptions/'))return json(subscription);
    if(String(url).includes('/planes_suscripcion'))return json([{codigo:'pro',stripe_price_id:'price_pro'}]);
    if(String(url).includes('/rpc/euclidian_aplicar_evento_pago')){aplicado=JSON.parse(options.body);return fail?json({},503):json({duplicado:duplicate,actualizado:!duplicate});}
    throw new Error('upstream inesperado');
  };
}
upstream();let r=res();await webhook(request(evento(),'invalido'),r);assert.equal(r.code,400);assert.equal(calls.length,0);
upstream();r=res();await webhook(request(evento()),r);assert.equal(r.code,200);assert.equal(aplicado.p_estado,'active');assert.equal(aplicado.p_user_id,uid);assert.equal(aplicado.p_suscripcion_id,'sub_contract');assert.equal(aplicado.p_hash.length,64);
upstream({subscription:{...sub,latest_invoice:{status:'open'}}});r=res();await webhook(request(evento()),r);assert.equal(aplicado.p_estado,'past_due');
upstream({subscription:{...sub,status:'canceled'}});r=res();await webhook(request(evento()),r);assert.equal(aplicado.p_estado,'canceled');
upstream({duplicate:true});r=res();await webhook(request(evento()),r);assert.equal(r.body.duplicado,true);
upstream({fail:true});r=res();await webhook(request(evento()),r);assert.equal(r.code,503);
upstream();r=res();await webhook(request(evento('customer.subscription.updated',true)),r);assert.equal(r.code,400);assert.equal(calls.length,0);
upstream();r=res();await webhook(request(evento('checkout.session.completed')),r);assert.equal(r.code,200);assert.equal(calls.length,0);assert.equal(r.body.ignored,true);
assert.equal(estadoProveedor({...sub,status:'trialing'}).estado,'incomplete');
for(const fin of [null,'2020-01-01',new Date(Date.now()+86400000).toISOString()]){
 global.fetch=async()=>json([{rol:'usuario',estado:'active',permitido:true,periodo_fin:fin}]);
 assert.equal((await estadoAcceso(uid)).permitido,!!fin&&Date.parse(fin)>Date.now());
}
process.env.EUCLIDIAN_APP_URL='https://euclidian.example/attacker';assert.equal(configuracionCobro().enabled,false);
r=res();await checkout({method:'POST',body:{},headers:{}},r);assert.equal(r.code,503);
process.env.EUCLIDIAN_APP_URL='https://euclidian.example/';
global.fetch=async()=>json({},401);r=res();await checkout({method:'POST',body:{user_id:uid,precio:1},headers:{authorization:'Bearer fake'}},r);assert.equal(r.code,401);
// Compra completa con cliente verificado: ni precio ni identidad del body mandan.
let sessionBody,existing=false,busy=false;
global.fetch=async(url,options={})=>{
 const s=String(url);
 if(s.includes('/auth/v1/user'))return json({id:uid,email:'verified@example.com'});
 if(s.includes('/planes_suscripcion'))return json([{codigo:'pro',stripe_price_id:'price_pro',precio_mensual:59900,moneda:'COP'}]);
 if(s.includes('/accesos_suscripcion')&&(!options.method||options.method==='GET'))return json([{proveedor:'stripe',proveedor_customer_id:'cus_contract',estado:'pendiente'}]);
 if(s.includes('/rpc/euclidian_reservar_checkout'))return json(busy?{ocupado:true}:{clave:uid,session_id:existing?'cs_existing':null});
 if(s.includes('/accesos_suscripcion'))return new Response(null,{status:204});
 if(s.includes('/v1/prices/'))return json({active:true,type:'recurring',currency:'cop',unit_amount:5990000,recurring:{interval:'month',interval_count:1}});
 if(s.includes('/v1/checkout/sessions/cs_existing'))return json({id:'cs_existing',status:'open',url:'https://checkout.stripe.com/existing'});
 if(s.includes('/v1/checkout/sessions')){sessionBody=new URLSearchParams(options.body);return json({id:'cs_new',url:'https://checkout.stripe.com/new'});}
 throw new Error('upstream inesperado');
};
r=res();await checkout({method:'POST',body:{plan_codigo:'pro',user_id:'otro',precio:1,success_url:'https://attacker.example'},headers:{authorization:'Bearer verified'}},r);
assert.equal(r.code,200);assert.equal(sessionBody.get('client_reference_id'),uid);assert.equal(sessionBody.get('line_items[0][price]'),'price_pro');assert.equal(sessionBody.get('subscription_data[metadata][euclidian_user_id]'),uid);assert.equal(sessionBody.get('success_url'),'https://euclidian.example/app.html?pago=confirmando');
existing=true;sessionBody=null;r=res();await checkout({method:'POST',body:{plan_codigo:'pro'},headers:{authorization:'Bearer verified'}},r);assert.equal(r.body.url,'https://checkout.stripe.com/existing');assert.equal(sessionBody,null);
busy=true;r=res();await checkout({method:'POST',body:{plan_codigo:'pro'},headers:{authorization:'Bearer verified'}},r);assert.equal(r.code,409);
console.log('Pagos: firma, modo, factura impagada, cancelación, replay, reintento, período y cierre seguro OK');
