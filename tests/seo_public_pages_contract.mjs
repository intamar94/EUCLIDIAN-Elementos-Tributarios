import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const read=p=>readFileSync(new URL('../'+p,import.meta.url),'utf8');
const pages=['index.html','fuentes-dian.html','fechas-y-vigencia.html','novedades-tributarias.html'];
const sitemap=read('sitemap.xml');
for(const page of pages){
 const html=read(page);
 const url='https://euclidianet.com/'+(page==='index.html'?'':page);
 assert.ok(html.includes('<meta name="robots" content="index,follow">'),page+' indexable');
 assert.ok(html.includes('<link rel="canonical" href="'+url+'">'),page+' canonical');
 assert.ok(html.includes('<meta name="description" content="'),page+' description');
 assert.ok(html.includes('application/ld+json'),page+' structured data');
 assert.equal((html.match(/<h1(?:\s|>)/g)||[]).length,1,page+' h1');
 assert.ok(sitemap.includes('<loc>'+url+'</loc>'),page+' sitemap');
 for(const m of html.matchAll(/(?:href|src)="\/(?!\/)([^"#?]+)(?:[?#][^"]*)?"/g)){
  const target=m[1];
  const virtualRoutes=['impressum','impressum.html','datenschutz','datenschutz.html','privacidad'];
  assert.ok(existsSync(new URL('../'+target,import.meta.url))||virtualRoutes.includes(target),page+' broken local link '+target);
 }
}
const home=read('index.html');
for(const page of pages.slice(1))assert.ok(home.includes('href="/'+page+'"'),page+' linked from home');
for(const privatePage of ['app.html','aportes.html','contacto.html']){
 assert.ok(read(privatePage).includes('noindex'),privatePage+' private/noindex');
 assert.ok(!sitemap.includes(privatePage),privatePage+' excluded sitemap');
}
const aportes=read('aportes.html');
assert.match(aportes,/href="\/app.html"/);
assert.match(read('app.html'),/href="\/aportes.html"/);
assert.match(read('lib/aportes.js'),/EUCLIDIAN_APORTES_HASTA/);
console.log('OK: 4 páginas públicas con canonical, SEO original, enlaces internos y aportes privados.');
