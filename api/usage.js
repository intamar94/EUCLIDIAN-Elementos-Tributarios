import { verificarUsuario } from '../lib/auth-server.js';

const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;
function headers(extra={}){return {apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,...extra};}

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  if(!SUPABASE_URL||!SERVICE_KEY)return res.status(503).json({error:'falta_configuracion'});
  const user=await verificarUsuario(req);
  if(!user)return res.status(401).json({error:'sesion_requerida'});
  try{
    const now=new Date();
    const inicio=new Date(Date.UTC(now.getUTCFullYear(),now.getUTCMonth(),1)).toISOString();
    const [usoRes,accesoRes]=await Promise.all([
      fetch(`${SUPABASE_URL}/rest/v1/uso_consultas?select=id&user_id=eq.${encodeURIComponent(user.id)}&creado_en=gte.${encodeURIComponent(inicio)}`,{
        headers:headers({Prefer:'count=exact',Range:'0-0'})
      }),
      fetch(`${SUPABASE_URL}/rest/v1/accesos_suscripcion?select=plan_codigo&user_id=eq.${encodeURIComponent(user.id)}&limit=1`,{
        headers:headers()
      })
    ]);
    if(!usoRes.ok||!accesoRes.ok)return res.status(502).json({error:'uso_no_disponible'});
    const rango=usoRes.headers.get('content-range')||'*/0';
    const consultas_mes=Number(rango.split('/')[1]||0);
    const acceso=(await accesoRes.json())[0]||{};
    let limite=null;
    if(acceso.plan_codigo){
      const planRes=await fetch(`${SUPABASE_URL}/rest/v1/planes_suscripcion?select=limite_consultas_mensual&codigo=eq.${encodeURIComponent(acceso.plan_codigo)}&limit=1`,{headers:headers()});
      if(planRes.ok){const plan=(await planRes.json())[0]||{};limite=plan.limite_consultas_mensual??null;}
    }
    return res.status(200).json({consultas_mes,limite_consultas_mensual:limite,periodo_inicio:inicio});
  }catch(_){
    return res.status(502).json({error:'uso_no_disponible'});
  }
}
