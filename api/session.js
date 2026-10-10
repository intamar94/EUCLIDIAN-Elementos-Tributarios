import { verificarUsuario, estadoAcceso } from '../lib/auth-server.js';

export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='GET')return res.status(405).json({error:'method_not_allowed'});
  try{
    const user=await verificarUsuario(req);
    if(!user)return res.status(401).json({authenticated:false,error:'sesion_requerida'});
    const acceso=await estadoAcceso(user.id);
    if(!acceso)return res.status(503).json({authenticated:true,error:'estado_acceso_no_disponible'});
    return res.status(200).json({
      authenticated:true,
      user:{id:user.id,email:user.email},
      access:{
        permitido:acceso.permitido===true,
        rol:acceso.rol||'usuario',
        estado:acceso.estado||'pendiente',
        plan_codigo:acceso.plan_codigo||null,
        cancelar_al_fin:acceso.cancelar_al_fin===true,
        periodo_fin:acceso.periodo_fin||null
      }
    });
  }catch(_){
    return res.status(503).json({authenticated:false,error:'sesion_no_disponible'});
  }
}
