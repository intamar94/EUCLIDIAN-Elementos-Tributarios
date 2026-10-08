// EUCLIDIAN — registra la decisión sobre un documento.
// La aprobación fiscal publica en la biblioteca; el email es independiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const REVISOR_CLAVE = process.env.EUCLIDIAN_REVISOR_CLAVE;
const BLOCKING = new Set(['identificacion','fuente','fecha_sin_valor','fecha_imposible',
  'orden_fechas','duplicado','plazo_cortado','cita_incompleta','retroactividad_sin_periodo']);

async function rows(path){
  const response=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`},cache:'no-store'});
  if(!response.ok)throw new Error(`control_${response.status}`);
  return response.json();
}

async function publicationGate(id,summary){
  if(summary.trim().length<80)return 'sintesis_insuficiente';
  const runs=await rows('inspector_ejecuciones?select=id,estado,finalizado_en,total,revisados&order=iniciado_en.desc&limit=1');
  const run=runs[0];
  if(!run||!['correcto','alerta'].includes(run.estado)||run.total<=0||run.revisados!==run.total||
      !run.finalizado_en||Date.now()-new Date(run.finalizado_en).getTime()>36*60*60*1000)
    return 'inspeccion_no_vigente';
  const [inspection,documents,dossiers]=await Promise.all([
    rows(`inspector_resultados?select=estado,hallazgos&ejecucion_id=eq.${run.id}&documento_id=eq.${encodeURIComponent(id)}&limit=1`),
    rows(`documentos_tributarios?select=id,enlace_oficial,fecha_publicacion,fecha_es_real,fecha_publicacion_web&id=eq.${encodeURIComponent(id)}&limit=1`),
    rows(`control_interno_expedientes?select=codigo,estado,prioridad&documento_id=eq.${encodeURIComponent(id)}&estado=in.(abierto,en_cuarentena)&prioridad=eq.alta&limit=1`)
  ]);
  if(!documents.length)return 'documento_no_encontrado';
  let source;
  try{source=new URL(documents[0].enlace_oficial);}catch{return 'fuente_no_verificable';}
  const normograma=source.hostname==='normograma.dian.gov.co'&&source.pathname.startsWith('/dian/compilacion/');
  const bulletin=source.hostname==='www.dian.gov.co'&&source.pathname.startsWith('/normatividad/Publicaciones-Juridicas/')&&source.pathname.toLowerCase().endsWith('.pdf');
  if(source.protocol!=='https:'||!(normograma||bulletin))
    return 'fuente_no_verificable';
  if(dossiers.length)return 'expediente_bloqueante_abierto';
  if(!inspection.length)return 'documento_sin_inspeccion';
  const codes=new Set((inspection[0].hallazgos||[]).map(x=>x.codigo));
  if(inspection[0].estado==='critico'||[...codes].some(code=>BLOCKING.has(code)))return 'hallazgo_bloqueante';
  if(!documents[0].fecha_es_real&&!documents[0].fecha_publicacion_web)
    return 'fecha_no_verificada';
  return null;
}

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'metodo_no_permitido'});
  // This endpoint writes through the Supabase service key; missing auth is an error, never open access.
  if(!CLAVE||!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  if(!REVISOR_CLAVE)return res.status(503).json({error:'modo_revision_no_configurado'});
  if(req.headers['x-clave']!==REVISOR_CLAVE)return res.status(401).json({error:'clave_revisor_incorrecta'});

  const {id,decision,resumen}=req.body||{};
  if(decision==='validar_revisor')return res.status(200).json({ok:true});
  if(!id||!['aprobar','descartar','devolver'].includes(decision))return res.status(400).json({error:'peticion_invalida'});
  if(decision==='aprobar'&&(typeof resumen!=='string'||!resumen.trim()))return res.status(400).json({error:'resumen_requerido_para_publicar'});
  if(decision==='aprobar'){
    try{const reason=await publicationGate(id,resumen);if(reason)return res.status(409).json({error:'publicacion_bloqueada',motivo:reason});}
    catch{return res.status(503).json({error:'control_no_disponible'});}
  }

  const cambios={};
  if(decision==='aprobar'){
    cambios.revisado_por_humano=true;
    cambios.publicado_cliente=true;
    cambios.aprobado_para_email=false;
    cambios.revisado_fiscal_en=new Date().toISOString();
    cambios.observaciones_revisor=null;
  }else if(decision==='descartar'){
    cambios.revisado_por_humano=true;
    cambios.publicado_cliente=false;
    cambios.aprobado_para_email=false;
    cambios.revisado_fiscal_en=new Date().toISOString();
  }
  if(decision==='devolver'){
    // Guardar un borrador no es aprobar ni cerrar la revisión.
  }
  if(typeof resumen==='string')cambios.resumen_humano=resumen.slice(0,4000)||null;

  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify(cambios)
    });
    if(!r.ok){const detalle=await r.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    const filas=await r.json();
    const fila=filas[0];
    if(!fila)return res.status(404).json({error:'documento_no_encontrado'});
    return res.status(200).json({ok:true,documento:fila});
  }catch(e){return res.status(500).json({error:'fallo_escritura',detalle:String(e).slice(0,200)});}
}
