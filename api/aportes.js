import {verificarUsuario, estadoAcceso} from '../lib/auth-server.js';

// Convocatoria temporal, horario de Colombia. Cerrada por defecto.
// Requiere configuración legal, activación explícita y fechas civiles verificables.
const URL_BASE=process.env.SUPABASE_URL;
const SERVICE_KEY=process.env.SUPABASE_SERVICE_KEY;
const TIPOS=['error_plataforma','dato_tributario','documento_faltante','sugerencia'];
function fechaCivil(v){
 if(!/^\d{4}-\d{2}-\d{2}$/.test(v||''))return false;
 const d=new Date(v+'T00:00:00Z');
 return !Number.isNaN(d.valueOf())&&d.toISOString().slice(0,10)===v;
}
function hoyColombia(fecha=new Date()){
 const parts=new Intl.DateTimeFormat('en-US',{timeZone:'America/Bogota',year:'numeric',month:'2-digit',day:'2-digit'}).formatToParts(fecha);
 const val=k=>parts.find(x=>x.type===k)?.value;
 return val('year')+'-'+val('month')+'-'+val('day');
}
export function estadoConvocatoria(env=process.env,ahora=new Date()){
 const inicio=env.EUCLIDIAN_APORTES_DESDE||'';
 const fin=env.EUCLIDIAN_APORTES_HASTA||'';
 const valido=fechaCivil(inicio)&&fechaCivil(fin)&&inicio<=fin;
 const hoy=hoyColombia(ahora);
 const autorizado=env.EUCLIDIAN_APORTES_ENABLED==='1'&&env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED==='1'&&env.EUCLIDIAN_LEGAL_APPROVED==='1';
 return {abierto:Boolean(valido&&autorizado&&inicio<=hoy&&hoy<=fin),inicio:valido?inicio:null,fin:valido?fin:null,
  mensaje:!valido?'El período de aportes aún no está definido.':!autorizado?'Los aportes están temporalmente cerrados.':hoy<inicio?'La convocatoria todavía no ha comenzado.':hoy>fin?'El período de aportes terminó.':'Puedes enviar un aporte hasta el final del día indicado, horario de Colombia.'};
}
export default async function handler(req,res){
 res.setHeader('Cache-Control','private, no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 if(!['GET','POST'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
 const ventana=estadoConvocatoria();
 if(req.method==='GET')return res.status(200).json(ventana);
 if(!ventana.abierto)return res.status(403).json({error:'convocatoria_cerrada',mensaje:ventana.mensaje});
 if(!URL_BASE||!SERVICE_KEY)return res.status(503).json({error:'servicio_no_configurado'});
 const tipo=String(req.body?.tipo??'');
 const referencia=String(req.body?.referencia??'').trim();
 const detalle=String(req.body?.detalle??'').trim();
 if(!TIPOS.includes(tipo)||referencia.length>180||detalle.length<20||detalle.length>3000||req.body?.acepta_privacidad!==true)
  return res.status(400).json({error:'aporte_invalido'});
 try{
  const usuario=await verificarUsuario(req);
  if(!usuario)return res.status(401).json({error:'sesion_requerida'});
  const acceso=await estadoAcceso(usuario.id);
  if(!acceso?.permitido||acceso.rol!=='usuario')return res.status(403).json({error:'acceso_restringido'});
  const db=await fetch(URL_BASE+'/rest/v1/aportes_usuario',{
   method:'POST',signal:AbortSignal.timeout(10000),
   headers:{apikey:SERVICE_KEY,Authorization:'Bearer '+SERVICE_KEY,'Content-Type':'application/json',Prefer:'return=minimal'},
   body:JSON.stringify({usuario_id:usuario.id,tipo,referencia:referencia||null,detalle,fecha_colombia:hoyColombia()})
  });
  if(db.status===409)return res.status(429).json({error:'limite_diario',mensaje:'Ya se recibió un aporte de este tipo durante el día de hoy.'});
  if(!db.ok)return res.status(503).json({error:'aporte_no_guardado'});
  return res.status(201).json({ok:true,mensaje:'Tu aporte quedó registrado para revisión. No constituye una consulta jurídica personalizada.'});
 }catch(_){return res.status(503).json({error:'aporte_no_disponible'});}
}
