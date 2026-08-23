/* EUCLIDIAN — armado de las fichas.
 *
 * Aqui vive todo lo que convierte un documento en algo legible: las
 * etiquetas de tema, los glifos al modo de Byrne, y los bloques de la ficha. Separado del resto porque cambia por razones distintas: esto se toca cuando cambia como se ve un documento, bandeja.js cuando cambia como se navega.
 *
 * Se carga antes que bandeja.js. Ambos usan defer, que conserva el orden.
 */
/* ═══════════ etiquetas ═══════════ */
const ETIQUETAS = {
  renta:'Renta', ganancia_ocasional:'Ganancia ocasional', iva:'IVA',
  consumo:'Impuesto al consumo', timbre:'Timbre', patrimonio:'Patrimonio',
  gmf:'GMF (4x1000)', simple:'Régimen SIMPLE', carbono:'Impuesto al carbono',
  plasticos:'Plásticos de un solo uso', saludables:'Impuestos saludables',
  licores_tabaco:'Licores y tabaco', normalizacion:'Normalización',
  retencion:'Retención en la fuente', retencion_iva:'ReteIVA',
  facturacion:'Facturación electrónica', nomina_electronica:'Nómina electrónica',
  exogena:'Información exógena', rut:'RUT', rub:'Beneficiario final',
  contabilidad:'Contabilidad y NIIF', devoluciones:'Devoluciones',
  firmeza:'Firmeza y prescripción', sanciones:'Sanciones',
  fiscalizacion:'Fiscalización', cobro:'Cobro y acuerdos de pago',
  beneficios:'Beneficios y conciliación', recursos:'Recursos y defensa',
  notificaciones:'Notificaciones', precios_transferencia:'Precios de transferencia',
  convenios:'Doble imposición', ece:'Entidades del exterior',
  aduanero:'Aduanero', cambiario:'Cambiario', comercio_exterior:'Comercio exterior',
  transporte:'Transporte de carga', zonas_francas:'Zonas francas',
  esal:'ESAL y donaciones', salud:'Salud', agropecuario:'Agropecuario',
  turismo:'Turismo', criptoactivos:'Criptoactivos', financiero:'Sector financiero',
  economia_naranja:'Economía naranja', formularios:'Formularios y recibos',
  calendario:'Calendario tributario', uvt:'UVT', interno_dian:'Interno de la DIAN',
};
function nombreTema(t){ return ETIQUETAS[t] || t.replace(/_/g,' '); }

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

function esc(s){
  return String(s??'').replace(/[&<>\"]/g, c =>
    ({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
}

/* ═══════════ piezas de la ficha ═══════════ */

const ROTULO_PRI = { accion:'Acción requerida', importante:'Importante', informativa:'Informativa' };

/* La cinta afina el rotulo con lo que solo se sabe en el navegador:
   si el plazo esta cerca. El nivel viene calculado de la base. */
function rotuloPrioridad(d){
  if (d.estado_vigencia !== 'vigente') return 'No la apliques';
  const f = fechaDePlazo((d.plazos_mencionados||[])[0]);
  if (f){
    const n = diasHasta(f);
    if (n >= 0 && n <= 30) return 'Vence pronto';
  }
  if (d.tiene_efectos_retroactivos) return 'Puede tocar años pasados';
  if ((d.modificado_por||[]).length) return 'Hay norma posterior';
  return ROTULO_PRI[d.prioridad] || 'Informativa';
}

/* Los glifos van al modo de Byrne: la figura dice lo que diria una etiqueta. */
function glifo(d){
  const c = d.estado_vigencia !== 'vigente' ? '#B23A32'
          : d.clasificacion_obligatoriedad === 'obligatorio_dian_y_contribuyentes' ? '#2C4C8F'
          : '#C99A2E';
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

/* La tesis juridica es la conclusion del documento: dice que respondio
   la DIAN, no de que trataba. Cuando existe, encabeza la ficha. */
function bloqueRespuesta(d){
  if(!d.tesis_juridica) return '';
  const r = d.tesis_respuesta || '';
  const marca = r==='si' ? 'Sí' : r==='no' ? 'No' : r==='matizada' ? 'Depende' : '—';
  const pregunta = d.problema_juridico
    ? `<div class="pregunta">${esc(d.problema_juridico).slice(0,300)}</div>` : '';
  return `<div class="respuesta ${r}">
    <div class="resp-cab"><span class="resp-marca">${marca}</span> Lo que respondió la DIAN</div>
    ${pregunta}
    <p>${esc(d.tesis_juridica).slice(0,700)}</p>
  </div>`;
}

function bloqueBorrador(d){
  if(!d.resumen_borrador || d.resumen_humano) return '';
  const c = d.borrador_confianza || 'baja';
  const ojo = (d.borrador_advertencias||[]).length
    ? `<div class="ojo">Verifica: ${(d.borrador_advertencias||[]).map(esc).join(' · ')}</div>` : '';
  return `<div class="borrador ${c==='baja'?'baja':''}">
    <div class="borrador-cab"><span>Borrador automático</span>
      <span class="confianza ${c}">confianza ${c}</span></div>
    <p>${esc(d.resumen_borrador)}</p>
    ${ojo}
    <button class="usar" onclick="usarBorrador('${d.id}')">Usar este texto y editarlo</button>
  </div>`;
}

/* Un plazo con fecha es lo mas accionable que trae un documento. */
function bloquePlazo(d){
  const p = (d.plazos_mencionados||[])[0];
  if(!p) return '';
  const f = fechaDePlazo(p);
  let marca = '';
  if (f){
    const n = diasHasta(f);
    marca = n >= 0
      ? `<span class="restan ${n>30?'lejos':''}">${n===0?'hoy':n===1?'mañana':'faltan '+n+' días'}</span>`
      : `<span class="restan pasado">ya pasó</span>`;
  }
  return `<div class="plazo">
    <div class="plazo-cab"><span>Plazo</span>${marca}</div>
    <p>${esc(p).slice(0,260)}</p>
  </div>`;
}

function bloqueRelaciones(d){
  const despues = d.modificado_por || [];
  const antes = d.modifica_a || [];
  if(!despues.length && !antes.length) return '';
  let html = '';
  if(despues.length){
    const items = despues.slice(0,4).map(r=>
      `<li>${esc(r.accion||'modificada')} por
        <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'')}</a>
        ${r.fecha?`<span style="color:var(--tenue)">(${fechaCorta(r.fecha)})</span>`:''}</li>`).join('');
    const mas = despues.length>4 ? `<li style="color:var(--tenue)">y ${despues.length-4} más</li>` : '';
    html += `<div class="rel despues"><b>Una norma posterior la tocó</b><ul>${items}${mas}</ul></div>`;
  }
  if(antes.length){
    const items = antes.slice(0,3).map(r=>
      `<li>${esc(r.accion||'modifica')} a
        <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'')}</a></li>`).join('');
    html += `<div class="rel antes"><b>Esta norma toca a</b><ul>${items}</ul></div>`;
  }
  return html;
}

/* Datos verificables del documento. Nada aqui es deduccion nuestra. */
function bloqueDatos(d){
  const filas = [];
  if(d.diario_oficial) filas.push(`<div><strong>Diario Oficial</strong> ${esc(d.diario_oficial)}</div>`);
  if(d.fecha_entrada_vigencia && d.fecha_es_real)
    filas.push(`<div><strong>Rige desde</strong> ${fechaCorta(d.fecha_entrada_vigencia)}</div>`);
  if(d.tiene_efectos_retroactivos && (d.anos_afectados||[]).length)
    filas.push(`<div><strong>Menciona años</strong> ${d.anos_afectados.join(', ')}</div>`);
  if((d.zonas_afectadas||[]).length)
    filas.push(`<div><strong>Aplica en</strong> ${d.zonas_afectadas.slice(0,6).map(esc).join(', ')}</div>`);
  if((d.fuentes_formales||[]).length)
    filas.push(`<div><strong>Interpreta</strong> ${d.fuentes_formales.slice(0,3).map(esc).join(' · ')}</div>`);
  if(d.fecha_publicacion_web && d.fecha_publicacion_web !== d.fecha_publicacion)
    filas.push(`<div><strong>Publicada en la web</strong> ${fechaCorta(d.fecha_publicacion_web)}
      <span style="color:var(--tenue)">— desde esa fecha obliga a los funcionarios</span></div>`);
  if(d.banco_datos)
    filas.push(`<div><strong>Tema DIAN</strong> ${esc(d.banco_datos)}</div>`);
  if(d.dependencia_emisora)
    filas.push(`<div><strong>Emitida por</strong> ${esc(d.dependencia_emisora)}</div>`);
  if((d.jurisprudencia_citada||[]).length)
    filas.push(`<div><strong>Cita jurisprudencia</strong> ${d.jurisprudencia_citada.slice(0,4).map(esc).join(' · ')}</div>`);
  if((d.doctrina_citada||[]).length)
    filas.push(`<div><strong>Se apoya en</strong> ${d.doctrina_citada.slice(0,3).map(esc).join(' · ')}</div>`);
  if(d.motivo_cambio_estado)
    filas.push(`<div><strong>Estado</strong> ${esc(d.motivo_cambio_estado).slice(0,160)}</div>`);
  return filas.length ? `<div class="datos">${filas.join('')}</div>` : '';
}

function ficha(d){
  const temas = (d.temas||[]).filter(t=>!t.startsWith('dian:') && t!=='boletin_mensual');
  const marcas = [
    `<span class="${d.estado_vigencia!=='vigente'?'alerta':'fuerte'}">${leyenda(d)}</span>`,
    d.materia ? `<span class="materia">${esc(d.materia)}</span>` : '',
    ...temas.slice(0,6).map(t=>`<span>${nombreTema(t)}</span>`),
    d.tiene_efectos_retroactivos ? '<span class="alerta">retroactivo</span>' : '',
  ].join('');

  const descriptores = (d.descriptores||[]).length
    ? `<ul>${d.descriptores.slice(0,6).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>` : '';

  const lateral = [bloquePlazo(d), bloqueRelaciones(d)].filter(Boolean).join('');

  return `<article data-id="${d.id}" class="p-${d.prioridad||'informativa'}${d.resumen_humano?' escrito':''}">
    <div class="cinta">${rotuloPrioridad(d)}</div>
    <div class="fila-id">
      ${glifo(d)}
      <a class="codigo" href="${esc(d.enlace_oficial)}" target="_blank" rel="noopener">${esc(d.numero_resolucion)}</a>
      ${d.numero_interno?`<span class="interno">int ${esc(d.numero_interno)}</span>`:''}
      ${d.fecha_es_real?`<span class="fecha">${fechaCorta(d.fecha_publicacion)}</span>`:''}
    </div>
    <h2>${esc(d.titulo)}</h2>
    <div class="cuerpo">
      <div class="principal">
        ${bloqueRespuesta(d)}
        ${bloqueBorrador(d)}
        ${bloqueDatos(d)}
        <details class="oficial">
          <summary>Ver el texto de la DIAN</summary>
          <p>${esc(d.descripcion_limpia||d.contenido||'').slice(0,1200)}</p>
          ${descriptores}
        </details>
        <div class="marcas">${marcas}</div>
        <div class="escribir">
          <label for="r-${d.id}">En palabras simples
            <span class="contador" id="c-${d.id}">${(d.resumen_humano||'').length||0}</span></label>
          <textarea id="r-${d.id}"
            placeholder="Qué cambió, a quién le toca y qué hay que hacer."
            oninput="contar('${d.id}')" onblur="guardarResumen('${d.id}')">${esc(d.resumen_humano||'')}</textarea>
          <div class="pista">Si lo dejas vacío, el correo sale con el texto de la DIAN tal cual.
            <b>Lo que escribas aquí es lo que hace este boletín distinto.</b></div>
          ${d.resumen_humano?'<div class="redactado">✓ redactado</div>':''}
        </div>
      </div>
      ${lateral ? `<aside class="lateral">${lateral}</aside>` : ''}
    </div>
    <div class="acciones">
      <button class="si" onclick="decidir('${d.id}','aprobar')">Aprobar</button>
      <button onclick="decidir('${d.id}','descartar')">Descartar</button>
    </div>
  </article>`;
}
