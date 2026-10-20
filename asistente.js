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
let raiz=null, pregunta='',consulta='',confirmado=false;
const checks=new Set();
const limpiarTexto=(v,max)=>String(v??'').replace(/\s+/gu,' ').trim().slice(0,max);
function palabras(v){
 const stop=new Set(['como','cómo','para','sobre','puedo','debo','cual','cuál','cuando','cuándo','donde','dónde','tiene','tengo','necesito','quiero','con','del','las','los','una','unos','unas','que','qué','por','esto','esta','este','esa','ese','son','hay','aplica']);
 return [...new Set(limpiarTexto(v,MAX_PREGUNTA).toLocaleLowerCase('es').replace(/[^\p{L}\p{N}\s-]/gu,' ').split(/\s+/u).filter(x=>x.length>2&&!stop.has(x)))].slice(0,14).join(' ').slice(0,MAX_CONSULTA);
}
function pendientes(){return CONTROLES.filter(([id])=>!checks.has(id)).map(([,texto])=>texto);}
function hoja(){
 return ['EUCLIDIAN · Hoja de investigación · BORRADOR',
 'Guía basada en reglas. Sin modelo de IA ni respuesta jurídica.',
 'Tema: '+pregunta,'Consulta propuesta: '+consulta,
 'La consulta puede enviarse al buscador solo por tu acción explícita.',
 'Lista autodeclarada por quien investiga; EUCLIDIAN no ha verificado fuentes, fechas, vigencia, citas ni conclusiones.',
 ...CONTROLES.map(([id,txt])=>(checks.has(id)?'[Marcado por el usuario] ':'[Pendiente] ')+txt),
 'Incluso con todas las casillas marcadas, este archivo es un borrador y no acredita aprobación profesional.'].join('\n\n');
}
function el(tag,text,attrs={}){const n=document.createElement(tag);if(text!==null)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;}
function aviso(text){const n=raiz?.querySelector('[data-asistente-estado]');if(n)n.textContent=text;}
function resumen(){
 const n=raiz?.querySelector('[data-asistente-pendientes]');if(!n)return;
 const falta=pendientes();n.textContent=falta.length?falta.length+' comprobaciones pendientes. Ninguna casilla sustituye la revisión de la fuente.':'Lista marcada por ti. La aplicación no ha comprobado la evidencia ni aprobado una conclusión jurídica.';
}
function generar(){
 const campo=raiz.querySelector('[data-asistente-pregunta]');pregunta=limpiarTexto(campo.value,MAX_PREGUNTA);campo.value=pregunta;
 confirmado=raiz.querySelector('[data-asistente-sin-datos]').checked;
 if(pregunta.length<8){aviso('Escribe un tema de al menos 8 caracteres.');return false;}
 if(!confirmado){aviso('Confirma que has omitido datos personales y confidenciales.');return false;}
 checks.clear();raiz.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);
 consulta=palabras(pregunta);raiz.querySelector('[data-asistente-consulta]').value=consulta;
 raiz.querySelector('[data-asistente-pasos]').hidden=false;
 aviso(consulta?'Palabras propuestas mediante reglas. Edítalas antes de buscar. Todavía no se ha consultado ninguna fuente.':'No pude extraer palabras útiles. Escribe una consulta antes de buscar.');resumen();return true;
}
function buscar(){
 const campo=raiz.querySelector('[data-asistente-consulta]');consulta=limpiarTexto(campo.value,MAX_CONSULTA);campo.value=consulta;
 if(consulta.length<3){aviso('La consulta debe tener al menos 3 caracteres.');return;}
 if(typeof window.euclidianBuscarTexto!=='function'){aviso('El buscador no está disponible. Copia las palabras al buscador cuando tengas acceso.');return;}
 try{const ok=window.euclidianBuscarTexto(consulta);aviso(ok===true?'Consulta enviada al buscador. Revisa los resultados y abre la fuente oficial; no se ha verificado su contenido.':'El buscador no confirmó la consulta. No se ha comprobado ninguna fuente.');}
 catch(_){aviso('No se pudo abrir la consulta. Conserva estas palabras e inténtalo de nuevo.');}
}
function exportar(){
 consulta=limpiarTexto(raiz.querySelector('[data-asistente-consulta]').value,MAX_CONSULTA);
 if(!pregunta||!confirmado){aviso('Prepara primero el tema sin datos personales.');return;}
 const blob=new Blob([hoja()],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob),a=el('a',null,{href:url,download:'euclidian-investigacion-borrador.txt'});
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);aviso('Borrador descargado en tu dispositivo. No acredita verificación ni revisión profesional.');
}
function limpiar(){pregunta='';consulta='';confirmado=false;checks.clear();if(!raiz)return;raiz.querySelectorAll('textarea,input').forEach(n=>{if(n.type==='checkbox')n.checked=false;else n.value='';});raiz.querySelector('[data-asistente-pasos]').hidden=true;aviso('Guía limpiada. La descarga previa, si existe, permanece en tu dispositivo.');resumen();}
function montar(){
 if(typeof document==='undefined')return false;
 const panel=document.getElementById('asistentePanel');if(!panel)return false;if(panel===raiz&&panel.childNodes.length)return true;raiz=panel;
 panel.classList.add('eu-asistente');panel.replaceChildren();
 panel.append(el('h2','Guía de investigación'),el('p','Prepara una búsqueda y organiza sus comprobaciones. Guía basada en reglas, sin modelo de IA ni respuesta jurídica.'));
 const form=el('form',null),label=el('label','1. Describe el tema sin datos personales',{for:'asistentePregunta'}),input=el('textarea',null,{id:'asistentePregunta',rows:'3',maxlength:String(MAX_PREGUNTA),'data-asistente-pregunta':'',placeholder:'Ejemplo: retención en servicios prestados desde el exterior'});
 input.addEventListener('input',()=>{pregunta='';consulta='';confirmado=false;checks.clear();const anterior=raiz.querySelector('[data-asistente-pasos]');if(anterior)anterior.hidden=true;aviso('Tema modificado. Prepara de nuevo la investigación para continuar.');});
 const ayuda=el('p','Omite nombres, identificación, NIT, correos, importes o documentos de clientes. El tema permanece en esta pestaña.',{id:'asistenteAyuda',class:'eu-asistente-ayuda'});input.setAttribute('aria-describedby','asistenteAyuda');
 const conf=el('label',null,{class:'eu-asistente-casilla'}),ck=el('input',null,{type:'checkbox','data-asistente-sin-datos':''});conf.append(ck,document.createTextNode('Confirmo que no he incluido datos personales ni confidenciales.'));
 form.append(label,input,ayuda,conf,el('button','Preparar investigación',{type:'submit'}));form.addEventListener('submit',e=>{e.preventDefault();generar();});panel.append(form);
 const pasos=el('div',null,{'data-asistente-pasos':''});pasos.hidden=true;
 const queryLabel=el('label','2. Revisa las palabras para el buscador',{for:'asistenteConsulta'}),query=el('input',null,{id:'asistenteConsulta',type:'text',maxlength:String(MAX_CONSULTA),'data-asistente-consulta':''});
 query.addEventListener('input',()=>{consulta=limpiarTexto(query.value,MAX_CONSULTA);checks.clear();pasos.querySelectorAll('[data-asistente-check]').forEach(n=>n.checked=false);resumen();});
 const btn=el('button','Buscar estas palabras',{type:'button'});btn.addEventListener('click',buscar);pasos.append(queryLabel,query,el('p','Solo las palabras de este campo se envían al buscador al pulsar Buscar. No uses datos confidenciales.',{class:'eu-asistente-ayuda'}),btn);
 const fieldset=el('fieldset',null);fieldset.append(el('legend','3. Comprueba la evidencia por tu cuenta'));
 for(const[id,txt]of CONTROLES){const lbl=el('label',null,{class:'eu-asistente-casilla'}),check=el('input',null,{type:'checkbox','data-asistente-check':id});check.addEventListener('change',()=>{if(check.checked)checks.add(id);else checks.delete(id);resumen();});lbl.append(check,document.createTextNode(txt));fieldset.append(lbl);}
 pasos.append(fieldset,el('p','',{'data-asistente-pendientes':'','aria-live':'polite'}));const descarga=el('button','Descargar hoja de investigación · borrador',{type:'button'});descarga.addEventListener('click',exportar);pasos.append(descarga);panel.append(pasos);
 const limpiarBtn=el('button','Limpiar guía',{type:'button',class:'eu-asistente-limpiar'});limpiarBtn.addEventListener('click',()=>{limpiar();input.focus();});panel.append(limpiarBtn,el('p','Todavía no se ha consultado ninguna fuente.',{'data-asistente-estado':'',role:'status','aria-live':'polite'}));resumen();return true;
}
window.EuclidianAsistente=Object.freeze({montar,limpiar,palabras,hoja});
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',montar,{once:true});else montar();}
})();
