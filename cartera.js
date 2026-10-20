/* M5 · Preferencias anónimas de lectura, solo durante esta sesión. */
(function(){
'use strict';
const TEMAS=Object.freeze({renta:'Renta',iva:'IVA',retencion:'Retención en la fuente',facturacion:'Facturación electrónica',nomina_electronica:'Nómina electrónica',exogena:'Información exógena',simple:'Régimen SIMPLE',contabilidad:'Contabilidad y NIIF',devoluciones:'Devoluciones',sanciones:'Sanciones',aduanero:'Aduanero',recursos:'Recursos y defensa'});
const MAX_PERFILES=8,MAX_TEMAS=3,perfiles=new Map();
let secuencia=0,editando='',estado='';
const escapar=x=>String(x).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function temasValidos(temas){
 if(!Array.isArray(temas)||temas.length<1||temas.length>MAX_TEMAS||temas.some(t=>typeof t!=='string'||!Object.hasOwn(TEMAS,t)))throw Error('Escoge entre uno y tres temas de la lista.');
 const unicos=[...new Set(temas)];
 if(unicos.length!==temas.length)throw Error('Cada tema debe aparecer una sola vez.');
 return unicos;
}
function nuevo(temas){
 const seleccion=temasValidos(temas);
 if(perfiles.size>=MAX_PERFILES)throw Error('Puedes abrir hasta ocho perfiles de lectura. Elimina uno para crear otro.');
 const numero=++secuencia,id='lectura-'+numero;
 perfiles.set(id,{id,alias:'Lectura '+numero,temas:seleccion});
 estado='Perfil creado para esta sesión.';render();return id;
}
function actualizar(id,temas){
 if(!perfiles.has(id))return false;
 perfiles.get(id).temas=temasValidos(temas);editando='';estado='Preferencias actualizadas.';render();return true;
}
function eliminar(id){
 if(!perfiles.delete(id))return false;
 if(editando===id)editando='';
 estado='Perfil eliminado de esta sesión.';render();return true;
}
function consulta(id){
 const perfil=perfiles.get(id);
 return perfil?perfil.temas.map(t=>TEMAS[t]).join(' '):'';
}
function buscar(id){
 const q=consulta(id);
 if(!q)return false;
 let aceptada=false;
 try{aceptada=typeof window.euclidianBuscarTexto==='function'&&window.euclidianBuscarTexto(q)===true;}catch(_){aceptada=false;}
 estado=aceptada?'Consulta enviada. Revisa los resultados y sus fuentes; una coincidencia no acredita una obligación.':'La consulta requiere acceso disponible. Puedes seguir organizando las preferencias de lectura.';
 const mensaje=typeof document!=='undefined'?document.getElementById('carteraEstado'):null;
 if(mensaje)mensaje.textContent=estado;
 return aceptada;
}
function estadoActual(){return [...perfiles.values()].map(p=>({...p,temas:[...p.temas]}));}
function limpiar(){perfiles.clear();secuencia=0;editando='';estado='';render();}
function foco(id){const el=document.getElementById(id);if(el)el.focus();}
function render(){
 if(typeof document==='undefined')return;
 const panel=document.getElementById('carteraPanel');if(!panel)return;
 const activo=perfiles.get(editando),seleccion=activo?activo.temas:[];
 panel.innerHTML='<div class="cartera-local"><h2 id="carteraTitulo">Perfiles de lectura</h2><p id="carteraAyuda">Organiza temas de investigación con alias automáticos. Solo se conservan en esta sesión; se borran al salir o recargar. No introduzcas clientes, NIT, importes ni datos personales.</p><p class="cartera-aviso">Son preferencias de lectura: no generan alertas, correos ni obligaciones tributarias.</p><form id="carteraFormulario" aria-describedby="carteraAyuda"><fieldset><legend>'+ (activo?'Editar '+escapar(activo.alias):'Nuevo perfil') +' · elige de uno a tres temas</legend><div class="cartera-temas">'+Object.entries(TEMAS).map(([id,label])=>'<label><input type="checkbox" name="carteraTema" value="'+id+'"'+(seleccion.includes(id)?' checked':'')+'>'+escapar(label)+'</label>').join('')+'</div></fieldset><div class="cartera-acciones"><button type="submit">'+(activo?'Guardar preferencias':'Crear perfil')+'</button>'+(activo?'<button type="button" id="carteraCancelar">Cancelar edición</button>':'')+'</div></form><p id="carteraEstado" role="status" aria-live="polite">'+escapar(estado)+'</p><p>'+perfiles.size+' de '+MAX_PERFILES+' perfiles en esta sesión.</p><ul class="cartera-lista">'+[...perfiles.values()].map(p=>'<li><h3>'+escapar(p.alias)+'</h3><p>'+p.temas.map(t=>escapar(TEMAS[t])).join(' · ')+'</p><p class="cartera-consulta">Consulta: '+escapar(consulta(p.id))+'</p><div class="cartera-acciones"><button type="button" data-cartera="buscar" data-id="'+p.id+'" aria-label="Consultar temas de '+escapar(p.alias)+'">Consultar temas</button><button type="button" data-cartera="editar" data-id="'+p.id+'" aria-label="Editar '+escapar(p.alias)+'">Editar</button><button type="button" data-cartera="eliminar" data-id="'+p.id+'" aria-label="Eliminar '+escapar(p.alias)+'">Eliminar</button></div></li>').join('')+'</ul>'+(perfiles.size?'':'<p>Crea un perfil para reunir tus temas y consultarlos juntos.</p>')+'</div>';
 panel.querySelector('#carteraFormulario').addEventListener('submit',e=>{
  e.preventDefault();const temas=[...panel.querySelectorAll('input[name="carteraTema"]:checked')].map(input=>input.value);
  try{if(editando)actualizar(editando,temas);else nuevo(temas);foco('carteraEstado');}catch(error){estado=error.message;const mensaje=document.getElementById('carteraEstado');mensaje.textContent=estado;}
 });
 const cancelar=panel.querySelector('#carteraCancelar');
 if(cancelar)cancelar.addEventListener('click',()=>{editando='';estado='Edición cancelada.';render();foco('carteraFormulario');});
 panel.querySelectorAll('[data-cartera]').forEach(button=>button.addEventListener('click',()=>{
  const {cartera:accion,id}=button.dataset;
  if(accion==='buscar'){buscar(id);return;}
  if(accion==='editar'){editando=id;estado='';render();foco('carteraFormulario');return;}
  if(accion==='eliminar'){eliminar(id);foco('carteraFormulario');}
 }));
 // Anchors for keyboard focus after a DOM update; status remains a live region.
 panel.querySelector('#carteraFormulario').setAttribute('tabindex','-1');
 panel.querySelector('#carteraEstado').setAttribute('tabindex','-1');
}
window.EuclidianCartera=Object.freeze({nuevo,actualizar,eliminar,consulta,buscar,estadoActual,limpiar,render,temas:TEMAS});
if(typeof document!=='undefined'){
 if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',render,{once:true});else render();
}
})();
