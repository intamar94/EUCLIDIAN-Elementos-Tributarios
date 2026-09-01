/* EUCLIDIAN — navegación de la bandeja del cliente. El cliente consulta únicamente información ya verificada/publicada. */
let CLAVE=sessionStorage.getItem('euclidian_clave')||'';
const F={prioridad:'',naturaleza:'',tema:'',orden:'recientes',pagina:1};
function entrar(e){e.preventDefault();CLAVE=document.getElementById('clave').value;sessionStorage.setItem('euclidian_clave',CLAVE);cargar()}
function listaArray(v){return Array.isArray(v)?v:(v==null||v===''?[]:[v])}
function normalizarDocumento(d){
  const x={...d};
  ['temas','descriptores','plazos_mencionados','modificado_por','modifica_a','zonas_afectadas','fuentes_formales','jurisprudencia_citada','doctrina_citada','anos_afectados','borrador_advertencias'].forEach(k=>{x[k]=listaArray(x[k])});
  x.temas=x.temas.map(v=>String(v??''));
  x.descriptores=x.descriptores.map(v=>String(v??''));
  x.plazos_mencionados=x.plazos_mencionados.map(v=>String(v??''));
  x.zonas_afectadas=x.zonas_afectadas.map(v=>String(v??''));
  x.fuentes_formales=x.fuentes_formales.map(v=>String(v??''));
  x.jurisprudencia_citada=x.jurisprudencia_citada.map(v=>String(v??''));
  x.doctrina_citada=x.doctrina_citada.map(v=>String(v??''));
  x.anos_afectados=x.anos_afectados.map(v=>String(v??''));
  x.borrador_advertencias=x.borrador_advertencias.map(v=>String(v??''));
  return x;
}
function fichaSegura(d){
  const titulo=String(d.titulo||d.numero_resolucion||'Documento tributario');
  const numero=String(d.numero_resolucion||d.numero_interno||'');
  const enlace=String(d.enlace_oficial||'#');
  const fecha=String(d.fecha_publicacion||'').slice(0,10);
  const resumen=String(d.resumen_humano||d.resumen_borrador||d.descripcion_limpia||d.contenido||'').slice(0,900);
  const temas=listaArray(d.temas).map(v=>String(v)).filter(Boolean).slice(0,6);
  const vigencia=String(d.estado_vigencia||'');
  const fuerza=d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes'?'Obligatoria':d.clasificacion_obligatoriedad==='obligatorio_dian_solo'?'Criterio de la DIAN':'Informativa';
  return `<article class="t-neutro ficha-segura"><div class="fila-id"><span aria-hidden="true">●</span><a class="codigo" href="${esc(enlace)}" target="_blank" rel="noopener">${esc(numero)}</a>${fecha?`<span class="fecha">${esc(fecha)}</span>`:''}</div><h2>${esc(titulo)}</h2>${resumen?`<div class="respuesta"><p>${esc(resumen)}</p></div>`:''}<div class="clasificacion"><div class="grupo-marcas"><span class="clas-rotulo">Clasificación</span><div class="marcas"><span>${esc(fuerza)}</span>${vigencia?`<span>${esc(vigencia)}</span>`:''}${temas.map(t=>`<span>${esc(t)}</span>`).join('')}</div></div></div><div class="acciones"><button class="si" onclick="decidir('${esc(d.id)}','aprobar')">Aprobar</button><button onclick="decidir('${esc(d.id)}','descartar')">Descartar</button></div></article>`;
}
function renderFicha(d){const x=normalizarDocumento(d);try{return ficha(x)}catch(e){return fichaSegura(x)}}
async function cargar(){const lista=document.getElementById('lista'),btn=document.getElementById('btnRecargar');if(btn)btn.disabled=true;lista.innerHTML='<div class="aviso"><b>Cargando información</b><span>Consultando la información verificada…</span></div>';document.getElementById('paginas').innerHTML='';try{const q=new URLSearchParams({orden:F.orden,pagina:F.pagina});if(F.tema)q.set('tema',F.tema);if(F.prioridad)q.set('prioridad',F.prioridad);if(F.naturaleza)q.set('naturaleza',F.naturaleza);const r=await fetch('/api/documentos?'+q,{headers:{'x-clave':CLAVE}});if(r.status===401){sessionStorage.removeItem('euclidian_clave');document.getElementById('puerta').hidden=false;document.getElementById('mal').textContent='No se pudo validar el acceso.';lista.innerHTML='';return}const data=await r.json();if(!r.ok)throw new Error(data.detalle||data.error);document.getElementById('puerta').hidden=true;document.getElementById('mal').textContent='';document.getElementById('cab').hidden=false;document.getElementById('controles').hidden=false;document.getElementById('barra').hidden=false;pintar('gPrioridad',data.prioridad||{});pintar('gNaturaleza',data.naturaleza||{});marcarActivos();poblarTemas(data.temas||[]);const s=document.getElementById('sello');if(s&&data.actualizado){const f=new Date(data.actualizado);s.textContent='Actualizado el '+f.toLocaleDateString('es-CO',{day:'numeric',month:'long'})+', '+f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'})}if(!Array.isArray(data.documentos)||!data.documentos.length){lista.innerHTML='<div class="aviso"><b>No hay documentos publicados.</b><span>La información aparece aquí cuando supera la revisión interna.</span></div>';return}lista.innerHTML=data.documentos.map(renderFicha).join('');paginacion(data);window.scrollTo({top:0,behavior:'smooth'})}catch(e){lista.innerHTML='<div class="error"><b>No se pudo cargar la información.</b><span>Inténtalo de nuevo en unos momentos.</span></div>'}finally{if(btn)btn.disabled=false}}
function pintar(grupo,conteos){document.querySelectorAll('#'+grupo+' button').forEach(b=>{const m=b.querySelector('b');if(m)m.textContent=conteos[b.dataset.v]===undefined?'':conteos[b.dataset.v]})}
function poblarTemas(temas){const sel=document.getElementById('selTema'),actual=sel.value,orden=[...temas].sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));sel.innerHTML='<option value="">Todos los temas</option>'+orden.map(t=>`<option value="${t}">${nombreTema(t)}</option>`).join('');sel.value=actual}
function paginacion(data){const cont=document.getElementById('paginas'),{pagina,paginas,total,porPagina}=data;if(!total){cont.innerHTML='';return}const primero=(pagina-1)*porPagina+1,ultimo=Math.min(pagina*porPagina,total);let html=`<div class="rango">${primero}–${ultimo} de ${total}</div>`;if(paginas>1){html+=`<button onclick="irA(${pagina-1})" ${pagina<=1?'disabled':''}>‹</button>`;const nums=new Set([1,paginas,pagina,pagina-1,pagina+1]);const orden=[...nums].filter(n=>n>=1&&n<=paginas).sort((a,b)=>a-b);let previo=0;orden.forEach(n=>{if(n-previo>1)html+='<span aria-hidden="true">…</span>';html+=`<button onclick="irA(${n})" aria-current="${n===pagina}">${n}</button>`;previo=n});html+=`<button onclick="irA(${pagina+1})" ${pagina>=paginas?'disabled':''}>›</button>`}cont.innerHTML=html}
function irA(n){if(n<1)return;F.pagina=n;cargar()}
function marcarActivos(){const n=[F.prioridad,F.naturaleza,F.tema,F.orden!=='recientes'?F.orden:''].filter(Boolean).length;const marca=document.getElementById('activos');if(marca)marca.textContent=n?' · '+n+' filtro'+(n===1?'':'s'):'';const btn=document.getElementById('btnLimpiar');if(btn)btn.hidden=n===0}
function limpiar(){F.prioridad='';F.naturaleza='';F.tema='';F.orden='recientes';F.pagina=1;document.getElementById('selTema').value='';document.getElementById('selOrden').value='recientes';document.querySelectorAll('#gPrioridad button,#gNaturaleza button').forEach((b,i)=>b.setAttribute('aria-pressed',String(i===0)));cargar()}
function grupoClic(grupo,campo){document.getElementById(grupo).addEventListener('click',e=>{const b=e.target.closest('button');if(!b)return;F[campo]=b.dataset.v;F.pagina=1;document.querySelectorAll('#'+grupo+' button').forEach(x=>x.setAttribute('aria-pressed',String(x===b)));cargar()})}
grupoClic('gPrioridad','prioridad');grupoClic('gNaturaleza','naturaleza');document.getElementById('selTema').addEventListener('change',e=>{F.tema=e.target.value;F.pagina=1;cargar()});document.getElementById('selOrden').addEventListener('change',e=>{F.orden=e.target.value;F.pagina=1;cargar()});if(CLAVE)cargar();else document.getElementById('puerta').hidden=false;
