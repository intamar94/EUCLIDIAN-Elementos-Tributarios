/* Guía local de investigación. Reglas de preparación, sin modelo de IA ni dictamen. */
(function(){
'use strict';
const MAX_PREGUNTA=600, MAX_CONSULTA=160;
const CONTROLES=[
 ['fuente','Abrí y cotejé la fuente oficial'],
 ['fecha','Comprobé la fecha de publicación y el período aplicable'],
 ['excepciones','Revisé condiciones, excepciones y alcance'],
 ['version','Comparé la versión y sus posibles modificaciones'],
 ['revision','Solicité revisión profesional de la interpretación']
];
const EVIDENCIA_CONTADOR=[
 ['fuente','Registré la fuente oficial DIAN autorizada'],
 ['pasaje','Identifiqué el pasaje o localizador exacto'],
 ['hash','Conservé hash e identificación de la versión o captura']
];
const ESTADOS_CONTADOR=Object.freeze({
 documentado:'Documentado: reservado para evidencia cotejada por un revisor. Esta guía de casillas no puede otorgar ese estado.',
 pendiente_de_cotejo:'Pendiente de cotejo: falta registrar o contrastar evidencia con la fuente DIAN.',
 requiere_revisor:'Requiere revisor: la ficha está completa, pero una persona competente debe verificar fuente, pasaje, hash y alcance.',
 abstencion:'Abstención: se detectó un posible dato no permitido. No se prepara búsqueda ni conclusión.'
});
const PATRONES_DATOS_PROHIBIDOS=[/\b(?:nit|c[eé]dula|contrase(?:ñ|n)a|saldo)\b/iu,/\b(?:correo\s+de\s+cliente|nombre\s+de\s+cliente|documento\s+de\s+identidad)\b/iu,/\b[\w.+-]+@[\w.-]+\.[a-z]{2,}\b/iu,/(?<!\d)(?:\d[ .-]?){9,13}(?!\d)/u];
let raiz=null, pregunta='',consulta='',confirmado=false,abstencion=false;
const checks=new Set();
const evidencia=new Set();
const limpiarTexto=(v,max)=>String(v??'').replace(/\s+/gu,' ').trim().slice(0,max);
function palabras(v){
 const stop=new Set(['como','cómo','para','sobre','puedo','debo','cual','cuál','cuando','cuándo','donde','dónde','tiene','tengo','necesito','quiero','con','del','las','los','una','unos','unas','que','qué','por','esto','esta','este','esa','ese','son','hay','aplica']);
 return [...new Set(limpiarTexto(v,MAX_PREGUNTA).toLocaleLowerCase('es').replace(/[^\p{L}\p{N}\s-]/gu,' ').split(/\s+/u).filter(x=>x.length>2&&!stop.has(x)))].slice(0,14).join(' ').slice(0,MAX_CONSULTA);
}
function pendientes(){return CONTROLES.filter(([id])=>!checks.has(id)).map(([,texto])=>texto);}
function estadoEvidencia(){
 if(abstencion)return 'abstencion';
 if(evidencia.size===EVIDENCIA_CONTADOR.length)return 'requiere_revisor';
 return 'pendiente_de_cotejo';
}
function actualizarEstadoEvidencia(){
 const codigo=estadoEvidencia(),n=raiz?.querySelector('[data-contador-evidencia-actual]');
 if(n){n.textContent=ESTADOS_CONTADOR[codigo];n.setAttribute('data-estado-contador',codigo);}
 return codigo;
}
function hayDatoNoPermitido(texto){return PATRONES_DATOS_PROHIBIDOS.some(patron=>patron.test(texto));}
function abstenerConsulta(){
 abstencion=true;consulta='';confirmado=false;checks.clear();evidencia.clear();
 raiz.querySelector('[data-asistente-sin-datos]').checked=false;
 raiz.querySelector('[data-asistente-consulta]').value='';
 raiz.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);
 raiz.querySelectorAll('[data-contador-evidencia-check]').forEach(n=>n.checked=false);
 raiz.querySelector('[data-asistente-pasos]').hidden=true;
 actualizarEstadoEvidencia();
 aviso('No incluyas datos personales ni confidenciales en la consulta. Se retiró de esta guía local; prepara de nuevo la investigación.');
}
function hoja(){
 return ['EUCLIDIAN · Hoja de investigación · BORRADOR',
 'EUCLIDIAN · Contador de Evidencia. Guía basada en reglas, sin modelo de IA ni respuesta jurídica.',
 'Tema: '+pregunta,'Consulta propuesta: '+consulta,
 'La consulta puede enviarse al buscador solo por tu acción explícita.',
 'Lista autodeclarada por quien investiga; EUCLIDIAN no ha verificado fuentes, fechas, vigencia, citas ni conclusiones.',
 'Estado documental: '+estadoEvidencia()+'. '+ESTADOS_CONTADOR[estadoEvidencia()],
 'Evidencia mínima para una afirmación tributaria: fuente DIAN, pasaje, hash, versión y revisión humana.',
 ...EVIDENCIA_CONTADOR.map(([id,txt])=>(evidencia.has(id)?'[Registrado por quien investiga] ':'[Sin registrar] ')+txt),
 ...CONTROLES.map(([id,txt])=>(checks.has(id)?'[Marcado por el usuario] ':'[Pendiente] ')+txt),
 'Incluso con todas las casillas marcadas, este archivo es un borrador y no acredita aprobación profesional.'].join('\n\n');
}
function el(tag,text,attrs={}){const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;}
function aviso(text){const n=raiz?.querySelector('[data-asistente-estado]');if(n)n.textContent=text;}
function resumen(){
 const n=raiz?.querySelector('[data-asistente-pendientes]');if(!n)return;
 const falta=pendientes();n.textContent=falta.length?falta.length+' comprobaciones pendientes. Ninguna casilla sustituye la revisión de la fuente.':'Lista marcada por ti. La aplicación no ha comprobado la evidencia ni aprobado una conclusión jurídica.';
 actualizarEstadoEvidencia();
}
function generar(){
 const campo=raiz.querySelector('[data-asistente-pregunta]');
 if(hayDatoNoPermitido(campo.value)){campo.value='';pregunta='';abstenerConsulta();return false;}
 pregunta=limpiarTexto(campo.value,MAX_PREGUNTA);campo.value=pregunta;
 confirmado=raiz.querySelector('[data-asistente-sin-datos]').checked;
 if(pregunta.length<8){aviso('Escribe un tema de al menos 8 caracteres.');return false;}
 if(!confirmado){aviso('Confirma que has omitido datos personales y confidenciales.');return false;}
 if(hayDatoNoPermitido(pregunta)){
  abstencion=true;evidencia.clear();checks.clear();campo.value='';pregunta='';consulta='';raiz.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);raiz.querySelectorAll('[data-contador-evidencia-check]').forEach(n=>n.checked=false);raiz.querySelector('[data-asistente-pasos]').hidden=true;actualizarEstadoEvidencia();aviso('No incluyas datos personales, confidenciales ni datos de un cliente. El tema fue retirado de esta guía local.');return false;
 }
 abstencion=false;checks.clear();evidencia.clear();raiz.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);raiz.querySelectorAll('[data-contador-evidencia-check]').forEach(n=>n.checked=false);
 consulta=palabras(pregunta);raiz.querySelector('[data-asistente-consulta]').value=consulta;
 raiz.querySelector('[data-asistente-pasos]').hidden=false;
 aviso(consulta?'Palabras propuestas mediante reglas. Edítalas antes de buscar. Todavía no se ha consultado ninguna fuente.':'No pude extraer palabras útiles. Escribe una consulta antes de buscar.');resumen();return true;
}
function buscar(){
 if(!pregunta||!confirmado||!raiz.querySelector('[data-asistente-sin-datos]').checked||abstencion){aviso('Prepara primero el tema sin datos personales.');return;}
 const campo=raiz.querySelector('[data-asistente-consulta]');
 if(hayDatoNoPermitido(campo.value)){abstenerConsulta();return;}
 consulta=limpiarTexto(campo.value,MAX_CONSULTA);campo.value=consulta;
 if(hayDatoNoPermitido(consulta)){abstenerConsulta();return;}
 if(consulta.length<3){aviso('La consulta debe tener al menos 3 caracteres.');return;}
 if(typeof window.euclidianBuscarTexto!=='function'){aviso('El buscador no está disponible. Copia las palabras al buscador cuando tengas acceso.');return;}
 try{const ok=window.euclidianBuscarTexto(consulta);aviso(ok===true?'Consulta enviada al buscador. Revisa los resultados y abre la fuente oficial; no se ha verificado su contenido.':'El buscador no confirmó la consulta. No se ha comprobado ninguna fuente.');}
 catch(_){aviso('No se pudo abrir la consulta. Conserva estas palabras e inténtalo de nuevo.');}
}
function exportar(){
 if(abstencion){aviso('Prepara primero el tema sin datos personales.');return;}
 if(hayDatoNoPermitido(raiz.querySelector('[data-asistente-consulta]').value)){abstenerConsulta();return;}
 consulta=limpiarTexto(raiz.querySelector('[data-asistente-consulta]').value,MAX_CONSULTA);
 if(hayDatoNoPermitido(consulta)){abstenerConsulta();return;}
 if(!pregunta||!confirmado||!raiz.querySelector('[data-asistente-sin-datos]').checked){aviso('Prepara primero el tema sin datos personales.');return;}
 const blob=new Blob([hoja()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a',null,{href:url,download:'euclidian-investigacion-borrador.txt'});
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);aviso('Borrador descargado en tu dispositivo. No acredita verificación ni revisión profesional.');
}
function limpiar(){pregunta='';consulta='';confirmado=false;abstencion=false;checks.clear();evidencia.clear();if(!raiz)return;raiz.querySelectorAll('textarea,input').forEach(n=>{if(n.type==='checkbox')n.checked=false;else n.value='';});raiz.querySelector('[data-asistente-pasos]').hidden=true;aviso('Guía limpiada. La descarga previa, si existe, permanece en tu dispositivo.');resumen();}
function montar(){
 if(typeof document==='undefined')return false;
 const panel=document.getElementById('asistentePanel');if(!panel)return false;if(panel===raiz&&panel.childNodes.length)return true;raiz=panel;
 panel.classList.add('eu-asistente');panel.replaceChildren();
 panel.append(el('h2','EUCLIDIAN · Contador de Evidencia'),el('p','Agente de investigación guiada: prepara una búsqueda DIAN y ordena evidencia sin modelo de IA, APIs, asesoría ni respuesta jurídica.'));
 const form=el('form',null),label=el('label','1. Describe el tema sin datos personales',{for:'asistentePregunta'}),input=el('textarea',null,{id:'asistentePregunta',rows:'3',maxlength:String(MAX_PREGUNTA),'data-asistente-pregunta':'',placeholder:'Ejemplo: retención en servicios prestados desde el exterior'});
 input.addEventListener('input',()=>{const tema=input.value;limpiar();input.value=tema;aviso('Tema modificado. Prepara de nuevo la investigación para continuar.');});
 const ayuda=el('p','Omite nombres, identificación, NIT, correos, importes o documentos de clientes. El tema permanece en esta pestaña.',{id:'asistenteAyuda',class:'eu-asistente-ayuda'});input.setAttribute('aria-describedby','asistenteAyuda');
 const conf=el('label',null,{class:'eu-asistente-casilla'}),ck=el('input',null,{type:'checkbox','data-asistente-sin-datos':''});conf.append(ck,document.createTextNode('Confirmo que no he incluido datos personales ni confidenciales.'));
 ck.addEventListener('change',()=>{if(!ck.checked){const tema=input.value;limpiar();input.value=tema;aviso('Confirmación retirada. Prepara de nuevo el tema antes de buscar o descargar.');}});
 form.append(label,input,ayuda,conf,el('button','Preparar investigación',{type:'submit'}));form.addEventListener('submit',e=>{e.preventDefault();generar();});panel.append(form);
 const pasos=el('div',null,{'data-asistente-pasos':''});pasos.hidden=true;
 const queryLabel=el('label','2. Revisa las palabras para el buscador',{for:'asistenteConsulta'}),query=el('input',null,{id:'asistenteConsulta',type:'text',maxlength:String(MAX_CONSULTA),'data-asistente-consulta':''});
 query.addEventListener('input',()=>{
  if(hayDatoNoPermitido(query.value)){abstenerConsulta();return;}
  consulta=limpiarTexto(query.value,MAX_CONSULTA);
  if(hayDatoNoPermitido(consulta)){abstenerConsulta();return;}
  checks.clear();evidencia.clear();
  pasos.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);
  pasos.querySelectorAll('[data-contador-evidencia-check]').forEach(n=>n.checked=false);
  resumen();
 });
 const btn=el('button','Buscar estas palabras',{type:'button','data-contador-evidencia-buscar':''});btn.addEventListener('click',buscar);pasos.append(queryLabel,query,el('p','Solo las palabras de este campo se envían al buscador autorizado ya disponible al pulsar Buscar. No uses datos confidenciales.',{class:'eu-asistente-ayuda'}),btn);
 const fieldset=el('fieldset',null);fieldset.append(el('legend','3. Comprueba la evidencia por tu cuenta'));
 for(const[id,txt]of CONTROLES){const lbl=el('label',null,{class:'eu-asistente-casilla'}),check=el('input',null,{type:'checkbox','data-asistente-check':id});check.addEventListener('change',()=>{if(check.checked)checks.add(id);else checks.delete(id);resumen();});lbl.append(check,document.createTextNode(txt));fieldset.append(lbl);}
 const evidenciaFieldset=el('fieldset',null,{'data-contador-evidencia':''});evidenciaFieldset.append(el('legend','4. Contador de evidencia · registra solo lo que ya tienes'));
 for(const[id,txt]of EVIDENCIA_CONTADOR){const lbl=el('label',null,{class:'eu-asistente-casilla'}),check=el('input',null,{type:'checkbox','data-contador-evidencia-check':id});check.addEventListener('change',()=>{if(check.checked)evidencia.add(id);else evidencia.delete(id);actualizarEstadoEvidencia();});lbl.append(check,document.createTextNode(txt));evidenciaFieldset.append(lbl);}
 const estados=el('ul',null,{class:'eu-contador-estados','aria-label':'Estados documentales posibles'});
 for(const[codigo,texto]of Object.entries(ESTADOS_CONTADOR)){const item=el('li',codigo.replaceAll('_',' ')+' · '+texto,{'data-contador-estado':codigo});estados.append(item);}
 const actual=el('p',ESTADOS_CONTADOR.pendiente_de_cotejo,{'data-contador-evidencia-actual':'','data-estado-contador':'pendiente_de_cotejo',role:'status','aria-live':'polite'});
 pasos.append(fieldset,el('p','',{'data-asistente-pendientes':'','aria-live':'polite'}),evidenciaFieldset,el('h3','Estado documental'),estados,actual,el('p','Marcar todas las casillas mantiene el estado requiere revisor. Solicitar una revisión no acredita que haya sido realizada. El filtro local de datos es preventivo y no garantiza detectar toda información confidencial.',{class:'eu-asistente-ayuda'}));const descarga=el('button','Descargar hoja de investigación · borrador',{type:'button'});descarga.addEventListener('click',exportar);pasos.append(descarga);panel.append(pasos);
 const limpiarBtn=el('button','Limpiar guía',{type:'button',class:'eu-asistente-limpiar'});limpiarBtn.addEventListener('click',()=>{limpiar();input.focus();});panel.append(limpiarBtn,el('p','Todavía no se ha consultado ninguna fuente.',{'data-asistente-estado':'',role:'status','aria-live':'polite'}));resumen();return true;
}
window.EuclidianAsistente=Object.freeze({montar,limpiar,palabras,hoja,estadoEvidencia});
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar,{once:true});else montar();}
})();
