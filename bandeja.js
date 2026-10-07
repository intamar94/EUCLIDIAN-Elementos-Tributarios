/* EUCLIDIAN — navegacion de la bandeja. */
let CLAVE = sessionStorage.getItem('euclidian_clave') || '';
let REVISOR = sessionStorage.getItem('euclidian_revisor_clave') || '';
window.euclidianPuedeRevisar=!!REVISOR;
const consultaInicial=new URLSearchParams(window.location.search);
const F = { estado:'todos', periodo:'todo', tema:'', q:(consultaInicial.get('q')||'').trim().slice(0,160), orden:'recientes', pagina:1 };
const cajaConsulta=document.getElementById('consulta'); if(cajaConsulta)cajaConsulta.value=F.q;
const TEMAS_DIARIOS=['Renta','IVA','Retención','Facturación electrónica','SIMPLE'];

function skeletonConsulta(){
  return `<div class="skeleton-lista" aria-hidden="true">${Array.from({length:3},(_,i)=>`<article class="skeleton-ficha"><div class="skeleton-linea mini"></div><div class="skeleton-linea titulo"></div><div class="skeleton-grid"><div><div class="skeleton-linea"></div><div class="skeleton-linea corta"></div><div class="skeleton-bloque"></div></div><div class="skeleton-lateral"><div class="skeleton-linea corta"></div><div class="skeleton-linea"></div></div></div></article>`).join('')}</div>`;
}
function estadoCarga(activo,mensaje='Ordenando la información…'){
  const indicador=document.getElementById('cargaGeometrica');
  const lista=document.getElementById('lista');
  if(indicador){
    indicador.hidden=!activo;
    const texto=indicador.querySelector('span:last-child');
    if(texto)texto.textContent=mensaje;
  }
  if(lista)lista.setAttribute('aria-busy',activo?'true':'false');
}
function marcarNavegacion(id){
  document.querySelectorAll('.nav-item').forEach(el=>{el.classList.remove('activo');el.removeAttribute('aria-current');});
  const activo=document.getElementById(id);
  if(activo){activo.classList.add('activo');activo.setAttribute('aria-current','page');}
}
function vistaVacia(){
  return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo">
    <span class="estado-vacio-figura" aria-hidden="true">◇</span>
    <div><span class="estado-vacio-kicker">SIN COINCIDENCIAS</span><h2 id="estadoVacioTitulo">No encontramos algo fiable con estos filtros</h2>
    <p>No significa que el tema no exista. Amplía la consulta o entra por una de estas rutas.</p></div>
    <div class="estado-vacio-acciones">
      <button type="button" data-empty-action="todo">Ver todo</button>
      <button type="button" data-empty-action="explorar">Explorar temas</button>
      <button type="button" data-empty-action="nuevos">Ver novedades</button>
    </div>
  </section>`;
}
function vistaError(mensaje){
  return `<section class="estado-error" role="alert"><span class="estado-error-figura" aria-hidden="true">×</span><div><span class="estado-vacio-kicker">NO PUDIMOS COMPLETAR LA CONSULTA</span><h2>Tu información no se perdió</h2><p>${esc(mensaje||'No se pudo leer la base.')}</p><button type="button" data-retry-load>Reintentar</button></div></section>`;
}
function describirConsulta(data){
  const partes=[];
  if(F.q)partes.push(`“${F.q}”`);
  if(F.tema)partes.push(nombreTema(F.tema));
  if(F.estado==='nuevos')partes.push('publicaciones recientes');
  if(F.periodo!=='todo')partes.push(F.periodo);
  const estado=document.getElementById('estadoConsulta');
  if(estado)estado.textContent=partes.length?`${Number(data.total||0).toLocaleString('es-CO')} resultados · ${partes.join(' · ')}`:`${Number(data.total||0).toLocaleString('es-CO')} documentos disponibles`;
}
function renderExplorar(data){
  const seccion=document.getElementById('explorar'), cont=document.getElementById('explorarTemas');
  if(!seccion||!cont)return;
  const temas=(data.temas||[]).slice().sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));
  cont.innerHTML=temas.map((t,i)=>`<button type="button" class="tema-explora" data-explora-tema="${esc(t)}"><span class="tema-indice">${String(i+1).padStart(2,'0')}</span><strong>${esc(nombreTema(t))}</strong><span class="tema-flecha" aria-hidden="true">↗</span></button>`).join('');
  cont.querySelectorAll('[data-explora-tema]').forEach(btn=>btn.addEventListener('click',()=>{F.tema=btn.dataset.exploraTema;F.pagina=1;const sel=document.getElementById('selTema');if(sel)sel.value=F.tema;seccion.hidden=true;marcarNavegacion('navConsultar');cargar();}));
}
function configurarNavegacion(){
  const inicio=document.querySelector('.nav-item[href="#hoy"]');
  const consultar=document.querySelector('.nav-item[href="#controles"]');
  const novedades=document.querySelector('.nav-item[href="#hoyLista"]');
  if(inicio){inicio.id='navInicio';inicio.addEventListener('click',()=>marcarNavegacion('navInicio'));}
  if(consultar){consultar.id='navConsultar';consultar.addEventListener('click',()=>marcarNavegacion('navConsultar'));}
  if(novedades){novedades.id='navNovedades';novedades.addEventListener('click',e=>{e.preventDefault();F.estado='nuevos';F.pagina=1;const sel=document.getElementById('selEstado');if(sel)sel.value='nuevos';marcarNavegacion('navNovedades');cargar().then(()=>document.getElementById('lista')?.scrollIntoView({behavior:'smooth',block:'start'}));});}
  document.getElementById('navExplorar')?.addEventListener('click',()=>{const seccion=document.getElementById('explorar');if(seccion){seccion.hidden=false;seccion.scrollIntoView({behavior:'smooth',block:'start'});}marcarNavegacion('navExplorar');});
  document.getElementById('cerrarExplorar')?.addEventListener('click',()=>{const seccion=document.getElementById('explorar');if(seccion)seccion.hidden=true;marcarNavegacion('navInicio');document.getElementById('hoy')?.scrollIntoView({behavior:'smooth',block:'start'});});
  document.getElementById('navSeguir')?.addEventListener('click',()=>{marcarNavegacion('navSeguir');document.querySelector('.seguimiento')?.scrollIntoView({behavior:'smooth',block:'center'});});
  const cuenta=document.getElementById('navCuenta');
  if(cuenta){cuenta.setAttribute('aria-disabled','true');cuenta.title='Cuenta personal en integración segura';cuenta.addEventListener('click',e=>{e.preventDefault();document.getElementById('estadoConsulta').textContent='La cuenta personal se habilitará cuando termine la integración segura de acceso y suscripción.';document.getElementById('estadoConsulta')?.scrollIntoView({behavior:'smooth',block:'center'});});}
}

function textoDocumento(d){return [d.titulo,d.resumen_humano,d.resumen_borrador,d.descripcion_limpia,d.materia,...(d.temas||[])].filter(Boolean).join(' ').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase();}
function temasSeguidos(){try{return JSON.parse(localStorage.getItem('euclidian_temas_seguidos')||'[]');}catch(e){return [];}}
function guardarTemas(temas){localStorage.setItem('euclidian_temas_seguidos',JSON.stringify(temas));}
function prioridadDiaria(d,temas){const texto=textoDocumento(d);let puntos=0,razon='',accion='Abre la ficha y confirma el alcance para el caso concreto.';if(d.estado_vigencia&&d.estado_vigencia!=='vigente'&&d.estado_vigencia!=='desconocido'){puntos+=100;razon='Cambio de vigencia';accion='No lo uses sin revisar la norma posterior y su efecto.';}const plazo=fechaDePlazo((d.plazos_mencionados||[])[0]);const dias=plazo?diasHasta(plazo):null;if(dias!==null&&dias>=0&&dias<=30){puntos+=90;razon='Plazo próximo';accion='Confirma obligación, periodo y contribuyente antes de agendarlo.';}if(d.tiene_efectos_retroactivos){puntos+=70;razon='Puede afectar periodos anteriores';accion='Revisa declaraciones ya presentadas y el alcance temporal.';}if(d.es_nuevo){puntos+=40;if(!razon)razon='Publicación DIAN reciente';}if(temas.some(t=>texto.includes(t.normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase()))){puntos+=30;if(!razon)razon='Tema que sigues';}return {puntos,razon:razon||'Para consulta',accion};}
function fechaActualizacion(valor){if(!valor)return 'Fuente DIAN disponible en cada ficha.';const f=new Date(valor);if(Number.isNaN(f.getTime()))return 'Fuente DIAN disponible en cada ficha.';return `Biblioteca actualizada el ${f.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'})}.`;}
function renderTemasSeguidos(data){const cont=document.getElementById('temasSeguidos');if(!cont)return;const activos=temasSeguidos();cont.innerHTML=TEMAS_DIARIOS.map(t=>`<button type="button" class="tema-seguido ${activos.includes(t)?'activo':''}" data-tema-diario="${esc(t)}" aria-pressed="${activos.includes(t)}">${activos.includes(t)?'✓ ': '+'}${esc(t)}</button>`).join('');cont.querySelectorAll('[data-tema-diario]').forEach(b=>b.addEventListener('click',()=>{const tema=b.dataset.temaDiario;const siguientes=temasSeguidos();const i=siguientes.indexOf(tema);if(i>=0)siguientes.splice(i,1);else siguientes.push(tema);guardarTemas(siguientes);renderPanelHoy(data);}));}
function renderPanelHoy(data){const panel=document.getElementById('hoy');if(!panel)return;const docs=data.documentos||[],seguidos=temasSeguidos();const priorizados=docs.map(d=>({d,...prioridadDiaria(d,seguidos)})).sort((a,b)=>b.puntos-a.puntos).filter(x=>x.puntos>0).slice(0,3);const nuevos=docs.filter(d=>d.es_nuevo).length,plazos=docs.filter(d=>{const f=fechaDePlazo((d.plazos_mencionados||[])[0]);return f&&diasHasta(f)>=0&&diasHasta(f)<=30;}).length,cambios=docs.filter(d=>d.estado_vigencia&&d.estado_vigencia!=='vigente'&&d.estado_vigencia!=='desconocido').length;document.getElementById('estadoFuente').textContent=fechaActualizacion(data.actualizado);document.getElementById('hoyIntro').textContent=priorizados.length?'Estos documentos merecen una revisión antes de aplicarlos o cerrar una obligación.':'No hay plazos próximos ni cambios de vigencia entre los documentos de esta consulta.';document.getElementById('hoyResumen').innerHTML=`<span><b>${nuevos}</b> publicaciones DIAN recientes</span><span><b>${plazos}</b> plazos próximos</span><span><b>${cambios}</b> cambios de vigencia</span>`;const lista=document.getElementById('hoyLista');lista.innerHTML=priorizados.map(({d,razon,accion})=>`<article class="hoy-item"><div><span class="hoy-etiqueta">${esc(razon)}</span><h3>${esc(d.titulo||d.numero_resolucion)}</h3><p>${esc(accion)}</p></div><button type="button" data-abrir-doc="${esc(d.id)}">Ver ficha</button></article>`).join('')||'<p class="hoy-vacio">Usa los temas que sigues o busca una obligación para priorizar tu consulta.</p>';lista.querySelectorAll('[data-abrir-doc]').forEach(b=>b.addEventListener('click',()=>document.querySelector(`article[data-id="${b.dataset.abrirDoc}"]`)?.scrollIntoView({behavior:'smooth',block:'start'})));renderTemasSeguidos(data);panel.hidden=false;}

async function entrar(e){
  e.preventDefault();
  const input=document.getElementById('clave'), btn=e.submitter || document.querySelector('#puerta button'), mal=document.getElementById('mal');
  const valor=input.value.trim();
  if(!valor) return;
  CLAVE=valor;
  if(btn){btn.disabled=true;btn.textContent='COMPROBANDO…';}
  if(mal)mal.textContent='';
  try{await cargar(true);}catch(err){CLAVE='';sessionStorage.removeItem('euclidian_clave');if(mal)mal.textContent=err.message||'No se pudo comprobar el acceso.';}
  finally{if(btn){btn.disabled=false;btn.textContent='ENTRAR';}}
}
async function alternarRevision(){
  const btn=document.getElementById('btnRevision');
  if(REVISOR){REVISOR='';sessionStorage.removeItem('euclidian_revisor_clave');window.euclidianPuedeRevisar=false;if(btn)btn.textContent='Modo revisión';await cargar();return;}
  const clave=prompt('Clave privada del revisor fiscal');if(!clave)return;
  try{const r=await fetch('/api/decidir',{method:'POST',headers:{'Content-Type':'application/json','x-clave':clave},body:JSON.stringify({decision:'validar_revisor'})});if(!r.ok)throw new Error(r.status===503?'El modo revisión aún no está configurado.':'Clave de revisor incorrecta.');REVISOR=clave;sessionStorage.setItem('euclidian_revisor_clave',clave);window.euclidianPuedeRevisar=true;if(btn)btn.textContent='Salir del modo revisión';await cargar();}catch(e){alert(e.message||'No se pudo activar el modo revisión.');}
}
function contar(id){const t=document.getElementById('r-'+id),c=document.getElementById('c-'+id);if(!t||!c)return;const n=t.value.trim().length;c.textContent=n?n+' / 4000':'0';c.className='contador'+(n>4000?' largo':'');}
function usarBorrador(id){const t=document.getElementById('r-'+id),b=document.querySelector(`article[data-id="${id}"] .borrador p`);if(!t||!b)return;t.value=b.textContent.trim();contar(id);t.focus();}
async function guardarResumen(id){const t=document.getElementById('r-'+id);if(!t)return;const valor=t.value.trim();if(t.dataset.guardado===valor)return;try{const r=await fetch('/api/decidir',{method:'POST',headers:{'Content-Type':'application/json','x-clave':REVISOR},body:JSON.stringify({id,decision:'devolver',resumen:valor})});if(!r.ok)throw new Error('no se guardó');t.dataset.guardado=valor;t.style.borderColor='';const art=t.closest('article');if(art)art.classList.toggle('escrito',!!valor);}catch(e){t.style.borderColor='var(--regla)';}}
async function cargar(autenticar=false){
  const lista=document.getElementById('lista'),btn=document.getElementById('btnRecargar'),mal=document.getElementById('mal');if(btn)btn.disabled=true;estadoCarga(true,F.q?'Buscando y verificando…':'Ordenando la información…');if(lista)lista.innerHTML=skeletonConsulta();document.getElementById('paginas').innerHTML='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const q=new URLSearchParams({estado:F.estado,orden:F.orden,periodo:F.periodo,pagina:F.pagina});if(F.q)q.set('q',F.q);if(F.tema)q.set('tema',F.tema);const r=await fetch('/api/documentos?'+q,{headers:{'x-clave':CLAVE},cache:'no-store',signal:controller.signal});if(r.status===401)throw new Error('Clave incorrecta.');const data=await r.json().catch(()=>({error:'Respuesta inválida del servidor.'}));if(!r.ok)throw new Error(data.detalle||data.error||'No se pudo leer la base.');sessionStorage.setItem('euclidian_clave',CLAVE);document.getElementById('puerta').hidden=true;if(mal)mal.textContent='';document.getElementById('cab').hidden=false;document.getElementById('hoy').hidden=false;document.getElementById('controles').hidden=false;document.getElementById('barra').hidden=false;marcarActivos();poblarTemas(data.temas||[]);renderPanelHoy(data);renderExplorar(data);describirConsulta(data);if(!data.documentos.length){lista.innerHTML=vistaVacia();return data;}lista.innerHTML=data.documentos.map(ficha).join('');paginacion(data);window.scrollTo({top:0,behavior:'smooth'});return data;
  }catch(e){if(e.name==='AbortError')throw new Error('El servidor tardó demasiado en responder. Inténtalo de nuevo.');if(autenticar){if(lista)lista.innerHTML='';throw e;}if(lista)lista.innerHTML=vistaError(e.message);throw e;}finally{clearTimeout(timer);estadoCarga(false);if(btn)btn.disabled=false;}}
function poblarTemas(temas){const sel=document.getElementById('selTema');if(!sel)return;const actual=sel.value;const orden=[...temas].sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));sel.innerHTML='<option value="">Todos los temas</option>'+orden.map(t=>`<option value="${t}">${nombreTema(t)}</option>`).join('');sel.value=actual;}
function seleccionarAnio(anio){F.periodo=anio||'todo';F.pagina=1;marcarActivos();cargar();}
function paginacion(data){const cont=document.getElementById('paginas'),{pagina,paginas,total,porPagina}=data;if(total===0){cont.innerHTML='';return;}const primero=(pagina-1)*porPagina+1,ultimo=Math.min(pagina*porPagina,total),r=document.getElementById('rango');if(r)r.textContent=`${Number(total).toLocaleString('es-CO')} documentos disponibles · mostrando ${primero}–${ultimo}`;let html='';if(paginas>1){html+=`<button onclick="irA(${pagina-1})" ${pagina<=1?'disabled':''}>‹</button>`;const nums=new Set([1,paginas,pagina,pagina-1,pagina+1]),orden=[...nums].filter(n=>n>=1&&n<=paginas).sort((a,b)=>a-b);let previo=0;orden.forEach(n=>{if(n-previo>1)html+='<span style="color:var(--tenue)">…</span>';html+=`<button onclick="irA(${n})" aria-current="${n===pagina}">${n}</button>`;previo=n;});html+=`<button onclick="irA(${pagina+1})" ${pagina>=paginas?'disabled':''}>›</button>`;}cont.innerHTML=html;}
function irA(n){F.pagina=n;cargar();}
async function decidir(id,decision){const art=document.querySelector(`article[data-id="${id}"]`),t=document.getElementById('r-'+id),resumen=t?t.value.trim():undefined;if(art)art.style.opacity='.4';try{const r=await fetch('/api/decidir',{method:'POST',headers:{'Content-Type':'application/json','x-clave':REVISOR},body:JSON.stringify({id,decision,resumen})});if(!r.ok){const d=await r.json();throw new Error(d.detalle||d.error||'falló');}if(art)art.remove();if(!document.querySelector('article'))cargar();}catch(e){if(art){art.style.opacity='1';art.insertAdjacentHTML('beforeend',`<div class="error" style="margin-top:10px">No se guardó la decisión.<code>${esc(e.message)}</code></div>`);}}}
function marcarActivos(){const n=[F.q,F.tema,F.estado!=='todos'?F.estado:'',F.periodo!=='todo'?F.periodo:''].filter(Boolean).length;const btn=document.getElementById('btnLimpiar');if(btn)btn.hidden=n===0;}
function limpiar(){F.q='';F.tema='';F.estado='todos';F.periodo='todo';F.pagina=1;const consulta=document.getElementById('consulta');if(consulta)consulta.value='';document.getElementById('selTema').value='';const anio=document.getElementById('selAnio');if(anio)anio.value='';const estado=document.getElementById('selEstado');if(estado)estado.value='todos';cargar();}
document.getElementById('selAnio').addEventListener('change',e=>seleccionarAnio(e.target.value));document.getElementById('selTema').addEventListener('change',e=>{F.tema=e.target.value;F.pagina=1;cargar();});document.getElementById('selEstado').addEventListener('change',e=>{F.estado=e.target.value;F.pagina=1;cargar();});document.getElementById('selOrden').addEventListener('change',e=>{F.orden=e.target.value;F.pagina=1;cargar();});document.getElementById('formBuscar').addEventListener('submit',e=>{e.preventDefault();F.q=document.getElementById('consulta').value.trim();F.pagina=1;cargar();});
configurarNavegacion();
if(REVISOR){const b=document.getElementById('btnRevision');if(b)b.textContent='Salir del modo revisión';}
if(CLAVE)cargar().catch(()=>{});else document.getElementById('puerta').hidden=false;

if(!window.__euclidianRecoveryActions){window.__euclidianRecoveryActions=true;document.addEventListener('click',e=>{
  const accion=e.target.closest('[data-empty-action]');if(accion){const tipo=accion.dataset.emptyAction;if(tipo==='todo'){limpiar();return;}if(tipo==='explorar'){const seccion=document.getElementById('explorar');if(seccion){seccion.hidden=false;seccion.scrollIntoView({behavior:'smooth',block:'start'});}marcarNavegacion('navExplorar');return;}if(tipo==='nuevos'){F.estado='nuevos';F.pagina=1;const sel=document.getElementById('selEstado');if(sel)sel.value='nuevos';marcarNavegacion('navNovedades');cargar();return;}}
  if(e.target.closest('[data-retry-load]'))cargar().catch(()=>{});
});}
