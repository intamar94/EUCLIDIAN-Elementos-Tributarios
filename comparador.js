/* EUCLIDIAN · Comparador exploratorio de fragmentos documentales.
   Diferencia de redacción ≠ modificación o vigencia jurídica.
   Las selecciones permanecen en memoria de la pestaña, no se transmiten. */
(function(){
'use strict';
const LIMITE=2200,MAX_TOKENS=320,MAX_CACHE=150;
const catalogo=new Map(),seleccion={a:null,b:null},pasajesEditados=new Map();
const limpio=(v,max=180)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,max);
const esc=(v)=>String(v??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
function fuenteOficial(v){
 try{
  const u=new URL(String(v??''));
  return u.protocol==='https:'&&!u.username&&!u.password&&
    (u.hostname==='dian.gov.co'||u.hostname.endsWith('.dian.gov.co'))?u.href:'';
 }catch(_){return '';}
}
function preparar(d){
 if(!d||d.tipo_documento==='boletin')return null;
 const id=limpio(d.id,120),url=fuenteOficial(d.enlace_oficial);
 const completo=String(d.texto_completo??'').trim();
 if(!id||!url||completo.length<60)return null;
 const cotejo=String(d.estado_fuente_verificacion||'')==='verificado_oficial'&&
   String(d.evaluacion_resultado||'').toUpperCase()==='APPROVE';
 return {id,ref:limpio(d.numero_resolucion||d.numero_interno||'Documento DIAN',110),
  titulo:limpio(d.titulo||'',180),url,fragmento:completo.slice(0,LIMITE),
  incompleto:completo.length>LIMITE,cotejo};
}
function panel(d){
 const p=preparar(d);
 if(!p)return '';
 catalogo.set(p.id,p);
 if(catalogo.size>MAX_CACHE)catalogo.delete(catalogo.keys().next().value);
 return '<div class="comparador-selector" aria-label="Comparación documental">'+
  '<span>Comparación de redacción</span><div class="comparador-selectores">'+
  '<button type="button" data-comp-lado="a" data-comp-id="'+esc(p.id)+'">Elegir como texto A</button>'+
  '<button type="button" data-comp-lado="b" data-comp-id="'+esc(p.id)+'">Elegir como texto B</button>'+
  '</div><small>Fragmentos de documentos DIAN. Solo muestra diferencias de texto; no determina cambios jurídicos.</small></div>';
}
function marcado(a,b){
 const tA=String(a??'').trim().split(/\s+/u).filter(Boolean).slice(0,MAX_TOKENS);
 const tB=String(b??'').trim().split(/\s+/u).filter(Boolean).slice(0,MAX_TOKENS);
 const m=tA.length,n=tB.length;
 const lcs=Array.from({length:m+1},()=>new Uint16Array(n+1));
 for(let i=m-1;i>=0;i--)for(let j=n-1;j>=0;j--)
  lcs[i][j]=tA[i]===tB[j]?lcs[i+1][j+1]+1:Math.max(lcs[i+1][j],lcs[i][j+1]);
 const anterior=[],posterior=[];let i=0,j=0;
 while(i<m||j<n){
  if(i<m&&j<n&&tA[i]===tB[j]){
    anterior.push({texto:tA[i++],cambio:false});
    posterior.push({texto:tB[j++],cambio:false});
  }else if(i<m&&(j===n||lcs[i+1][j]>=lcs[i][j+1])){
    anterior.push({texto:tA[i++],cambio:true});
  }else{posterior.push({texto:tB[j++],cambio:true});}
 }
 return {anterior,posterior,recortado:String(a??'').trim().split(/\s+/u).length>MAX_TOKENS||
  String(b??'').trim().split(/\s+/u).length>MAX_TOKENS,
  cambios:anterior.some(x=>x.cambio)||posterior.some(x=>x.cambio)};
}
function mostrarSeleccion(){
 if(typeof document==='undefined')return;
 let barra=document.getElementById('euComparadorSeleccion');
 if(!seleccion.a&&!seleccion.b){barra?.remove();return;}
 const lugar=document.getElementById('controles')||document.getElementById('fichas')||document.body;
 if(!barra){
  barra=document.createElement('div');
  barra.id='euComparadorSeleccion';
  barra.className='eu-comparador-seleccion';
  barra.setAttribute('role','status');
  barra.setAttribute('aria-live','polite');
  lugar.appendChild(barra);
 }
 barra.replaceChildren();
 const texto=document.createElement('span');
 texto.textContent=(seleccion.a?'Texto A: '+seleccion.a.ref:'Falta texto A')+
  ' · '+(seleccion.b?'Texto B: '+seleccion.b.ref:'Falta elegir texto B');
 const boton=document.createElement('button');
 boton.type='button';boton.dataset.compLimpiarGlobal='1';boton.textContent='Limpiar elección';
 barra.append(texto,boton);
}
function limpiarSeleccion(){
 seleccion.a=null;seleccion.b=null;
 pasajesEditados.clear();
 const dlg=typeof document!=='undefined'?document.getElementById('euComparadorDialog'):null;
 if(dlg?.open)dlg.close();
 mostrarSeleccion();
}
function crearVentana(){
 let dlg=document.getElementById('euComparadorDialog');
 if(dlg)return dlg;
 dlg=document.createElement('dialog');dlg.id='euComparadorDialog';
 dlg.className='eu-comparador-dialog';dlg.setAttribute('aria-labelledby','euComparadorTitulo');
 dlg.innerHTML='<div class="eu-comparador-cab"><div><span>HERRAMIENTA DE INVESTIGACIÓN</span><h2 id="euComparadorTitulo">Comparar fragmentos DIAN</h2></div><button type="button" data-comp-cerrar aria-label="Cerrar comparador">✕</button></div>'+
  '<p class="eu-comparador-alerta">Comparación textual exploratoria, <strong>no conclusión jurídica</strong>. Una redacción diferente no acredita derogación, reconsideración, vigencia ni efectos para un cliente. Confirma documentos, fechas y excepciones en la DIAN.</p>'+
  '<div class="eu-comparador-matrices"><section><h3>Texto A</h3><p id="euComparadorMetaA"></p><a id="euComparadorLinkA" target="_blank" rel="noopener noreferrer">Ver fuente DIAN ↗</a><label for="euComparadorTextoA">Fragmento editable (máximo 2.200 caracteres)</label><textarea id="euComparadorTextoA" maxlength="2200" spellcheck="false"></textarea></section>'+
  '<section><h3>Texto B</h3><p id="euComparadorMetaB"></p><a id="euComparadorLinkB" target="_blank" rel="noopener noreferrer">Ver fuente DIAN ↗</a><label for="euComparadorTextoB">Fragmento editable (máximo 2.200 caracteres)</label><textarea id="euComparadorTextoB" maxlength="2200" spellcheck="false"></textarea></section></div>'+
  '<p class="eu-comparador-nota">Se carga solo el fragmento inicial disponible en el catálogo. Para comparar el apartado relevante, pega el pasaje de cada documento tras cotejar sus fuentes. No se guarda ni transmite este texto.</p>'+
  '<div class="eu-comparador-acciones"><button type="button" data-comp-ejecutar>Resaltar diferencias</button><button type="button" data-comp-limpiar>Limpiar selección</button></div>'+
  '<p class="eu-comparador-estado" id="euComparadorEstado" role="status" aria-live="polite"></p>'+
  '<div id="euComparadorResultado" class="eu-comparador-resultado" hidden><p><strong>Diferencias de redacción</strong> (resaltadas). El resultado no establece relación normativa.</p>'+
  '<div class="eu-comparador-salidas"><section><h4>Texto A · fragmentos ausentes en B</h4><div id="euComparadorAntes"></div></section><section><h4>Texto B · fragmentos ausentes en A</h4><div id="euComparadorDespues"></div></section></div></div>';
 document.body.appendChild(dlg);
 return dlg;
}
function estado(mensaje){
 const d=document.getElementById('euComparadorEstado');
 if(d)d.textContent=mensaje;
}
function pintarTokens(id,tokens){
 const target=document.getElementById(id);
 target.replaceChildren();
 tokens.forEach((t,i)=>{
  if(i)target.appendChild(document.createTextNode(' '));
  if(t.cambio){
   const mark=document.createElement('mark');
   mark.className='eu-comparador-cambio';
   mark.textContent=t.texto;target.appendChild(mark);
  }else target.appendChild(document.createTextNode(t.texto));
 });
}
function resultado(){
 const dlg=crearVentana();
 const a=dlg.querySelector('#euComparadorTextoA').value.slice(0,LIMITE);
 const b=dlg.querySelector('#euComparadorTextoB').value.slice(0,LIMITE);
 const cont=dlg.querySelector('#euComparadorResultado');
 if(!a.trim()||!b.trim()){
  cont.hidden=true;estado('Necesitas dos fragmentos para comparar.');return;
 }
 const r=marcado(a,b);
 pintarTokens('euComparadorAntes',r.anterior);pintarTokens('euComparadorDespues',r.posterior);
 cont.hidden=false;
 estado((r.cambios?'Se marcaron diferencias de redacción.':'No se encontraron diferencias en los fragmentos evaluados.')+
  (r.recortado?' La comparación se limitó a las primeras 320 palabras de cada fragmento.':''));
}
function abrir(){
 if(!seleccion.a||!seleccion.b)return;
 const dlg=crearVentana();
 for(const lado of ['a','b']){
  const p=seleccion[lado],s=lado.toUpperCase();
  dlg.querySelector('#euComparadorMeta'+s).textContent=p.ref+
    (p.titulo?' · '+p.titulo:'')+
    (p.cotejo?' · Metadatos contrastados':' · Cotejo documental pendiente')+
    (p.incompleto?' · Extracto inicial acotado':'');
  dlg.querySelector('#euComparadorLink'+s).href=p.url;
  dlg.querySelector('#euComparadorTexto'+s).value=pasajesEditados.get(p.id)??p.fragmento;
 }
 dlg.querySelector('#euComparadorResultado').hidden=true;
 estado('Dos fuentes seleccionadas. Puedes ajustar los fragmentos antes de comparar.');
 if(!dlg.open)dlg.showModal();
}
function avisar(mensaje,elemento){
 const nodo=elemento.closest('article')||elemento.parentNode;
 let estado=nodo.querySelector('.comparador-mensaje');
 if(!estado){estado=document.createElement('p');estado.className='comparador-mensaje';
  estado.setAttribute('role','status');elemento.closest('.comparador-selector')?.appendChild(estado);}
 if(estado)estado.textContent=mensaje;
}
if(typeof document!=='undefined'){
 document.addEventListener('input',e=>{
  const lado=e.target.id==='euComparadorTextoA'?'a':e.target.id==='euComparadorTextoB'?'b':null;
  if(lado&&seleccion[lado])pasajesEditados.set(seleccion[lado].id,e.target.value.slice(0,LIMITE));
 });
 document.addEventListener('click',e=>{
  const boton=e.target.closest?.('[data-comp-lado],[data-comp-ejecutar],[data-comp-limpiar],[data-comp-limpiar-global],[data-comp-cerrar]');
  if(!boton)return;
  if(boton.hasAttribute('data-comp-cerrar')){crearVentana().close();return;}
  if(boton.hasAttribute('data-comp-ejecutar')){resultado();return;}
  if(boton.hasAttribute('data-comp-limpiar')||boton.hasAttribute('data-comp-limpiar-global')){
   limpiarSeleccion();return;
  }
  const lado=boton.dataset.compLado,id=boton.dataset.compId,p=catalogo.get(id);
  if(!p)return;
  if(seleccion[lado==='a'?'b':'a']?.id===p.id){
   avisar('Elige dos documentos distintos para comparar.',boton);return;
  }
  seleccion[lado]=p;
  mostrarSeleccion();
  if(seleccion.a&&seleccion.b)abrir();
  else avisar('Texto '+lado.toUpperCase()+' seleccionado. Elige el otro documento, también puede ser de otra búsqueda.',boton);
 });
}
window.EuclidianComparador={panel,preparar,marcado,fuenteOficial};
})();