/* Herramientas locales: navegación y limpieza; no almacenamiento ni envío. */
(function(){
'use strict';
const modules=()=>[window.EuclidianCartera,window.EuclidianAgenda,window.EuclidianExogena,window.EuclidianAsistente];
const tabs=()=>typeof document==='undefined'?[]:[...document.querySelectorAll('.herramientas-menu [role="tab"]')];
function seleccionar(tab,enfocar=false){
 for(const item of tabs()){
  const selected=item===tab;item.setAttribute('aria-selected',String(selected));item.tabIndex=selected?0:-1;
  const panel=document.getElementById(item.getAttribute('aria-controls'));if(panel)panel.hidden=!selected;
 }
 if(enfocar)tab?.focus();
}
function limpiar(){for(const mod of modules())mod?.limpiar?.();const primero=tabs()[0];if(primero)seleccionar(primero);}
function hayTrabajo(){
 return window.EuclidianExpedientes?.hayCambiosSinExportar?.()||window.EuclidianAgenda?.tieneDatos?.()||(window.EuclidianCartera?.estadoActual?.().length||0)>0||(typeof document!=='undefined'&&!!document.getElementById('asistentePregunta')?.value);
}
function confirmarSalida(){
 return !hayTrabajo()||window.confirm('Tienes trabajo temporal en esta pestaña. Exporta lo que necesites antes de salir. ¿Salir y vaciarlo?');
}
function iniciar(){
 const todos=tabs();
 todos.forEach((tab,i)=>{
  tab.addEventListener('click',()=>seleccionar(tab));
  tab.addEventListener('keydown',e=>{
   let next;
   if(e.key==='ArrowRight')next=(i+1)%todos.length;
   if(e.key==='ArrowLeft')next=(i-1+todos.length)%todos.length;
   if(e.key==='Home')next=0;if(e.key==='End')next=todos.length-1;
   if(next===undefined)return;e.preventDefault();seleccionar(todos[next],true);
  });
 });
}
window.addEventListener?.('beforeunload',e=>{if(hayTrabajo()){e.preventDefault();e.returnValue='';}});
window.EuclidianHerramientas=Object.freeze({limpiar,confirmarSalida});
if(typeof document!=='undefined'){if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();}
})();
