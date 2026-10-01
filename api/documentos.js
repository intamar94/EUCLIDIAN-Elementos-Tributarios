// EUCLIDIAN — catálogo completo de documentos.
// La vista cliente muestra todo el corpus; el estado fiscal se conserva como dato informativo.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const ESTADOS = { pendientes:'revisado_por_humano=is.false', nuevos:'es_nuevo=is.true', aprobados:'revisado_por_humano=is.true&publicado_cliente=is.true', todos:'' };
const PRIORIDADES = { accion:'prioridad=eq.accion', importante:'prioridad=eq.importante', informativa:'prioridad=eq.informativa' };
const NATURALEZAS = { obligatorias:'clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes', conceptos:'clasificacion_obligatoriedad=eq.obligatorio_dian_solo' };
const PERIODOS = { '2026':'anio_publicacion=eq.2026', recientes:'anio_publicacion=gte.2024', decada:'anio_publicacion=gte.2016', todo:'' };
const ORDENES = { recientes:'fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast,numero_resolucion.desc', prioridad:'orden_prioridad.asc,fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast', antiguos:'fecha_publicacion.asc.nullslast,fecha_publicacion_web.asc.nullslast,numero_resolucion.asc' };
// Solo columnas expuestas por v_bandeja. Los metadatos de verificación se derivan abajo.
const CAMPOS = ['id','numero_resolucion','numero_interno','tipo_documento','subtipo','contenido','descripcion_limpia','titulo','resumen_humano','resumen_borrador','borrador_confianza','borrador_advertencias','enlace_oficial','materia','temas','banco_datos','fecha_publicacion','fecha_es_real','fecha_entrada_vigencia','fecha_publicacion_web','diario_oficial','dependencia_emisora','entidad_emisora','estado_vigencia','motivo_cambio_estado','clasificacion_obligatoriedad','tiene_efectos_retroactivos','anos_afectados','zonas_afectadas','plazos_mencionados','anotaciones_vigencia','tesis_juridica','tesis_respuesta','problema_juridico','fuentes_formales','descriptores','area_derecho','doctrina_citada','jurisprudencia_citada','modifica_a','modificado_por','nivel_alerta','prioridad','orden_prioridad','revisado_por_humano','publicado_cliente','aprobado_para_email','revisado_fiscal_en','observaciones_revisor','anio','anio_publicacion','precision_fecha','es_nuevo','nivel_detalle','created_at'].join(',');
const FUENTES = {
  tributario: 'https://normograma.dian.gov.co/dian/compilacion/tributario.html',
  novedades: 'https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html'
};
function normalizarDiagnostico(value){ if(!value)return value; return String(value).replace(/CRITICAL:\s*/g,'').replace(/No se pudo leer la fuente oficial:\s*404 Client Error: Not Found for url:\s*\S+/gi,'No fue posible acceder al documento en el enlace oficial registrado. La ficha conserva los datos disponibles de la publicación DIAN, pero el contenido íntegro requiere una fuente documental accesible.').replace(/No se pudo leer la fuente oficial:\s*\S+/gi,'No fue posible acceder al documento en el enlace oficial registrado. La ficha conserva los datos disponibles de la publicación DIAN, pero el contenido íntegro requiere una fuente documental accesible.'); }
export default async function handler(req,res){
  // Fail closed: a missing access secret must never make this privileged API public.
  if(!CLAVE||!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  if(req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});
  const periodoSolicitado=String(req.query.periodo||'2026');
  const periodo=/^\d{4}$/.test(periodoSolicitado)?periodoSolicitado:(PERIODOS[periodoSolicitado]!==undefined?periodoSolicitado:'2026');
  const estadoSolicitado=req.query.estado; const estado=ESTADOS[estadoSolicitado]!==undefined?estadoSolicitado:'todos';
  const tema=req.query.tema||''; const prioridad=PRIORIDADES[req.query.prioridad]?req.query.prioridad:''; const naturaleza=NATURALEZAS[req.query.naturaleza]?req.query.naturaleza:'';
  const q=String(req.query.q||'').trim().slice(0,160);
  const orden=ORDENES[req.query.orden]||ORDENES.recientes; const pagina=Math.max(1,parseInt(req.query.pagina,10)||1);
  const cabeceras={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
  let filtro=/^\d{4}$/.test(periodo)?`anio_publicacion=eq.${periodo}`:(PERIODOS[periodo]!==undefined?PERIODOS[periodo]:'id=not.is.null');
  if(ESTADOS[estado])filtro+='&'+ESTADOS[estado]; if(PRIORIDADES[prioridad])filtro+='&'+PRIORIDADES[prioridad]; if(NATURALEZAS[naturaleza])filtro+='&'+NATURALEZAS[naturaleza]; if(tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;
  if(q){const termino=q.replace(/[(),]/g,' ').replace(/[*]/g,' ').trim();if(termino)filtro+=`&or=${encodeURIComponent(`(numero_resolucion.ilike.*${termino}*,titulo.ilike.*${termino}*,contenido.ilike.*${termino}*,descripcion_limpia.ilike.*${termino}*)`)}`;}
  const primera=(pagina-1)*POR_PAGINA;
  try{
    const rDocs=await fetch(`${SUPABASE_URL}/rest/v1/v_bandeja?select=${CAMPOS}&${filtro}&order=${orden}`,{headers:{...cabeceras,Prefer:'count=exact',Range:`${primera}-${primera+POR_PAGINA-1}`}});
    if(!rDocs.ok){const detalle=await rDocs.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    const documentos=await rDocs.json(); const rango=rDocs.headers.get('content-range')||'*/0'; const total=parseInt(rango.split('/')[1],10)||0;
    if(documentos.length){
      const ids=documentos.map(d=>d.id).filter(Boolean); const inFilter=`in.(${ids.join(',')})`;
      // texto_completo/enriquecido_en pertenecen a la tabla base y pueden no
      // estar expuestos por la vista de lectura; pedirlos aparte evita romperla.
      const rTexto=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id,texto_completo,enriquecido_en,fuente_verificada_en,fuente_verificacion_url,estado_fuente_verificacion&id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
      if(rTexto.ok){const textos=await rTexto.json();const porTexto=new Map(textos.map(x=>[x.id,x]));for(const d of documentos){const x=porTexto.get(d.id);if(x){Object.assign(d,{texto_completo:x.texto_completo||null,enriquecido_en:x.enriquecido_en||null,fuente_verificada_en:x.fuente_verificada_en||null,fuente_verificacion_url:x.fuente_verificacion_url||null,estado_fuente_verificacion:x.estado_fuente_verificacion||null});}}}
      const rEval=await fetch(`${SUPABASE_URL}/rest/v1/revisor_fiscal_euclidian_evaluaciones?select=documento_id,resultado,puntuacion,reglas_pasadas,reglas_fallidas,motivos,version_reglas&documento_id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
      if(rEval.ok){const evaluaciones=await rEval.json(); const porId=new Map(evaluaciones.map(e=>[e.documento_id,e])); for(const d of documentos){const e=porId.get(d.id); if(e){d.evaluacion_resultado=e.resultado||null;d.evaluacion_puntuacion=e.puntuacion??null;d.evaluacion_reglas_pasadas=e.reglas_pasadas||[];d.evaluacion_reglas_fallidas=e.reglas_fallidas||[];d.evaluacion_motivos=(e.motivos||[]).map(normalizarDiagnostico);d.evaluacion_version_reglas=e.version_reglas||null;} d.observaciones_revisor=normalizarDiagnostico(d.observaciones_revisor); d.fuente_raiz=(d.temas||[]).includes('boletin_mensual')||d.tipo_documento==='boletin'?FUENTES.novedades:FUENTES.tributario; d.estado_fuente_verificacion=d.estado_fuente_verificacion||(d.texto_completo?'texto_capturado':'solo_registro'); d.control_automatico_en=d.revisado_por_humano?null:(d.revisado_fiscal_en||null); d.revision_humana_registrada=!!d.revisado_por_humano; }}
    }
    const filtroConteos=ESTADOS[estado]?filtro.replace('&'+ESTADOS[estado],''):filtro;
    const prefijoConteos=filtroConteos?`${filtroConteos}&`:'';
    const [rResumen,rPendientes,rPublicados]=await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/rpc/conteos_bandeja_api`,{method:'POST',headers:{...cabeceras,'Content-Type':'application/json'},body:JSON.stringify({p_periodo:periodo,p_tema:tema||null,p_estado:estado,p_prioridad:prioridad||null,p_naturaleza:naturaleza||null})}),
      fetch(`${SUPABASE_URL}/rest/v1/v_bandeja?select=id&${prefijoConteos}revisado_por_humano=is.false`,{headers:{...cabeceras,Prefer:'count=exact',Range:'0-0'}}),
      fetch(`${SUPABASE_URL}/rest/v1/v_bandeja?select=id&${prefijoConteos}revisado_por_humano=is.true&publicado_cliente=is.true`,{headers:{...cabeceras,Prefer:'count=exact',Range:'0-0'}})
    ]);
    if(!rPendientes.ok||!rPublicados.ok)return res.status(502).json({error:'fallo_conteos_revision'});
    let resumen={}; try{if(rResumen.ok)resumen=(await rResumen.json())||{};}catch(e){}
    const nPendientes=parseInt((rPendientes.headers.get('content-range')||'*/0').split('/')[1],10)||0;const nPublicados=parseInt((rPublicados.headers.get('content-range')||'*/0').split('/')[1],10)||0;
    const estadoResumen={...(resumen.estado||{}),pendientes:nPendientes,aprobados:nPublicados};
    res.setHeader('Cache-Control','no-store'); return res.status(200).json({documentos,total,pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),estado:estadoResumen,prioridad:resumen.prioridad||{},naturaleza:resumen.naturaleza||{},temas:resumen.temas||[],periodo,periodos:resumen.periodos||{},actualizado:resumen.actualizado||null,pendientes:nPendientes,aprobados:nPublicados});
  }catch(e){return res.status(500).json({error:'fallo_lectura',detalle:String(e).slice(0,200)});}
}
