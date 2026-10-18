/* EUCLIDIAN · API futura de expedientes privados.
   CERRADA hasta aprobación LEGAL.ia + migración + RLS en dos sesiones.
   Usa JWT del usuario en Supabase/PostgREST para NO evadir RLS. */
import {bearerToken,verificarUsuario,estadoAcceso} from './auth-server.js';

const SUPABASE_URL=process.env.SUPABASE_URL;
const PUBLISHABLE_KEY=process.env.SUPABASE_PUBLISHABLE_KEY;
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const columnas={titulo:140,pregunta:1800,hechos:3000,hipotesis:3000,salvedades:3000,conclusion:3000};
const baseCampos=['id','titulo','pregunta','hechos','hipotesis','salvedades','conclusion','estado','version','created_at','updated_at'];
const lista=baseCampos.join(',');
const MAX_BODY_BYTES=17000;

function abierto(){
 return process.env.EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED==='1' &&
 process.env.EUCLIDIAN_LEGAL_APPROVED==='1' &&
 process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED==='1';
}
function idValido(id){return typeof id==='string'&&UUID.test(id);}
function analizar(body){
 if(!body||typeof body!=='object'||Array.isArray(body))return {error:'cuerpo_invalido'};
 const raw=JSON.stringify(body);
 if(raw.length>MAX_BODY_BYTES)return {error:'cuerpo_demasiado_grande'};
 if(Object.keys(body).some(key=>!Object.hasOwn(columnas,key)&&key!=='version'))return {error:'campo_no_permitido'};
 const campos={};
 for(const [k,max] of Object.entries(columnas)){
  if(!Object.hasOwn(body,k))continue;
  if(typeof body[k]!=='string'||body[k].length>max)return {error:'campo_invalido'};
  campos[k]=body[k];
 }
 if(Object.hasOwn(campos,'titulo')&&!campos.titulo.trim())return {error:'titulo_requerido'};
 return {campos};
}
function queryEncode(params){
 return new URLSearchParams(params).toString();
}
async function rest(path,{method='GET',body,token,prefer='return=representation'}={}){
 const headers={apikey:PUBLISHABLE_KEY,Authorization:'Bearer '+token,
  'Content-Type':'application/json',Accept:'application/json',Prefer:prefer};
 const r=await fetch(SUPABASE_URL+'/rest/v1/'+path,{
  method,headers,signal:AbortSignal.timeout(12000),
  ...(body!==undefined?{body:JSON.stringify(body)}:{})
 });
 if(!r.ok)return {ok:false,status:r.status};
 const rows=r.status===204?[]:await r.json().catch(()=>[]);
 return {ok:true,rows:Array.isArray(rows)?rows:[]};
}
export default async function expedientesHandler(req,res){
 res.setHeader('Cache-Control','no-store');
 res.setHeader('X-Robots-Tag','noindex, nofollow');
 // No fallback a credencial de administración. En producción sigue cerrado.
 if(!abierto())return res.status(503).json({error:'expedientes_nube_no_habilitados'});
 if(!['GET','POST','PATCH','DELETE'].includes(req.method))return res.status(405).json({error:'method_not_allowed'});
 if(!SUPABASE_URL||!PUBLISHABLE_KEY)return res.status(503).json({error:'configuracion_no_disponible'});
 try{
  const user=await verificarUsuario(req);
  if(!user?.id)return res.status(401).json({error:'sesion_requerida'});
  const acceso=await estadoAcceso(user.id);
  if(!acceso)return res.status(503).json({error:'acceso_no_verificable'});
  if(acceso.permitido!==true)return res.status(403).json({error:'acceso_no_autorizado'});
  const token=bearerToken(req),id=req.query?.id;
  const owner=user.id;
  if(id!==undefined&&!idValido(id))return res.status(400).json({error:'id_invalido'});
  if(req.method==='GET'){
   if(req.query?.vista==='revisiones'){
    if(!id)return res.status(400).json({error:'id_requerido'});
    const qs=queryEncode({select:'id,expediente_id,version,creado_en,tipo,snapshot',
     expediente_id:'eq.'+id,owner_id:'eq.'+owner,order:'version.desc',limit:'50'});
    const r=await rest('expediente_revisiones?'+qs,{token});
    return r.ok?res.status(200).json({revisiones:r.rows}):res.status(502).json({error:'historial_no_disponible'});
   }
   const qs=queryEncode({select:lista,owner_id:'eq.'+owner,...(id?{id:'eq.'+id}:{}),
    order:'updated_at.desc',limit:id?'1':'30'});
   const r=await rest('expedientes_profesionales?'+qs,{token});
   return r.ok?res.status(200).json({expedientes:r.rows}):res.status(502).json({error:'expedientes_no_disponibles'});
  }
  if(req.method==='POST'){
   const v=analizar(req.body);
   if(v.error)return res.status(400).json({error:v.error});
   // owner_id, id, estado, versión y fechas los asigna PostgreSQL.
   const registro={titulo:v.campos.titulo||'Investigación sin título'};
   for(const k of Object.keys(columnas))if(k!=='titulo'&&Object.hasOwn(v.campos,k))registro[k]=v.campos[k];
   const r=await rest('expedientes_profesionales?select='+encodeURIComponent(lista),{
    method:'POST',body:registro,token});
   return r.ok&&r.rows[0]?res.status(201).json({expediente:r.rows[0]}):
    res.status(502).json({error:'expediente_no_creado'});
  }
  if(!id)return res.status(400).json({error:'id_requerido'});
  const version=Number(req.body?.version??req.query?.version);
  if(!Number.isSafeInteger(version)||version<1)return res.status(400).json({error:'version_requerida'});
  const where=queryEncode({id:'eq.'+id,owner_id:'eq.'+owner,version:'eq.'+version,
   select:lista});
  if(req.method==='PATCH'){
   const v=analizar(req.body);
   if(v.error)return res.status(400).json({error:v.error});
   if(!Object.keys(v.campos).length)return res.status(400).json({error:'sin_campos'});
   const r=await rest('expedientes_profesionales?'+where,{method:'PATCH',body:v.campos,token});
   if(!r.ok)return res.status(502).json({error:'expediente_no_actualizado'});
   return r.rows[0]?res.status(200).json({expediente:r.rows[0]}):
    res.status(409).json({error:'version_desactualizada_o_sin_acceso'});
  }
  const r=await rest('expedientes_profesionales?'+where,{method:'DELETE',token});
  if(!r.ok)return res.status(502).json({error:'expediente_no_eliminado'});
  return r.rows[0]?res.status(200).json({eliminado:true}):
   res.status(409).json({error:'version_desactualizada_o_sin_acceso'});
 }catch(_){
  return res.status(503).json({error:'servicio_expedientes_no_disponible'});
 }
}
export const expedienteContrato={abierto,analizar,idValido,queryEncode};
