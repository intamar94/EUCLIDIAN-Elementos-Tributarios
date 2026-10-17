import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read=path=>readFile(new URL('../'+path,import.meta.url));
const [app,css]=await Promise.all(['app.html','estandar-heroes-euclidian.css'].map(async p=>(await read(p)).toString('utf8')));
const posters=[...app.matchAll(/<div class="eu-gif[^"]*" data-caption="([^"]+)"[\s\S]*?<img src="([^"]+)"/g)]
 .map(m=>({caption:m[1],source:m[2]}));
assert.equal(posters.length,6,'Todas las vistas deben tener escena');
assert.equal(new Set(posters.map(x=>x.source)).size,6,
 'Las seis páginas deben tener imágenes distintas');
const byName=Object.fromEntries(posters.map(p=>[p.caption,p.source]));
assert.equal(byName['Tu espacio personal'],'/assets/euclides-cuenta-nueva-hq.webp');
assert.equal(byName['Tu guía, Euclides'],'/assets/euclides-guia-editorial.webp');
assert.equal(byName['El taller tributario'],'/assets/euclides-dian-sin-franjas.webp');
assert.equal(byName['Explora sin rodeos'],'/assets/euclides-telefono-hq.webp');
assert.equal(byName['Consulta con claridad'],'/assets/euclides-pantalla-hq.webp');
assert.equal(byName['En la escuela de Euclides'],'/assets/euclides-ensenando-hq.webp');
for(const path of ['assets/euclides-cuenta-nueva-hq.webp','assets/euclides-cuenta-nueva-hq.webm','assets/euclides-guia-editorial.webp',
 'assets/euclides-dian-sin-franjas.webp','assets/euclides-dian-sin-franjas.webm']){
 const b=await read(path);
 assert.ok(b.length>40000,'Recurso visual completo: '+path);
}
assert.ok(!app.includes('euclides-dian-hq.webm')&&!app.includes('euclides-dian-hq.webp'));
assert.ok(app.includes('/estandar-heroes-euclidian.css'));
assert.ok(app.indexOf('/estandar-heroes-euclidian.css')>app.indexOf('/animaciones-euclidian.css'),
 'El estándar debe prevalecer sobre los estilos históricos');
assert.match(css, /--eu-hero-gutter:clamp\(12px,2\.2vw,28px\)/);
assert.match(css, /--eu-hero-radius:18px/);
assert.match(css, /--eu-hero-espacio:24px/);
assert.match(css, /aspect-ratio:16\/9/);
assert.match(css, /object-fit:cover!important/);
assert.match(css, /#novedadesCab\.novedades-cab\{width:calc/);
assert.match(css, /@media\(max-width:760px\)/);
assert.match(css, /@media\(max-width:390px\)/);
assert.match(css, /background:rgba\(249,247,238,\.95\)/);
assert.doesNotMatch(css, /#puerta\s*\{|#puerta\s+\.auth-caja\s*\{/);
assert.match(app, /<img class="ilustracion" src="\/euclides\.png" alt="Euclides explica a sus discípulos" width="1400" height="770">/);
assert.equal((app.match(/class="eu-video" data-eu-video/g)||[]).length,5,
 'La nueva Cuenta utiliza animación exclusiva y la Guía mantiene su ilustración');
console.log('Estándar de seis páginas: imágenes únicas, bordes sin bandas oscuras, márgenes, vídeos y acceso OK');
