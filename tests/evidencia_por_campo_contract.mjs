import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync('practico.js','utf8');
const css=readFileSync('practico.css','utf8');
const app=readFileSync('app.html','utf8');
const codigo={window:{},URL,Date};
vm.runInNewContext(js,codigo);
const {preparar,matrizEvidencia,panel,borrador,fuenteSegura}=codigo.window.EuclidianPractico;
function muestra(extra={}){
 return {id:'id-ejemplo',numero_resolucion:'DIAN-OFICIO-42-2026',
 titulo:'Documento de prueba',tipo_documento:'oficio',resumen_humano:'Síntesis verificada del registro',
 enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/prueba.htm',
 evaluacion_resultado:'APPROVE',estado_fuente_verificacion:'verificado_oficial',
 fecha_es_real:true,fecha_publicacion:'2026-05-10',fecha_publicacion_web:'2026-05-11',
 fecha_entrada_vigencia:'2026-06-01',estado_vigencia:'vigente',
 temas:['iva'],modifica_a:['OFICIO-1-2023'],...extra};
}
const m=matrizEvidencia(muestra());
assert.equal(m.length,6,'La matriz cubre fuente, fecha, síntesis, cambio, destinatarios y tiempo');
assert.equal(m.map(x=>x.campo).join(','),'fuente,fecha_acto,sintesis,cambio,alcance,aplicacion');
const estados=Object.fromEntries(m.map(x=>[x.campo,x.estado]));
assert.equal(estados.fuente,'registrado');
assert.equal(estados.fecha_acto,'registrado');
assert.equal(estados.sintesis,'registrado');
for(const campo of ['cambio','alcance','aplicacion'])assert.equal(estados[campo],'pendiente',
 'Nunca afirmar alcance, cambio o efecto temporal sin cita por pasaje: '+campo);
const p=preparar(muestra());
assert.equal(p.fechaActo,'2026-05-10');
assert.equal(p.fechaAplicacion,'2026-06-01');
assert.match(borrador(p,'tecnico'),/Fecha de aplicación: Por confirmar;/);
assert.match(borrador(p,'tecnico'),/Cambio de criterio: PENDIENTE/);
assert.match(borrador(p,'cliente'),/no acredita modificaciones, fecha efectiva ni sujetos afectados/);
const estructurada=muestra({modifica_a:[{numero:'DIAN-CONCEPTO-77-2025',titulo:'Antecedente documental',accion:'reconsidera',enlace:'https://normograma.dian.gov.co/dian/compilacion/docs/antecedente.htm'}]});
const rel=preparar(estructurada);
assert.equal(rel.relaciones.length,1,'Se conserva la relación estructurada del catálogo');
assert.match(rel.relaciones[0],/DIAN-CONCEPTO-77-2025/);
assert.match(borrador(rel,'tecnico'),/Relaciones registradas/);
assert.equal(matrizEvidencia(estructurada,rel).find(x=>x.campo==='cambio').estado,'pendiente',
 'Reconsideración catalogada no equivale a cambio jurídicamente demostrado');
assert.match(panel(muestra()),/Mapa de evidencia/);
assert.equal((panel(muestra()).match(/class="practico-evidencia-etiqueta"/g)||[]).length,6);
const invalido=preparar(muestra({numero_resolucion:'DIAN-OFICIO-42-2025'}));
assert.equal(invalido.fechaActo,'','Año del identificador y fecha no deben contradecirse');
assert.equal(matrizEvidencia({},invalido).find(x=>x.campo==='fecha_acto').estado,'pendiente');
const parcial=muestra({evaluacion_resultado:'REVIEW',estado_fuente_verificacion:'pendiente',
 resumen_humano:'Obligación falsa para todos los contribuyentes',modifica_a:['CONCEPTO-FALSO']});
const pn=preparar(parcial);
assert.equal(pn.resumen,'');
assert.equal(matrizEvidencia(parcial,pn).find(x=>x.campo==='sintesis').estado,'pendiente');
assert.doesNotMatch(borrador(pn,'tecnico'),/Obligación falsa/);
assert.doesNotMatch(panel(parcial),/Obligación falsa/);
const sinEnlace=preparar(muestra({enlace_oficial:'http://evil.com/diAN'}));
assert.equal(sinEnlace.cotejado,false);
assert.equal(matrizEvidencia({},sinEnlace).find(x=>x.campo==='fuente').estado,'pendiente');
const xss=panel(muestra({temas:['<img src=x onerror=alert(1)>'],titulo:'<script>alert(1)</script>'}));
assert.doesNotMatch(xss,/<script>|<img src=x/);
assert.match(xss,/&lt;img/);
assert.equal(fuenteSegura('https://dian.gov.co.evil.invalid/'), '');
assert.match(css,/\.practico-evidencia li/);
assert.match(css,/@media\(max-width:360px\)/);
assert.ok(app.includes('/practico.js'),'Debe estar conectado a la misma ficha vigente');
assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|SUPABASE_SERVICE_KEY/);
console.log('Mapa evidencia de seis campos: fuentes, fechas coherentes, XSS, incertidumbre y exportación OK');
