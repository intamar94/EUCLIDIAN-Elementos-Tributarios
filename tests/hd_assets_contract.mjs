import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const file=p=>readFile(new URL('../'+p,import.meta.url));
const text=async p=>(await file(p)).toString('utf8');
const [app,publico,css,js]=await Promise.all([
  'app.html','index.html','animaciones-euclidian.css','animaciones-euclidian.js'].map(text));
const escenas=['ensenando','pantalla','telefono'];
for(const nombre of escenas){
 const video=await file('assets/euclides-'+nombre+'-hq.webm');
 const poster=await file('assets/euclides-'+nombre+'-hq.webp');
 assert.ok(video.length>100000&&video.length<700000,'Vídeo HD válido '+nombre);
 assert.ok(poster.length>50000&&poster.length<300000,'Póster nítido '+nombre);
 assert.equal(video.toString('hex',0,4),'1a45dfa3','Formato WebM '+nombre);
 assert.equal(poster.toString('ascii',0,4),'RIFF','Formato WebP '+nombre);
 assert.equal(poster.toString('ascii',8,12),'WEBP','Póster WebP '+nombre);
 assert.ok(app.includes('/assets/euclides-'+nombre+'-hq.webm'),'Falta escena '+nombre);
 assert.ok(app.includes('/assets/euclides-'+nombre+'-hq.webp'),'Falta póster '+nombre);
 assert.ok(!app.includes('/assets/euclides-'+nombre+'.webp'),'No usar miniatura borrosa '+nombre);
}
assert.equal((app.match(/class="eu-video" data-eu-video/g)||[]).length,4);
assert.equal((app.match(/class="eu-still"/g)||[]).length,6);
assert.equal((app.match(/class="eu-gif(?: eu-imagen)?"/g)||[]).length,6);
for(const name of ['cuenta','guia']){
 const poster=await file('assets/euclides-'+name+'-editorial.webp');
 assert.ok(poster.length>50000,'Ilustración exclusiva de '+name);
 assert.ok(app.includes('/assets/euclides-'+name+'-editorial.webp'));
}
for(const ext of ['webm','webp']){
 const b=await file('assets/euclides-dian-sin-franjas.'+ext);
 assert.ok(b.length>50000,'Novedades sin franjas: '+ext);
 assert.ok(app.includes('/assets/euclides-dian-sin-franjas.'+ext));
 assert.ok(!app.includes('/assets/euclides-dian-hq.'+ext));
}
assert.equal((publico.match(/class="eu-video" data-eu-video/g)||[]).length,1);
assert.match(publico,/class="hero-visual"[\s\S]*?<img src="\/euclides\.png"/);
assert.ok(publico.indexOf('<figure class="hero-visual">')<publico.indexOf('<div class="hero-copy">'));
assert.match(app,/<img class="ilustracion" src="\/euclides\.png" alt="Euclides explica a sus discípulos" width="1400" height="770">/);
assert.match(app,/href="\/animaciones-euclidian\.css"/);
assert.match(publico,/href="\/animaciones-euclidian\.css"/);
assert.match(app,/src="\/animaciones-euclidian\.js" defer/);
assert.match(publico,/src="\/animaciones-euclidian\.js" defer/);
assert.match(js,/IntersectionObserver/);
assert.match(js,/document\.hidden/);
assert.match(js,/video\.pause\(\)/);
assert.match(js,/source\.src=source\.dataset\.src/);
assert.match(js,/prefers-reduced-motion: reduce/);
assert.match(css,/@media\(prefers-reduced-motion:reduce\)/);
assert.match(css,/\.eu-video\{display:none!important\}/);
assert.doesNotMatch(css,/#puerta\s*\{|\.auth-caja\s*\{/);
console.log('Imágenes HD: 4 vídeos internos, 2 escenas exclusivas estáticas, 7 escenas totales y acceso protegido OK');
