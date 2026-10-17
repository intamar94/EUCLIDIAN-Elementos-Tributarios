import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const base='https://euclidianet.com';
const pages=['index.html','fuentes-dian.html','fechas-y-vigencia.html','novedades-tributarias.html','contacto.html'];
const s=read('sitemap.xml'),robots=read('robots.txt');
assert.ok(robots.includes('Sitemap: '+base+'/sitemap.xml'));
const locs=[...s.matchAll(/<loc>([^<]+)<\/loc>/g)].map(x=>x[1]);
assert.equal(locs.length,pages.length,'El sitemap solo contiene la portada, tres guías y el contacto público');
assert.deepEqual([...locs].sort(),pages.map(p=>base+(p==='index.html'?'/':'/'+p)).sort());
for(const page of pages){
 const html=read(page),url=base+(page==='index.html'?'/':'/'+page);
 assert.match(html,/<html lang="es-CO">/);
 assert.match(html,/<meta name="robots" content="index,follow">/);
 assert.ok(html.includes('<link rel="canonical" href="'+url+'">'),page+' sin canonical correcto');
 assert.match(html,/<title>[^<]{12,}<\/title>/);
 assert.match(html,/<meta name="description" content="[^"]{60,}"/);
 assert.ok(html.includes('content="'+url+'"'),page+' sin OG URL');
 for(const property of ['og:title','og:description','og:image','og:image:alt','og:locale']){
  assert.ok(html.includes('property="'+property+'"'),page+' sin '+property);
 }
 for(const name of ['twitter:card','twitter:title','twitter:description','twitter:image']){
  assert.ok(html.includes('name="'+name+'"'),page+' sin '+name);
 }
 assert.match(html,/<h1(?:\s[^>]*)?>[\s\S]*?<\/h1>/);
 const json=[...html.matchAll(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/g)];
 assert.equal(json.length,1,page+' requiere JSON-LD válido y único');
 const obj=JSON.parse(json[0][1]);assert.equal(obj['@context'],'https://schema.org');
 assert.ok(!html.includes('euclidian-elementos-tributarios.vercel.app'),page+' refiere al host anterior');
}
for(const page of ['app.html','aportes.html']){
 const html=read(page);
 assert.match(html,/<meta name="robots" content="noindex[,a-z]*">/);
 assert.ok(!s.includes(base+'/'+page),'Una vista noindex no debe figurar en el sitemap: '+page);
}
assert.match(read('app.html'),/SIGNA: contribuye a mejorar EUCLIDIAN/);
assert.match(read('app.html'),/href="\/aportes.html"/);
const signa=read('aportes.html');
assert.match(signa,/<h1>SIGNA:/);
assert.match(signa,/<form id="formAporte" hidden>/);
assert.match(signa,/no se reciben formularios durante esta fase/);
assert.match(read('api/aportes.js'),/EUCLIDIAN_APORTES_ENABLED==='1'/);
assert.match(read('api/aportes.js'),/EUCLIDIAN_PUBLIC_ACCESS_ENABLED==='1'/);
assert.match(read('api/aportes.js'),/EUCLIDIAN_LEGAL_APPROVED==='1'/);
const config=JSON.parse(read('vercel.json'));
for(const p of ['/app.html','/aportes.html','/api/(.*)']){
 assert.ok(config.headers.some(h=>h.source===p&&h.headers.some(x=>x.key==='X-Robots-Tag'&&x.value.includes('noindex'))),'Falta X-Robots-Tag: '+p);
}
assert.match(read('docs/SEO_Y_OFERTA_COLOMBIA.md'),/dominio verificado `euclidianet.com`/);
console.log('SEO integral: 5 páginas indexables, zonas privadas noindex, SIGNA cerrado y dominio canónico verificados');
