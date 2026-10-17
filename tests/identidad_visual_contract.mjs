import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const read=path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [publico,app,cssPub,cssApp,icon,geo]=await Promise.all(
 ['index.html','app.html','identidad-publica.css','identidad-euclidian.css',
  'icono-euclidian.svg','geometria-euclidian.svg'].map(read));

assert.match(publico,/href="\/identidad-publica\.css"/);
assert.match(app,/href="\/identidad-euclidian\.css"/);
for(const html of [publico,app]) assert.match(html,/href="\/icono-euclidian\.svg"/);
assert.match(app,/<div id="puerta" hidden>[\s\S]*?<img class="ilustracion" src="\/euclides\.png" alt="Euclides explica a sus discípulos" width="1400" height="770">/);
assert.match(publico,/<figure class="hero-visual">[\s\S]*?<img src="\/euclides\.png"/);
assert.doesNotMatch(cssApp,/#puerta\s*\{|#puerta\s+\.auth-caja\s*\{/,
 'La nueva identidad no debe modificar la composición de acceso');

for(const id of ['inicioPanel','controles','novedadesCab','explorar','cuentaPanel','bienvenida'])
 assert.match(app,new RegExp('id="'+id+'"'));
assert.equal((app.match(/class="eu-frase"/g)||[]).length,6);
for(const phrase of ['Menos vueltas','La norma se mueve','Sin regla, sin compás',
 'Tu acceso, sin laberintos','Encontrarla no debería serlo','Euclides trazaba líneas'])
 assert.ok(app.includes(phrase),'Falta guiño editorial '+phrase);
for(const section of ['que-es','beneficios','por-dentro','como-funciona','preguntas','suscripcion'])
 assert.match(publico,new RegExp('id="'+section+'"'));
assert.ok(publico.indexOf('id="por-dentro"')<publico.indexOf('id="preguntas"'));
assert.ok(publico.indexOf('id="preguntas"')<publico.indexOf('id="suscripcion"'));
assert.ok(!publico.slice(0,publico.indexOf('id="suscripcion"')).includes('$49.900'));
assert.match(publico,/CONTRATACIÓN PRÓXIMAMENTE/);
assert.match(publico,/EUCLIDIAN no es un sitio oficial de la DIAN/);
assert.match(cssPub,/@media\(max-width:620px\)/);
assert.match(cssApp,/@media\(max-width:700px\)/);
for(const css of [cssPub,cssApp]) assert.match(css,/prefers-reduced-motion/);
assert.match(geo,/<svg/);
assert.match(geo,/viewBox="0 0 460 260"/);
assert.match(icon,/<svg/);

const animations=[
  'assets/euclides-ensenando.webp',
  'assets/euclides-dian.webp',
  'assets/euclides-pantalla.webp',
  'assets/euclides-telefono.webp'
];
for(const asset of animations){
  const binary=await readFile(new URL('../'+asset,import.meta.url));
  assert.ok(binary.length>1000&&binary.length<20000, 'Animación optimizada '+asset);
  assert.equal(binary.toString('ascii',0,4),'RIFF','WebP real '+asset);
  assert.equal(binary.toString('ascii',8,12),'WEBP','Cabecera WebP '+asset);
  assert.ok(binary.includes(Buffer.from('ANIM')), 'Animación WebP, no imagen estática '+asset);
}
const imageStart=publico.indexOf('<figure class="hero-visual">');
const copyStart=publico.indexOf('<div class="hero-copy">');
assert.ok(imageStart>=0 && imageStart<copyStart, 'El hero comienza por imagen, nunca texto');
assert.match(publico,/class="eu-hero-gif"/);
assert.match(cssPub,/\.hero\s*\{display:flex;flex-direction:column/);
assert.equal((app.match(/class="eu-gif(?: eu-imagen)?"/g)||[]).length,6,
  'Cada sección interna lleva una animación');
assert.ok(!app.slice(app.indexOf('<div id="puerta"'),app.indexOf('<header hidden id="cab"')).includes('class="eu-gif"'),
  'Ingreso preservado sin GIF ni cambio visual');
for(const src of ['euclides-ensenando','euclides-dian','euclides-pantalla','euclides-telefono']){
  assert.ok(app.includes('/assets/'+src+(src==='euclides-dian'?'-sin-franjas':'-hq')+'.webp')||publico.includes('/assets/'+src+'-hq.webp'));
}
assert.match(cssApp,/\.eu-gif/);
assert.match(app,/prefers-reduced-motion: reduce/);
assert.match(publico,/prefers-reduced-motion: reduce/);

console.log('Identidad editorial: portada, seis vistas, accesibilidad, acceso preservado y contratación cerrada OK');
