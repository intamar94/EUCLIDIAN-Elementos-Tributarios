/* EUCLIDIAN — navegacion de la bandeja. */
let CLAVE = sessionStorage.getItem('euclidian_clave') || '';
let REVISOR = sessionStorage.getItem('euclidian_revisor_clave') || '';
window.euclidianPuedeRevisar=!!REVISOR;
const consultaInicial=new URLSearchParams(window.location.search);
const F = { estado:'todos', periodo:'todo', tema:'', q:(consultaInicial.get('q')||'').trim().slice(0,160), orden:'recientes', pagina:1 };
const cajaConsulta=document.getElementById('consulta'); if(cajaConsulta)cajaConsulta.value=F.q;

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
  const lista=document.getElementById('lista'),btn=document.getElementById('btnRecargar'),mal=document.getElementById('mal');if(btn)btn.disabled=true;if(lista)lista.innerHTML='<div class="aviso">Leyendo…</div>';document.getElementById('paginas').innerHTML='';
  const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),15000);
  try{const q=new URLSearchParams({estado:F.estado,orden:F.orden,periodo:F.periodo,pagina:F.pagina});if(F.q)q.set('q',F.q);if(F.tema)q.set('tema',F.tema);const r=await fetch('/api/documentos?'+q,{headers:{'x-clave':CLAVE},cache:'no-store',signal:controller.signal});if(r.status===401)throw new Error('Clave incorrecta.');const data=await r.json().catch(()=>({error:'Respuesta inválida del servidor.'}));if(!r.ok)throw new Error(data.detalle||data.error||'No se pudo leer la base.');sessionStorage.setItem('euclidian_clave',CLAVE);document.getElementById('puerta').hidden=true;if(mal)mal.textContent='';document.getElementById('cab').hidden=false;document.getElementById('controles').hidden=false;document.getElementById('barra').hidden=false;marcarActivos();poblarTemas(data.temas||[]);if(!data.documentos.length){lista.innerHTML='<div class="aviso"><b>Nada por aquí</b>Prueba con otro filtro.</div>';return data;}lista.innerHTML=data.documentos.map(ficha).join('');paginacion(data);window.scrollTo({top:0,behavior:'smooth'});return data;
  }catch(e){if(e.name==='AbortError')throw new Error('El servidor tardó demasiado en responder. Inténtalo de nuevo.');if(autenticar){if(lista)lista.innerHTML='';throw e;}if(lista)lista.innerHTML=`<div class="error">No se pudo leer la base.<code>${esc(e.message)}</code></div>`;throw e;}finally{clearTimeout(timer);if(btn)btn.disabled=false;}}
function poblarTemas(temas){const sel=document.getElementById('selTema');if(!sel)return;const actual=sel.value;const orden=[...temas].sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));sel.innerHTML='<option value="">Todos los temas</option>'+orden.map(t=>`<option value="${t}">${nombreTema(t)}</option>`).join('');sel.value=actual;}
function seleccionarAnio(anio){F.periodo=anio||'todo';F.pagina=1;marcarActivos();cargar();}
function paginacion(data){const cont=document.getElementById('paginas'),{pagina,paginas,total,porPagina}=data;if(total===0){cont.innerHTML='';return;}const primero=(pagina-1)*porPagina+1,ultimo=Math.min(pagina*porPagina,total),r=document.getElementById('rango');if(r)r.textContent=`${primero}–${ultimo} de ${total}`;let html='';if(paginas>1){html+=`<button onclick="irA(${pagina-1})" ${pagina<=1?'disabled':''}>‹</button>`;const nums=new Set([1,paginas,pagina,pagina-1,pagina+1]),orden=[...nums].filter(n=>n>=1&&n<=paginas).sort((a,b)=>a-b);let previo=0;orden.forEach(n=>{if(n-previo>1)html+='<span style="color:var(--tenue)">…</span>';html+=`<button onclick="irA(${n})" aria-current="${n===pagina}">${n}</button>`;previo=n;});html+=`<button onclick="irA(${pagina+1})" ${pagina>=paginas?'disabled':''}>›</button>`;}cont.innerHTML=html;}
function irA(n){F.pagina=n;cargar();}
async function decidir(id,decision){const art=document.querySelector(`article[data-id="${id}"]`),t=document.getElementById('r-'+id),resumen=t?t.value.trim():undefined;if(art)art.style.opacity='.4';try{const r=await fetch('/api/decidir',{method:'POST',headers:{'Content-Type':'application/json','x-clave':REVISOR},body:JSON.stringify({id,decision,resumen})});if(!r.ok){const d=await r.json();throw new Error(d.detalle||d.error||'falló');}if(art)art.remove();if(!document.querySelector('article'))cargar();}catch(e){if(art){art.style.opacity='1';art.insertAdjacentHTML('beforeend',`<div class="error" style="margin-top:10px">No se guardó la decisión.<code>${esc(e.message)}</code></div>`);}}}
function marcarActivos(){const n=[F.q,F.tema,F.estado!=='todos'?F.estado:'',F.periodo!=='todo'?F.periodo:''].filter(Boolean).length;const btn=document.getElementById('btnLimpiar');if(btn)btn.hidden=n===0;}
function limpiar(){F.q='';F.tema='';F.estado='todos';F.periodo='todo';F.pagina=1;const consulta=document.getElementById('consulta');if(consulta)consulta.value='';document.getElementById('selTema').value='';const anio=document.getElementById('selAnio');if(anio)anio.value='';const estado=document.getElementById('selEstado');if(estado)estado.value='todos';cargar();}
document.getElementById('selAnio').addEventListener('change',e=>seleccionarAnio(e.target.value));document.getElementById('selTema').addEventListener('change',e=>{F.tema=e.target.value;F.pagina=1;cargar();});document.getElementById('selEstado').addEventListener('change',e=>{F.estado=e.target.value;F.pagina=1;cargar();});document.getElementById('selOrden').addEventListener('change',e=>{F.orden=e.target.value;F.pagina=1;cargar();});document.getElementById('formBuscar').addEventListener('submit',e=>{e.preventDefault();F.q=document.getElementById('consulta').value.trim();F.pagina=1;cargar();});
if(REVISOR){const b=document.getElementById('btnRevision');if(b)b.textContent='Salir del modo revisión';}
if(CLAVE)cargar().catch(()=>{});else document.getElementById('puerta').hidden=false;
