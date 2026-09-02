// EUCLIDIAN — registra la decisión sobre un documento.
// La aprobación fiscal publica en la biblioteca; el email es independiente.
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;

export default async function handler(req,res){
  if(req.method!=='POST')return res.status(405).json({error:'metodo_no_permitido'});
  if(CLAVE&&req.headers['x-clave']!==CLAVE)return res.status(401).json({error:'clave_incorrecta'});

  const {id,decision,resumen}=req.body||{};
  if(!id||!['aprobar','descartar','devolver'].includes(decision))return res.status(400).json({error:'peticion_invalida'});

  const cambios={};
  if(decision==='aprobar'){
    cambios.revisado_por_humano=true;
    cambios.publicado_cliente=true;
    cambios.revisado_fiscal_en=new Date().toISOString();
    cambios.observaciones_revisor=null;
  }else if(decision==='descartar'){
    cambios.revisado_por_humano=true;
    cambios.publicado_cliente=false;
    cambios.aprobado_para_email=false;
    cambios.revisado_fiscal_en=new Date().toISOString();
  }
  if(decision==='devolver'){
    cambios.publicado_cliente=false;
    cambios.aprobado_para_email=false;
  }
  if(typeof resumen==='string')cambios.resumen_humano=resumen.slice(0,4000)||null;

  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?id=eq.${encodeURIComponent(id)}`,{
      method:'PATCH',
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json',Prefer:'return=representation'},
      body:JSON.stringify(cambios)
    });
    if(!r.ok){const detalle=await r.text();return res.status(502).json({error:'supabase',detalle:detalle.slice(0,300)});}
    const [fila]=await r.json();
    return res.status(200).json({ok:true,documento:fila});
  }catch(e){return res.status(500).json({error:'fallo_escritura',detalle:String(e).slice(0,200)});}
}
