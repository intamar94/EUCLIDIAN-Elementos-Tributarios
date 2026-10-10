const SUPABASE_URL=process.env.SUPABASE_URL;
const PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY;

function emailValido(v){return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v||'').trim());}
async function upstream(path,{method='POST',body,token}={}){
  const r=await fetch(`${SUPABASE_URL}${path}`,{
    signal:AbortSignal.timeout(10000),
    method,
    headers:{
      apikey:PUBLISHABLE_KEY,
      ...(token?{Authorization:`Bearer ${token}`}:{}),
      'Content-Type':'application/json'
    },
    body:body===undefined?undefined:JSON.stringify(body)
  });
  const data=await r.json().catch(()=>({message:'Respuesta inválida del servicio de acceso.'}));
  return {r,data};
}
function limpiarRespuesta(data){
  if(!data||typeof data!=='object')return {};
  return {
    access_token:data.access_token,
    refresh_token:data.refresh_token,
    expires_in:data.expires_in,
    expires_at:data.expires_at,
    token_type:data.token_type,
    user:data.user?{id:data.user.id,email:data.user.email,email_confirmed_at:data.user.email_confirmed_at}:null
  };
}
export default async function handler(req,res){
  res.setHeader('Cache-Control','no-store');
  if(req.method!=='POST')return res.status(405).json({error:'method_not_allowed'});
  if(!SUPABASE_URL||!PUBLISHABLE_KEY)return res.status(503).json({error:'auth_no_configurado'});
  const action=String(req.body?.action||'');
  try{
    if(action==='signup'||action==='signin'){
      const email=String(req.body?.email||'').trim().toLowerCase();
      const password=String(req.body?.password||'');
      if(!emailValido(email)||password.length<8)return res.status(400).json({error:'datos_invalidos'});
      const path=action==='signup'?'/auth/v1/signup':'/auth/v1/token?grant_type=password';
      const {r,data}=await upstream(path,{body:{email,password}});
      if(!r.ok)return res.status(r.status).json({error:'auth_rechazado',message:data.msg||data.message||data.error_description||'No se pudo completar el acceso.'});
      return res.status(200).json({ok:true,action,...limpiarRespuesta(data),requires_confirmation:action==='signup'&&!data.access_token});
    }
    if(action==='refresh'){
      const refresh_token=String(req.body?.refresh_token||'');
      if(!refresh_token)return res.status(400).json({error:'refresh_requerido'});
      const {r,data}=await upstream('/auth/v1/token?grant_type=refresh_token',{body:{refresh_token}});
      if(!r.ok)return res.status(401).json({error:'sesion_expirada'});
      return res.status(200).json({ok:true,action,...limpiarRespuesta(data)});
    }
    if(action==='recover'){
      const email=String(req.body?.email||'').trim().toLowerCase();
      if(!emailValido(email))return res.status(400).json({error:'email_invalido'});
      const {r}=await upstream('/auth/v1/recover',{body:{email}});
      if(r.status>=500||r.status===429)return res.status(503).json({error:'recuperacion_no_disponible'});
      // Respuesta neutra para no revelar si una cuenta existe.
      return res.status(200).json({ok:true,action,requested:true});
    }
    if(action==='update_password'){
      const token=String(req.body?.access_token||'');
      const password=String(req.body?.password||'');
      if(!token||password.length<8)return res.status(400).json({error:'datos_invalidos'});
      const {r,data}=await upstream('/auth/v1/user',{method:'PUT',token,body:{password}});
      if(!r.ok)return res.status(r.status).json({error:'actualizacion_rechazada',message:data.msg||data.message||'No se pudo actualizar la contraseña.'});
      return res.status(200).json({ok:true,action});
    }
    if(action==='logout'){
      const token=String(req.body?.access_token||'');
      if(token)await upstream('/auth/v1/logout',{token,body:{}});
      return res.status(200).json({ok:true,action});
    }
    return res.status(400).json({error:'accion_no_valida'});
  }catch(_){
    return res.status(502).json({error:'auth_no_disponible'});
  }
}
