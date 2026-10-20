/* M7 · Laboratorio genérico y ficticio. No verifica formatos DIAN ni obligaciones fiscales.
   Los datos se procesan en memoria. No usa red, cookies ni almacenamiento persistente. */
(function () {
'use strict';
const MAX_BYTES=200000, MAX_FILAS=1000, MAX_ERRORES=100;
const CABECERA=['fila_id','concepto_ficticio','importe'];
const EJEMPLO='fila_id,concepto_ficticio,importe\r\nDEMO-001,DEMO_SERVICIO,1250.00\r\nDEMO-002,DEMO_BIEN,80.50\r\n';
let generacion=0;
function parsearCSV(texto) {
 if(typeof texto!=='string')throw Error('Selecciona un CSV de texto UTF-8.');
 if(new TextEncoder().encode(texto).length>MAX_BYTES)throw Error('El archivo supera 200 KB.');
 texto=texto.replace(/^\uFEFF/,'');
 const filas=[]; let celdas=[],celda='',comillas=false,cerrada=false,linea=1,inicio=1;
 const guardarCelda=()=>{celdas.push(celda);celda='';cerrada=false;if(celdas.length>20)throw Error('Demasiadas columnas: usa las tres columnas del ejemplo.');};
 const guardarFila=()=>{guardarCelda();if(celdas.length!==1||celdas[0]!=='')filas.push({numero:inicio,celdas});celdas=[];if(filas.length>MAX_FILAS+1)throw Error('El laboratorio admite hasta 1000 registros.');};
 for(let i=0;i<texto.length;i++){
  const c=texto[i];
  if(comillas){
   if(c==='"'){if(texto[i+1]==='"'){celda+='"';i++;}else{comillas=false;cerrada=true;}}
   else{celda+=c;if(c==='\n')linea++;else if(c==='\r'&&texto[i+1]!=='\n')linea++;}
   continue;
  }
  if(c===','){guardarCelda();continue;}
  if(c==='\r'||c==='\n'){guardarFila();if(c==='\r'&&texto[i+1]==='\n')i++;linea++;inicio=linea;continue;}
  if(cerrada)throw Error('CSV mal formado en la línea '+linea+': hay caracteres después de cerrar comillas.');
  if(c==='"'){if(celda!=='')throw Error('CSV mal formado en la línea '+linea+': comillas dentro de una celda sin escapar.');comillas=true;}
  else celda+=c;
 }
 if(comillas)throw Error('CSV mal formado: falta cerrar comillas.');
 if(celdas.length||celda!==''||cerrada)guardarFila();
 return filas;
}
function revisar(texto){
 const filas=parsearCSV(texto),errores=[];let totalErrores=0;
 const error=(fila,campo,motivo,correccion)=>{totalErrores++;if(errores.length<MAX_ERRORES)errores.push({fila,campo,motivo,correccion});};
 if(!filas.length){error(1,'encabezados','Archivo vacío.','Descarga el ejemplo ficticio y conserva su primera fila.');return {registros:0,errores,totalErrores,valido:false};}
 const encabezados=filas[0].celdas;
 if(encabezados.length!==3||encabezados.some((v,i)=>v!==CABECERA[i])){
  error(filas[0].numero,'encabezados','Los encabezados no coinciden con el esquema del laboratorio.','Usa exactamente fila_id,concepto_ficticio,importe en ese orden, separados por comas.');
  return {registros:filas.length-1,errores,totalErrores,valido:false};
 }
 const vistos=new Set();
 for(const fila of filas.slice(1)){
  const c=fila.celdas;
  if(c.length!==3){error(fila.numero,'columnas','Cantidad de columnas inconsistente.','Cada registro debe contener tres celdas separadas por comas.');continue;}
  for(let i=0;i<c.length;i++)if(/^[\s\uFEFF]*[=+@-]/u.test(c[i]))error(fila.numero,CABECERA[i],'Posible fórmula de hoja de cálculo.','Sustituye la fórmula por un valor ficticio literal del esquema.');
  if(!/^DEMO-\d{3}$/.test(c[0]))error(fila.numero,'fila_id','Identificador ajeno al esquema ficticio.','Usa DEMO- seguido de tres cifras, por ejemplo DEMO-001. No introduzcas NIT ni documentos personales.');
  if(vistos.has(c[0]))error(fila.numero,'fila_id','Identificador técnico repetido.','Asigna un identificador DEMO distinto a cada fila.');
  vistos.add(c[0]);
  if(!['DEMO_SERVICIO','DEMO_BIEN'].includes(c[1]))error(fila.numero,'concepto_ficticio','Concepto ajeno al catálogo ficticio.','Usa únicamente DEMO_SERVICIO o DEMO_BIEN.');
  if(!/^(0|[1-9]\d{0,11})\.\d{2}$/.test(c[2]))error(fila.numero,'importe','Importe decimal inválido para este ejercicio.','Usa un importe no negativo con punto y dos decimales, sin separadores de miles: 1250.00. Máximo 12 cifras enteras.');
 }
 if(filas.length===1)error(filas[0].numero,'registros','El archivo solo contiene encabezados.','Añade al menos un registro ficticio siguiendo el ejemplo.');
 return {registros:filas.length-1,errores,totalErrores,valido:totalErrores===0};
}
function revisarBytes(bytes){
 if(bytes.byteLength>MAX_BYTES)throw Error('El archivo supera 200 KB.');
 let texto;
 try{texto=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}
 catch{throw Error('El archivo no es UTF-8 válido. Exporta el CSV como UTF-8 y vuelve a cargarlo.');}
 return revisar(texto);
}
function nodo(etiqueta,texto,clase){const e=document.createElement(etiqueta);if(texto!==undefined)e.textContent=texto;if(clase)e.className=clase;return e;}
function limpiar(){
 generacion++;
 const raiz=document.getElementById('exogenaPanel');if(!raiz)return;
 const entrada=raiz.querySelector('input[type=file]');if(entrada)entrada.value='';
 const resultado=raiz.querySelector('[data-exogena-resultados]');if(resultado)resultado.replaceChildren();
 const estado=raiz.querySelector('[data-exogena-estado]');if(estado)estado.textContent='Datos del ejercicio borrados de esta vista.';
}
function mostrar(raiz,revision){
 const destino=raiz.querySelector('[data-exogena-resultados]');destino.replaceChildren();
 const estado=raiz.querySelector('[data-exogena-estado]');
 estado.textContent=revision.valido?revision.registros+' registros sin errores estructurales en el esquema ficticio. Esto no acredita cumplimiento tributario.':revision.registros+' registros revisados; '+revision.totalErrores+' observaciones. Corrige el CSV y vuelve a cargarlo.';
 if(!revision.errores.length)return;
 if(revision.totalErrores>MAX_ERRORES)destino.appendChild(nodo('p','Se muestran las primeras 100 observaciones.'));
 const envoltura=nodo('div',undefined,'exogena-tabla');envoltura.tabIndex=0;envoltura.setAttribute('role','region');envoltura.setAttribute('aria-label','Observaciones del CSV; desplaza para consultar todas las columnas');
 const tabla=nodo('table');tabla.appendChild(nodo('caption','Revisión estructural: línea física del archivo, campo y corrección'));
 const cabeza=nodo('thead'),tr=nodo('tr');for(const titulo of ['Línea','Campo','Observación','Cómo corregir']){const th=nodo('th',titulo);th.scope='col';tr.appendChild(th);}cabeza.appendChild(tr);tabla.appendChild(cabeza);
 const cuerpo=nodo('tbody');for(const e of revision.errores){const fila=nodo('tr');for(const v of [e.fila,e.campo,e.motivo,e.correccion])fila.appendChild(nodo('td',String(v)));cuerpo.appendChild(fila);}tabla.appendChild(cuerpo);envoltura.appendChild(tabla);destino.appendChild(envoltura);
}
function panel(){
 const raiz=document.getElementById('exogenaPanel');if(!raiz||raiz.dataset.exogenaMontado)return;
 raiz.dataset.exogenaMontado='1';raiz.classList.add('exogena-lab');
 const h=nodo('h2','Laboratorio CSV ficticio');raiz.appendChild(h);
 raiz.appendChild(nodo('p','Practica la revisión de estructura con datos inventados. No es un formato DIAN, una validación tributaria ni una presentación de información exógena.','exogena-aviso'));
 raiz.appendChild(nodo('p','Solo admite fila_id (DEMO-001), concepto_ficticio (DEMO_SERVICIO o DEMO_BIEN) e importe no negativo (1250.00). CSV UTF-8, separado por comas, hasta 200 KB y 1000 registros. No cargues datos de clientes, NIT ni documentos personales.'));
 raiz.appendChild(nodo('p','El contenido se procesa en esta pestaña, sin enviarlo ni guardarlo automáticamente. Se elimina al limpiar, salir de la cuenta o recargar. La descarga del ejemplo sí crea un archivo en tu dispositivo.'));
 const botones=nodo('div',undefined,'exogena-acciones'),ejemplo=nodo('button','Descargar ejemplo ficticio'),borrar=nodo('button','Limpiar ejercicio');ejemplo.type=borrar.type='button';
 ejemplo.addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([EJEMPLO],{type:'text/csv;charset=utf-8'}));const enlace=nodo('a');enlace.href=url;enlace.download='euclidian-ejemplo-ficticio.csv';document.body.appendChild(enlace);enlace.click();enlace.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);});
 borrar.addEventListener('click',limpiar);botones.append(ejemplo,borrar);raiz.appendChild(botones);
 const etiqueta=nodo('label','Cargar CSV exclusivamente ficticio');etiqueta.htmlFor='exogenaArchivo';const entrada=nodo('input');entrada.id='exogenaArchivo';entrada.type='file';entrada.accept='.csv,text/csv';
 const estado=nodo('p','Descarga el ejemplo para comenzar.');estado.dataset.exogenaEstado='';estado.setAttribute('role','status');estado.setAttribute('aria-live','polite');const resultado=nodo('div');resultado.dataset.exogenaResultados='';
 entrada.addEventListener('change',async()=>{
  const turno=++generacion,archivo=entrada.files&&entrada.files[0];resultado.replaceChildren();if(!archivo)return;
  estado.textContent='Revisando estructura localmente…';
  try{if(archivo.size>MAX_BYTES)throw Error('El archivo supera 200 KB.');const bytes=new Uint8Array(await archivo.arrayBuffer());if(turno!==generacion)return;mostrar(raiz,revisarBytes(bytes));}
  catch(e){if(turno===generacion)estado.textContent=e.message;}
  finally{if(turno===generacion)entrada.value='';}
 });
 raiz.append(etiqueta,entrada,estado,resultado);
}
window.EuclidianExogena={panel,limpiar,revisar,revisarBytes,parsearCSV,ejemplo:EJEMPLO};
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',panel);else panel();
})();
