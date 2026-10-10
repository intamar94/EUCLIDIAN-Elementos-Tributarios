import { autorizarConsulta, registrarUsoConsulta } from '../lib/auth-server.js';
// EUCLIDIAN — catálogo completo de documentos.
// La vista cliente muestra todo el corpus; el estado fiscal se conserva como dato informativo.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const ESTADOS = { nuevos:'nuevos', todos:'todos' };
const PERIODOS = { recientes:2024, decada:2016, todo:null };
function filtroAnio(periodo){
  if(periodo==='todo')return 'id=not.is.null';
  const valor=/^\d{4}$/.test(periodo)?Number(periodo):PERIODOS[periodo];
  const op=/^\d{4}$/.test(periodo)?'eq':'gte';
  return `and=(or(anio_publicacion.${op}.${valor},and(anio_publicacion.is.null,anio.${op}.${valor})))`;
}
const ORDENES = { recientes:'fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast,numero_resolucion.desc', prioridad:'orden_prioridad.asc,fecha_publicacion.desc.nullslast,fecha_publicacion_web.desc.nullslast', antiguos:'fecha_publicacion.asc.nullslast,fecha_publicacion_web.asc.nullslast,numero_resolucion.asc' };
// Solo columnas expuestas por v_bandeja. Los metadatos de verificación se derivan abajo.
const CAMPOS = ['id','numero_resolucion','numero_interno','tipo_documento','contenido','descripcion_limpia','titulo','resumen_humano','resumen_borrador','enlace_oficial','materia','temas','fecha_publicacion','fecha_es_real','fecha_entrada_vigencia','fecha_publicacion_web','diario_oficial','entidad_emisora','estado_vigencia','motivo_cambio_estado','clasificacion_obligatoriedad','zonas_afectadas','plazos_mencionados','anotaciones_vigencia','tesis_juridica','tesis_respuesta','problema_juridico','fuentes_formales','descriptores','doctrina_citada','jurisprudencia_citada','modifica_a','modificado_por','anio','anio_publicacion','es_nuevo'].join(',');
const FUENTES = {
  tributario: 'https://normograma.dian.gov.co/dian/compilacion/tributario.html',
  novedades: 'https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html'
};
const DIAS_NOVEDAD = 14;
const CABECERA_FECHA_WEB = /(?:publicad[oa]\s+en\s+la\s+p[aá]gina\s+(?:web\s+)?(?:oficial\s+)?de\s+la\s+DIAN|publicaci[oó]n\s+en\s+la\s+DIAN)\s*:/i;
// Estas frases son plantillas antiguas sobre el tipo de acto y las etiquetas
// temáticas. No describen el criterio jurídico de un documento individual.
const SINTESIS_PLANTILLA = /Doctrina DIAN:\s*orienta, no obliga|te toca si trabajas con/i;
function fechaCorteNovedades(){const f=new Date();f.setUTCDate(f.getUTCDate()-DIAS_NOVEDAD);return f.toISOString().slice(0,10);}
function fechaDocumentoCoherente(d){const anio=String(d.numero_resolucion||'').match(/-((?:19|20)\d{2})$/)?.[1];return d.fecha_es_real===true&&typeof d.fecha_publicacion==='string'&&(!anio||d.fecha_publicacion.slice(0,4)===anio);}
function fechaReciente(fecha){const valor=String(fecha||'').slice(0,10);return /^\d{4}-\d{2}-\d{2}$/.test(valor)&&valor>=fechaCorteNovedades()&&valor<=new Date().toISOString().slice(0,10);}
function esNovedadOficial(d){return fechaReciente(d.fecha_publicacion_web)||(fechaDocumentoCoherente(d)&&fechaReciente(d.fecha_publicacion));}
function fechaNovedad(d){const web=fechaReciente(d.fecha_publicacion_web)?d.fecha_publicacion_web:'';const acto=fechaDocumentoCoherente(d)&&fechaReciente(d.fecha_publicacion)?d.fecha_publicacion:'';return web>acto?web:acto;}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method&&req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  const started=Date.now();
  // Fail closed: Supabase server configuration is mandatory. The old shared key
  // remains only as an internal transition path; customers use Supabase Auth.
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  const acceso=await autorizarConsulta(req);
  if(!acceso.ok){
    return res.status(acceso.status||401).json({
      error:acceso.error||'acceso_denegado',
      access:acceso.acceso?{
        estado:acceso.acceso.estado||'pendiente',
        plan_codigo:acceso.acceso.plan_codigo||null,
        periodo_fin:acceso.acceso.periodo_fin||null
      }:undefined
    });
  }
  const periodoSolicitado=String(req.query.periodo||'2026');
  const periodo=/^\d{4}$/.test(periodoSolicitado)?periodoSolicitado:(PERIODOS[periodoSolicitado]!==undefined?periodoSolicitado:'2026');
  const estadoSolicitado=req.query.estado; const estado=ESTADOS[estadoSolicitado]!==undefined?estadoSolicitado:'todos';
  const tema=req.query.tema||'';
  const q=String(req.query.q||'').trim().slice(0,160);
  const doc=String(req.query.doc||'').trim();
  if(doc&&!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(doc))return res.status(400).json({error:'documento_invalido'});
  const orden=ORDENES[req.query.orden]||ORDENES.recientes; const pagina=Math.max(1,parseInt(req.query.pagina,10)||1);
  const cabeceras={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
  let filtro=doc?`id=eq.${doc}`:filtroAnio(periodo);
  filtro+='&publicado_cliente=is.true';
  if(!doc&&estado==='nuevos'){const corte=fechaCorteNovedades();filtro+=`&or=(fecha_publicacion.gte.${corte},fecha_publicacion_web.gte.${corte})`;}
  if(!doc&&tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;
  if(!doc&&q){const termino=q.replace(/[(),]/g,' ').replace(/[*]/g,' ').trim();if(/^DIAN-[A-Z_]+-\d+-(?:19|20)\d{2}$/i.test(termino)){filtro+=`&numero_resolucion=eq.${encodeURIComponent(termino)}`;}else if(termino){const sigla=/^[A-ZÁÉÍÓÚÜÑ]{2,8}$/u.test(termino);const busqueda=sigla?`(contenido.plfts(spanish).${termino},descripcion_limpia.plfts(spanish).${termino})`:`(numero_resolucion.ilike.*${termino}*,titulo.ilike.*${termino}*,contenido.ilike.*${termino}*,descripcion_limpia.ilike.*${termino}*)`;filtro+=`&or=${encodeURIComponent(busqueda)}`;}}
  const primera=doc?0:(pagina-1)*POR_PAGINA;
  try{
    const novedades=!doc&&estado==='nuevos';
    const lote=novedades?500:POR_PAGINA;
    const inicio=novedades?0:primera;
    const documentos=[]; let total=0;
    // La evidencia se comprueba después de leer la tabla base. Para que el
    // total y la paginación sean exactos, la vista de novedades recorre todos
    // los candidatos del intervalo antes de elegir la página solicitada.
    for(let offset=inicio;;offset+=lote){
      const rDocs=await fetch(`${SUPABASE_URL}/rest/v1/v_bandeja?select=${CAMPOS}&${filtro}&order=${orden}`,{headers:{...cabeceras,Prefer:'count=exact',Range:`${offset}-${offset+lote-1}`}});
      if(!rDocs.ok){const detalle=await rDocs.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
      const grupo=await rDocs.json();
      if(offset===inicio){const rango=rDocs.headers.get('content-range')||'*/0';total=parseInt(rango.split('/')[1],10)||0;}
      documentos.push(...grupo);
      if(!novedades||offset+grupo.length>=total||grupo.length===0)break;
    }
    if(documentos.length){
      // texto_completo/enriquecido_en pertenecen a la tabla base y pueden no
      // estar expuestos por la vista de lectura; pedirlos aparte evita romperla.
      const porTexto=new Map();
      const ids=documentos.map(d=>d.id).filter(Boolean);
      for(let i=0;i<ids.length;i+=50){
        const inFilter=`in.(${ids.slice(i,i+50).join(',')})`;
        const rTexto=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id,texto_completo,notas_verificacion,estado_fuente_verificacion,fuente_verificada_en,hash_contenido&id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
        if(!rTexto.ok)return res.status(502).json({error:'evidencia_no_disponible'});
        if(rTexto.ok)for(const x of await rTexto.json())porTexto.set(x.id,x);
      }
      for(const d of documentos){const x=porTexto.get(d.id)||{};const nota=String(x.notas_verificacion||'');const raiz=nota.match(/raiz:\s*(https:\/\/[^\s|]+)/i);const indice=nota.match(/indice:\s*(https:\/\/[^\s|]+)/i);d.texto_completo=x.texto_completo||null;d.estado_fuente_verificacion=x.estado_fuente_verificacion||null;d.fuente_verificada_en=x.fuente_verificada_en||null;d.fuente_raiz=(raiz&&raiz[1])||((d.temas||[]).includes('boletin_mensual')||d.tipo_documento==='boletin'?FUENTES.novedades:FUENTES.tributario);d.fuente_indice=(indice&&indice[1])||null;}
      const boletines=documentos.filter(d=>d.tipo_documento==='boletin');
      if(boletines.length){
        const porBoletin=new Map(boletines.map(d=>[d.id,d]));
        for(const d of boletines)d.referencias_boletin=[];
        for(let i=0;i<boletines.length;i+=50){
          const inFilter=`in.(${boletines.slice(i,i+50).map(d=>d.id).join(',')})`;
          const rRefs=await fetch(`${SUPABASE_URL}/rest/v1/boletin_referencias?select=boletin_id,pagina,tipo,referencia,url_oficial,pdf_hash&boletin_id=${encodeURIComponent(inFilter)}&order=pagina.asc`,{headers:cabeceras});
          if(!rRefs.ok)return res.status(502).json({error:'referencias_no_disponibles'});
          for(const ref of await rRefs.json()){
            const boletin=porBoletin.get(ref.boletin_id);
            if(boletin?.estado_fuente_verificacion==='pdf_oficial_con_texto'&&ref.pdf_hash===porTexto.get(boletin.id)?.hash_contenido&&String(ref.url_oficial||'').startsWith('https://normograma.dian.gov.co/dian/compilacion/docs/'))
              boletin.referencias_boletin.push({pagina:ref.pagina,tipo:ref.tipo,referencia:ref.referencia,url_oficial:ref.url_oficial});
          }
        }
      }
      const evaluaciones=new Map();
      for(let i=0;i<ids.length;i+=50){
        const inFilter=`in.(${ids.slice(i,i+50).join(',')})`;
        const rEvaluaciones=await fetch(`${SUPABASE_URL}/rest/v1/revisor_fiscal_euclidian_evaluaciones?select=documento_id,resultado&documento_id=${encodeURIComponent(inFilter)}`,{headers:cabeceras});
        if(!rEvaluaciones.ok)return res.status(502).json({error:'evaluacion_no_disponible'});
        for(const x of await rEvaluaciones.json())evaluaciones.set(x.documento_id,x.resultado);
      }
      for(const d of documentos){
        // Una fecha de Diario Oficial u otra cita no acredita publicación web DIAN.
        // Las fechas heredadas sin el encabezado explícito no se muestran como tal.
        if(d.fecha_publicacion_web&&!CABECERA_FECHA_WEB.test(String(d.texto_completo||'')))d.fecha_publicacion_web=null;
        d.evaluacion_resultado=evaluaciones.get(d.id)||'REVIEW';
        if(SINTESIS_PLANTILLA.test(String(d.resumen_humano||d.resumen_borrador||''))){
          // En una ficha contrastada conservamos pregunta/tesis y metadatos,
          // pero preferimos la descripción DIAN a una síntesis formularia.
          d.resumen_humano=null;d.resumen_borrador=null;
        }
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
      if(novedades){const elegibles=documentos.filter(d=>d.es_nuevo&&String(d.texto_completo||'').trim().length>=200&&String(d.enlace_oficial||'').startsWith('https://normograma.dian.gov.co/dian/compilacion/'));elegibles.sort((a,b)=>fechaNovedad(b).localeCompare(fechaNovedad(a))||String(b.numero_resolucion||'').localeCompare(String(a.numero_resolucion||'')));total=elegibles.length;documentos.splice(0,documentos.length,...elegibles.slice(primera,primera+POR_PAGINA));}
    }
    const rMeta=await fetch(`${SUPABASE_URL}/rest/v1/rpc/metadatos_catalogo_cliente`,{method:'POST',headers:{...cabeceras,'Content-Type':'application/json'},body:JSON.stringify({p_periodo:doc?'todo':periodo})});
    if(!rMeta.ok)return res.status(502).json({error:'metadatos_no_disponibles'});
    const meta=await rMeta.json();
    if(acceso.modo==='usuario'&&acceso.user?.id){
      await registrarUsoConsulta(acceso.user.id,{latencia_ms:Date.now()-started,resultados:total,estado:total?'ok':'sin_resultados'});
    }
    res.setHeader('Cache-Control','no-store'); return res.status(200).json({documentos,total,pagina:doc?1:pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),temas:meta.temas||[],periodo,anios:Array.isArray(meta.anios)?meta.anios:[],actualizado:meta.actualizado||null});
  }catch(e){return res.status(500).json({error:'fallo_lectura',detalle:String(e).slice(0,200)});}
}
