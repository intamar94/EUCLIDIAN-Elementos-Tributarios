// EUCLIDIAN — API pública de consulta para el cliente.
// La publicación se decide exclusivamente en servidor: el cliente solo recibe
// información aprobada para publicación.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const PRIORIDADES = { importante:'prioridad=eq.importante', informativa:'prioridad=eq.informativa' };
const NATURALEZAS = { obligatorias:'clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes', conceptos:'clasificacion_obligatoriedad=eq.obligatorio_dian_solo' };
const ORDENES = { recientes:'fecha_publicacion.desc,numero_resolucion.desc', prioridad:'orden_prioridad.asc,fecha_publicacion.desc', antiguos:'fecha_publicacion.asc,numero_resolucion.asc' };
const CAMPOS = ['id','numero_resolucion','numero_interno','tipo_documento','titulo','contenido','descripcion_limpia','resumen_humano','enlace_oficial','materia','temas','banco_datos','fecha_publicacion','fecha_es_real','fecha_entrada_vigencia','fecha_publicacion_web','diario_oficial','dependencia_emisora','estado_vigencia','motivo_cambio_estado','clasificacion_obligatoriedad','tiene_efectos_retroactivos','anos_afectados','zonas_afectadas','plazos_mencionados','anotaciones_vigencia','tesis_juridica','tesis_respuesta','problema_juridico','fuentes_formales','descriptores','doctrina_citada','jurisprudencia_citada','modifica_a','modificado_por','nivel_alerta','prioridad'].join(',');
export default async function handler(req,res){
  if(CLAVE&&req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  const desde=req.query.desde||'',tema=req.query.tema||'',prioridad=PRIORIDADES[req.query.prioridad]?req.query.prioridad:'',naturaleza=NATURALEZAS[req.query.naturaleza]?req.query.naturaleza:'',orden=ORDENES[req.query.orden]||ORDENES.recientes,pagina=Math.max(1,parseInt(req.query.pagina,10)||1);
  let filtro='aprobado_para_email=eq.true';
  if(desde)filtro+=`&fecha_publicacion=gte.${encodeURIComponent(desde)}`;
  if(PRIORIDADES[prioridad])filtro+='&'+PRIORIDADES[prioridad];
  if(NATURALEZAS[naturaleza])filtro+='&'+NATURALEZAS[naturaleza];
  if(tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;
  const primera=(pagina-1)*POR_PAGINA,cabeceras={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
  try{
    // Fuente pública: tabla real de producción. No dependemos de una vista
    // que pueda quedar desactualizada respecto al proceso de publicación.
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=${CAMPOS}&${filtro}&order=${orden}`,{headers:{...cabeceras,Prefer:'count=exact',Range:`${primera}-${primera+POR_PAGINA-1}`} });
    if(!r.ok){const detalle=await r.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    const documentos=await r.json(),rango=r.headers.get('content-range')||'*/0',total=parseInt(rango.split('/')[1],10)||0;
    const temas=[...new Set(documentos.flatMap(d=>Array.isArray(d.temas)?d.temas:[]))].sort((a,b)=>String(a).localeCompare(String(b),'es'));
    const prioridadConteos={importante:0,informativa:0};
    const naturalezaConteos={obligatorias:0,conceptos:0};
    documentos.forEach(d=>{
      if(d.prioridad==='importante')prioridadConteos.importante++;
      if(d.prioridad==='informativa')prioridadConteos.informativa++;
      if(d.clasificacion_obligatoriedad==='obligatorio_dian_y_contribuyentes')naturalezaConteos.obligatorias++;
      if(d.clasificacion_obligatoriedad==='obligatorio_dian_solo')naturalezaConteos.conceptos++;
    });
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({documentos,total,pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),temas,prioridad:prioridadConteos,naturaleza:naturalezaConteos,actualizado:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:'fallo_lectura'});}
}
