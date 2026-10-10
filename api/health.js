const SUPABASE_URL=process.env.SUPABASE_URL;
const SUPABASE_KEY=process.env.SUPABASE_SERVICE_KEY;
const PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY;
import {configuracionCobro} from '../lib/billing.js';

async function probe(path){
  const started=Date.now();
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
      signal:AbortSignal.timeout(8000),
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`}
    });
    return {ok:r.ok,latency_ms:Date.now()-started};
  }catch(_){return {ok:false,latency_ms:Date.now()-started};}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(503).json({ok:false,error:'missing_configuration'});
  const started=Date.now();
  const [documentos,comercial]=await Promise.all([
    probe('documentos_tributarios?select=id&limit=1'),
    probe('planes_suscripcion?select=codigo&activo=is.true&limit=1')
  ]);
  const auth_configured=!!PUBLISHABLE_KEY;
  const ok=documentos.ok&&comercial.ok&&auth_configured;
  return res.status(ok?200:503).json({
    ok,
    service:'euclidian',
    version:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||null,
    checks:{
      database:documentos.ok,
      commercial_schema:comercial.ok,
      auth_configured
    },
    payment_provider_configured:configuracionCobro().enabled,
    latency_ms:Date.now()-started
  });
}
