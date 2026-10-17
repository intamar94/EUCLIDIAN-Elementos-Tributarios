import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../landing.css',import.meta.url),'utf8');

assert.match(html,/<title>[^<]*EUCLIDIAN[^<]*<\/title>/i);
assert.match(html,/<meta name="description" content="[^"]{80,}"/i);
assert.match(html,/<link rel="canonical" href="https:\/\/euclidianet\.com\//i);
assert.match(html,/<meta property="og:title"/i);
assert.match(html,/<script type="application\/ld\+json">/i);
assert.match(html,/href="\/app\.html"/i);
assert.match(html,/EUCLIDIAN no es un sitio oficial de la DIAN/i);
assert.match(html,/id="por-dentro"/i);
assert.match(html,/id="suscripcion"/i);
assert.match(css,/@media\(max-width:620px\)/i);
assert.match(css,/focus-visible/i);
assert.ok(html.indexOf('id="que-es"')<html.indexOf('id="por-dentro"')&&html.indexOf('id="por-dentro"')<html.indexOf('id="suscripcion"'),'La explicación precede a la muestra y a la suscripción');
assert.equal((html.match(/role="tabpanel"/g)||[]).length,3,'Tres vistas de ejemplo');
assert.match(html,/contratación|CONTRATACIÓN/);
assert.match(html,/Vistas ilustrativas/);
assert.match(html,/\/app\.html\?registro=1/);

const ubicaciones=['id="que-es"','id="por-dentro"','id="como-funciona"','id="preguntas"','id="suscripcion"','id="cierreTitulo"','<footer>'];
assert.ok(ubicaciones.every((x,i)=>i===0||html.indexOf(ubicaciones[i-1])<html.indexOf(x)), 'La portada explica, muestra, resuelve dudas y luego vende');
const inicioPlan=html.indexOf('<section class="suscripcion wrap"');
assert.ok(!html.slice(0,inicioPlan).includes('$49.900')&&!html.slice(0,inicioPlan).includes('$29.900'), 'No adelantar cifras antes del plan');
assert.ok(html.slice(inicioPlan).includes('$49.900')&&html.slice(inicioPlan).includes('$29.900'), 'Mostrar tarifas aprobadas al final');
const cierre=html.slice(html.indexOf('class="suscripcion-cierre"'));
assert.match(cierre,/href="\/app\.html\?registro=1"/);
assert.match(cierre,/no se realizan cobros/i);
assert.match(cierre,/registro no activa la biblioteca/i);
assert.ok(!/href="[^"]*(checkout|stripe|pagar)[^"]*"/i.test(cierre),'No simular contratación aún desactivada');
assert.ok(html.indexOf('class="preguntas-lista"')<html.indexOf('class="suscripcion-estado"'),'FAQ antes del precio');
assert.match(css,/\.cierre-acciones\s*\.primary/);
assert.match(css,/\.preguntas summary::after/);
assert.match(css,/\.suscripcion-estado \.plan-detalles/);
assert.match(css,/@media\(max-width:620px\)/);

console.log('Contrato portada pública/SEO: estructura, tres vistas, acceso y condiciones de contratación OK');
