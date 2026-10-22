import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {invokeHandler} from '../cloudflare/adapter.js';
process.env.SUPABASE_URL='https://example.invalid';
process.env.SUPABASE_PUBLISHABLE_KEY='test-not-a-real-key';
process.env.SUPABASE_SERVICE_KEY='test-not-a-real-service-key';
process.env.PAYMENT_PROVIDER='stripe';
process.env.STRIPE_SECRET_KEY='sk_test_local_not_real';
process.env.STRIPE_WEBHOOK_SECRET='whsec_local_contract';
process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED='0';
process.env.EUCLIDIAN_LEGAL_APPROVED='0';
process.env.EUCLIDIAN_BILLING_ENABLED='false';
const {default:worker}=await import('../cloudflare/worker.js');
let assetCalls=0;
const env={EUCLIDIAN_PREVIEW_KEY:'contract-only-preview-key',ASSETS:{async fetch(req){assetCalls++;return new Response(new URL(req.url).pathname);}}};
function req(path,options={}){return new Request('https://preview.example'+path,{...options,headers:{'x-euclidian-preview-key':env.EUCLIDIAN_PREVIEW_KEY,...options.headers}});}
for(const path of ['/','/app.html','/assets/a.webp','/api/auth','/api/payment-webhook','/impressum']){
 const r=await worker.fetch(new Request('https://preview.example'+path),env);assert.equal(r.status,503);assert.equal(r.headers.get('X-Robots-Tag'),'noindex, nofollow');
}
assert.equal(assetCalls,0);
// Public canonical routing preserves path/query and method with 308. It must
// not apply to private previews, arbitrary hosts or forwarded host spoofing.
const production={...env,EUCLIDIAN_CLOUDFLARE_MODE:'production'};
for(const original of ['https://www.euclidianet.com/impressum?q=1','http://euclidianet.com/impressum?q=1']){
 const redirect=await worker.fetch(new Request(original),production);
 assert.equal(redirect.status,308);assert.equal(redirect.headers.get('Location'),'https://euclidianet.com/impressum?q=1');
}
const postRedirect=await worker.fetch(new Request('https://www.euclidianet.com/api/auth',{method:'POST'}),production);
assert.equal(postRedirect.status,308);
assert.equal((await worker.fetch(new Request('https://euclidianet.com/'),production)).status,200);
assert.equal((await worker.fetch(new Request('https://other.example/',{headers:{'x-forwarded-host':'www.euclidianet.com'}}),production)).status,200);
assert.equal((await worker.fetch(new Request('https://www.euclidianet.com/'),env)).status,503);
assert.equal((await worker.fetch(req('/app'),env)).status,200);
assert.equal(await (await worker.fetch(req('/'),env)).text(),'/index.html');
assert.equal((await worker.fetch(req('/api/missing'),env)).status,404);
assert.equal((await worker.fetch(req('/__proto__'),env)).status,200); // static path, never an inherited handler
const closed=await worker.fetch(req('/api/auth',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({action:'signup',email:'x@example.com',password:'abcdefgh'})}),env);
assert.equal(closed.status,403);assert.equal((await closed.json()).error,'registro_cerrado');
assert.equal((await worker.fetch(req('/api/checkout',{method:'POST'}),env)).status,503);
for(const path of ['/impressum','/impressum.html','/datenschutz','/datenschutz.html','/privacidad'])assert.equal((await worker.fetch(req(path),env)).status,503);
const echo=(q,s)=>s.status(201).json({query:q.query,body:q.body,header:q.headers['x-check']});
const r=await invokeHandler(echo,req('/api/test?q=a%20b',{method:'PATCH',headers:{'content-type':'application/json','x-check':'ok'},body:'{"nombre":"Intamar"}'}));
assert.equal(r.status,201);assert.deepEqual(await r.json(),{query:{q:'a b'},body:{nombre:'Intamar'},header:'ok'});
assert.equal((await invokeHandler(echo,req('/api/test',{method:'POST',headers:{'content-type':'application/json'},body:'{'}))).status,400);
assert.equal((await invokeHandler(echo,req('/api/test',{method:'POST',body:'x'.repeat(262145)}))).status,413);
assert.equal((await invokeHandler((q,s)=>s.status(200).end('body'),req('/api/test',{method:'HEAD'}))).body,null);
const payload=JSON.stringify({id:'evt_contract',type:'contract.ignored',livemode:false,data:{object:{}}});
const signature=Stripe.webhooks.generateTestHeaderString({payload,secret:process.env.STRIPE_WEBHOOK_SECRET});
const signed=await worker.fetch(req('/api/payment-webhook',{method:'POST',headers:{'stripe-signature':signature,'content-type':'application/json'},body:payload}),env);
assert.equal(signed.status,200);assert.equal((await signed.json()).ignored,true);
assert.equal((await worker.fetch(req('/api/payment-webhook',{method:'POST',headers:{'stripe-signature':signature,'content-type':'application/json'},body:payload+' '}),env)).status,400);
console.log('Cloudflare adapter: private access, legal aliases, body limits, auth closure and raw Stripe signature passed.');
