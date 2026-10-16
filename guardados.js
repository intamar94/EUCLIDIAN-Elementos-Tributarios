/* Solo accesos a documentos públicos; cada apertura vuelve a validar el acceso en la API. */
(()=>{
  const KEY='euclidian_documentos_guardados_v1', MAX=150;
  const valido=id=>typeof id==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  function leer(){try{const datos=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(datos)?datos.filter(d=>d&&valido(d.id)&&typeof d.titulo==='string').slice(0,MAX).map(d=>({id:d.id,titulo:d.titulo.slice(0,240)})):[];}catch{return [];}}
  let guardados=leer();
  const tiene=id=>guardados.some(d=>d.id===id);
  window.euclidianBotonGuardar=d=>valido(d.id)?`<button type="button" class="accion-documento secundaria guardar-documento" data-guardar-doc="${esc(d.id)}" data-titulo="${esc(tituloFicha(d).slice(0,240))}" aria-pressed="${tiene(d.id)}">${tiene(d.id)?'Guardado · quitar':'Guardar documento'}</button>`:'';
  function render(){
    const lista=document.getElementById('documentosGuardados');
    if(lista)lista.innerHTML=guardados.length?guardados.map(d=>`<div class="guardado-fila"><button type="button" data-abrir-guardado="${esc(d.id)}">${esc(d.titulo)} <span aria-hidden="true">→</span></button><button type="button" data-quitar-guardado="${esc(d.id)}" aria-label="Quitar ${esc(d.titulo)} de guardados">Quitar</button></div>`).join(''):'<p class="guardados-vacio">Todavía no has guardado documentos. Usa «Guardar documento» en una ficha para encontrarla aquí.</p>';
    document.querySelectorAll('[data-guardar-doc]').forEach(b=>{const si=tiene(b.dataset.guardarDoc);b.setAttribute('aria-pressed',String(si));b.textContent=si?'Guardado · quitar':'Guardar documento';});
  }
  function informar(texto){const estado=document.getElementById('guardadosEstado');if(estado)estado.textContent=texto;}
  document.addEventListener('click',e=>{
    const abrir=e.target.closest('[data-abrir-guardado]');if(abrir){window.euclidianAbrirGuardado?.(abrir.dataset.abrirGuardado);return;}
    const b=e.target.closest('[data-guardar-doc], [data-quitar-guardado]');if(!b)return;
    const id=b.dataset.guardarDoc||b.dataset.quitarGuardado;if(!valido(id))return;
    const quitar=tiene(id);
    if(!quitar&&guardados.length>=MAX){b.textContent=`Límite de ${MAX}: quita un guardado`;return;}
    const siguiente=quitar?guardados.filter(d=>d.id!==id):[{id,titulo:(b.dataset.titulo||'Documento DIAN').slice(0,240)},...guardados];
    try{localStorage.setItem(KEY,JSON.stringify(siguiente));}catch{b.textContent='No se pudo guardar el cambio';informar('El navegador no permitió guardar el cambio.');return;}
    guardados=siguiente;render();informar(quitar?'Documento quitado de guardados.':'Documento guardado en Explorar.');
    if(b.dataset.quitarGuardado)document.querySelector('#documentosGuardados button')?.focus();
  });
  window.addEventListener('storage',e=>{if(e.key===KEY||e.key===null){guardados=leer();render();}});
  render();
})();
