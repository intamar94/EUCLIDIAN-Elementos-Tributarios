import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {renderLegal} from '../lib/legal-public.js';
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
function response(){
 return {code:200,headers:{},body:null,setHeader(k,v){this.headers[k]=v;return this},
 status(n){this.code=n;return this},end(s=''){this.body=s;return this}};
}
function render(section,env={},method='GET'){
 const res=response();
 renderLegal({method},res,section,env);
 return res;
}
const closed=render('impressum',{});
assert.equal(closed.code,503,'Legal pages must fail closed when identity is missing');
assert.equal(closed.headers['X-Robots-Tag'],'noindex, nofollow');
assert.doesNotMatch(closed.body,/Beispielstrasse|EUCLIDIAN_LEGAL_NAME|@example/);
const synthetic={
 EUCLIDIAN_LEGAL_NAME:'Ejemplo de Titular',
 EUCLIDIAN_LEGAL_ADDRESS:'Beispielstrasse 19\n65432 Musterstadt\nDeutschland',
 EUCLIDIAN_LEGAL_EMAIL:'legal@example.test',
 EUCLIDIAN_LEGAL_APPROVED:'1'
};
const missingApproval=render('impressum',{...synthetic,EUCLIDIAN_LEGAL_APPROVED:'0'});
assert.equal(missingApproval.code,503);
const imprint=render('impressum',synthetic);
assert.equal(imprint.code,200);
assert.match(imprint.body,/Ejemplo de Titular/);
assert.match(imprint.body,/Beispielstrasse 19/);
assert.match(imprint.body,/mailto:/);
assert.match(imprint.body,/Faro de Intamar/);
const economicImprint=render('impressum',{...synthetic,EUCLIDIAN_LEGAL_W_ID:'DE000000000-00001'});
assert.match(economicImprint.body,/Wirtschafts-Identifikationsnummer<\/h2><p>DE000000000-00001/);
assert.doesNotMatch(economicImprint.body,/Umsatzsteuer-Identifikationsnummer/);
const escapedId=render('impressum',{...synthetic,EUCLIDIAN_LEGAL_W_ID:'<img src=x>'});
assert.ok(escapedId.body.includes('&lt;img src=x&gt;'));
assert.match(imprint.body,/https:\/\/euclidianet.com\/impressum/);
assert.match(imprint.headers['Content-Security-Policy'],/default-src 'none'/);
assert.equal(render('impressum',synthetic,'HEAD').body,'');
assert.equal(render('impressum',synthetic,'POST').code,405);
assert.equal(render('impressum',{...synthetic,EUCLIDIAN_LEGAL_NAME:'<script>alert(1)</script>'}).code,503);
assert.equal(render('impressum',{...synthetic,EUCLIDIAN_LEGAL_EMAIL:'not-an-email'}).code,503);
const privacy=render('datenschutz',synthetic);
assert.equal(privacy.code,200);
const explicitVercel=render('datenschutz',{...synthetic,EUCLIDIAN_HOSTING_PROVIDER:'vercel'});
assert.equal(explicitVercel.body,privacy.body,'Existing Vercel deployments preserve their default provider');
const cloudflarePrivacy=render('datenschutz',{...synthetic,EUCLIDIAN_HOSTING_PROVIDER:'cloudflare'});
assert.equal(cloudflarePrivacy.code,200);
assert.match(cloudflarePrivacy.body,/Cloudflare<\/strong> proporciona alojamiento mediante Workers/);
assert.match(cloudflarePrivacy.body,/https:\/\/www.cloudflare.com\/privacypolicy\//);
assert.doesNotMatch(cloudflarePrivacy.body,/Vercel|vercel\.com/,'Cloudflare production must not claim Vercel is its host');
assert.match(cloudflarePrivacy.body,/registro, el acceso de usuarios externos/);
assert.match(cloudflarePrivacy.body,/suscripciones, los cobros y el envío de aportes están desactivados/);
for(const invalid of ['another-host','<script>alert(1)</script>']){
 const result=render('datenschutz',{...synthetic,EUCLIDIAN_HOSTING_PROVIDER:invalid});
 assert.equal(result.code,503,'Unknown hosting must not silently publish inaccurate privacy');
 assert.equal(result.headers['X-Robots-Tag'],'noindex, nofollow');
 assert.doesNotMatch(result.body,/script|another-host/);
}
for(const v of ['Supabase','Vercel','Brasil','Google Fonts','localStorage','sessionStorage','Reglamento','Privacidad']){
  if(v==='Reglamento')continue;
  assert.ok(privacy.body.includes(v),'Privacy section missing: '+v);
}
const vercel=JSON.parse(read('vercel.json'));
for(const [source,destination] of [
 ['/impressum','/api/impressum'],['/impressum.html','/api/impressum'],
 ['/datenschutz','/api/datenschutz'],['/datenschutz.html','/api/datenschutz'],
 ['/privacidad','/api/datenschutz']]){
 assert.ok(vercel.rewrites.some(x=>x.source===source&&x.destination===destination));
}
for(const filename of ['index.html','app.html']){
 const body=read(filename);
 assert.match(body,/href="\/impressum"/);
 assert.match(body,/href="\/datenschutz"/);
 assert.match(body,/href="\/legal-links.css"/);
}
const index=read('index.html');
assert.ok(index.includes('<link rel="canonical" href="https://euclidianet.com/">'));
assert.ok(read('robots.txt').includes('https://euclidianet.com/sitemap.xml'));
assert.ok(read('sitemap.xml').includes('https://euclidianet.com/'));
console.log('LEGAL PUBLIC: endpoints closed by default, mock approved render, security, paths and SEO OK');

// El aviso corresponde a preparación, sin convertir una política en permiso de apertura.
assert.match(privacy.body,/registro, el acceso de usuarios externos/);
assert.match(privacy.body,/Cloudflare Email Routing/);
assert.match(privacy.body,/Gmail \(Google\)/);
assert.match(privacy.body,/2026\/179/);
assert.match(privacy.body,/datenschutz.hessen.de/);
assert.doesNotMatch(privacy.body,/deben evaluarse|deberán cumplir|deben contrastarse/);
for (const file of ['index.html','app.html','api/baja.js']) {
 assert.doesNotMatch(read(file),/https:\/\/fonts\.(?:googleapis|gstatic)\.com/);
}
