/* EUCLIDIAN — ficha final para el contador. */
const MESES=['','ene','feb','mar','abr','may','jun','jul','ago','sep','oct','nov','dic'];
const MESNUM={enero:1,febrero:2,marzo:3,abril:4,mayo:5,junio:6,julio:7,agosto:8,septiembre:9,setiembre:9,octubre:10,noviembre:11,diciembre:12};

function fechaCorta(f){
  if(!f)return '';
  const p=String(f).slice(0,10).split('-');
  return p.length===3&&+p[1]>=1&&+p[1]<=12?`${+p[2]} ${MESES[+p[1]]} ${p[0]}`:'';
}
function fechaDePlazo(texto){
  const m=String(texto||'').match(/(?:hasta el|a más tardar el|el)\s+(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+(20\d{2})/i);
  if(!m)return null;
  const mes=MESNUM[m[2].toLowerCase()];
  if(!mes)return null;
  return new Date(+m[3],mes-1,+m[1]);
}
function diasHasta(f){
  const hoy=new Date();hoy.setHours(0,0,0,0);return Math.round((f-hoy)/86400000);
}
function esc(s){return String(s??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
function arr(v){return Array.isArray(v)?v:(v==null||v===''?[]:[v]);}
function cleanText(v){return String(v??'').replace(/\s+/g,' ').trim();}

function señal(d){
  if(d.estado_vigencia&&d.estado_vigencia!=='vigente')return {rotulo:'No la apliques',tono:'alerta'};
  if(d.nivel_alerta==='critica')return {rotulo:'Acción requerida',tono:'alerta'};
  const f=fechaDePlazo(arr(d.plazos_mencionados)[0]);
  const dias=f?diasHasta(f):null;
  if(dias!==null&&dias>=0&&dias<=30)return {rotulo:'Vence pronto',tono:'alerta'};
  if(d.tiene_efectos_retroactivos)return {rotulo:'Puede tocar años pasados',tono:'alerta'};
  if(arr(d.modificado_por).length)return {rotulo:'Hay norma posterior',tono:'orienta'};
  if(d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes')return {rotulo:'Obligatoria',tono:'obliga'};
  return {rotulo:'Informativa',tono:'neutro'};
}
function glifo(d){
  const c=d.estado_vigencia!=='vigente'?'#B23A32':d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes'?'#2C4C8F':'#3D82B8';
  if(d.estado_vigencia!=='vigente')return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true"><rect x="2" y="2" width="11" height="11" fill="none" stroke="${c}" stroke-width="1.5"/><line x1="2" y1="13" x2="13" y2="2" stroke="${c}" stroke-width="1.5"/></svg>`;
  if(d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes')return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true"><polygon points="7.5,2 13.5,13 1.5,13" fill="${c}"/></svg>`;
  return `<svg width="15" height="15" viewBox="0 0 15 15" aria-hidden="true"><circle cx="7.5" cy="7.5" r="5.5" fill="none" stroke="${c}" stroke-width="1.8"/></svg>`;
}
function fuerza(d){
  if(d.estado_vigencia&&d.estado_vigencia!=='vigente')return d.estado_vigencia;
  if(d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes')return 'Obliga al contribuyente';
  if(d.clasificacion_obligatoriedad==='obligatorio_dian_solo')return 'Criterio de la DIAN: orienta, no obliga al contribuyente';
  if(d.clasificacion_obligatoriedad==='vinculante_jurisprudencia')return 'Jurisprudencia vinculante';
  return 'Informativa';
}
function aQuien(d){
  const partes=[];
  const f=fuerza(d);
  if(f)partes.push(f);
  const temas=arr(d.temas).filter(t=>!String(t).startsWith('dian:')&&t!=='boletin_mensual').map(t=>typeof nombreTema==='function'?nombreTema(t):String(t).replace(/_/g,' ')).filter(Boolean);
  if(temas.length)partes.push('Personas o empresas que trabajen con '+temas.slice(0,4).join(', '));
  const zonas=arr(d.zonas_afectadas);
  if(zonas.length)partes.push('Alcance territorial: '+zonas.slice(0,6).join(', '));
  return partes.join(' — ');
}
function queHacer(d){
  const out=[];
  const estado=d.estado_vigencia;
  if(estado==='suspendido')out.push('No la apliques mientras dure la suspensión; verifica su alcance.');
  else if(estado==='inexequible')out.push('No la apliques: figura como inexequible.');
  else if(estado==='derogado'||estado==='revocado')out.push(`No la uses como regla vigente; está ${estado}. Revisa los casos históricos a los que afectó.`);
  if(d.tiene_efectos_retroactivos&&arr(d.anos_afectados).length)out.push('Revisa declaraciones o periodos anteriores: afecta '+arr(d.anos_afectados).slice(0,6).join(', ')+'.');
  const p=arr(d.plazos_mencionados)[0];
  if(p)out.push('Controla el plazo indicado: '+cleanText(p).slice(0,320)+'.');
  if(arr(d.modificado_por).length)out.push('Comprueba la norma posterior relacionada antes de aplicar este criterio.');
  if(!out.length&&d.estado_vigencia==='vigente')out.push('Aplicar según el alcance y las condiciones expresamente señaladas en el documento oficial.');
  return out;
}
function bloqueResumen(d){
  const texto=cleanText(d.resumen_humano||d.resumen_borrador||d.descripcion_limpia||'');
  if(!texto)return '';
  return `<section class="resumen-lectura ficha-bloque"><div class="resumen-cab"><span>Resumen para el contador</span><small>${d.resumen_humano?'Revisado por EUCLIDIAN':'Extracto pendiente de revisión fiscal'}</small></div><p>${esc(texto)}</p></section>`;
}
function bloqueDecision(d){
  const q=cleanText(d.problema_juridico);
  const t=cleanText(d.tesis_juridica);
  if(!q&&!t)return '';
  const marca=d.tesis_respuesta==='si'?'Sí':d.tesis_respuesta==='no'?'No':d.tesis_respuesta==='matizada'?'Depende':'';
  return `<section class="ficha-bloque decision"><h3>Consulta y respuesta de la DIAN</h3>${q?`<div><span class="mini-rotulo">Pregunta</span><p>${esc(q)}</p></div>`:''}${t?`<div class="tesis"><span class="mini-rotulo">Respuesta${marca?' · '+marca:''}</span><p>${esc(t)}</p></div>`:''}</section>`;
}
function bloqueAplicacion(d){
  const quien=aQuien(d),acciones=queHacer(d);
  return `<section class="ficha-bloque aplicacion"><div class="col"><span class="mini-rotulo">A quién afecta / a quién le sirve</span><p>${esc(quien||'El alcance debe comprobarse en el documento oficial.')}</p></div><div class="col"><span class="mini-rotulo">Qué debe revisar o hacer el contador</span><ul>${acciones.map(x=>`<li>${esc(x)}</li>`).join('')}</ul></div></section>`;
}
function bloqueDatos(d){
  const filas=[];
  const push=(k,v)=>{if(v!==undefined&&v!==null&&String(v).trim()!=='')filas.push(`<div><strong>${k}</strong><span>${esc(v)}</span></div>`)};
  push('Tipo',d.tipo_documento);push('Número',d.numero_resolucion);push('Fecha',d.fecha_es_real?fechaCorta(d.fecha_publicacion):`${fechaCorta(d.fecha_publicacion)} · pendiente de verificación`);
  push('Entidad emisora',d.entidad_emisora);push('Dependencia',d.dependencia_emisora);push('Diario Oficial',d.diario_oficial);push('Vigencia',d.estado_vigencia);push('Entrada en vigencia',d.fecha_entrada_vigencia&&d.fecha_es_real?fechaCorta(d.fecha_entrada_vigencia):'No verificada');
  if(d.tiene_efectos_retroactivos)push('Efectos retroactivos',arr(d.anos_afectados).length?'Sí · '+arr(d.anos_afectados).join(', '):'Sí');
  if(arr(d.fuentes_formales).length)push('Fuentes formales',arr(d.fuentes_formales).join(' · '));
  if(arr(d.descriptores).length)push('Descriptores',arr(d.descriptores).join(' · '));
  if(d.area_derecho)push('Área del derecho',d.area_derecho);
  if(d.banco_datos)push('Banco de datos DIAN',d.banco_datos);
  if(d.fecha_publicacion_web&&d.fecha_publicacion_web!==d.fecha_publicacion)push('Publicada en web',fechaCorta(d.fecha_publicacion_web));
  return filas.length?`<section class="ficha-bloque datos-completos"><h3>Datos comprobables</h3><div class="datos-grid">${filas.join('')}</div></section>`:'';
}
function bloquePlazos(d){
  const p=arr(d.plazos_mencionados);if(!p.length)return '';
  return `<section class="ficha-bloque plazos-completos"><h3>Fechas y plazos</h3>${p.slice(0,6).map(x=>{const f=fechaDePlazo(x),n=f?diasHasta(f):null;const marca=n===null?'':n<0?'Ya pasó':n===0?'Hoy':n===1?'Mañana':`Faltan ${n} días`;return `<div class="plazo-line"><span>${esc(cleanText(x))}</span>${marca?`<b>${marca}</b>`:''}</div>`}).join('')}</section>`;
}
function bloqueRelaciones(d){
  const antes=arr(d.modifica_a),despues=arr(d.modificado_por);if(!antes.length&&!despues.length)return '';
  return `<section class="ficha-bloque relaciones"><h3>Relaciones y cambios</h3>${despues.length?`<div><b>Normas posteriores que la modifican o afectan</b><ul>${despues.slice(0,8).map(r=>`<li>${esc(r.accion||'Modificada por')} <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'ver documento')}</a>${r.fecha?' · '+esc(fechaCorta(r.fecha)):''}</li>`).join('')}</ul></div>`:''}${antes.length?`<div><b>Documentos anteriores relacionados</b><ul>${antes.slice(0,8).map(r=>`<li>${esc(r.accion||'Modifica')} <a href="${esc(r.enlace||'#')}" target="_blank" rel="noopener">${esc(r.numero||'ver documento')}</a></li>`).join('')}</ul></div>`:''}</section>`;
}
function bloqueTemas(d){
  const temas=arr(d.temas).filter(t=>!String(t).startsWith('dian:')&&t!=='boletin_mensual');
  const desc=arr(d.descriptores);
  if(!temas.length&&!desc.length)return '';
  return `<section class="ficha-bloque temas-completos"><h3>Clasificación y búsqueda</h3>${temas.length?`<div class="marcas">${temas.map(t=>`<span>${esc(typeof nombreTema==='function'?nombreTema(t):t)}</span>`).join('')}</div>`:''}${desc.length?`<div class="descriptor-list">${desc.slice(0,12).map(x=>`<span>${esc(x)}</span>`).join('')}</div>`:''}</section>`;
}
function bloqueFuente(d){
  const url=cleanText(d.enlace_oficial);if(!url)return '';
  return `<section class="ficha-bloque oficial-completo"><div><span class="mini-rotulo">Fuente oficial DIAN</span><a href="${esc(url)}" target="_blank" rel="noopener">Abrir documento original</a></div><small>La fuente oficial es la referencia de comprobación. EUCLIDIAN no sustituye el documento original.</small></section>`;
}

function ficha(d){
  const s=señal(d),titulo=cleanText(d.titulo||d.numero_resolucion||'Documento tributario');
  return `<article data-id="${esc(d.id)}" class="t-${s.tono}${d.resumen_humano?' escrito':''}">
    <div class="cinta">${s.rotulo}</div>
    <div class="fila-id">${glifo(d)}<a class="codigo" href="${esc(d.enlace_oficial||'#')}" target="_blank" rel="noopener">${esc(d.numero_resolucion||'')}</a>${d.numero_interno?`<span class="interno">int ${esc(d.numero_interno)}</span>`:''}<span class="fecha">${esc(fechaCorta(d.fecha_publicacion))}</span></div>
    <h2>${esc(titulo)}</h2>
    ${bloqueResumen(d)}
    ${bloqueDecision(d)}
    ${bloqueAplicacion(d)}
    ${bloquePlazos(d)}
    ${bloqueRelaciones(d)}
    ${bloqueDatos(d)}
    ${bloqueTemas(d)}
    ${bloqueFuente(d)}
  </article>`;
}
