import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync} from 'node:fs';
const js=readFileSync('informes.js','utf8');
const app=readFileSync('app.html','utf8'),expJS=readFileSync('expedientes.js','utf8'),
 css=readFileSync('informes.css','utf8');
const ctx={window:{},URL,Date,TextEncoder,Uint8Array,Uint16Array,DataView,Array,Set};
vm.runInNewContext(js,ctx);
const {extraer,html,docx,fuenteValida}=ctx.window.EuclidianInformes;
const expediente={
 formato:'euclidian-expediente-v1',version:1,estado:'aprobado_falsificado',
 campos:{titulo:'Doctrina del IVA — ejemplo',pregunta:'¿Cuál es el criterio aplicable?',
 hechos:'Caso ficticio sin NIT y sin cifras',hipotesis:'Según una hipótesis, debe comprobarse la excepción.',
 salvedades:'Fecha, sujetos y vigencia todavía por confirmar.',
 conclusion:'Es necesario revisar con las fuentes DIAN antes de asesorar.'},
 fuentes:[{url:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm',
  ref:'DIAN-OFICIO-1-2026',titulo:'Doctrina tributaria',revision_humana:true,cotejo:true}]};
assert.equal(extraer(expediente,'tecnico').secciones.length,5);
assert.equal(extraer(expediente,'cliente').secciones.length,5);
assert.match(extraer(expediente,'cliente').etiqueta,/COMUNICACIÓN AL CLIENTE/);
assert.match(extraer(expediente).advertencia,/BORRADOR SIN REVISIÓN JURÍDICA/);
assert.equal(fuenteValida('https://dian.gov.co.evil.com/documento'),'');
assert.equal(fuenteValida('javascript:alert(1)'),'');
assert.equal(fuenteValida('https://admin:password@normograma.dian.gov.co/docs/x'),'');
assert.throws(()=>html({...expediente,fuentes:[{url:'https://malicioso.invalid/'}]}),/no oficial/i);
assert.throws(()=>docx({},'tecnico'),/expediente EUCLIDIAN válido/i);
assert.throws(()=>html(expediente,'aprobado'),/Tipo de informe no permitido/);
const h=html(expediente,'tecnico');
assert.match(h,/<!doctype html>/i);
assert.match(h,/BORRADOR SIN REVISIÓN JURÍDICA/);
assert.match(h,/Fecha de preparación \(no acredita vigencia\)/);
assert.match(h,/Doctrina del IVA/);
assert.match(h,/DIAN-OFICIO-1-2026/);
assert.match(h,/https:\/\/normograma\.dian\.gov\.co/);
assert.doesNotMatch(h,/\baprobado_falsificado\b/);
assert.doesNotMatch(h,/revision_humana/);
assert.match(html(expediente,'cliente'),/NO ENVIAR SIN REVISIÓN/);
const xss={...expediente,campos:{...expediente.campos,titulo:'<script>alert("XSS")</script>',conclusion:'<img src=x onerror=alert(1)>'},
 fuentes:[{...expediente.fuentes[0],titulo:'<svg onload=alert(1)>'}]};
const vulnerable=html(xss);
assert.doesNotMatch(vulnerable,/<script>|<img src=x|<svg onload/);
assert.match(vulnerable,/&lt;script&gt;/);
assert.match(vulnerable,/&lt;img src=x/);
assert.match(vulnerable,/&lt;svg onload/);
function extraerArchivos(bytes){
 const b=Buffer.from(bytes),files=new Map();let off=0;
 while(off+30<b.length&&b.readUInt32LE(off)===0x04034b50){
  const flags=b.readUInt16LE(off+6);
  assert.equal(flags&0x0008,0,'Sin descriptor externo');
  const n=b.readUInt16LE(off+26),extra=b.readUInt16LE(off+28),len=b.readUInt32LE(off+18);
  const name=b.subarray(off+30,off+30+n).toString('utf8');
  const data=b.subarray(off+30+n+extra,off+30+n+extra+len);
  files.set(name,data.toString('utf8'));off+=30+n+extra+len;
 }
 assert.equal(b.readUInt32LE(off),0x02014b50,'Central ZIP válida');
 return files;
}
const doc=docx(expediente,'tecnico');
assert.ok(doc instanceof Uint8Array);
assert.equal(Buffer.from(doc).readUInt32LE(0),0x04034b50);
const files=extraerArchivos(doc);
for(const name of ['[Content_Types].xml','_rels/.rels','word/document.xml','word/styles.xml','word/_rels/document.xml.rels'])
 assert.ok(files.has(name),'Parte DOCX faltante: '+name);
assert.match(files.get('word/document.xml'),/Doctrina del IVA/);
assert.match(files.get('word/document.xml'),/DIAN-OFICIO-1-2026/);
assert.match(files.get('word/document.xml'),/BORRADOR SIN REVISIÓN JURÍDICA/);
assert.match(files.get('word/styles.xml'),/Heading2/);
assert.match(files.get('word/document.xml'),/<w:hyperlink r:id="fuente1">/);
assert.match(files.get('word/_rels/document.xml.rels'),/Id="fuente1"[^>]+Target="https:\/\/normograma\.dian\.gov\.co\/dian\/compilacion\/docs\/ejemplo\.htm" TargetMode="External"/);
assert.doesNotMatch(extraerArchivos(docx({...expediente,fuentes:[]})).get('word/_rels/document.xml.rels'),/TargetMode="External"/);
const maxFuentes={...expediente,fuentes:Array.from({length:18},(_,i)=>({...expediente.fuentes[0],url:'https://normograma.dian.gov.co/docs/f'+i+'.htm?texto=IVA&version=1'}))};
const maxFiles=extraerArchivos(docx(maxFuentes));
assert.equal((maxFiles.get('word/document.xml').match(/<w:hyperlink /g)||[]).length,18);
assert.equal((maxFiles.get('word/_rels/document.xml.rels').match(/TargetMode="External"/g)||[]).length,18);
assert.match(maxFiles.get('word/_rels/document.xml.rels'),/texto=IVA&amp;version=1/);
for(const exportar of [html,docx])assert.throws(()=>exportar({...maxFuentes,fuentes:[...maxFuentes.fuentes,expediente.fuentes[0]]}),/no se exportará una lista incompleta/);
assert.match(extraerArchivos(docx(xss)).get('word/document.xml'),/&lt;script&gt;/);
assert.doesNotMatch(extraerArchivos(docx(xss)).get('word/document.xml'),/<script>/);
assert.match(extraerArchivos(docx(expediente,'cliente')).get('word/document.xml'),/COMUNICACIÓN AL CLIENTE/);
assert.match(app,/src="\/informes\.js" defer/);
assert.match(app,/href="\/informes\.css"/);
assert.ok(app.indexOf('/informes.js')<app.indexOf('/expedientes.js'));
for(const name of ['pdf','docx','cliente-docx','cliente-pdf'])assert.match(app,new RegExp('data-exp-export="'+name+'"'));
assert.match(expJS,/EuclidianInformes\.descargarWord/);
assert.match(expJS,/EuclidianInformes\.abrirPDF/);
assert.match(css,/@media\(max-width:560px\)/);
assert.doesNotMatch(js,/fetch\(|XMLHttpRequest|sendBeacon|localStorage|sessionStorage|SUPABASE_SERVICE_KEY|cdn\.jsdelivr|https:\/\/fonts/);
console.log('Informes M4: HTML imprimible, DOCX ZIP/OOXML, Word cliente, citas, XSS, no aprobación y privacidad OK');
