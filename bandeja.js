/* EUCLIDIAN — navegacion de la bandeja. */
let CLAVE = sessionStorage.getItem('euclidian_clave') || '';
sessionStorage.removeItem('euclidian_revisor_clave');
let generacionCarga=0;
let controladorConsulta=null;
window.euclidianCerrarInterno=()=>{generacionCarga++;controladorConsulta?.abort();CLAVE='';sessionStorage.removeItem('euclidian_clave');liberarCarga();};
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
  if(activo){
    for(const id of ['estadoConsulta','rango']){const el=document.getElementById(id);if(el)el.textContent='Cargando resultados…';}
  }
}
function liberarCarga(){estadoCarga(false);const btn=document.getElementById('btnRecargar');if(btn)btn.disabled=false;}
function marcarNavegacion(id){
  document.querySelectorAll('.nav-item').forEach(el=>{el.classList.remove('activo');el.removeAttribute('aria-current');});
  const activo=document.getElementById(id);
  if(activo){activo.classList.add('activo');activo.setAttribute('aria-current','page');}
}
function vistaVacia(){
  if(F.doc)return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo"><span class="estado-vacio-figura" aria-hidden="true">◇</span><div><span class="estado-vacio-kicker">DOCUMENTO SELECCIONADO</span><h2 id="estadoVacioTitulo">Esta ficha no está disponible</h2><p>El documento seleccionado no está disponible en EUCLIDIAN en este momento. Si conservas su referencia, puedes consultarla directamente en la fuente DIAN.</p></div><div class="estado-vacio-acciones"><button type="button" data-empty-action="todo">Ver documentos disponibles</button></div></section>`;
  if(F.estado==='nuevos'&&!F.q&&!F.tema)return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo"><span class="estado-vacio-figura" aria-hidden="true">◇</span><div><h2 id="estadoVacioTitulo">No hay publicaciones listas para mostrar</h2><p>Puedes consultar la biblioteca o comprobar las novedades en la DIAN.</p></div><div class="estado-vacio-acciones"><button type="button" data-empty-action="todo">Ver biblioteca completa</button><a href="https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html" target="_blank" rel="noopener noreferrer">Ver novedades en la DIAN ↗</a></div></section>`;
  return `<section class="estado-vacio" aria-labelledby="estadoVacioTitulo">
    <span class="estado-vacio-figura" aria-hidden="true">◇</span>
    <div><span class="estado-vacio-kicker">SIN COINCIDENCIAS</span><h2 id="estadoVacioTitulo">No hay resultados con estos filtros</h2>
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
  if(F.doc){document.getElementById('estadoConsulta').textContent=data.documentos?.length?'Documento seleccionado':'Documento seleccionado no disponible';return;}
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
  const focoAnterior=document.activeElement;
  vistaActual=vista;aplicarVista();
  // Al salir de un panel, el foco no debe quedarse en un botón oculto.
  // No se mueve al teclear, al cargar resultados ni al restaurar la sesión.
  if(focoAnterior?.closest('[hidden]')){
    const panel=(vistas[vistaActual]||[]).map(id=>document.getElementById(id)).find(el=>el&&!el.hidden);
    const destino=panel?.querySelector('h1,h2')||panel;
    if(destino){if(!destino.hasAttribute('tabindex'))destino.setAttribute('tabindex','-1');destino.focus({preventScroll:true});}
  }
  window.scrollTo({top:0,behavior:'instant'});
}
window.euclidianCambiarVista=mostrarVista;
window.euclidianAbrirGuardado=id=>{if(!accesoConsulta)return;reiniciarFiltros();F.doc=id;mostrarVista('consultar');cargar().catch(()=>{});};
window.euclidianBuscarTexto=texto=>{
  if(typeof texto!=='string'||!accesoConsulta||document.getElementById('puerta')?.hidden!==true)return false;
  const q=texto.trim().slice(0,160);if(!q)return false;
  reiniciarFiltros();F.q=q;document.getElementById('consulta').value=q;
  mostrarVista('consultar');document.getElementById('consulta').focus({preventScroll:true});
  cargar().catch(()=>{});return true;
};
window.euclidianRestablecerVista=()=>{generacionCarga++;controladorConsulta?.abort();ultimaRespuesta=null;catalogoTemas=[];accesoConsulta=false;vistaActual='inicio';window.euclidianVistaActual='inicio';liberarCarga();};
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
    window.euclidianCuentaInterna?.(true);
    document.getElementById('perfilForm').hidden=true;
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
  controladorConsulta?.abort();
  marcarActivos();
  const lista=document.getElementById('lista'),btn=document.getElementById('btnRecargar'),mal=document.getElementById('mal');
  if(btn)btn.disabled=true;estadoCarga(true,F.q?'Buscando y verificando…':'Ordenando la información…');
  if(lista)lista.innerHTML=skeletonConsulta();document.getElementById('paginas').innerHTML='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  controladorConsulta=controller;
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
      window.EuclidianHerramientas?.limpiar();window.EuclidianExpedientes?.limpiar();window.EuclidianComparador?.limpiar();window.EuclidianInformes?.limpiar();
      accesoConsulta=false;['inicioDocumentos','inicioNovedades','explorarTemas','estadoTemas'].forEach(id=>document.getElementById(id)?.replaceChildren());
      document.getElementById('puerta').hidden=true;
      document.getElementById('cab').hidden=false;
      ['inicioPanel','novedadesCab','controles','barra','bienvenida','explorar','lista','paginas'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
      if(lista)lista.innerHTML='';
      mostrarVista('cuenta');await window.euclidianAuthSinSuscripcion?.(data);
      return data;
    }
    if(!r.ok)throw new Error(data.mensaje||'No pudimos cargar la biblioteca. Inténtalo de nuevo.');
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
    for(const id of ['estadoConsulta','rango']){const el=document.getElementById(id);if(el)el.textContent='Consulta no completada';}
    if(e.name==='AbortError')e=new Error('El servidor tardó demasiado en responder. Inténtalo de nuevo.');
    if(autenticar){if(lista)lista.innerHTML='';throw e;}
    if(document.getElementById('puerta')?.hidden===true){if(vistaActual==='inicio')document.getElementById('inicioDocumentos').innerHTML=vistaError(e.message);else if(lista)lista.innerHTML=vistaError(e.message);}
    throw e;
  }finally{clearTimeout(timer);if(generacion===generacionCarga){controladorConsulta=null;estadoCarga(false);if(btn)btn.disabled=false;}}
}
function poblarTemas(temas){
  const sel=document.getElementById('selTema');if(!sel)return;
  const actual=sel.value;
  const orde…5425 tokens truncated…cerrar')){crearVentana().close();return;}
  if(boton.hasAttribute('data-comp-ejecutar')){resultado();return;}
  if(boton.hasAttribute('data-comp-exportar')){exportar();return;}
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
window.EuclidianComparador={panel,preparar,marcado,fuenteOficial,borrador,limpiar:limpiarSesion};
})();