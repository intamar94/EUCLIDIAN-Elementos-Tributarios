/* EUCLIDIAN — navegacion de la bandeja.
 *
 * Estado, carga, paginacion, filtros y decisiones. El armado visual de
 * cada ficha esta en fichas.js, que se carga antes.
 */
let CLAVE = sessionStorage.getItem('euclidian_clave') || '';
/* Tres ejes que se combinan libremente, mas tema y orden. */
const F = { estado:'pendientes', prioridad:'', naturaleza:'',
            tema:'', orden:'recientes', pagina:1 };

function entrar(e){
  e.preventDefault();
  CLAVE = document.getElementById('clave').value;
  sessionStorage.setItem('euclidian_clave', CLAVE);
  cargar();
}

/* ═══════════ editor ═══════════ */
function contar(id){
  const t = document.getElementById('r-'+id), c = document.getElementById('c-'+id);
  if(!t||!c) return;
  const n = t.value.trim().length;
  c.textContent = n ? n+' / 320' : '0';
  c.className = 'contador' + (n>320 ? ' largo' : '');
}
function usarBorrador(id){
  const t = document.getElementById('r-'+id);
  const b = document.querySelector(`article[data-id="${id}"] .borrador p`);
  if(!t||!b) return;
  t.value = b.textContent.trim(); contar(id); t.focus();
}
async function guardarResumen(id){
  const t = document.getElementById('r-'+id);
  if(!t) return;
  const valor = t.value.trim();
  if (t.dataset.guardado === valor) return;
  try{
    const r = await fetch('/api/decidir',{method:'POST',
      headers:{'Content-Type':'application/json','x-clave':CLAVE},
      body: JSON.stringify({id, decision:'devolver', resumen:valor})});
    if(!r.ok) throw new Error('no se guardó');
    t.dataset.guardado = valor; t.style.borderColor='';
    const art = t.closest('article');
    if(art) art.classList.toggle('escrito', !!valor);
  }catch(e){ t.style.borderColor='var(--regla)'; }
}

/* ═══════════ carga ═══════════ */
async function cargar(){
  const lista = document.getElementById('lista');
  const btn = document.getElementById('btnRecargar');
  if(btn) btn.disabled = true;
  lista.innerHTML = '<div class="aviso">Leyendo…</div>';
  document.getElementById('paginas').innerHTML = '';
  try{
    const q = new URLSearchParams({estado:F.estado, orden:F.orden, pagina:F.pagina});
    if(F.tema) q.set('tema', F.tema);
    if(F.prioridad) q.set('prioridad', F.prioridad);
    if(F.naturaleza) q.set('naturaleza', F.naturaleza);

    const r = await fetch('/api/documentos?'+q, {headers:{'x-clave':CLAVE}});
    if (r.status === 401){
      sessionStorage.removeItem('euclidian_clave');
      document.getElementById('puerta').hidden = false;
      document.getElementById('mal').textContent = 'Clave incorrecta.';
      lista.innerHTML=''; return;
    }
    const data = await r.json();
    if (!r.ok) throw new Error(data.detalle || data.error);

    document.getElementById('puerta').hidden = true;
    document.getElementById('mal').textContent = '';
    document.getElementById('cab').hidden = false;
    document.getElementById('controles').hidden = false;
    document.getElementById('nPend').textContent = data.pendientes;
    document.getElementById('nApr').textContent = data.aprobados;

    pintar('gPrioridad', data.prioridad || {});
    pintar('gNaturaleza', data.naturaleza || {});
    pintar('gEstado', data.estado || {});
    marcarActivos();
    poblarTemas(data.temas || []);

    const s = document.getElementById('sello');
    if (s && data.actualizado){
      const f = new Date(data.actualizado);
      s.textContent = 'Datos al ' + f.toLocaleDateString('es-CO',{day:'numeric',month:'long'}) +
        ', ' + f.toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
    }

    if (!data.documentos.length){
      lista.innerHTML = F.estado==='aprobados'
        ? '<div class="aviso"><b>Nada aprobado aún</b>Aprueba documentos y aparecerán aquí.</div>'
        : '<div class="aviso"><b>Nada por aquí</b>Prueba con otro filtro, o vuelve cuando el scraper traiga cambios nuevos.</div>';
      return;
    }
    lista.innerHTML = data.documentos.map(ficha).join('');
    paginacion(data);
    window.scrollTo({top:0, behavior:'smooth'});
  }catch(e){
    lista.innerHTML = `<div class="error">No se pudo leer la base.<code>${esc(e.message)}</code></div>`;
  }finally{
    if(btn) btn.disabled = false;
  }
}

function pintar(grupo, conteos){
  document.querySelectorAll('#'+grupo+' button').forEach(b=>{
    const marca = b.querySelector('b');
    if(marca){
      const n = conteos[b.dataset.v];
      marca.textContent = (n===undefined ? '' : n);
    }
  });
}

/* Los temas vienen del servidor y cubren la seleccion completa, no solo
   la pagina visible: asi el selector no cambia de opciones al avanzar. */
function poblarTemas(temas){
  const sel = document.getElementById('selTema');
  const actual = sel.value;
  const orden = [...temas].sort((a,b)=>nombreTema(a).localeCompare(nombreTema(b),'es'));
  sel.innerHTML = '<option value="">Todos los temas</option>' +
    orden.map(t=>`<option value="${t}">${nombreTema(t)}</option>`).join('');
  sel.value = actual;
}

/* Antes se traian 60 documentos sin decir que habia mas. Quien llegaba
   al final creia haberlo visto todo. */
function paginacion(data){
  const cont = document.getElementById('paginas');
  const {pagina, paginas, total, porPagina} = data;
  if (total === 0){ cont.innerHTML=''; return; }

  const primero = (pagina-1)*porPagina + 1;
  const ultimo = Math.min(pagina*porPagina, total);
  let html = `<div class="rango">${primero}–${ultimo} de ${total}</div>`;

  if (paginas > 1){
    html += `<button onclick="irA(${pagina-1})" ${pagina<=1?'disabled':''}>‹</button>`;
    const nums = new Set([1, paginas, pagina, pagina-1, pagina+1]);
    const orden = [...nums].filter(n=>n>=1 && n<=paginas).sort((a,b)=>a-b);
    let previo = 0;
    orden.forEach(n=>{
      if (n - previo > 1) html += `<span style="color:var(--tenue)">…</span>`;
      html += `<button onclick="irA(${n})" aria-current="${n===pagina}">${n}</button>`;
      previo = n;
    });
    html += `<button onclick="irA(${pagina+1})" ${pagina>=paginas?'disabled':''}>›</button>`;
  }
  cont.innerHTML = html;
}
function irA(n){ F.pagina = n; cargar(); }

/* ═══════════ decisiones ═══════════ */
async function decidir(id, decision){
  const art = document.querySelector(`article[data-id="${id}"]`);
  const t = document.getElementById('r-'+id);
  const resumen = t ? t.value.trim() : undefined;
  if (art) art.style.opacity = '.4';
  try{
    const r = await fetch('/api/decidir',{method:'POST',
      headers:{'Content-Type':'application/json','x-clave':CLAVE},
      body: JSON.stringify({id, decision, resumen})});
    if (!r.ok){
      const d = await r.json();
      throw new Error(d.detalle || d.error || 'falló');
    }
    if (art) art.remove();
    const n = document.getElementById('nPend');
    n.textContent = Math.max(0, (+n.textContent||0) - 1);
    if (decision==='aprobar'){
      const a = document.getElementById('nApr');
      a.textContent = (+a.textContent||0) + 1;
    }
    if (!document.querySelector('article')) cargar();
  }catch(e){
    if (art){
      art.style.opacity='1';
      art.insertAdjacentHTML('beforeend',
        `<div class="error" style="margin-top:10px">No se guardó la decisión.<code>${esc(e.message)}</code></div>`);
    }
  }
}

/* ═══════════ controles ═══════════ */
/* Cuantos filtros hay puestos, y como quitarlos. Sin esto es facil
   quedarse mirando una lista corta sin recordar que hay un tema
   seleccionado dentro del panel. */
function marcarActivos(){
  const n = [
    F.prioridad, F.naturaleza, F.tema,
    F.estado !== 'pendientes' ? F.estado : '',
    F.orden !== 'recientes' ? F.orden : '',
  ].filter(Boolean).length;
  const marca = document.getElementById('activos');
  if (marca) marca.textContent = n ? n : '';
  const btn = document.getElementById('btnLimpiar');
  if (btn) btn.hidden = n === 0;
}

function limpiar(){
  F.prioridad = ''; F.naturaleza = ''; F.tema = '';
  F.estado = 'pendientes'; F.orden = 'recientes'; F.pagina = 1;
  document.getElementById('selTema').value = '';
  document.getElementById('selOrden').value = 'recientes';
  ['gPrioridad','gNaturaleza','gEstado'].forEach(g=>{
    document.querySelectorAll('#'+g+' button').forEach((b,i)=>
      b.setAttribute('aria-pressed', String(i === 0)));
  });
  cargar();
}

function grupoClic(grupo, campo){
  document.getElementById(grupo).addEventListener('click', e=>{
    const b = e.target.closest('button'); if(!b) return;
    F[campo] = b.dataset.v;
    F.pagina = 1;
    document.querySelectorAll('#'+grupo+' button').forEach(x=>
      x.setAttribute('aria-pressed', String(x===b)));
    cargar();
  });
}
grupoClic('gPrioridad','prioridad');
grupoClic('gNaturaleza','naturaleza');
grupoClic('gEstado','estado');

document.getElementById('selTema').addEventListener('change', e=>{
  F.tema = e.target.value; F.pagina = 1; cargar();
});
document.getElementById('selOrden').addEventListener('change', e=>{
  F.orden = e.target.value; F.pagina = 1; cargar();
});

if (CLAVE) cargar(); else document.getElementById('puerta').hidden = false;
