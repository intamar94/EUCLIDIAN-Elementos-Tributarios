const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY;
const PUBLISHABLE_KEY = process.env.SUPABASE_PUBLISHABLE_KEY;

export function bearerToken(req){
  const h=String(req.headers.authorization||'');
  const m=h.match(/^Bearer\s+(.+)$/i);
  return m?m[1].trim():'';
}

export async function verificarUsuario(req){
  const token=bearerToken(req);
  if(!token||!SUPABASE_URL||!PUBLISHABLE_KEY)return null;
  const r=await fetch(`${SUPABASE_URL}/auth/v1/user`,{
    headers:{apikey:PUBLISHABLE_KEY,Authorization:`Bearer ${token}`}
  });
  if(!r.ok)return null;
  const user=await r.json().catch(()=>null);
  return user&&user.id?user:null;
}

export async function estadoAcceso(userId){
  if(!userId||!SUPABASE_URL||!SERVICE_KEY)return null;
  const r=await fetch(`${SUPABASE_URL}/rest/v1/rpc/euclidian_estado_acceso`,{
    method:'POST',
    headers:{
      apikey:SERVICE_KEY,
      Authorization:`Bearer ${SERVICE_KEY}`,
      'Content-Type':'application/json'
    },
    body:JSON.stringify({p_user_id:userId})
  });
  if(!r.ok)return null;
  const rows=await r.json().catch(()=>[]);
  return Array.isArray(rows)?rows[0]||null:rows;
}

export async function autorizarConsulta(req){
  const claveInterna=process.env.EUCLIDIAN_CLAVE;
  if(claveInterna&&req.headers['x-clave']===claveInterna){
    return {ok:true,modo:'interno',user:null,acceso:{permitido:true,rol:'interno'}};
  }
  const user=await verificarUsuario(req);
  if(!user)return {ok:false,status:401,error:'sesion_requerida'};
  const acceso=await estadoAcceso(user.id);
  if(!acceso)return {ok:false,status:503,error:'estado_acceso_no_disponible'};
  if(acceso.permitido!==true)return {ok:false,status:402,error:'suscripcion_requerida',user,acceso};
  return {ok:true,modo:'usuario',user,acceso};
}


export async function registrarUsoConsulta(userId,{latencia_ms,resultados,estado='ok'}={}){
  if(!userId||!SUPABASE_URL||!SERVICE_KEY)return false;
  try{
    const r=await fetch(`${SUPABASE_URL}/rest/v1/uso_consultas`,{
      method:'POST',
      headers:{
        apikey:SERVICE_KEY,
        Authorization:`Bearer ${SERVICE_KEY}`,
        'Content-Type':'application/json',
        Prefer:'return=minimal'
      },
      body:JSON.stringify({
        user_id:userId,
        latencia_ms:Number.isFinite(latencia_ms)?Math.max(0,Math.round(latencia_ms)):null,
        resultados:Number.isFinite(resultados)?Math.max(0,Math.round(resultados)):0,
        estado:['ok','sin_resultados','error'].includes(estado)?estado:'ok'
      })
    });
    return r.ok;
  }catch(_){return false;}
}
