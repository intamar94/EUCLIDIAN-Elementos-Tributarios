import { verificarUsuario } from '../lib/auth-server.js';

const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;

function limpio(v,max){
  const s=String(v??'').trim().replace(/\s+/g,' ');
  return s.slice(0,max);
}
async function supabase(path,options={}){
  return fetch(`${SUPABASE_URL}/rest/v1/${path}`,{
    ...options,
    signal:AbortSignal.timeout(10000),
    headers:{
      apikey:SERVICE_KEY,
      Authorization:`Bearer ${SERVICE_KEY}`,
      'Content-Type':'application/json',
      ...(options.headers||{})
    }
  });
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(!['GET','PATCH'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
  if(!SUPABASE_URL||!SERVICE_KEY)return res.status(503).json({error:'falta_configuracion'});
  try{
    const user=await verificarUsuario(req);
    if(!user)return res.status(401).json({error:'sesion_requerida'});
    if(req.method==='GET'){
      const r=await supabase(`perfiles_usuario?select=nombre,ciudad,onboarding_completado,acepta_terminos_en,acepta_privacidad_en&user_id=eq.${encodeURIComponent(user.id)}&limit=1`);
      if(!r.ok)return res.status(502).json({error:'perfil_no_disponible'});
      const rows=await r.json();
      return res.status(200).json({profile:rows[0]||{nombre:null,ciudad:null,onboarding_completado:false}});
    }
    const body=req.body||{};
    const patch={
      nombre:limpio(body.nombre,120)||null,
      ciudad:limpio(body.ciudad,120)||null,
      onboarding_completado:true,
      updated_at:new Date().toISOString()
    };
    const r=await supabase(`perfiles_usuario?user_id=eq.${encodeURIComponent(user.id)}`,{
      method:'PATCH',
      headers:{Prefer:'return=representation'},
      body:JSON.stringify(patch)
    });
    if(!r.ok)return res.status(502).json({error:'perfil_no_actualizado'});
    const rows=await r.json();
    if(!rows[0])return res.status(409).json({error:'perfil_no_creado'});
    return res.status(200).json({ok:true,profile:rows[0]});
  }catch(_){
    return res.status(502).json({error:'perfil_no_disponible'});
  }
}
