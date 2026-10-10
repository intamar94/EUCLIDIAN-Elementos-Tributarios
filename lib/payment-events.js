const SUPABASE_URL=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;

function headers(extra={}){return {apikey:SERVICE_KEY,Authorization:`Bearer ${SERVICE_KEY}`,'Content-Type':'application/json',...extra};}
function normaliza(v,max=250){return String(v??'').trim().slice(0,max);}

export async function reclamarEventoPago({proveedor,evento_id,tipo=null,user_id=null,proveedor_suscripcion_id=null,payload_hash=null}){
  proveedor=normaliza(proveedor,80);evento_id=normaliza(evento_id,250);
  if(!SUPABASE_URL||!SERVICE_KEY||!proveedor||!evento_id)throw new Error('evento_pago_invalido');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/eventos_pago?on_conflict=proveedor,evento_id`,{
    method:'POST',
    headers:headers({Prefer:'resolution=ignore-duplicates,return=representation'}),
    body:JSON.stringify({
      proveedor,evento_id,
      tipo:normaliza(tipo,160)||null,
      user_id:user_id||null,
      proveedor_suscripcion_id:normaliza(proveedor_suscripcion_id,250)||null,
      payload_hash:normaliza(payload_hash,128)||null
    })
  });
  if(!r.ok)throw new Error('registro_evento_pago_fallido');
  const rows=await r.json().catch(()=>[]);
  return {nuevo:Array.isArray(rows)&&rows.length>0,registro:Array.isArray(rows)?rows[0]||null:null};
}

export async function finalizarEventoPago({proveedor,evento_id,ok,error=null}){
  proveedor=normaliza(proveedor,80);evento_id=normaliza(evento_id,250);
  if(!SUPABASE_URL||!SERVICE_KEY||!proveedor||!evento_id)throw new Error('evento_pago_invalido');
  const r=await fetch(`${SUPABASE_URL}/rest/v1/eventos_pago?proveedor=eq.${encodeURIComponent(proveedor)}&evento_id=eq.${encodeURIComponent(evento_id)}`,{
    method:'PATCH',
    headers:headers({Prefer:'return=minimal'}),
    body:JSON.stringify({
      estado:ok?'procesado':'error',
      procesado_en:new Date().toISOString(),
      error:ok?null:normaliza(error,1000)||'error_no_especificado'
    })
  });
  if(!r.ok)throw new Error('actualizacion_evento_pago_fallida');
  return true;
}
