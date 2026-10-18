import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
const js=readFileSync('comparador.js','utf8');
const app=readFileSync('app.html','utf8');
const bloques=readFileSync('bloques.js','utf8');
const css=readFileSync('comparador.css','utf8');
const ctx={window:{},URL};
vm.runInNewContext(js,ctx);
const {preparar,panel,marcado,fuenteOficial}=ctx.window.EuclidianComparador;
assert.equal(typeof preparar,'function');
assert.equal(typeof marcado,'function');
assert.match(app,/src="\/comparador\.js" defer/);
assert.match(app,/href="\/comparador\.css"/);
assert.ok(app.indexOf('/comparador.js')<app.indexOf('/bloques.js'));
assert.match(bloques,/EuclidianComparador\?\.panel\(d\)/);
assert.match(app,/<img class="ilustracion" src="\/euclides\.png"/);
function doc(extra={}){return {
 id:'00000000-0000-4000-8000-000000000010',
 titulo:'Documento de ejemplo',numero_resolucion:'DIAN-CONCEPTO-15-2026',
 enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm',
 tipo_documento:'concepto',estado_fuente_verificacion:'verificado_oficial',
 evaluacion_resultado:'APPROVE',
 texto_completo:'La DIAN examina una cuestión tributaria y describe los hechos, excepciones y condiciones del caso consultado.',
 ...extra
};}
const p=preparar(doc());
assert.equal(p.ref,'DIAN-CONCEPTO-15-2026');
assert.equal(p.cotejo,true);
assert.equal(p.incompleto,false);
assert.match(panel(doc()),/Elegir como texto A/);
assert.match(panel(doc()),/Elegir como texto B/);
assert.match(panel(doc()),/no determina cambios jurídicos/);
assert.equal(panel(doc({tipo_documento:'boletin'})),'');
assert.equal(panel(doc({texto_completo:''})),'');
assert.equal(panel(doc({enlace_oficial:'http://dian.gov.co/dian/compilacion/' })),'');
assert.equal(panel(doc({enlace_oficial:'https://dian.gov.co.evil.invalid/dian/' })),'');
assert.equal(panel(doc({enlace_oficial:'https://user:secret@dian.gov.co/dian/' })),'');
assert.equal(fuenteOficial('javascript:alert(1)'),'');
assert.match(fuenteOficial('https://www.dian.gov.co/recurso'),/^https:\/\/www\.dian\.gov\.co/);
const malicious=panel(doc({id:'"><img src=x onerror=alert(1)>',titulo:'<script>alert(1)</script>'}));
assert.doesNotMatch(malicious,/<img src=x|<script>/);
assert.match(malicious,/&quot;&gt;&lt;img/);
const limited=preparar(doc({texto_completo:'x'.repeat(90000)}));
assert.equal(limited.fragmento.length,2200);
assert.equal(limited.incompleto,true);
const r=marcado('Las operaciones pueden estar exentas','Las operaciones están gravadas');
assert.equal(r.cambios,true);
assert.ok(r.anterior.some(x=>x.cambio&&x.texto==='pueden'));
assert.ok(r.posterior.some(x=>x.cambio&&x.texto==='gravadas'));
const same=marcado('Igual pasaje de texto.','Igual pasaje de texto.');
assert.equal(same.cambios,false);
assert.ok(same.anterior.every(x=>!x.cambio));
assert.ok(same.posterior.every(x=>!x.cambio));
const large=marcado('A '.repeat(500),'B '.repeat(500));
assert.equal(large.recortado,true);
assert.ok(large.anterior.length<=320&&large.posterior.length<=320);
assert.match(css,/@media\(max-width:700px\)/);
assert.match(css,/@media\(max-width:365px\)/);
assert.match(css,/focus-visible/);
assert.match(js,/showModal\(\)/);
assert.match(js,/textContent/);
assert.match(js,/no conclusión jurídica/);
assert.doesNotMatch(js,/fetch\(|localStorage|sessionStorage|SUPABASE_SERVICE_KEY|eval\(/);
console.log('Comparador documental: selección segura, texto A/B, diff, límites, XSS, móvil y bloqueo jurídico OK');
