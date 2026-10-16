/* EUCLIDIAN — navegacion de la bandeja. */
let CLAVE = sessionStorage.getItem('euclidian_clave') || '';
sessionStorage.removeItem('euclidian_revisor_clave');
let generacionCarga=0;
window.euclidianCerrarInterno=()=>{generacionCarga++;CLAVE='';sessionStorage.removeItem('euclidian_clave');liberarCarga();};
const consultaInicial=new URLSearchParams(window.location.search);
const docInicial=consultaInicial.get('doc')||'';
const F = { estado:'todos', periodo:'todo', tema:'', q:(consultaInicial.get('q')||'').trim().slice(0,160), doc:/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(docInicial)?docInicial:'', orden:'recientes', pagina:1 };
function dejarFicha(){if(F.doc){F.doc='';history.replaceState(null,'',location.pathname);}}
const cajaConsulta=document.getElementById('consulta'); if(cajaConsulta)cajaConsulta.value=F.q;

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
function liberarCarga(){estadoCarga(false);const btn=document.getElementById('btnRecargar');if(btn)btn.disabled=false;}
function marcarNavegacion(id){
  document.querySelectorAll('.nav-item').forEach(el=>{el.classList.remove('activo');el.removeAttribute('aria-current');});
  const activo=document.getElementById(id);
  if(activo){activo.classList.add('activo');activo.setAttribute('aria-current','page');}
}
function vistaVacia(){
  if(F.doc)return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo"><span class="estado-vacio-figura" aria-hidden="true">◇</span><div><span class="estado-vacio-kicker">ENLACE DEL CORREO</span><h2 id="estadoVacioTitulo">Esta ficha no está disponible</h2><p>El documento del enlace no está publicado en EUCLIDIAN en este momento. Puedes consultar la fuente DIAN enlazada en el correo.</p></div><div class="estado-vacio-acciones"><button type="button" data-empty-action="todo">Ver documentos disponibles</button></div></section>`;
  if(F.estado==='nuevos'&&!F.q&&!F.tema)return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo"><span class="estado-vacio-figura" aria-hidden="true">◇</span><div><h2 id="estadoVacioTitulo">No hay publicaciones listas para mostrar</h2><p>Puedes consultar la biblioteca o comprobar las novedades en la DIAN.</p></div><div class="estado-vacio-acciones"><button type="button" data-empty-action="todo">Ver biblioteca completa</button><a href="https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html" target="_blank" rel="noopener noreferrer">Ver novedades en la DIAN ↗</a></div></section>`;
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
  if(F.doc){document.getElementById('estadoConsulta').textContent=data.documentos?.length?'Documento abierto desde el correo':'Documento del correo no disponible';return;}
  if(F.q)partes.push(`“${F.q}”`);
  if(F.tema)partes.push(nombreTema(F.tema));
  if(F.estado==='nuevos')partes.push('publicaciones recientes');
  if(F.periodo!=='todo')partes.push(F.periodo);
  const estado=document.getElementById('estadoConsulta');
  if(estado)estado.textContent=partes.length?`${Number(data.total||0).toLocaleString('es-CO')} resultados · ${partes.join(' · ')}`:`${Number(data.total||0).toLocaleString('es-CO')} documentos disponibles`;
}
let catalogoTemas=[];
const claveTemas='euclidian_temas_seleccionados_v2';
function temasSeguidos(){
  try{
    const guardados=localStorage.getItem(claveTemas);
    const anteriores=JSON.parse(guardados===null?(localStorage.getItem('euclidian_temas_seguidos')||'[]'):guardados);
    if(!Array.isArray(anteriores))return [];
    return [...new Set(anteriores.filter(t=>typeof t==='string').map(t=>Object.hasOwn(ETIQUETAS,t)?t:Object.keys(ETIQUETAS).find(k=>ETIQUETAS[k]===t)||(t==='Retención'?'retencion':t)).filter(t=>/^[a-z0-9_]+$/.test(t)&&esTemaDeTrabajo(t)))];
  }catch(_){return [];}
}
function guardarTemas(temas){try{localStorage.setItem(claveTemas,JSON.stringify(temas));return true;}catch(_){return false;}}
function renderExplorar(data){
  const cont=document.getElementById('explorarTemas'),sel=document.getElementById('agregarTema');if(!cont||!sel)return;
  if(data){const recibidos=(data.temas||[]).filter(t=>typeof t==='string'&&esTemaDeTrabajo(t));catalogoTemas=[...new Set([...catalogoTemas,...recibidos])].sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));}
  const seleccionados=temasSeguidos();
  sel.innerHTML='<option value="">Elige un tema…</option>'+catalogoTemas.filter(t=>!seleccionados.includes(t)).map(t=>`<option value="${esc(t)}">${esc(nombreTema(t))}</option>`).join('');
  sel.disabled=catalogoTemas.every(t=>seleccionados.includes(t));
  if(sel.disabled)sel.options[0].textContent=catalogoTemas.length?'Todos los temas disponibles están añadidos':'No hay temas disponibles';
  cont.innerHTML=seleccionados.map(t=>`<div class="tema-personal"><button type="button" class="tema-personal-abrir" data-explora-tema="${esc(t)}"><strong>${esc(nombreTema(t))}</strong><span>Ver documentos <b aria-hidden="true">→</b></span></button><button type="button" class="tema-personal-quitar" data-quitar-tema="${esc(t)}" aria-label="Quitar ${esc(nombreTema(t))}">×</button></div>`).join('')||'<p class="temas-vacio">Elige un tema en el desplegable para empezar.</p>';
}
function cambiarSeleccionTemas(tema,agregar){
  const actuales=temasSeguidos();
  const siguientes=agregar?[...new Set([...actuales,tema])]:actuales.filter(t=>t!==tema);
  const ok=guardarTemas(siguientes);
  document.getElementById('estadoTemas').classList.toggle('solo-lectores',ok);
  document.getElementById('estadoTemas').textContent=ok?`${nombreTema(tema)}: ${agregar?'añadido':'quitado'}.`:'No se pudo guardar la selección en este navegador.';
  if(ok)renderExplorar();
}

let vistaActual=(F.doc||F.q)?'consultar':'inicio';
let ultimaRespuesta=null,accesoConsulta=false;
const vistas={inicio:['inicioPanel'],consultar:['controles','barra','lista','paginas'],novedades:['novedadesCab','barra','lista','paginas'],explorar:['explorar'],cuenta:['cuentaPanel'],guia:['bienvenida']};
function aplicarVista(){
  const autorizado=document.getElementById('puerta')?.hidden===true;
  if(autorizado&&!accesoConsulta&&!['cuenta','guia'].includes(vistaActual))vistaActual='cuenta';
  const visibles=vistas[vistaActual]||[];
  [...new Set(Object.values(vistas).flat())].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=!autorizado||!visibles.includes(id);});
  if(vistaActual==='novedades'&&ultimaRespuesta?.total===0)document.getElementById('barra').hidden=true;
  const nav={inicio:'navInicio',consultar:'navConsultar',novedades:'navNovedades',explorar:'navExplorar',cuenta:'navCuenta'};
  marcarNavegacion(nav[vistaActual]||'');
  window.euclidianVistaActual=vistaActual;
}
function mostrarVista(vista){
  if(!vistas[vista])return;
  vistaActual=vista;aplicarVista();
  window.scrollTo({top:0,behavior:'instant'});
}
window.euclidianCambiarVista=mostrarVista;
window.euclidianRestablecerVista=()=>{generacionCarga++;ultimaRespuesta=null;catalogoTemas=[];accesoConsulta=false;vistaActual='inicio';window.euclidianVistaActual='inicio';liberarCarga();};
function abrirNovedades(){reiniciarFiltros();F.estado='nuevos';document.getElementById('selEstado').value='nuevos';mostrarVista('novedades');return cargar().catch(()=>{});}
function abrirConsulta(){dejarFicha();if(F.estado==='nuevos')reiniciarFiltros();mostrarVista('consultar');return cargar().catch(()=>{});}
function configurarNavegacion(){
  const inicio=document.querySelector('.nav-item[href="#inicioPanel"]');
  const consultar=document.querySelector('.nav-item[href="#controles"]');
  const novedades=document.querySelector('.nav-item[href="#novedadesCab"]');
  if(inicio){inicio.id='navInicio';inicio.addEventListener('click',e=>{e.preventDefault();reiniciarFiltros();mostrarVista('inicio');cargar().catch(()=>{});});}
  if(consultar){consultar.id='navConsultar';consultar.addEventListener('click',e=>{e.preventDefault();abrirConsulta();});}
  if(novedades){novedades.id='navNovedades';novedades.addEventListener('click',e=>{e.preventDefault();abrirNovedades();});}
  document.getElementById('navExplorar')?.addEventListener('click',()=>mostrarVista('explorar'));
  document.getElementById('navCuenta')?.addEventListener('click',async()=>{
    mostrarVista('cuenta');
    if(!CLAVE&&window.euclidianTieneSesion?.()){await window.euclidianMostrarCuenta?.();return;}
    document.getElementById('cuentaEmail').textContent='Acceso interno';document.getElementById('cuentaEstado').textContent='Interno';
    ['cuentaPlan','cuentaPeriodo','cuentaUso'].forEach(id=>document.getElementById(id).textContent='—');document.getElementById('perfilForm').hidden=true;
  });
  document.getElementById('inicioDocumentos')?.addEventListener('click',e=>{const btn=e.target.closest('[data-inicio-doc]');if(!btn)return;reiniciarFiltros();F.doc=btn.dataset.inicioDoc;mostrarVista('consultar');cargar().catch(()=>{});});
  document.getElementById('inicioNovedades')?.addEventListener('click',e=>{if(e.target.closest('button'))abrirNovedades();});
  document.getElementById('agregarTema')?.addEventListener('change',e=>{const tema=e.target.value;if(catalogoTemas.includes(tema))cambiarSeleccionTemas(tema,true);});
  document.getElementById('explorarTemas')?.addEventListener('click',e=>{
    const quitar=e.target.closest('[data-quitar-tema]');if(quitar){cambiarSeleccionTemas(quitar.dataset.quitarTema,false);document.getElementById('agregarTema').focus();return;}
    const abrir=e.target.closest('[data-explora-tema]');if(abrir){reiniciarFiltros();F.tema=abrir.dataset.exploraTema;document.getElementById('selTema').value=F.tema;mostrarVista('consultar');cargar().catch(()=>{});}
  });
}
function renderInicio(data){
  document.getElementById('inicioResumen').textContent='Consulta normas y doctrina con su fuente DIAN.';
  const docs=(data.documentos||[]).slice(0,3);
  document.getElementById('inicioDocumentos').innerHTML=docs.map(d=>{
    const temas=(d.temas||[]).filter(t=>esTemaDeTrabajo(t)).slice(0,2).map(nombreTema).join(' · ');
    const titulo=tituloFicha(d),descripcion=String(d.descripcion_limpia||d.contenido||'').replace(/\s+/g,' ').trim();
    const extracto=descripcion&&descripcion.toLowerCase()!==titulo.toLowerCase()?descripcion.slice(0,220)+(descripcion.length>220?'…':''):'';
    return `<button type="button" class="inicio-documento" data-inicio-doc="${esc(d.id)}">${temas?`<span class="inicio-documento-tipo">${esc(temas)}</span>`:''}<strong>${esc(titulo)}</strong>${extracto?`<span class="inicio-documento-extracto">${esc(extracto)}</span>`:''}<span class="inicio-documento-ref">${fechaPrincipal(d)}<b aria-hidden="true">Ver ficha →</b></span></button>`;
  }).join('')||'<p>No pudimos mostrar documentos en este momento. Puedes buscar en Consultar.</p>';
}

async function entrarInterno(valor){
  const mal=document.getElementById('mal');
  CLAVE=String(valor||'').trim();if(!CLAVE)return;
  if(mal)mal.textContent='';
  try{await cargar(true);sessionStorage.setItem('euclidian_clave',CLAVE);}
  catch(err){CLAVE='';sessionStorage.removeItem('euclidian_clave');throw err;}
}
window.euclidianEntrarInterno=entrarInterno;
async function cargar(autenticar=false){
  const generacion=++generacionCarga;
  const lista=document.getElementById('lista'),btn=document.getElementById('btnRecargar'),mal=document.getElementById('mal');
  if(btn)btn.disabled=true;estadoCarga(true,F.q?'Buscando y verificando…':'Ordenando la información…');
  if(lista)lista.innerHTML=skeletonConsulta();document.getElementById('paginas').innerHTML='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const q=new URLSearchParams({estado:F.estado,orden:F.orden,periodo:F.periodo,pagina:F.pagina});
    if(F.doc)q.set('doc',F.doc);else {if(F.q)q.set('q',F.q);if(F.tema)q.set('tema',F.tema);}
    const token=CLAVE?'':await window.euclidianAuthToken?.();
    const headers=token?{Authorization:`Bearer ${token}`}:CLAVE?{'x-clave':CLAVE}:{};
    const r=await fetch('/api/documentos?'+q,{headers,cache:'no-store',signal:controller.signal});
    const data=await r.json().catch(()=>({error:'Respuesta inválida del servidor.'}));
    if(generacion!==generacionCarga)return null;
    if(r.status===401){
      if(token)window.euclidianAuthExpirada?.();
      throw new Error(token?'Tu sesión terminó. Vuelve a entrar.':'Clave interna incorrecta.');
    }
    if(r.status===402){
      accesoConsulta=false;['inicioDocumentos','inicioNovedades','explorarTemas','estadoTemas'].forEach(id=>document.getElementById(id)?.replaceChildren());
      document.getElementById('puerta').hidden=true;
      document.getElementById('cab').hidden=false;
      ['inicioPanel','novedadesCab','controles','barra','bienvenida','explorar','lista','paginas'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
      if(lista)lista.innerHTML='';
      mostrarVista('cuenta');await window.euclidianAuthSinSuscripcion?.(data);
      return data;
    }
    if(!r.ok)throw new Error(data.detalle||data.error||'No se pudo leer la base.');
    if(CLAVE&&!token)sessionStorage.setItem('euclidian_clave',CLAVE);
    document.getElementById('puerta').hidden=true;if(mal)mal.textContent='';
    document.getElementById('cab').hidden=false;
    accesoConsulta=true;ultimaRespuesta=data;
    marcarActivos();poblarTemas(data.temas||[]);poblarAnios(data.anios||[]);renderExplorar(data);describirConsulta(data);
    if(vistaActual==='inicio')renderInicio(data);
    lista.innerHTML=data.documentos.length?data.documentos.map(ficha).join(''):vistaVacia();
    paginacion(data);aplicarVista();if(vistaActual==='inicio')window.euclidianIniciarGuia?.();
    if(vistaActual==='inicio'||vistaActual==='guia')actualizarNovedadesGlobales(headers,generacion);
    return data;
  }catch(e){
    if(generacion!==generacionCarga)return null;
    if(e.name==='AbortError')e=new Error('El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    if(autenticar){if(lista)lista.innerHTML='';throw e;}
    if(document.getElementById('puerta')?.hidden===true){if(vistaActual==='inicio')document.getElementById('inicioDocumentos').innerHTML=vistaError(e.message);else if(lista)lista.innerHTML=vistaError(e.message);}
    throw e;
  }finally{clearTimeout(timer);if(generacion===generacionCarga){estadoCarga(false);if(btn)btn.disabled=false;}}
}
function poblarTemas(temas){
  const sel=document.getElementById('selTema');if(!sel)return;
  const actual=sel.value;
  const orden=[...temas].filter(t=>typeof t==='string'&&!t.startsWith('dian:')).sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));
  const grupo=(nombre,items)=>items.length?`<optgroup label="${nombre}">${items.map(t=>`<option value="${esc(t)}">${esc(nombreTema(t))}</option>`).join('')}</optgroup>`:'';
  sel.innerHTML='<option value="">Todos los temas y publicaciones</option>'+grupo('Temas de trabajo',orden.filter(esTemaDeTrabajo))+grupo('Publicaciones DIAN',orden.filter(t=>!esTemaDeTrabajo(t)));
  sel.value=actual;
}

function poblarAnios(anios){const sel=document.getElementById('selAnio');if(!sel)return;const actual=/^\d{4}$/.test(F.periodo)?F.periodo:'';sel.innerHTML='<option value="">Todos los años</option>'+anios.filter(x=>Number.isInteger(x.anio)&&x.anio>=1950&&x.anio<=new Date().getFullYear()+1).map(x=>`<option value="${x.anio}">${x.anio} · ${Number(x.total||0).toLocaleString('es-CO')}</option>`).join('');sel.value=actual;}
function seleccionarAnio(anio){F.periodo=anio||'todo';F.pagina=1;marcarActivos();cargar().catch(()=>{});}
function paginacion(data){const cont=document.getElementById('paginas'),{pagina,paginas,total,porPagina}=data;if(total===0){cont.innerHTML='';const r=document.getElementById('rango');if(r)r.textContent=F.estado==='nuevos'?'0 publicaciones en los últimos 14 días':'0 resultados con estos filtros';return;}const primero=(pagina-1)*porPagina+1,ultimo=Math.min(pagina*porPagina,total),r=document.getElementById('rango');if(r)r.textContent=`${Number(total).toLocaleString('es-CO')} documentos disponibles · mostrando ${primero}–${ultimo}`;let html='';if(paginas>1){html+=`<button onclick="irA(${pagina-1})" ${pagina<=1?'disabled':''}>‹</button>`;const nums=new Set([1,paginas,pagina,pagina-1,pagina+1]),orden=[...nums].filter(n=>n>=1&&n<=paginas).sort((a,b)=>a-b);let previo=0;orden.forEach(n=>{if(n-previo>1)html+='<span style="color:var(--tenue)">…</span>';html+=`<button onclick="irA(${n})" aria-current="${n===pagina}">${n}</button>`;previo=n;});html+=`<button onclick="irA(${pagina+1})" ${pagina>=paginas?'disabled':''}>›</button>`;}cont.innerHTML=html;}
function irA(n){F.pagina=n;cargar().catch(()=>{});}

function marcarActivos(){const n=[F.doc,F.q,F.tema,F.estado!=='todos'?F.estado:'',F.periodo!=='todo'?F.periodo:''].filter(Boolean).length;const btn=document.getElementById('btnLimpiar');if(btn)btn.hidden=n===0;}
function reiniciarFiltros(){F.orden='recientes';document.getElementById('selOrden').value='recientes';F.q='';F.doc='';F.tema='';F.estado='todos';F.periodo='todo';F.pagina=1;history.replaceState(null,'',location.pathname);const consulta=document.getElementById('consulta');if(consulta)consulta.value='';document.getElementById('selTema').value='';const anio=document.getElementById('selAnio');if(anio)anio.value='';const estado=document.getElementById('selEstado');if(estado)estado.value='todos';}
function limpiar(){reiniciarFiltros();mostrarVista('consultar');return cargar();}
document.getElementById('selAnio').addEventListener('change',e=>{dejarFicha();seleccionarAnio(e.target.value);});document.getElementById('selTema').addEventListener('change',e=>{dejarFicha();F.tema=e.target.value;F.pagina=1;cargar().catch(()=>{});});document.getElementById('selEstado').addEventListener('change',e=>{dejarFicha();F.estado=e.target.value;F.pagina=1;cargar().catch(()=>{});});document.getElementById('selOrden').addEventListener('change',e=>{dejarFicha();F.orden=e.target.value;F.pagina=1;cargar().catch(()=>{});});document.getElementById('formBuscar').addEventListener('submit',e=>{e.preventDefault();dejarFicha();F.q=document.getElementById('consulta').value.trim();F.pagina=1;cargar().catch(()=>{});});
configurarNavegacion();
if(!window.euclidianEnRecuperacion&&(CLAVE||window.euclidianTieneSesion?.()))cargar().catch(()=>{if(!CLAVE&&!window.euclidianTieneSesion?.())document.getElementById('puerta').hidden=false;});else document.getElementById('puerta').hidden=false;

if(!window.__euclidianRecoveryActions){window.__euclidianRecoveryActions=true;document.addEventListener('click',e=>{
  const accion=e.target.closest('[data-empty-action]');if(accion){const tipo=accion.dataset.emptyAction;if(tipo==='todo'){limpiar().catch(()=>{});return;}if(tipo==='explorar'){mostrarVista('explorar');return;}if(tipo==='nuevos'){abrirNovedades();return;}}
  if(e.target.closest('[data-retry-load]'))cargar().catch(()=>{});
});}

async function actualizarNovedadesGlobales(headers,generacion){
  const panel=document.getElementById('inicioNovedades');if(!panel)return;
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{
    const r=await fetch('/api/documentos?estado=nuevos&periodo=todo&pagina=1&orden=recientes&resumen=1',{headers,cache:'no-store',signal:controller.signal});
    if(generacion!==generacionCarga||!document.getElementById('puerta').hidden)return;
    if(!r.ok)throw new Error('sin_resumen');
    const data=await r.json();if(generacion!==generacionCarga)return;
    panel.innerHTML=Number(data.total)>0?`<button type="button">${Number(data.total).toLocaleString('es-CO')} publicaciones recientes <span aria-hidden="true">→</span></button>`:'<p>Sin publicaciones recientes listas para consulta.</p>';
    panel.hidden=false;
  }catch(_){if(generacion===generacionCarga){panel.innerHTML='<p>No pudimos comprobar las novedades. Reintenta con Actualizar.</p>';panel.hidden=false;}}finally{clearTimeout(timer);}
}

// Reserva espacio real para la barra inferior, también al ampliar el texto.
if(typeof ResizeObserver!=='undefined'){
  const nav=document.querySelector('.nav-principal');
  if(nav)new ResizeObserver(()=>document.documentElement.style.setProperty('--altura-nav',`${nav.getBoundingClientRect().height}px`)).observe(nav);
}
