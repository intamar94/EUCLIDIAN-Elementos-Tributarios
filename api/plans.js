import { verificarUsuario } from '../lib/auth-server.js';
import { configuracionCobro } from '../lib/billing.js';

const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;
const PRICING_PUBLICADO=String(process.env.EUCLIDIAN_PRICING_PUBLICADO||'').toLowerCase()==='true';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  if(!SUPABASE_URL||!SERVICE_KEY)return res.status(503).json({error:'falta_configuracion'});
  try{
    const user=await verificarUsuario(req);
    if(!user)return res.status(401).json({error:'sesion_requerida'});
    const r=await fetch(`${SUPABASE_URL}/rest/v1/planes_suscripcion?select=codigo,nombre,descripcion,precio_mensual,moneda,limite_consultas_mensual&activo=is.true&order=precio_mensual.asc.nullslast`,{
      headers:{apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`}
    });
    if(!r.ok)return res.status(502).json({error:'planes_no_disponibles'});
    const planes=(await r.json()).map(p=>({
      codigo:p.codigo,
      nombre:p.nombre,
      descripcion:p.descripcion,
      limite_consultas_mensual:p.limite_consultas_mensual,
      pricing_publicado:PRICING_PUBLICADO,
      ...(PRICING_PUBLICADO?{precio_mensual:p.precio_mensual,moneda:p.moneda}:{})
    }));
    return res.status(200).json({planes,pricing_publicado:PRICING_PUBLICADO,billing_enabled:configuracionCobro().enabled});
  }catch(_){
    return res.status(502).json({error:'planes_no_disponibles'});
  }
}
