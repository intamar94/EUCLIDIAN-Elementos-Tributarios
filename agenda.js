/* EUCLIDIAN · M6: tareas manuales de investigación, exclusivamente en memoria. */
(function(){
'use strict';
const MAX=40,items=new Map();let secuencia=0,mensaje='';
const texto=(v,max)=>typeof v==='string'?v.trim().slice(0,max):'';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
function fechaValida(v){
 if(typeof v!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(v))return false;
 const [y,m,d]=v.split('-').map(Number);
 if(y<1900||y>9998||m<1||m>12||d<1)return false;
 return d<=new Date(Date.UTC(y,m,0)).getUTCDate();
}
function fuente(v){
 try{const u=new URL(v);if(u.protocol!=='https:'||u.username||u.password||(u.port&&u.port!=='443')||u.href.length>1600)return '';
 if(u.hostname!=='dian.gov.co'&&!u.hostname.endsWith('.dian.gov.co'))return '';return u.href;}catch(_){return '';}
}
function normalizar(v){
 if(!v||typeof v!=='object')throw Error('Completa la tarea y su fuente oficial.');
 const titulo=texto(v.titulo,140),fecha=v.fecha,referencia=texto(v.referencia,180),url=fuente(v.url);
 if(!titulo||!referencia||!url)throw Error('Indica una tarea, una referencia y un enlace HTTPS de dian.gov.co.');
 if(!fechaValida(fecha))throw Error('Elige una fecha válida entre los años 1900 y 9998.');
 return {titulo,fecha,referencia,url,completada:false};
}
function agregar(v){const x=normalizar(v);if(items.size>=MAX)throw Error('Máximo de 40 tareas. Exporta y elimina las que ya no necesites.');const id='agenda-'+(++secuencia);items.set(id,{id,...x});render();return id;}
function listar(){return [...items.values()].sort((a,b)=>a.fecha.localeCompare(b.fecha)||a.id.localeCompare(b.id)).map(x=>({...x}));}
function completar(id,valor){if(!items.has(id)||typeof valor!=='boolean')return false;items.get(id).completada=valor;render();return true;}
function eliminar(id){const ok=items.delete(id);render();return ok;}
function tieneDatos(){
 if(items.size)return true;
 const formulario=document.getElementById('agendaFormulario');
 return !!formulario&&['titulo','fecha','referencia','url'].some(k=>String(formulario.elements[k]?.value||'').trim().length>0);
}
function limpiar(){items.clear();secuencia=0;document.getElementById('agendaFormulario')?.reset();mensaje='Agenda vaciada. No se guardaron datos en el servidor.';render();}
// Prefix even whitespace-separated formula triggers: spreadsheet programs may strip it.
function celdaCSV(v){let s=String(v).replace(/[\r\n]+/g,' ');if(/^[\s]*[=+\-@\t]/.test(s))s="'"+s;return '"'+s.replace(/"/g,'""')+'"';}
function csv(){return '\uFEFF'+[['Tarea de investigación','Fecha elegida por el usuario','Referencia DIAN','URL oficial','Estado'],...listar().map(x=>[x.titulo,x.fecha,x.referencia,x.url,x.completada?'Completada':'Pendiente'])].map(row=>row.map(celdaCSV).join(',')).join('\r\n')+'\r\n';}
function descargar(){if(!items.size){mensaje='Añade una tarea antes de exportar.';render();return;}const blob=new Blob([csv()],{type:'text/csv;charset=utf-8'}),url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='euclidian-agenda-investigacion.csv';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);mensaje='CSV descargado. Contiene fechas elegidas por ti, sin validación de vencimientos legales.';render();}
function render(){
 const p=document.getElementById('agendaPanel');if(!p)return;
 const foco=document.activeElement?.id;
 const previo=p.querySelector('#agendaFormulario');
 const borrador=previo?Object.fromEntries(['titulo','fecha','referencia','url'].map(k=>[k,previo.elements[k].value])):null;
 p.innerHTML=`<section class="agenda" aria-labelledby="agendaTitulo"><h2 id="agendaTitulo">Agenda de investigación</h2><p>Organiza revisiones con una <strong>fecha elegida por ti</strong> y una referencia DIAN. No calcula ni certifica vencimientos tributarios.</p><p class="agenda-aviso">Solo en esta pestaña: al recargar o salir se pierden las tareas. Exporta el CSV para conservarlas. No escribas NIT, nombres de clientes ni otros datos personales.</p><form id="agendaFormulario"><label for="agendaTarea">Tarea de investigación</label><input id="agendaTarea" name="titulo" maxlength="140" required placeholder="Ej.: revisar el texto de una resolución"><label for="agendaFecha">Fecha elegida por ti</label><input id="agendaFecha" name="fecha" type="date" min="1900-01-01" max="9998-12-31" required><label for="agendaReferencia">Referencia DIAN</label><input id="agendaReferencia" name="referencia" maxlength="180" required placeholder="Número y título del documento"><label for="agendaUrl">Enlace oficial DIAN</label><input id="agendaUrl" name="url" type="url" maxlength="1600" required placeholder="https://www.dian.gov.co/…"><p>El dominio del enlace se comprueba. Abre la fuente para verificar su contenido y la fecha aplicable.</p><button type="submit">Añadir tarea</button><p id="agendaError" role="alert"></p></form><div class="agenda-acciones"><button id="agendaExportar" type="button" ${items.size?'':'disabled'}>Exportar CSV</button><button id="agendaVaciar" type="button" ${items.size?'':'disabled'}>Vaciar agenda</button><span>${items.size} de ${MAX} tareas</span></div><p id="agendaEstado" role="status" aria-live="polite">${esc(mensaje)}</p>${items.size?'<ul class="agenda-lista">'+listar().map(x=>`<li><label class="agenda-tarea"><input id="agendaCheck-${esc(x.id)}" type="checkbox" data-completar="${esc(x.id)}" ${x.completada?'checked':''}><span>${esc(x.titulo)} <strong>${x.completada?'Completada':'Pendiente'}</strong></span></label><p>Fecha elegida: <time datetime="${esc(x.fecha)}">${esc(x.fecha)}</time></p><a href="${esc(x.url)}" target="_blank" rel="noopener noreferrer">${esc(x.referencia)} · Abrir fuente DIAN</a><button id="agendaEliminar-${esc(x.id)}" type="button" data-eliminar="${esc(x.id)}" aria-label="Eliminar tarea: ${esc(x.titulo)}">Eliminar</button></li>`).join('')+'</ul>':'<p class="agenda-vacia">Aún no hay tareas. Añade una revisión con su fuente oficial.</p>'}</section>`;
 p.querySelector('#agendaFormulario').addEventListener('submit',e=>{e.preventDefault();const f=e.currentTarget;try{agregar({titulo:f.elements.titulo.value,fecha:f.elements.fecha.value,referencia:f.elements.referencia.value,url:f.elements.url.value});document.getElementById('agendaFormulario')?.reset();document.getElementById('agendaTarea')?.focus();}catch(err){const el=document.getElementById('agendaError');el.textContent=err.message;}});
 if(borrador)for(const [k,v] of Object.entries(borrador))p.querySelector('#agendaFormulario').elements[k].value=v;
 p.querySelector('#agendaExportar').addEventListener('click',descargar);
 p.querySelector('#agendaVaciar').addEventListener('click',()=>{if(window.confirm('¿Vaciar las tareas de esta pestaña? Exporta antes si quieres conservarlas.')){limpiar();document.getElementById('agendaTarea')?.focus();}});
 p.querySelectorAll('[data-completar]').forEach(el=>el.addEventListener('change',()=>completar(el.dataset.completar,el.checked)));
 p.querySelectorAll('[data-eliminar]').forEach(el=>el.addEventListener('click',()=>{eliminar(el.dataset.eliminar);document.getElementById('agendaTarea')?.focus();}));
 if(foco?.startsWith('agendaCheck-'))document.getElementById(foco)?.focus();
}
window.EuclidianAgenda=Object.freeze({agregar,listar,completar,eliminar,limpiar,csv,fechaValida,render,tieneDatos});
window.addEventListener('beforeunload',e=>{if(tieneDatos()){e.preventDefault();e.returnValue='';}});
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render);else render();
})();
