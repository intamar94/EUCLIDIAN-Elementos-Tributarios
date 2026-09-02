/* EUCLIDIAN — bloques y armado de la ficha
 *
 * La pregunta, la respuesta, el borrador, el plazo, las relaciones y la
 * ficha completa. Usa lo definido en fichas.js, que se carga antes.
 */

/* La pregunta y la respuesta, en ese orden.
 *
 * La pregunta importa por si sola: es donde la DIAN dice a quien se
 * refiere. "¿Una sociedad en liquidacion judicial debe presentar
 * certificacion bancaria?" se lee y se sabe si es el caso propio, sin
 * que nadie tenga que inventar una etiqueta de "aplica a".
 *
 * Por eso se muestra aunque no haya tesis: son dos datos distintos y
 * cada uno vale por su cuenta. */
function bloqueRespuesta(d){
  if(!d.problema_juridico && !d.tesis_juridica) return '';

  const pregunta = d.problema_juridico ? `<div class="consulta">
      <span class="consulta-rotulo">Lo que le preguntaron a la DIAN</span>
      <p>${esc(d.problema_juridico).slice(0,420)}</p>
    </div>` : '';

  if(!d.tesis_juridica) return `<div class="respuesta solo-pregunta">${pregunta}</div>`;

  const r = d.tesis_respuesta || '';
  const marca = r==='si' ? 'Sí' : r==='no' ? 'No' : r==='matizada' ? 'Depende' : '—';
  return `<div class="respuesta">
    ${pregunta}
    <div class="resp-cab"><span class="resp-marca">${marca}</span> Lo que respondió</div>
    <p>${esc(d.tesis_juridica).slice(0,700)}</p>
  </div>`;
}

/* Cuando no hay ficha redactada, se muestra lo que dice la DIAN tal
   cual, con el aviso de que es texto oficial sin traducir. Es mas
   honesto que dejar la ficha vacia o que inventar un resumen. */
function bloqueSinFicha(d){
  if (d.resumen_borrador || d.resumen_humano) return '';
  const texto = d.descripcion_limpia || d.contenido || '';
  if (!texto) return '';
  return `<div class="sin-ficha">
    <span class="sin-ficha-rotulo">Texto oficial, sin resumir</span>
    <p>${esc(texto).slice(0,600)}</p>
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
  const fuerza = [
    `<span class="${d.estado_vigencia!=='vigente' ? 'alerta'
        : d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes' ? 'obliga'
        : 'orienta'}">${leyenda(d)}</span>`,
    d.tiene_efectos_retroactivos ? '<span class="alerta">afecta años pasados</span>' : '',
  ].filter(Boolean).join('');

  const materias = [
    d.materia ? `<span class="materia">${esc(d.materia)}</span>` : '',
    ...temas.slice(0,6).map(t=>`<span>${nombreTema(t)}</span>`),
  ].filter(Boolean).join('');

  const descriptores = (d.descriptores||[]).length
    ? `<ul>${d.descriptores.slice(0,6).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>` : '';

  const lateral = [bloquePlazo(d), bloqueRelaciones(d)].filter(Boolean).join('');
  const s = señal(d);
  const marcaNueva = d.es_nuevo ? '<span class="nuevo">Nuevo</span>' : '';
  const marcaDetalle = (d.nivel_detalle === 'solo_listado')
    ? '<span class="detalle-parcial" title="Aún no se ha abierto el documento oficial">Sin abrir</span>'
    : (d.nivel_detalle === 'leido')
      ? '<span class="detalle-parcial" title="Documento leído; falta la ficha en palabras simples">Sin ficha</span>'
      : '';

  return `<article data-id="${d.id}" class="t-${s.tono}${d.resumen_humano?' escrito':''}${d.es_nuevo?' nuevo-doc':''}">
    <div class="cintas">
      ${marcaNueva}
      <span class="cinta">${s.rotulo}</span>
      ${marcaDetalle}
    </div>
    <div class="fila-id">
      ${glifo(d)}
      <a class="codigo" href="${esc(d.enlace_oficial)}" target="_blank" rel="noopener">${esc(d.numero_resolucion)}</a>
      ${d.numero_interno?`<span class="interno">int ${esc(d.numero_interno)}</span>`:''}
      ${fechaFicha(d)}
    </div>
    <h2>${esc(d.titulo)}</h2>
    <div class="cuerpo">
      <div class="principal">
        ${bloqueRespuesta(d)}
        ${bloqueBorrador(d)}
        ${bloqueSinFicha(d)}
        ${bloqueDatos(d)}
        <details class="oficial">
          <summary><span class="abrir">Ver cómo lo dice la DIAN</span></summary>
          <p>${esc(d.descripcion_limpia||d.contenido||'').slice(0,1200)}</p>
          ${descriptores}
        </details>
        <div class="clasificacion">
          <div class="grupo-marcas">
            <span class="clas-rotulo">Qué fuerza tiene</span>
            <div class="marcas">${fuerza}</div>
          </div>
          ${materias ? `<div class="grupo-marcas">
            <span class="clas-rotulo">De qué trata</span>
            <div class="marcas">${materias}</div>
          </div>` : ''}
        </div>
      </div>
      ${lateral ? `<aside class="lateral">${lateral}</aside>` : ''}
    </div>
  </article>`;
}
