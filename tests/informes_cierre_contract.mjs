import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
const context={window:{},URL,TextEncoder};
vm.runInNewContext(readFileSync('informes.js','utf8'),context);
const api=context.window.EuclidianInformes;
const exp={formato:'euclidian-expediente-v1',version:1,campos:{},fuentes:[]};
assert.equal(api.extraer(exp).pendientes.length,11,'Seis campos, fuentes y cuatro cotejos pendientes');
assert.match(api.html(exp),/Completar pregunta de investigación/);
assert.match(api.html(exp),/Adjuntar documentos oficiales DIAN/);
const completo={...exp,estado:'aprobado',campos:{titulo:'IVA / Bogotá: revisión 2026',pregunta:'Pregunta',hechos:'Línea uno\r\nLínea dos\rLínea tres\nLínea cuatro',hipotesis:'Hipótesis',salvedades:'Salvedades',conclusion:'Conclusión <script> & "cita"'},fuentes:[{url:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm',ref:'Referencia de prueba',titulo:'Prueba'}]};
assert.equal(api.extraer(completo).pendientes.length,4,'Completar no aprueba la revisión');
for(const tipo of ['tecnico','cliente']){
 assert.match(api.html(completo,tipo),/Obtener revisión profesional/);
 assert.match(api.html(completo,tipo),/Estado: borrador sin revisión/);
 assert.match(api.nombreArchivo(completo,tipo),new RegExp('^euclidian-\\d{4}-\\d{2}-\\d{2}-iva-bogota-revision-2026-'+tipo+'-borrador\\.docx$'));
}
const hostil={...completo,campos:{...completo.campos,titulo:'../../\\:<>',hipotesis:'A\u0000\u0001\u000b\u000c\u001f\ufffe\uffff\ud800B\udfffC\tD 😀'},fuentes:[{...completo.fuentes[0],titulo:'\u0000<svg> & prueba'}]};
assert.match(api.nombreArchivo(hostil),/-sin-titulo-tecnico-borrador\.docx$/);
assert.doesNotMatch(api.html(hostil),/\u0000|<svg>/);
assert.match(api.html(hostil),/ABC\tD 😀/);
assert.throws(()=>api.nombreArchivo(exp,'aprobado'),/Tipo de informe/);
const dir=mkdtempSync(join(tmpdir(),'euclidian-informes-'));
try{
 for(const [name,fixture] of [['completo',completo],['hostil',hostil],['vacio',exp]])writeFileSync(join(dir,name+'.docx'),api.docx(fixture));
 const result=execFileSync('python3',['-c',String.raw`
import sys,zipfile,xml.etree.ElementTree as ET
from pathlib import Path
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
for path in Path(sys.argv[1]).glob('*.docx'):
 with zipfile.ZipFile(path) as z:
  assert z.testzip() is None, 'CRC inválida'
  for part in z.namelist(): ET.fromstring(z.read(part))
  doc=ET.fromstring(z.read('word/document.xml'))
  txt=' '.join(n.text or '' for n in doc.findall('.//w:t',ns))
  assert 'BORRADOR SIN REVISIÓN JURÍDICA' in txt
  assert 'Obtener revisión profesional' in txt
  if path.stem=='completo':
   assert len(doc.findall('.//w:br',ns))==3, 'Saltos de línea perdidos'
   assert 'Conclusión <script> & "cita"' in txt
  if path.stem=='hostil': assert 'ABC\tD 😀' in txt
  styles=ET.fromstring(z.read('word/styles.xml'))
  assert len(styles.findall('.//w:outlineLvl',ns))==2
print('3 DOCX: ZIP CRC, XML válido, saltos y jerarquía accesible OK')
`,dir],{encoding:'utf8'});
 console.log(result.trim());
}finally{rmSync(dir,{recursive:true,force:true});}
console.log('M4 cierre: checklist, borradores, HTML seguro, nombres y OOXML válidos OK');
