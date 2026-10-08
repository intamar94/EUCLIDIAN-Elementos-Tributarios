const $ = id => document.getElementById(id);
let reviewKey = sessionStorage.getItem('euclidian_revisor_clave') || '';
let currentPage = 1;
let currentTotal = 0;
let casePage = 1;
let caseTotal = 0;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number = value => Number(value || 0).toLocaleString('es-CO');
const when = value => value ? new Date(value).toLocaleString('es-CO', {dateStyle:'medium',timeStyle:'short'}) : 'Sin fecha';
const safeOfficialUrl = value => { try { const u = new URL(value); const normograma = u.hostname === 'normograma.dian.gov.co' && u.pathname.startsWith('/dian/compilacion/'); const boletin = u.hostname === 'www.dian.gov.co' && u.pathname.startsWith('/normatividad/Publicaciones-Juridicas/') && u.pathname.toLowerCase().endsWith('.pdf'); return u.protocol === 'https:' && (normograma || boletin) ? u.href : ''; } catch { return ''; } };

async function load() {
  const params = new URLSearchParams({estado:$('filtro').value,pagina:String(currentPage),caso_estado:$('filtroCasos').value,caso_pagina:String(casePage)});
  const response = await fetch('/api/inspector?' + params, {headers:{'x-clave':reviewKey},cache:'no-store'});
  if (response.status === 401) throw new Error('Clave de revisión incorrecta.');
  if (!response.ok) throw new Error('No se pudo consultar el inspector.');
  const data = await response.json();
  $('acceso').hidden = true;
  $('informe').hidden = false;
  const run = data.ejecucion;
  if (!run) {
    $('estado').textContent = 'El inspector aún no ha realizado una ejecución completa.';
    return;
  }
  $('fecha').textContent = `Iniciada ${when(run.iniciado_en)} · Finalizada ${when(run.finalizado_en)}`;
  const complete = ['correcto','alerta'].includes(run.estado) && run.revisados === run.total && run.total > 0;
  $('estado').className = 'estado ' + run.estado;
  $('estado').textContent = complete ? (run.estado === 'alerta' ? 'Cobertura completa con hallazgos para corregir.' : 'Cobertura completa sin alertas automáticas.') :
    run.estado === 'en_curso' ? 'Inspección en curso. La cobertura total todavía no está confirmada.' : `Inspección incompleta: ${run.error || 'revisa la ejecución programada.'}`;
  $('metricas').innerHTML = [
    [number(run.revisados) + ' / ' + number(run.total), 'Registros comprobados'],
    [number(run.criticos), 'Con hallazgos críticos'],
    [number(run.avisos), 'Con avisos'],
    [number(run.enlaces?.revisados), `Enlaces DIAN comprobados en esta ejecución · ${number(run.enlaces?.rotos)} fallaron`]
  ].map(([value,label]) => `<div class="metrica"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('');
  const gestion = data.gestion || {};
  const gestionRun = gestion.ejecucion;
  const sameCycle = gestionRun && (gestionRun.verificacion_id === run.id || gestionRun.inspeccion_id === run.id);
  $('gestion').innerHTML = gestionRun ? `<p class="${sameCycle ? 'bien-texto' : 'fallo-texto'}">${sameCycle ? 'Último ciclo registrado' : 'Hay una inspección nueva pendiente de gestión'} · ${escapeHtml(gestionRun.estado)} · ${when(gestionRun.finalizado_en)}</p><div class="metricas">${[
    [number(gestionRun.correcciones_verificadas), 'Correcciones comprobadas'],
    [number(gestionRun.en_cuarentena), 'Fuera de publicación en este ciclo'],
    [number(gestionRun.pendientes_evidencia), 'Sin evidencia suficiente'],
    [number(gestionRun.requieren_analisis), 'Requieren contraste documental']
  ].map(([value,label]) => `<div class="metrica"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`).join('')}</div>` : '<p>El ciclo de gestión todavía no ha procesado esta inspección.</p>';
  const labels = {abierto:'Abierto',en_cuarentena:'Fuera de publicación',correccion_verificada:'Corrección comprobada; falta publicación',resuelto_verificado:'Cerrado y comprobado'};
  const counts = gestion.conteos || {};
  $('conteosCasos').textContent = `${number(counts.abiertos)} pendientes · ${number(counts.en_cuarentena)} fuera de publicación · ${number(counts.correccion_verificada)} con corrección comprobada`;
  caseTotal = gestion.total || 0;
  $('expedientes').innerHTML = (gestion.expedientes || []).map(item => {
    const d = item.documento || {};
    const source = safeOfficialUrl(item.fuente_url) || safeOfficialUrl(d.enlace_oficial);
    const evidence = item.evidencia || {};
    const proof = `<details class="detalle-evidencia"><summary>Ver evidencia y trazabilidad</summary><dl><dt>Inspección de origen</dt><dd>${escapeHtml(item.inspeccion_ultima || 'Sin dato')}</dd><dt>Reinspección</dt><dd>${escapeHtml(item.verificacion_id || 'Pendiente')}</dd><dt>Fuente consultada</dt><dd>${escapeHtml(evidence.consultada_en || 'Sin fecha registrada')}</dd><dt>Dato anterior</dt><dd>${escapeHtml(JSON.stringify(evidence.antes ?? 'No registrado'))}</dd><dt>Dato resultante</dt><dd>${escapeHtml(JSON.stringify(evidence.despues ?? 'No registrado'))}</dd><dt>Huella del contenido</dt><dd>${escapeHtml(evidence.sha256 || evidence.texto_sha256 || 'No disponible')}</dd><dt>Motivo técnico</dt><dd>${escapeHtml(evidence.error || 'Ninguno registrado')}</dd></dl></details>`;
    const ready = item.estado === 'correccion_verificada' && d.id && !d.publicado_cliente;
    const editor = ready ? `<div class="editor-expediente"><p><b>Para volver a publicar:</b> coteja la fuente DIAN, la fecha y la síntesis que leerá el contador.</p><p>Fecha del documento: ${escapeHtml(d.fecha_es_real ? d.fecha_publicacion || 'Sin dato' : 'No verificada')} · publicación web: ${escapeHtml(d.fecha_publicacion_web || 'Sin dato')}</p><label for="resumen-${escapeHtml(item.id)}">Síntesis para el contador</label><textarea id="resumen-${escapeHtml(item.id)}" rows="5" maxlength="4000">${escapeHtml(d.resumen_humano || d.resumen_borrador || d.descripcion_limpia || '')}</textarea><button type="button" data-publicar="${escapeHtml(d.id)}" data-resumen="resumen-${escapeHtml(item.id)}">Publicar ficha comprobada</button></div>` : '';
    return `<article class="expediente ${item.prioridad === 'alta' ? 'prioridad-alta' : ''}"><div class="expediente-titulo"><strong>${escapeHtml(d.titulo || d.numero_resolucion || item.documento_id || 'Documento no identificado')}</strong><span>${escapeHtml(d.publicado_cliente && item.estado === 'correccion_verificada' ? 'Publicada; pendiente cierre en el próximo control' : labels[item.estado] || item.estado)}</span></div><p><b>${escapeHtml(item.codigo.replaceAll('_', ' '))}</b> · prioridad ${escapeHtml(item.prioridad)} · detectado ${when(item.primera_deteccion)} · ${number(item.intentos)} controles</p><p>${escapeHtml(item.detalle)}</p><p><b>Siguiente paso:</b> ${escapeHtml(item.accion_requerida)}</p><p class="evidencia">Último control: ${when(item.ultimo_control_en)}${evidence.sha256 ? ' · huella de fuente: ' + escapeHtml(evidence.sha256.slice(0,16)) + '…' : ''}${item.verificacion_id ? ' · reinspección registrada' : ''}</p>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Abrir fuente DIAN</a>` : '<span class="fallo-texto">Sin fuente individual comprobable</span>'}${proof}${editor}</article>`;
  }).join('') || '<p>No hay expedientes en este filtro.</p>';
  $('casosPagina').textContent = `Página ${casePage} de ${Math.max(1,Math.ceil(caseTotal/25))} · ${number(caseTotal)} expedientes`;
  $('casosAnterior').disabled = casePage <= 1;
  $('casosSiguiente').disabled = casePage * 25 >= caseTotal;
  $('casos').innerHTML = (run.casos || []).map(c => `<div class="caso"><strong class="${c.estado === 'fallo' ? 'fallo-texto' : 'bien-texto'}">${escapeHtml(c.nombre)} · ${c.estado === 'fallo' ? 'Revisar' : 'Sin hallazgos automáticos'}</strong><p>${escapeHtml((c.hallazgos || []).join(' · ') || 'Fuente y datos centinela cotejados.')}</p>${safeOfficialUrl(c.fuente) ? `<a href="${escapeHtml(safeOfficialUrl(c.fuente))}" target="_blank" rel="noopener noreferrer">Abrir fuente DIAN</a>` : ''}</div>`).join('') || '<p>Los casos centinela todavía no se han ejecutado.</p>';
  $('enlaces').innerHTML = (run.enlaces?.muestra || []).map(x => `<div class="resultado"><strong>${escapeHtml(x.numero || x.id)}</strong><p>${escapeHtml(x.motivo)}</p></div>`).join('') || '<p>No se encontraron enlaces fallidos en la muestra de esta ejecución.</p>';
  $('motivos').innerHTML = Object.entries(run.motivos || {}).sort((a,b) => b[1]-a[1]).map(([code,count]) => `<div class="motivo">${escapeHtml(code.replaceAll('_',' '))}: <strong>${number(count)}</strong></div>`).join('') || '<p>Sin motivos registrados.</p>';
  currentTotal = data.total || 0;
  $('resultados').innerHTML = (data.resultados || []).map(r => {
    const d = r.documento || {};
    const source = safeOfficialUrl(d.enlace_oficial);
    return `<div class="resultado"><strong>${escapeHtml(d.titulo || d.numero_resolucion || r.documento_id)}</strong><p>${(r.hallazgos || []).map(h => escapeHtml(h.detalle)).join(' · ') || 'Sin alertas automáticas en el barrido estructural.'}</p>${source ? `<a href="${escapeHtml(source)}" target="_blank" rel="noopener noreferrer">Abrir fuente DIAN</a>` : ''}</div>`;
  }).join('') || '<p>No hay documentos con este estado en la ejecución seleccionada.</p>';
  $('pagina').textContent = `Página ${currentPage} de ${Math.max(1,Math.ceil(currentTotal/25))} · ${number(currentTotal)} documentos`;
  $('anterior').disabled = currentPage <= 1;
  $('siguiente').disabled = currentPage * 25 >= currentTotal;
}

$('formAcceso').addEventListener('submit', async event => {
  event.preventDefault();
  reviewKey = $('clave').value.trim();
  try { await load(); sessionStorage.setItem('euclidian_revisor_clave',reviewKey); $('errorAcceso').textContent = ''; }
  catch (error) { $('errorAcceso').textContent = error.message; reviewKey = ''; }
});
$('actualizar').addEventListener('click', () => load().catch(error => { $('estado').textContent = error.message; }));
$('filtro').addEventListener('change', () => { currentPage = 1; load().catch(error => { $('estado').textContent = error.message; }); });
$('filtroCasos').addEventListener('change', () => { casePage = 1; load().catch(error => { $('estado').textContent = error.message; }); });
$('casosAnterior').addEventListener('click', () => { casePage--; load().catch(error => { $('estado').textContent = error.message; }); });
$('casosSiguiente').addEventListener('click', () => { casePage++; load().catch(error => { $('estado').textContent = error.message; }); });
$('expedientes').addEventListener('click', async event => {
  const button = event.target.closest('[data-publicar]');
  if (!button) return;
  const summary = $(button.dataset.resumen)?.value.trim() || '';
  const messages = {sintesis_insuficiente:'La síntesis necesita al menos 80 caracteres comprobados.',inspeccion_no_vigente:'Hace falta una inspección completa y reciente.',expediente_bloqueante_abierto:'La ficha conserva un expediente bloqueante.',hallazgo_bloqueante:'La reinspección conserva un hallazgo bloqueante.',fecha_no_verificada:'La fecha del documento o de publicación no está comprobada.',fuente_no_verificable:'La fuente individual DIAN no es verificable.'};
  button.disabled = true;
  try {
    const response = await fetch('/api/decidir',{method:'POST',headers:{'Content-Type':'application/json','x-clave':reviewKey},body:JSON.stringify({id:button.dataset.publicar,decision:'aprobar',resumen:summary})});
    const data = await response.json();
    if (!response.ok) throw new Error(messages[data.motivo] || data.motivo || data.error || 'No se pudo publicar.');
    await load();
  } catch(error) { button.insertAdjacentHTML('afterend',`<p class="fallo-texto" role="alert">${escapeHtml(error.message)}</p>`); button.disabled = false; }
});
$('anterior').addEventListener('click', () => { currentPage--; load().catch(error => { $('estado').textContent = error.message; }); });
$('siguiente').addEventListener('click', () => { currentPage++; load().catch(error => { $('estado').textContent = error.message; }); });
if (reviewKey) load().catch(() => { $('errorAcceso').textContent = 'Vuelve a ingresar la clave de revisión.'; reviewKey = ''; sessionStorage.removeItem('euclidian_revisor_clave'); });
