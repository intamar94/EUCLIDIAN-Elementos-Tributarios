import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync('practico.js','utf8');
const html=readFileSync('app.html','utf8');
const bloques=readFileSync('bloques.js','utf8');
const css=readFileSync('practico.css','utf8');
const contexto={window:{},URL,Date};
vm.runInNewContext(js,contexto);
const f=contexto.window.EuclidianPractico;
assert.ok(f&&typeof f.panel==='function'&&typeof f.borrador==='function');
assert.match(html,/src="\/practico\.js" defer/);
assert.match(html,/href="\/practico\.css"/);
assert.ok(html.indexOf('src="/practico.js"')<html.indexOf('src="/bloques.js"'));
assert.match(bloques,/EuclidianPractico\?\.panel\(d\)/);
const d={
 id:'abc',numero_resolucion:'DIAN-OFICIO-100-2026',titulo:'Oficio ejemplo',
 tipo_documento:'oficio',evaluacion_resultado:'REVIEW',
 estado_fuente_verificacion:'pendiente',
 enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm',
 estado_vigencia:'vigente',fecha_publicacion:'2026-02-30',
 fecha_es_real:false,fecha_entrada_vigencia:'2026-03-01',
 temas:['retención'],modifica_a:['Oficio XXX'],
 resumen_humano:'Una nueva obligación automática (NO CONFIAR)',
};
const p=f.preparar(d);
assert.equal(p.fechaActo,'');
assert.equal(p.fechaAplicacion,'');
assert.equal(p.resumen,'');
assert.equal(p.cotejado,false);
const tecnico=f.borrador(p,'tecnico'),cliente=f.borrador(p,'cliente');
assert.match(tecnico,/Fecha de aplicación: Por confirmar/);
assert.match(tecnico,/sujetos y excepciones|sujetos, condiciones/i);
assert.doesNotMatch(tecnico,/nueva obligación automática/);
assert.match(cliente,/no implica por sí sola/i);
assert.match(cliente,/completar tras revisión profesional/i);
assert.doesNotMatch(cliente,/nueva obligación automática/);
assert.match(f.panel(d),/Lectura práctica · 30 segundos/);
assert.match(f.panel(d),/data-practico-tipo="tecnico"/);
assert.match(f.panel(d),/data-practico-tipo="cliente"/);
const escape=f.panel({...d,id:'"><img src=x onerror=alert(1)>',
 temas:['<svg onload=alert(1)>']});
assert.doesNotMatch(escape,/<svg onload|<img src=x/);
assert.match(escape,/&lt;svg/);
assert.equal(f.fuenteSegura('https://normograma.dian.gov.co/dian/compilacion/tributario.html').startsWith('https://'),true);
for(const s of ['http://normograma.dian.gov.co/','https://evil.example.com','https://dian.gov.co.evil.example'])assert.equal(f.fuenteSegura(s),'');
const aprobado=f.preparar({...d,evaluacion_resultado:'APPROVE',estado_fuente_verificacion:'verificado_oficial',resumen_humano:'Síntesis revisable',fecha_es_real:true,fecha_publicacion:'2026-02-20'});
assert.equal(aprobado.cotejado,true);
assert.equal(aprobado.resumen,'Síntesis revisable');
assert.equal(aprobado.fechaActo,'2026-02-20');
assert.equal(f.panel({id:'id2',tipo_documento:'boletin'}),'');
assert.match(css,/@media\(max-width:650px\)/);
assert.match(css,/focus-visible/);
assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|SUPABASE_SERVICE_KEY/);
console.log('Ficha práctica segura: exportación, controles de evidencia, escapes, fuente y responsive OK');
