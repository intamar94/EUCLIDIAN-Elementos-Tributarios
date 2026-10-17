import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const read = path=>readFile(new URL('../'+path,import.meta.url),'utf8');
const [app,landing,mobile,publicCss,oldCss]=await Promise.all([
 'app.html','index.html','heroes-euclidian-responsive.css',
 'hero-publico-responsive.css','identidad-euclidian.css'].map(read));

assert.match(app,/href="\/heroes-euclidian-responsive\.css"/);
assert.match(landing,/href="\/hero-publico-responsive\.css"/);
assert.equal((app.match(/class="eu-gif"/g)||[]).length,6);
assert.equal((app.match(/data-caption="/g)||[]).length,6);
assert.ok(landing.indexOf('<figure class="hero-visual">')<landing.indexOf('<div class="hero-copy">'));
for(const cls of ['inicio-cab','novedades-cab','bienvenida-cab']){
 const tag=app.match(new RegExp('class="'+cls+'[^>]*>[\\s\\S]*?<div class="eu-gif"'));
 assert.ok(tag,cls+' debe contener escena visible fuera del texto');
}
for(const context of ['explorar-cabecera','cuenta-cabecera']){
 const start=app.indexOf('class="'+context+'"');
 const end=app.indexOf('</div>',app.indexOf('<div class="eu-gif"',start));
 assert.ok(start>0 && end>start,context);
}
assert.match(app,/<div class="titulo-consulta">[\s\S]*?<span class="eu-frase">La normativa ya es complicada\. Encontrarla no debería serlo\.<\/span><\/div><div class="eu-gif"/);
assert.match(app,/<img class="ilustracion" src="\/euclides\.png" alt="Euclides explica a sus discípulos" width="1400" height="770">/);
assert.doesNotMatch(mobile,/#puerta\s*\{|\.auth-caja\s*\{/);
assert.match(mobile,/position:relative!important;right:auto!important;bottom:auto!important/);
assert.match(mobile,/\.inicio-cab>\.eu-gif/);
assert.match(mobile,/grid-column:1;grid-row:1;min-height:0;align-self:auto/);
assert.match(mobile,/@media\(max-width:760px\)/);
assert.match(mobile,/@media\(max-width:390px\)/);
assert.match(publicCss,/@media\(max-width:620px\)/);
assert.match(publicCss,/width:53%/);
assert.ok(mobile.includes('aspect-ratio:16/9'));
assert.ok(oldCss.includes('width:99px'), 'Se prueba que la nueva hoja sustituye al tamaño antiguo');
const oldPos=app.indexOf('href="/identidad-euclidian.css"');
const newPos=app.indexOf('href="/heroes-euclidian-responsive.css"');
assert.ok(oldPos>=0 && newPos>oldPos,'Las reglas nuevas deben cargar después');
assert.match(app,/prefers-reduced-motion: reduce/);
assert.match(landing,/prefers-reduced-motion: reduce/);
console.log('Héroes responsivos: seis escenas completas, portada visual primero, controles protegidos y breakpoints OK');
