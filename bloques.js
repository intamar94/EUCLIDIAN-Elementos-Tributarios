/* EUCLIDIAN — bloques y armado de la ficha
 *
 * La pregunta, la respuesta, el borrador, el plazo, las relaciones y la
 * ficha completa. Usa lo definido en fichas.js, que se carga antes.
 */

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

function textoMotivo(m){
  const s=String(m||'').trim();
  if(!s)return '';
  return s
    .replace(/^CRITICAL:\s*/i,'')
    .replace(/No se pudo leer la fuente oficial:\s*404 Client Error: Not Found for url:\s*\S+/i,'La fuente individual registrada no está accesible actualmente. La ficha conserva la información corroborada en el índice oficial DIAN.')
    .replace(/No se pudo leer la fuente oficial:\s*\S+/i,'La fuente individual registrada no está accesible actualmente. La ficha conserva la información corroborada en el índice oficial DIAN.')
    .replace(/\s+/g,' ');
}

function bloqueDiagnostico(d){
  const revisado=!!d.revisado_fiscal_en;
  const resultado=String(d.evaluacion_resultado||'').toUpperCase();
  const aprobado=resultado==='APPROVE' || (!!d.aprobado_para_email && resultado!=='REVIEW');
  const puntuacion=d.evaluacion_puntuacion;
  const fallidas=Array.isArray(d.evaluacion_reglas_fallidas)?d.evaluacion_reglas_fallidas:[];
  const motivos=(Array.isArray(d.evaluacion_motivos)?d.evaluacion_motivos:[]).map(textoMotivo).filter(Boolean);
  const estado=aprobado?'Aprobada':revisado?'Revisada · requiere atención':'Pendiente de revisión';
  const clase=aprobado?'diagnostico-ok':revisado?'diagnostico-revision':'diagnostico-pendiente';
  const score=puntuacion!==null && puntuacion!==undefined ? `<div class="diagnostico-score"><strong>${esc(puntuacion)}/100</strong><span>evaluación fiscal</span></div>` : '';
  const reglas=fallidas.length ? `<div class="diagnostico-reglas"><span>Aspectos pendientes</span><div>${fallidas.map(x=>`<span>${esc(String(x).replace(/^FUENTE_OFICIAL$/,'Evidencia oficial'))}</span>`).join('')}</div></div>` : '';
  const detalle=motivos.length ? `<ul class="diagnostico-motivos">${motivos.slice(0,5).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>` : `<p>La ficha fue revisada y no presenta observaciones adicionales.</p>`;
  return `<div class="diagnostico ${clase}">
    <div class="diagnostico-cab"><strong>Diagnóstico fiscal</strong><span>${estado}</span></div>
    <div class="diagnostico-resumen">${score}${revisado?`<div class="diagnostico-meta">Revisada: ${fechaCorta(d.revisado_fiscal_en)}</div>`:''}</div>
    ${reglas}${detalle}
  </div>`;
}

function bloqueFuentes(d){
  const individual=d.enlace_oficial;
  const verificacion=d.fuente_verificacion_url;
  const estado=d.estado_fuente_verificacion;
  const indice='https://www.dian.gov.co/Contribuyentes-Plus/Paginas/Normatividad.aspx';
  const fallback=verificacion||indice;
  const individualNoDisponible=estado==='indice_oficial_dian';
  const individualHtml=individual ? (individualNoDisponible
    ? `<div class="fuente-item"><span class="fuente-estado">Fuente individual</span><span class="fuente-no">No accesible actualmente</span><a href="${esc(individual)}" target="_blank" rel="noopener">Intentar abrir documento DIAN</a></div>`
    : `<div class="fuente-item"><span class="fuente-estado">Documento individual DIAN</span><a href="${esc(individual)}" target="_blank" rel="noopener">Abrir fuente primaria</a></div>`) : '';
  return `<details class="fuentes"><summary>Fuentes y trazabilidad</summary>
    ${individualHtml}
    <div class="fuente-item"><span class="fuente-estado">Índice oficial DIAN</span><a href="${esc(fallback)}" target="_blank" rel="noopener">Ver publicación en Normatividad DIAN</a></div>
    ${estado==='indice_oficial_dian' ? `<p class="fuente-nota">Número, fecha, tema y tesis/descripción se corroboran contra el registro oficial DIAN. El contenido íntegro solo se considera corroborado cuando la fuente individual es accesible.</p>` : ''}
    ${d.fuente_verificada_en ? `<div class="fuente-fecha">Verificación de fuente: ${fechaCorta(d.fuente_verificada_en)}</div>` : ''}
  </details>`;
}

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
  return `<div class="plazo"><div class="plazo-cab"><span>Plazo</span>${marca}</div><p>${esc(p).slice(0,260)}</p></div>`;
}

function bloqueRelaciones(d){
  const despues = d.modificado_por || [];
  const antes = d.modifica_a || [];
  if(!despues.length && !antes.length) return '';
  let html = '';
  if(despues.length){
    const items = despues.slice(0,4).map(r=>`<li>${esc(r.accion||'modificada')} por <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'')}</a> ${r.fecha?`<span style="color:var(--tenue)">(${fechaCorta(r.fecha)})</span>`:''}</li>`).join('');
    const mas = despues.length>4 ? `<li style="color:var(--tenue)">y ${despues.length-4} más</li>` : '';
    html += `<div class="rel despues"><b>Una norma posterior la tocó</b><ul>${items}${mas}</ul></div>`;
  }
  if(antes.length){
    const items = antes.slice(0,3).map(r=>`<li>${esc(r.accion||'modifica')} a <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'')}</a></li>`).join('');
    html += `<div class="rel antes"><b>Esta norma toca a</b><ul>${items}</ul></div>`;
  }
  return html;
}

function bloqueDatos(d){
  const filas = [];
  if(d.diario_oficial) filas.push(`<div><strong>Diario Oficial</strong> ${esc(d.diario_oficial)}</div>`);
  if(d.fecha_entrada_vigencia && d.fecha_es_real) filas.push(`<div><strong>Rige desde</strong> ${fechaCorta(d.fecha_entrada_vigencia)}</div>`);
  if(d.fecha_fin_vigencia) filas.push(`<div><strong>Vigencia hasta</strong> ${fechaCorta(d.fecha_fin_vigencia)}</div>`);
  if(d.tiene_efectos_retroactivos && (d.anos_afectados||[]).length) filas.push(`<div><strong>Menciona años</strong> ${d.anos_afectados.join(', ')}</div>`);
  if((d.zonas_afectadas||[]).length) filas.push(`<div><strong>Aplica en</strong> ${d.zonas_afectadas.slice(0,6).map(esc).join(', ')}</div>`);
  if((d.fuentes_formales||[]).length) filas.push(`<div><strong>Interpreta</strong> ${d.fuentes_formales.slice(0,6).map(esc).join(' · ')}</div>`);
  if(d.fecha_publicacion_web && d.fecha_publicacion_web !== d.fecha_publicacion) filas.push(`<div><strong>Publicada en la web</strong> ${fechaCorta(d.fecha_publicacion_web)}</div>`);
  if(d.banco_datos) filas.push(`<div><strong>Tema DIAN</strong> ${esc(d.banco_datos)}</div>`);
  if(d.dependencia_emisora) filas.push(`<div><strong>Emitida por</strong> ${esc(d.dependencia_emisora)}</div>`);
  if((d.jurisprudencia_citada||[]).length) filas.push(`<div><strong>Cita jurisprudencia</strong> ${d.jurisprudencia_citada.slice(0,6).map(esc).join(' · ')}</div>`);
  if((d.doctrina_citada||[]).length) filas.push(`<div><strong>Se apoya en</strong> ${d.doctrina_citada.slice(0,6).map(esc).join(' · ')}</div>`);
  if(d.motivo_cambio_estado) filas.push(`<div><strong>Motivo de estado</strong> ${esc(d.motivo_cambio_estado).slice(0,240)}</div>`);
  if(d.area_derecho) filas.push(`<div><strong>Área jurídica</strong> ${esc(d.area_derecho)}</div>`);
  if(d.precision_fecha) filas.push(`<div><strong>Precisión de fecha</strong> ${esc(d.precision_fecha)}</div>`);
  return filas.length ? `<div class="datos">${filas.join('')}</div>` : '';
}

function ficha(d){
  const temas = (d.temas||[]).filter(t=>!t.startsWith('dian:') && t!=='boletin_mensual');
  const fuerza = [
    `<span class="${d.estado_vigencia!=='vigente' ? 'alerta' : d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes' ? 'obliga' : 'orienta'}">${leyenda(d)}</span>`,
    d.tiene_efectos_retroactivos ? '<span class="alerta">afecta años pasados</span>' : '',
  ].filter(Boolean).join('');
  const materias = [d.materia ? `<span class="materia">${esc(d.materia)}</span>` : '', ...temas.slice(0,6).map(t=>`<span>${nombreTema(t)}</span>`)].filter(Boolean).join('');
  const descriptores = (d.descriptores||[]).length ? `<ul>${d.descriptores.slice(0,8).map(x=>`<li>${esc(x)}</li>`).join('')}</ul>` : '';
  const lateral = [bloquePlazo(d), bloqueRelaciones(d)].filter(Boolean).join('');
  const s = señal(d);
  const marcaNueva = d.es_nuevo ? '<span class="nuevo">Nuevo</span>' : '';
  const marcaDetalle = (d.nivel_detalle === 'solo_listado') ? '<span class="detalle-parcial" title="Aún no se ha abierto el documento oficial">Sin abrir</span>' : (d.nivel_detalle === 'leido') ? '<span class="detalle-parcial" title="Documento leído; falta la ficha en palabras simples">Sin ficha</span>' : '';
  const resumen = d.resumen_humano || d.resumen_borrador || d.descripcion_limpia || d.contenido || '';
  return `<article data-id="${d.id}" class="t-${s.tono}${d.resumen_humano?' escrito':''}${d.es_nuevo?' nuevo-doc':''}>
    <div class="cintas">${marcaNueva}<span class="cinta">${s.rotulo}</span>${marcaDetalle}</div>
    <div class="fila-id">${glifo(d)}<a class="codigo" href="${esc(d.enlace_oficial)}" target="_blank" rel="noopener">${esc(d.numero_resolucion)}</a>${d.numero_interno?`<span class="interno">int ${esc(d.numero_interno)}</span>`:''}${fechaFicha(d)}</div>
    <h2>${esc(d.titulo)}</h2>
    <div class="cuerpo">
      <div class="principal">
        ${bloqueDiagnostico(d)}
        ${resumen ? `<div class="resumen-ficha"><span class="resumen-rotulo">Resumen</span><p>${esc(resumen)}</p></div>` : ''}
        ${bloqueRespuesta(d)}
        ${bloqueBorrador(d)}
        ${bloqueSinFicha(d)}
        ${bloqueDatos(d)}
        ${bloqueFuentes(d)}
        <details class="oficial"><summary><span class="abrir">Ver cómo lo dice la DIAN</span></summary><p>${esc(d.descripcion_limpia||d.contenido||'').slice(0,1600)}</p>${descriptores}</details>
        <div class="clasificacion"><div class="grupo-marcas"><span class="clas-rotulo">Qué fuerza tiene</span><div class="marcas">${fuerza}</div></div>${materias ? `<div class="grupo-marcas"><span class="clas-rotulo">De qué trata</span><div class="marcas">${materias}</div></div>` : ''}</div>
      </div>
      ${lateral ? `<aside class="lateral">${lateral}</aside>` : ''}
    </div>
  </article>`;
}
