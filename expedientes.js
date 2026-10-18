/* EUCLIDIAN · Expediente profesional M3 beta: privado en memoria.
   Sin almacenamiento automático, sin envío de notas al servidor.
   Los archivos exportados son responsabilidad de quien los descarga. */
(function(){
'use strict';
const MAX_CASOS=8,MAX_FUENTES=18,MAX_ARCHIVO=200000;
const coleccion=new Map(),documentos=new Map();
let activo='',contador=0;
const campos={titulo:140,pregunta:1800,hechos:3000,hipotesis:3000,salvedades:3000,conclusion:3000};
const limite=(v,n)=>typeof v==='string'?v.trim().slice(0,n):'';
const escape=v=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const esObjeto=o=>o!==null&&typeof o==='object'&&!Array.isArray(o);
function urlDian(v){
 try{
  const u=new URL(String(v||''));
  if(u.protocol!=='https:'||u.username||u.password||u.port&&u.port!=='443')return '';
  if(u.hostname!=='dian.gov.co'&&!u.hostname.endsWith('.dian.gov.co'))return '';
  if(u.href.length>1600)return '';
  return u.href;
 }catch(_){return '';}
}
function normalizarFuente(v){
 if(!esObjeto(v))return null;
 const url=urlDian(v.url);
 const ref=limite(v.ref,125),titulo=limite(v.titulo,190);
 if(!url||!ref||!titulo)return null;
 return {url,ref,titulo,cotejo:false};
}
function normalizar(v){
 if(!esObjeto(v)||v.formato!=='euclidian-expediente-v1'||v.version!==1||!esObjeto(v.campos)||!Array.isArray(v.fuentes))throw Error('Formato de expediente no reconocido.');
 if(v.fuentes.length>MAX_FUENTES)throw Error('Demasiadas fuentes en el archivo.');
 const limpio={};
 for(const [key,max] of Object.entries(campos)){
  if(v.campos[key]!==undefined&&typeof v.campos[key]!=='string')throw Error('Campo de texto inválido.');
  limpio[key]=limite(v.campos[key]||'',max);
 }
 const fuentes=[];
 for(const item of v.fuentes){
  const fuente=normalizarFuente(item);
  if(!fuente)throw Error('El archivo contiene una fuente inválida o no oficial.');
  if(!fuentes.some(x=>x.url===fuente.url))fuentes.push(fuente);
 }
 return {formato:'euclidian-expediente-v1',version:1,
  campos:limpio,fuentes,estado:'borrador_sin_revision',
  fechaCorte:limite(v.fechaCorte,10)};
}
function nuevo(titulo='Investigación sin título'){
 if(coleccion.size>=MAX_CASOS)throw Error('Máximo de ocho expedientes abiertos. Exporta uno antes de iniciar otro.');
 const id='exp-'+(++contador);
 const registro={id,formato:'euclidian-expediente-v1',version:1,campos:{
  titulo:limite(titulo,140),pregunta:'',hechos:'',hipotesis:'',salvedades:'',conclusion:''
 },fuentes:[],estado:'borrador_sin_revision',fechaCorte:''};
 coleccion.set(id,registro);activo=id;
 render();return id;
}
function seleccionar(id){if(!coleccion.has(id))return false;activo=id;render();return true;}
function actual(){return coleccion.get(activo)||null;}
function agregarFuente(datos){
 const fuente=normalizarFuente(datos);
 if(!fuente)throw Error('La fuente debe tener URL oficial DIAN y referencia.');
 const x=actual();
 if(!x)throw Error('Crea un expediente primero.');
 if(x.fuentes.some(z=>z.url===fuente.url))return false;
 if(x.fuentes.length>=MAX_FUENTES)throw Error('Límite de 18 fuentes por expediente.');
 x.fuentes.push(fuente);render();return true;
}
function removerFuente(indice){const x=actual();if(!x||!Number.isInteger(indice)||indice<0||indice>=x.fuentes.length)return false;x.fuentes.splice(indice,1);render();return true;}
function modificar(campo,valor){
 const x=actual();
 if(!x||!Object.hasOwn(campos,campo)||typeof valor!=='string')return false;
 x.campos[campo]=limite(valor,campos[campo]);return true;
}
function respaldo(){
 const x=actual();if(!x)throw Error('No hay expediente para exportar.');
 return JSON.stringify({formato:'euclidian-expediente-v1',version:1,fechaCorte:new Date().toISOString().slice(0,10),
  campos:x.campos,fuentes:x.fuentes.map(z=>({url:z.url,ref:z.ref,titulo:z.titulo})),
  estado:'borrador_sin_revision'},null,2);
}
function importar(texto){
 if(typeof texto!=='string'||texto.length>MAX_ARCHIVO)throw Error('El archivo supera el límite permitido (200 KB).');
 const obj=normalizar(JSON.parse(texto));
 if(coleccion.size>=MAX_CASOS)throw Error('Máximo de ocho expedientes: exporta o cierra uno antes de importar.');
 const id='exp-'+(++contador);
 coleccion.set(id,{...obj,id});activo=id;render();return id;
}
function informe(){
 const x=actual();if(!x)throw Error('No hay expediente.');
 const c=x.campos;
 return ['EUCLIDIAN · EXPEDIENTE PROFESIONAL — BORRADOR SIN REVISIÓN','',
  'Asunto: '+(c.titulo||'Sin título'),'Fecha de preparación: '+new Date().toISOString().slice(0,10),
  'Estado: BORRADOR; sin revisión jurídica ni firma profesional.','',
  'Pregunta de investigación:',c.pregunta||'[Por completar]','',
  'Hechos a verificar:',c.hechos||'[Por completar]','',
  'Hipótesis / interpretación provisional:',c.hipotesis||'[Por completar]','',
  'Salvedades y excepciones:',c.salvedades||'[Por completar]','',
  'Conclusión propuesta (NO APROBADA):',c.conclusion||'[Por completar]','',
  'DOCUMENTOS DE REFERENCIA (fuentes por comprobar):',
  ...x.fuentes.map((z,i)=>(i+1)+'. '+z.ref+' · '+z.titulo+'\n   '+z.url),
  x.fuentes.length?'':'[Sin fuentes]','',
  'ADVERTENCIA: estas referencias no acreditan por sí mismas vigencia, cambio normativo, obligación, fecha efectiva ni aplicación individual. Verificar pasajes, excepciones y versión oficial con un profesional.'].join('\n');
}
function descargar(texto,nombre,tipo){
 const url=URL.createObjectURL(new Blob([texto],{type:tipo}));
 try{
  const a=document.createElement('a');a.href=url;a.download=nombre;
  document.body.appendChild(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function estado(mensaje){const p=document.getElementById('expEstado');if(p)p.textContent=mensaje;}
function render(){
 if(typeof document==='undefined')return;
 const lista=document.getElementById('expElegir');
 const editor=document.getElementById('expEditor');
 if(!lista||!editor)return;
 const x=actual();
 lista.replaceChildren();
 for(const item of coleccion.values()){
  const o=document.createElement('option');o.value=item.id;o.textContent=item.campos.titulo||'Sin título';lista.appendChild(o);
 }
 if(x)lista.value=x.id;
 lista.disabled=!x;
 editor.hidden=!x;
 const cerrar=document.getElementById('expCerrar');
 if(cerrar)cerrar.disabled=!x;
 for(const b of document.querySelectorAll('[data-exp-export]'))b.disabled=!x;
 if(!x)return;
 for(const [campo] of Object.entries(campos)){
  const input=editor.querySelector('[data-exp-campo="'+campo+'"]');
  if(input&&input.value!==x.campos[campo])input.value=x.campos[campo];
 }
 const fuentes=document.getElementById('expFuentes');
 if(!fuentes)return;
 fuentes.replaceChildren();
 if(!x.fuentes.length){
  const p=document.createElement('p');p.className='exp-vacio';
  p.textContent='Sin fuentes. Agrégalas desde las fichas en Consultar.';fuentes.appendChild(p);
 }
 for(let i=0;i<x.fuentes.length;i++){
  const z=x.fuentes[i],li=document.createElement('li'),a=document.createElement('a'),button=document.createElement('button');
  a.href=z.url;a.target='_blank';a.rel='noopener noreferrer';a.textContent=z.ref+' · '+z.titulo+' ↗';
  button.type='button';button.dataset.expQuitar=String(i);button.textContent='Quitar';
  button.setAttribute('aria-label','Quitar fuente '+z.ref);
  li.append(a,button);fuentes.appendChild(li);
 }
 const cuenta=document.getElementById('expContador');
 if(cuenta)cuenta.textContent=x.fuentes.length+' / '+MAX_FUENTES+' fuentes';
}
function panel(d){
 if(!d||d.tipo_documento==='boletin')return '';
 const id=limite(d.id,120);
 const url=urlDian(d.enlace_oficial);
 if(!id||!url)return '';
 const ref=limite(d.numero_resolucion||d.numero_interno,125);
 const titulo=limite(d.titulo||d.numero_resolucion,190);
 if(!ref||!titulo)return '';
 documentos.set(id,{url,ref,titulo});
 if(documentos.size>200)documentos.delete(documentos.keys().next().value);
 return '<div class="exp-adjuntar"><button type="button" data-exp-adjuntar="'+escape(id)+'">＋ Añadir a expediente</button>'+
  '<small>Guarda la referencia para tu investigación; no determina una obligación.</small></div>';
}
function limpiar(){coleccion.clear();documentos.clear();activo='';contador=0;render();}
if(typeof document!=='undefined'){
 document.addEventListener('input',e=>{
  const f=e.target.closest?.('[data-exp-campo]');
  if(f){modificar(f.dataset.expCampo,f.value);
   if(f.dataset.expCampo==='titulo'){
    const sel=document.getElementById('expElegir');
    if(sel?.selectedOptions[0])sel.selectedOptions[0].textContent=limite(f.value,140)||'Sin título';
   }}
 });
 document.addEventListener('change',async e=>{
  if(e.target.id==='expElegir'){seleccionar(e.target.value);return;}
  if(e.target.id!=='expImportar')return;
  const archivo=e.target.files?.[0];if(!archivo)return;
  try{
   if(archivo.size>MAX_ARCHIVO)throw Error('El archivo supera los 200 KB.');
   const contenido=await archivo.text();importar(contenido);
   estado('Expediente importado como borrador sin revisar. Comprueba las fuentes.');
  }catch(err){estado('No se pudo importar: '+err.message);}
  finally{e.target.value='';}
 });
 document.addEventListener('click',e=>{
  const b=e.target.closest?.('[data-exp-adjuntar],[data-exp-export],[data-exp-quitar],#expNuevo,#expCerrar');
  if(!b)return;
  try{
   if(b.id==='expNuevo'){nuevo();estado('Expediente creado en esta pestaña. Exporta antes de salir.');return;}
   if(b.id==='expCerrar'){
    const x=actual();if(!x)return;
    if(!window.confirm('¿Cerrar este expediente sin guardar automáticamente? Exporta primero si deseas conservarlo.'))return;
    coleccion.delete(x.id);activo=coleccion.keys().next().value||'';render();
    estado('Expediente cerrado y retirado de la memoria de esta pestaña.');return;
   }
   if(b.hasAttribute('data-exp-adjuntar')){
    const doc=documentos.get(b.dataset.expAdjuntar);if(!doc)return;
    if(!actual())nuevo();
    const added=agregarFuente(doc);
    const caja=b.closest('.exp-adjuntar');
    let aviso=caja?.querySelector('.exp-adjuntar-estado');
    if(!aviso&&caja){aviso=document.createElement('span');aviso.className='exp-adjuntar-estado';aviso.setAttribute('role','status');caja.appendChild(aviso);}
    if(aviso)aviso.textContent=added?'Referencia añadida. Revisa tu expediente en Explorar.':'La referencia ya está en el expediente.';
    estado('Fuentes actualizadas. Recuerda exportar antes de salir.');return;
   }
   if(b.hasAttribute('data-exp-quitar')){removerFuente(Number(b.dataset.expQuitar));estado('Referencia quitada del expediente.');return;}
   const tipo=b.dataset.expExport;
   if(tipo==='json'){descargar(respaldo(),'euclidian-expediente-borrador.json','application/json;charset=utf-8');
    estado('Archivo JSON descargado. Guárdalo en un lugar privado.');}
   if(tipo==='txt'){descargar(informe(),'euclidian-informe-borrador.txt','text/plain;charset=utf-8');
    estado('Informe descargado para revisión profesional.');}
  }catch(err){estado(err.message);}
 });
 window.addEventListener('pagehide',()=>{}); // No persistencia implícita en salida.
}
window.EuclidianExpedientes={panel,nuevo,seleccionar,agregarFuente,removerFuente,modificar,respaldo,importar,informe,limpiar,urlDian,estadoActual:actual,normalizar};
})();