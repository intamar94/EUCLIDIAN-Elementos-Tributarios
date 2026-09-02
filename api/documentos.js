// EUCLIDIAN — API de consulta para el cliente.
// El cliente solo recibe información aprobada para publicación.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const PRIORIDADES = { importante:'prioridad=eq.importante', informativa:'prioridad=eq.informativa' };
const NATURALEZAS = { obligatorias:'clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes', conceptos:'clasificacion_obligatoriedad=eq.obligatorio_dian_solo' };
const ORDENES = { recientes:'fecha_publicacion.desc.nullslast,id.desc', prioridad:'fecha_publicacion.desc.nullslast,id.desc', antiguos:'fecha_publicacion.asc.nullslast,id.asc' };
const baseHeaders={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};

async function contar(filtro=''){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id&${filtro}`,{headers:{...baseHeaders,Prefer:'count=exact'},cache:'no-store'});
  if(!r.ok)throw new Error((await r.text()).slice(0,250));
  const cr=r.headers.get('content-range')||'*/0';
  return parseInt(cr.split('/')[1],10)||0;
}
async function fechaExtrema(desc=true){
  const order=desc?'fecha_publicacion.desc.nullslast,id.desc':'fecha_publicacion.asc.nullslast,id.asc';
  const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=fecha_publicacion&aprobado_para_email=eq.true&order=${order}&limit=1`,{headers:baseHeaders,cache:'no-store'});
  if(!r.ok)return null;
  const d=await r.json(); return d[0]?.fecha_publicacion||null;
}

export default async function handler(req,res){
  if(CLAVE&&req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});
  const desde=req.query.desde||'',tema=req.query.tema||'',prioridad=PRIORIDADES[req.query.prioridad]?req.query.prioridad:'',naturaleza=NATURALEZAS[req.query.naturaleza]?req.query.naturaleza:'',orden=ORDENES[req.query.orden]||ORDENES.recientes,pagina=Math.max(1,parseInt(req.query.pagina,10)||1);
  let filtro='aprobado_para_email=eq.true';
  if(desde)filtro+=`&fecha_publicacion=gte.${encodeURIComponent(desde)}`;
  if(PRIORIDADES[prioridad])filtro+='&'+PRIORIDADES[prioridad];
  if(NATURALEZAS[naturaleza])filtro+='&'+NATURALEZAS[naturaleza];
  if(tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;
  const primera=(pagina-1)*POR_PAGINA;
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=*&${filtro}&order=${orden}`,{headers:{...baseHeaders,Prefer:'count=exact'},Range:`${primera}-${primera+POR_PAGINA-1}`,cache:'no-store'});
    if(!r.ok){const detalle=await r.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    const documentos=await r.json();
    const cr=r.headers.get('content-range')||'*/0';
    const total=parseInt(cr.split('/')[1],10)||0;
    const [baseTotal,publicados,fechaMasReciente,fechaMasAntigua,importantes,informativas,obligatorias,conceptos]=await Promise.all([
      contar(''),contar('aprobado_para_email=eq.true'),fechaExtrema(true),fechaExtrema(false),
      contar('aprobado_para_email=eq.true&prioridad=eq.importante'),
      contar('aprobado_para_email=eq.true&prioridad=eq.informativa'),
      contar('aprobado_para_email=eq.true&clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes'),
      contar('aprobado_para_email=eq.true&clasificacion_obligatoriedad=eq.obligatorio_dian_solo')
    ]);
    const temas=[...new Set(documentos.flatMap(d=>Array.isArray(d.temas)?d.temas:[]))].filter(Boolean).sort((a,b)=>String(a).localeCompare(String(b),'es'));
    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({documentos,total,pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),temas,prioridad:{importante:importantes,informativa:informativas},naturaleza:{obligatorias,conceptos},cobertura:{baseTotal,publicados,fechaMasReciente,fechaMasAntigua},consulta:new Date().toISOString()});
  }catch(e){return res.status(500).json({error:'fallo_lectura',detalle:String(e.message||e).slice(0,250)});}
}
