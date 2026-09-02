/* EUCLIDIAN — señales de la ficha
 *
 * Que tono lleva cada documento, sus glifos, y las fechas. Los bloques
 * de contenido estan en bloques.js, que se carga despues.
 */

/* EUCLIDIAN — armado de las fichas.
 *
 * Aqui vive todo lo que convierte un documento en algo legible: las
 * etiquetas de tema, los glifos al modo de Byrne, y los bloques de la
 * ficha. Separado del resto porque cambia por razones distintas: esto
 * se toca cuando cambia como se ve un documento, bandeja.js cuando
 * cambia como se navega.
 *
 * Se carga antes que bandeja.js. Ambos usan defer, que conserva el orden.
 */
/* ═══════════ etiquetas ═══════════ */
const MESES=['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
function fechaCorta(f){
  if(!f) return '';
  const p = String(f).slice(0,10).split('-');
  return p.length===3 ? `${+p[2]} ${MESES[+p[1]]} ${p[0]}` : '';
}

const MESNUM = {enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,
  agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};

/* Saca la fecha de un plazo escrito en prosa. Devuelve null si no hay una
   fecha clara: preferible no mostrar cuenta regresiva a mostrarla mal. */
function fechaDePlazo(texto){
  if(!texto) return null;
  const m = texto.match(/(?:hasta el|a más tardar el|el)\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(20\d{2})/i);
  if(!m) return null;
  const mes = MESNUM[m[2].toLowerCase()];
  if(!mes) return null;
  const f = new Date(+m[3], mes-1, +m[1]);
  return isNaN(f) ? null : f;
}
function diasHasta(f){
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((f - hoy) / 86400000);
}

/* La fecha principal de la ficha es la fecha que la DIAN declara como
   publicación en su página web. fecha_publicacion conserva la fecha propia
   del acto/concepto y solo se usa como respaldo si la DIAN no informó fecha web. */
function fechaFicha(d){
  if (d.fecha_publicacion_web)
    return `<span class="fecha">${fechaCorta(d.fecha_publicacion_web)}</span>`;
  if (d.precision_fecha === 'exacta' || d.fecha_es_real)
    return `<span class="fecha">${fechaCorta(d.fecha_publicacion)}</span>`;
  const anio = d.anio_publicacion || d.anio || String(d.fecha_publicacion || '').slice(0,4);
  if (!anio) return '';
  return `<span class="fecha aproximada" title="La DIAN no publicó el día exacto">${anio}</span>`;
}

function esc(s){
  return String(s??'').replace(/[&<>\"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
}

/* ═══════════ piezas de la ficha ═══════════ */

/* La señal de la ficha: el rotulo y el color salen del MISMO motivo.
   Antes el color venia del nivel de prioridad y el rotulo del motivo,
   asi que un mismo tono acababa significando cosas distintas.

   Tonos:  alerta  detente, actua
           obliga  te obliga
           orienta orienta, no obliga
           neutro  informacion

   El orden de las reglas es el desempate: lo que exige accion se
   evalua primero, porque la accion manda sobre la clasificacion. */
function señal(d){
  if (d.estado_vigencia !== 'vigente')
    return {rotulo:'No la apliques', tono:'alerta'};
  if (d.nivel_alerta === 'critica')
    return {rotulo:'Acción requerida', tono:'alerta'};

  const f = fechaDePlazo((d.plazos_mencionados||[])[0]);
  const dias = f ? diasHasta(f) : null;
  if (dias !== null && dias >= 0 && dias <= 30)
    return {rotulo:'Vence pronto', tono:'alerta'};
  if (d.tiene_efectos_retroactivos)
    return {rotulo:'Puede tocar años pasados', tono:'alerta'};

  if ((d.modificado_por||[]).length)
    return {rotulo:'Hay norma posterior', tono:'orienta'};
  if (dias !== null && dias >= 0)
    return {rotulo:'Tiene plazo', tono:'obliga'};
  if (d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes')
    return {rotulo:'Obligatoria', tono:'obliga'};

  return {rotulo:'Informativa', tono:'neutro'};
}

/* Los glifos van al modo de Byrne: la figura dice lo que diria una etiqueta. */
function glifo(d){
  // Los dos azules son el mismo color a distinta intensidad: obligar y
  // orientar son grados de lo mismo, y la figura lo refuerza.
  const c = d.estado_vigencia !== 'vigente' ? '#B23A32'
          : d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes' ? '#2C4C8F'
          : '#3D82B8';
  if (d.estado_vigencia !== 'vigente')
    return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <rect x="2" y="2" width="11" height="11" fill="none" stroke="${c}" stroke-width="1.5"/>
      <line x1="2" y1="13" x2="13" y2="2" stroke="${c}" stroke-width="1.5"/></svg>`;
  if (d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes')
    return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
      <polygon points="7.5,2 13.5,13 1.5,13" fill="${c}"/></svg>`;
  return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true">
    <circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="${c}" stroke-width="1.8"/></svg>`;
}

function leyenda(d){
  if (d.estado_vigencia !== 'vigente') return d.estado_vigencia;
  const o = d.clasificacion_obligatoriedad;
  if (o === 'obligatorio_dian_y_contribuyentes') return 'obliga al contribuyente';
  if (o === 'obligatorio_dian_solo') return 'criterio de la DIAN';
  return 'informativo';
}
