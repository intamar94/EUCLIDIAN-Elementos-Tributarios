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
const MESES_LARGOS=['','enero','febrero','marzo','abril','mayo','junio','julio','agosto','septiembre','octubre','noviembre','diciembre'];
function fechaCorta(f){
  if(!f) return '';
  const p = String(f).slice(0,10).split('-');
  return p.length===3 ? `${+p[2]} ${MESES[+p[1]]} ${p[0]}` : '';
}
function fechaLarga(f){
  if(!f) return '';
  const p=String(f).slice(0,10).split('-');
  return p.length===3&&MESES_LARGOS[+p[1]] ? `${+p[2]} de ${MESES_LARGOS[+p[1]]} de ${p[0]}` : '';
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
  if ((d.precision_fecha === 'exacta' || d.fecha_es_real) && fechaDocumentoConfiable(d))
    return `<span class="fecha">${fechaCorta(d.fecha_publicacion)}</span>`;
  if (d.fecha_publicacion_web)
    return `<span class="fecha">${fechaCorta(d.fecha_publicacion_web)}</span>`;
  const anio = anioIdentificador(d) || d.anio_publicacion || d.anio;
  if (!anio) return '';
  return `<span class="fecha aproximada" title="Año del identificador DIAN; fecha exacta no verificada">${anio}</span>`;
}

function fechaDocumentoConfiable(d){
  if (!d.fecha_es_real || !d.fecha_publicacion) return false;
  const fecha=String(d.fecha_publicacion).slice(0,10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) return false;
  const hoy=new Date().toISOString().slice(0,10);
  if(fecha>hoy || fecha.endsWith('-01-01')) return false;
  const anio=anioIdentificador(d);
  return !anio || fecha.slice(0,4)===anio;
}

function anioIdentificador(d){
  const coincidencia=String(d.numero_resolucion||'').match(/-(19|20)\d{2}$/);
  return coincidencia?coincidencia[0].slice(1):'';
}

/* La ficha no presenta una fecha exacta si no está respaldada por el
   documento. Distingue la fecha propia del acto de la fecha en que la DIAN
   lo publicó en su web; ambas pueden ser relevantes y no son equivalentes. */
function fechaPrincipal(d){
  if (fechaDocumentoConfiable(d))
    return `<span class="fecha-principal">Documento DIAN · ${fechaLarga(d.fecha_publicacion)}</span>`;
  if (d.fecha_publicacion_web)
    return `<span class="fecha-principal">Publicada por DIAN · ${fechaLarga(d.fecha_publicacion_web)}</span>`;
  const anio=anioIdentificador(d)||d.anio_publicacion||d.anio||String(d.fecha_publicacion||'').slice(0,4);
  return anio?`<span class="fecha-principal aproximada" title="La fecha exacta del acto no está verificada">Año del documento · ${esc(anio)}</span>`:'';
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
  if (d.tipo_documento === 'boletin')
    return {rotulo:'Boletín DIAN · consulta informativa', tono:'neutro'};
  if (d.estado_vigencia && d.estado_vigencia !== 'vigente' && d.estado_vigencia !== 'desconocido')
    return {rotulo:'Revisa su vigencia', tono:'alerta'};
  if (!d.estado_vigencia || d.estado_vigencia === 'desconocido')
    return {rotulo:'Vigencia por confirmar', tono:'orienta'};
  if (d.nivel_alerta === 'critica')
    return {rotulo:'Acción requerida', tono:'alerta'};

  const f = fechaDePlazo((d.plazos_mencionados||[])[0]);
  const dias = f ? diasHasta(f) : null;
  if (dias !== null && dias >= 0 && dias <= 30)
    return {rotulo:'Fecha próxima mencionada', tono:'orienta'};

  if ((d.modificado_por||[]).length)
    return {rotulo:'Hay norma posterior', tono:'orienta'};
  if (dias !== null && dias >= 0)
    return {rotulo:'Fecha o plazo mencionado', tono:'orienta'};
  if (d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes')
    return {rotulo:'Norma general · confirmar ámbito', tono:'orienta'};

  return {rotulo:'Criterio informativo', tono:'neutro'};
}

/* Los glifos van al modo de Byrne: la figura dice lo que diria una etiqueta. */
function glifo(d){
  // El color clasifica la naturaleza del documento; no determina por sí solo
  // su aplicación al contribuyente concreto.
  const c = d.estado_vigencia && d.estado_vigencia !== 'vigente' && d.estado_vigencia !== 'desconocido' ? '#B23A32'
          : d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes' ? '#2C4C8F'
          : '#3D82B8';
  if (d.estado_vigencia && d.estado_vigencia !== 'vigente' && d.estado_vigencia !== 'desconocido')
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
  if (d.tipo_documento === 'boletin') return 'Publicación informativa DIAN';
  if (d.estado_vigencia && d.estado_vigencia !== 'vigente' && d.estado_vigencia !== 'desconocido') return d.estado_vigencia;
  if (!d.estado_vigencia || d.estado_vigencia === 'desconocido') return 'vigencia por confirmar';
  const o = d.clasificacion_obligatoriedad;
  if (o === 'obligatorio_dian_y_contribuyentes') return 'norma general · confirmar ámbito y vigencia';
  if (o === 'obligatorio_dian_solo') return 'criterio DIAN · revisar alcance';
  return 'informativo';
}
