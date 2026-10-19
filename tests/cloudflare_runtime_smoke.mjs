import {Miniflare,convertV4MiniflareOptions} from 'miniflare';
import assert from 'node:assert/strict';
import Stripe from 'stripe';
import {readFile} from 'node:fs/promises';
const mf=new Miniflare(convertV4MiniflareOptions({cf:false,workers:[{modules:true,scriptPath:'.wrangler/cloudflare-bundle/worker.js',compatibilityDate:'2026-10-19',compatibilityFlags:['nodejs_compat'],
 bindings:{EUCLIDIAN_CLOUDFLARE_MODE:'preview',EUCLIDIAN_PREVIEW_KEY:'local-contract-only',SUPABASE_URL:'https://example.invalid',SUPABASE_SERVICE_KEY:'test',SUPABASE_PUBLISHABLE_KEY:'test',PAYMENT_PROVIDER:'stripe',STRIPE_SECRET_KEY:'sk_test_local_not_real',STRIPE_WEBHOOK_SECRET:'whsec_local_contract',EUCLIDIAN_PUBLIC_ACCESS_ENABLED:'0',EUCLIDIAN_SIGNUP_ENABLED:'false',EUCLIDIAN_LEGAL_APPROVED:'0',EUCLIDIAN_BILLING_ENABLED:'false'},
 serviceBindings:{ASSETS:async request=>{try{const p=new URL(request.url).pathname;return new Response(await readFile('dist-cloudflare/public'+p));}catch{return new Response(null,{status:404});}}}}]}));
try{
 const headers={'x-euclidian-preview-key':'local-contract-only'};
 const send=(p,o={})=>mf.dispatchFetch('https://preview.example'+p,o);
 for(const p of ['/','/app.html','/api/auth'])assert.equal((await send(p)).status,503);
 for(const p of ['/','/app','/app.html','/landing.css','/assets/euclides-guia-editorial.webp'])assert.equal((await send(p,{headers})).status,200,p);
 for(const p of ['/docs/LEGAL_LANZAMIENTO_20261019.md','/package.json','/.dev.vars','/cloudflare/worker.js','/api/unknown'])assert.equal((await send(p,{headers})).status,404,p);
 assert.equal((await send('/api/auth',{method:'POST',headers:{...headers,'content-type':'application/json'},body:'{"action":"signup"}'})).status,403);
 const payload=JSON.stringify({id:'evt_contract',type:'contract.ignored',livemode:false,data:{object:{}}});
 const sig=Stripe.webhooks.generateTestHeaderString({payload,secret:'whsec_local_contract'});
 const r=await send('/api/payment-webhook',{method:'POST',headers:{...headers,'content-type':'application/json','stripe-signature':sig},body:payload});
 assert.equal(r.status,200,await r.text());
 console.log('workerd passed: static assets, private gate, hidden source, closed signup, Stripe signature.');
}finally{await mf.dispose();}
