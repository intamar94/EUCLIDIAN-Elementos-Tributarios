// EUCLIDIAN — catálogo completo de documentos.
// La vista cliente muestra todo el corpus; el estado fiscal se conserva como dato informativo.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const ESTADOS = { nuevos:'nuevos', todos:'todos' };
const PERIODOS = { '2026':'anio_publicacion=eq.2026', recientes:'anio_publicacion=gte.2024', decada:'anio_publicacion=gte.2016', todo:'' };
const ORDENES = { recientes:'fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast,numero_resolucion.desc', prioridad:'orden_prioridad.asc,fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast', antiguos:'fecha_publicacion.asc.nullslast,fecha_publicacion_web.asc.nullslast,numero_resolucion.asc' };
// Solo columnas expuestas por v_bandeja. Los metadatos de verificación se derivan abajo.
const CAMPOS = ['id','numero_resolucion','numero_interno','tipo_documento','contenido','descripcion_limpia','titulo','resumen_humano','resumen_borrador','enlace_oficial','materia','temas','fecha_publicacion','fecha_es_real','fecha_entrada_vigencia','fecha_publicacion_web','diario_oficial','entidad_emisora','estado_vigencia','motivo_cambio_estado','clasificacion_obligatoriedad','zonas_afectadas','plazos_mencionados','anotaciones_vigencia','tesis_juridica','tesis_respuesta','problema_juridico','fuentes_formales','descriptores','doctrina_citada','jurisprudencia_citada','modifica_a','modificado_por','anio','anio_publicacion','es_nuevo'].join(',');
const FUENTES = {
  tributario: 'https://normograma.dian.gov.co/dian/compilacion/tributario.html',
  novedades: 'https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html'
};
const DIAS_NOVEDAD = 14;
const CABECERA_FECHA_WEB = /(?:publicad[oa]\s+en\s+la\s+p[aá]gina\s+(?:web\s+)?(?:oficial\s+)?de\s+la\s+DIAN|publicaci[oó]n\s+en\s+la\s+DIAN)\s*:/i;
function fechaCorteNovedades(){const f=new Date();f.setUTCDate(f.getUTCDate()-DIAS_NOVEDAD);return f.toISOString().slice(0,10);}
function esNovedadOficial(d){const corte=fechaCorteNovedades();return [d.fecha_publicacion_web,d.fecha_publicacion].some(f=>typeof f==='string'&&f.slice(0,10)>=corte);}
export default async function handler(req,res){
  // Fail closed: a missing access secret must never make this privileged API public.
  if(!CLAVE||!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  if(req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});
  const periodoSolicitado=String(req.query.periodo||'2026');
  const periodo=/^\d{4}$/.test(periodoSolicitado)?periodoSolicitado:(PERIODOS[periodoSolicitado]!==undefined?periodoSolicitado:'2026');
  const estadoSolicitado=req.query.estado; const estado=ESTADOS[estadoSolicitado]!==undefined?estadoSolicitado:'todos';
  const tema=req.query.tema||'';
  const q=String(req.query.q||'').trim().slice(0,160);
  const orden=ORDENES[req.query.orden]||ORDENES.recientes; const pagina=Math.max(1,parseInt(req.query.pagina,10)||1);
  const cabeceras={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
  let filtro=/^\d{4}$/.test(periodo)?`anio_publicacion=eq.${periodo}`:(PERIODOS[periodo]!==undefined?PERIODOS[periodo]:'id=not.is.null');
  filtro+='&publicado_cliente=is.true';
  if(estado==='nuevos'){const corte=fechaCorteNovedades();filtro+=`&or=(fecha_publicacion.gte.${corte},fecha_publicacion_web.gte.${corte})`;}
  if(tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;
  if(q){
    const termino=q.replace(/[(),]/g,' ').replace(/[*]/g,' ').trim();
    if(/^DIAN-[A-Z_]+-\d+-(?:19|20)\d{2}$/i.test(termino))filtro+=`&numero_resolucion=eq.${encodeURIComponent(termino)}`;
    else if(termino)filtro+=`&or=${encodeURIComponent(`(numero_resolucion.ilike.*${termino}*,titulo.ilike.*${termino}*,contenido.ilike.*${termino}*,descripcion_limpia.ilike.*${termino}*)`)}`;
  }
  const primera=(pagina-1)*POR_PAGINA;
  try{
    const rDocs=await fetch(`${SUPABASE_URL}/rest/v1/v_bandeja?select=${CAMPOS}&${filtro}&order=${orden}`,{headers:{...cabeceras,Prefer:'count=exact',Range:`${primera}-${primera+POR_PAGINA-1}`}});
    if(!rDocs.ok){const detalle=await rDocs.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    let documentos=await rDocs.json(); const rango=rDocs.headers.get('content-range')||'*/0'; let total=parseInt(rango.split('/')[1],10)||0;
    if(documentos.length){
      const ids=documentos.map(d=>d.id).filter(Boolean); const inFilter=`in.(${ids.join(',')})`;
      // texto_completo/enriquecido_en pertenecen a la tabla base y pueden no
      // estar expuestos por la vista de lectura; pedirlos aparte evita romperla.
      const rTexto=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id,texto_completo,notas_verificacion&id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
      if(rTexto.ok){const textos=await rTexto.json();const porTexto=new Map(textos.map(x=>[x.id,x]));for(const d of documentos){const x=porTexto.get(d.id)||{};const nota=String(x.notas_verificacion||'');const raiz=nota.match(/raiz:\s*(https:\/\/[^\s|]+)/i);const indice=nota.match(/indice:\s*(https:\/\/[^\s|]+)/i);d.texto_completo=x.texto_completo||null;d.fuente_raiz=(raiz&&raiz[1])||((d.temas||[]).includes('boletin_mensual')||d.tipo_documento==='boletin'?FUENTES.novedades:FUENTES.tributario);d.fuente_indice=(indice&&indice[1])||null;}}
      const rEvaluaciones=await fetch(`${SUPABASE_URL}/rest/v1/revisor_fiscal_euclidian_evaluaciones?select=documento_id,resultado&documento_id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
      const evaluaciones=rEvaluaciones.ok?new Map((await rEvaluaciones.json()).map(x=>[x.documento_id,x.resultado])):new Map();
      for(const d of documentos){
        // Una fecha de Diario Oficial u otra cita no acredita publicación web DIAN.
        // Las fechas heredadas sin el encabezado explícito no se muestran como tal.
        if(d.fecha_publicacion_web&&!CABECERA_FECHA_WEB.test(String(d.texto_completo||'')))d.fecha_publicacion_web=null;
        d.evaluacion_resultado=evaluaciones.get(d.id)||'REVIEW';
        if(d.evaluacion_resultado!=='APPROVE'){
          // El catálogo sigue localizable; las conclusiones que no superaron
          // el contraste individual no se entregan como criterio profesional.
          d.consulta_documental=true;
          d.resumen_humano=null;d.resumen_borrador=null;
          d.problema_juridico=null;d.tesis_juridica=null;d.tesis_respuesta=null;
          d.plazos_mencionados=[];d.fuentes_formales=[];d.doctrina_citada=[];d.jurisprudencia_citada=[];
          d.fecha_es_real=false;d.estado_vigencia='desconocido';d.clasificacion_obligatoriedad=null;
          d.fecha_entrada_vigencia=null;d.motivo_cambio_estado=null;d.anotaciones_vigencia=[];
          d.zonas_afectadas=[];d.modifica_a=[];d.modificado_por=[];
        }
        d.es_nuevo=esNovedadOficial(d);
        if(!d.fuente_raiz)d.fuente_raiz=(d.temas||[]).includes('boletin_mensual')||d.tipo_documento==='boletin'?FUENTES.novedades:FUENTES.tributario;
      }
      // Una publicación reciente solo aparece como novedad cuando conserva
      // fecha exacta, texto fuente y enlace DIAN. Así la urgencia no rebaja
      // el estándar de evidencia de la biblioteca.
      if(estado==='nuevos'){documentos=documentos.filter(d=>d.fecha_es_real===true&&String(d.texto_completo||'').trim().length>=200&&String(d.enlace_oficial||'').startsWith('https://normograma.dian.gov.co/dian/compilacion/'));total=documentos.length;}
    }
    const rResumen=await fetch(`${SUPABASE_URL}/rest/v1/rpc/conteos_bandeja_api`,{method:'POST',headers:{...cabeceras,'Content-Type':'application/json'},body:JSON.stringify({p_periodo:periodo,p_tema:tema||null,p_estado:estado,p_prioridad:null,p_naturaleza:null})});
    let resumen={}; try{if(rResumen.ok)resumen=(await rResumen.json())||{};}catch(e){}
    res.setHeader('Cache-Control','no-store'); return res.status(200).json({documentos,total,pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),temas:resumen.temas||[],periodo,periodos:resumen.periodos||{},actualizado:resumen.actualizado||null});
  }catch(e){return res.status(500).json({error:'fallo_lectura',detalle:String(e).slice(0,200)});}
}
