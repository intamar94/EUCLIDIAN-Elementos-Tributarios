const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET') return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!SUPABASE_URL||!SUPABASE_KEY) return res.status(503).json({ok:false,error:'missing_configuration'});
  try{
    const started=Date.now();
    const r=await fetch(`${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id&limit=1`,{
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
    });
    if(!r.ok) return res.status(503).json({ok:false,error:'database_unavailable'});
    return res.status(200).json({ok:true,service:'euclidian',database:true,latency_ms:Date.now()-started});
  }catch(_){
    return res.status(503).json({ok:false,error:'healthcheck_failed'});
  }
}
