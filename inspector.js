const $ = id => document.getElementById(id);
let reviewKey = sessionStorage.getItem('euclidian_revisor_clave') || '';
let currentPage = 1;
let currentTotal = 0;
const escapeHtml = value => String(value ?? '').replace(/[&<>"']/g, ch => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[ch]));
const number = value => Number(value || 0).toLocaleString('es-CO');
const when = value => value ? new Date(value).toLocaleString('es-CO', {dateStyle:'medium',timeStyle:'short'}) : 'Sin fecha';
const safeOfficialUrl = value => { try { const u = new URL(value); const normograma = u.hostname === 'normograma.dian.gov.co' && u.pathname.startsWith('/dian/compilacion/'); const boletin = u.hostname === 'www.dian.gov.co' && u.pathname.startsWith('/normatividad/Publicaciones-Juridicas/') && u.pathname.toLowerCase().endsWith('.pdf'); return u.protocol === 'https:' && (normograma || boletin) ? u.href : ''; } catch { return ''; } };

async function load() {
  const params = new URLSearchParams({estado:$('filtro').value,pagina:String(currentPage)});
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
$('anterior').addEventListener('click', () => { currentPage--; load().catch(error => { $('estado').textContent = error.message; }); });
$('siguiente').addEventListener('click', () => { currentPage++; load().catch(error => { $('estado').textContent = error.message; }); });
if (reviewKey) load().catch(() => { $('errorAcceso').textContent = 'Vuelve a ingresar la clave de revisión.'; reviewKey = ''; sessionStorage.removeItem('euclidian_revisor_clave'); });
