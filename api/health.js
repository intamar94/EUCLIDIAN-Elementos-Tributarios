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

async function documental(){
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/estado_direccion_documental`,{
      method:'POST',signal:AbortSignal.timeout(8000),
      headers:{apikey:SUPABASE_KEY,Authorization:`Bearer ${SUPABASE_KEY}`,'Content-Type':'application/json'},body:'{}'
    });
    if(!r.ok)return {estado:'no_disponible'};
    const data=await r.json();
    const last=data.ultimo_ciclo;
    const age=last?.latido_en?Math.max(0,Math.floor((Date.now()-Date.parse(last.latido_en))/60000)):null;
    return {estado:!last?'sin_ejecucion':age>60?'atrasado':last.estado,
      activo:!!data.activo,ultimo_latido:last?.latido_en||null,antiguedad_minutos:age,
      universo:data.universo??null,cola:data.cola||{},
      etapas:(data.etapas||[]).map(e=>({etapa:e.etapa,estado:e.estado})),
      cobertura_confirmada:!!last&&last.estado==='completo'&&age!==null&&age<=60
        &&(data.cola?.pendiente||0)===0&&(data.cola?.cuarentena||0)===0&&(data.cola?.reintentar||0)===0};
  }catch(_){return {estado:'no_disponible'};}
}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({ok:false,error:'method_not_allowed'});
  if(!SUPABASE_URL||!SUPABASE_KEY)return res.status(503).json({ok:false,error:'missing_configuration'});
  const interno=!!process.env.EUCLIDIAN_CLAVE && req.headers?.['x-clave']===process.env.EUCLIDIAN_CLAVE;
  const started=Date.now();
  const [documentos,comercial,flujo]=await Promise.all([
    probe('documentos_tributarios?select=id&limit=1'),
    probe('planes_suscripcion?select=codigo&activo=is.true&limit=1'),
    interno?documental():null
  ]);
  const auth_configured=!!PUBLISHABLE_KEY;
  const ok=documentos.ok&&comercial.ok&&auth_configured;
  return res.status(ok?200:503).json({
    ok,
    service:'euclidian',
    ...(interno?{version:process.env.VERCEL_GIT_COMMIT_SHA?.slice(0,12)||null}:{}),
    checks:{
      database:documentos.ok,
      commercial_schema:comercial.ok,
      auth_configured
    },
    ...(interno?{documental:flujo,payment_provider_configured:configuracionCobro().enabled}:{}),
    latency_ms:Date.now()-started
  });
}
