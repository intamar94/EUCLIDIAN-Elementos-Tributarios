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
console.log('Identidad editorial: portada, seis vistas, accesibilidad, acceso preservado y contratación cerrada OK');
