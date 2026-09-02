// EUCLIDIAN — API pública de consulta para el cliente.
// La biblioteca solo recibe documentos que pasaron el Revisor Fiscal.
// La aprobación para email es una función independiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;
const POR_PAGINA = 25;
const PRIORIDADES = { importante:'prioridad=eq.importante', informativa:'prioridad=eq.informativa' };
const NATURALEZAS = { obligatorias:'clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes', conceptos:'clasificacion_obligatoriedad=eq.obligatorio_dian_solo' };
const ORDENES = { recientes:'fecha_publicacion.desc', prioridad:'orden_prioridad.asc,fecha_publicacion.desc', antiguos:'fecha_publicacion.asc' };

function rangoTotal(r){
  const h=r.headers.get('content-range')||'*/0';
  const n=parseInt(h.split('/')[1],10);
  return Number.isFinite(n)?n:0;
}

async function contar(cabeceras,filtro){
  const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id&${filtro}`,{
    headers:{...cabeceras,Prefer:'count=exact'},Range:'0-0'
  });
  return r.ok?rangoTotal(r):0;
}

export default async function handler(req,res){
  if(CLAVE&&req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(500).json({error:'falta_configuracion'});

  const desde=req.query.desde||'';
  const tema=req.query.tema||'';
  const prioridad=PRIORIDADES[req.query.prioridad]?req.query.prioridad:'';
  const naturaleza=NATURALEZAS[req.query.naturaleza]?req.query.naturaleza:'';
  const orden=ORDENES[req.query.orden]||ORDENES.recientes;
  const pagina=Math.max(1,parseInt(req.query.pagina,10)||1);

  // Publicación profesional: revisado por el Revisor Fiscal y publicado.
  // NO depende de la bandera de email.
  let filtro='publicado_cliente=eq.true&revisado_por_humano=eq.true';
  if(desde)filtro+=`&fecha_publicacion=gte.${encodeURIComponent(desde)}`;
  if(PRIORIDADES[prioridad])filtro+='&'+PRIORIDADES[prioridad];
  if(NATURALEZAS[naturaleza])filtro+='&'+NATURALEZAS[naturaleza];
  if(tema)filtro+=`&temas=cs.{${encodeURIComponent(tema)}}`;

  const primera=(pagina-1)*POR_PAGINA;
  const cabeceras={apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`};
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=*&${filtro}&order=${orden}`,{
      headers:{...cabeceras,Prefer:'count=exact'},
      Range:`${primera}-${primera+POR_PAGINA-1}`
    });
    if(!r.ok){const detalle=await r.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}

    const documentos=await r.json();
    const total=rangoTotal(r);
    const temas=[...new Set(documentos.flatMap(d=>Array.isArray(d.temas)?d.temas:[]))].filter(t=>!String(t).startsWith('dian:')).sort((a,b)=>String(a).localeCompare(String(b),'es'));
    const base='publicado_cliente=eq.true&revisado_por_humano=eq.true';
    const [totalImportantes,totalInformativas,totalObligatorias,totalConceptos]=await Promise.all([
      contar(cabeceras,`${base}&prioridad=eq.importante`),
      contar(cabeceras,`${base}&prioridad=eq.informativa`),
      contar(cabeceras,`${base}&clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes`),
      contar(cabeceras,`${base}&clasificacion_obligatoriedad=eq.obligatorio_dian_solo`)
    ]);

    res.setHeader('Cache-Control','no-store');
    return res.status(200).json({
      documentos,total,pagina,porPagina:POR_PAGINA,paginas:Math.max(1,Math.ceil(total/POR_PAGINA)),temas,
      prioridad:{importante:totalImportantes,informativa:totalInformativas},
      naturaleza:{obligatorias:totalObligatorias,conceptos:totalConceptos},
      actualizado:new Date().toISOString()
    });
  }catch(e){return res.status(500).json({error:'fallo_lectura'});}
}
