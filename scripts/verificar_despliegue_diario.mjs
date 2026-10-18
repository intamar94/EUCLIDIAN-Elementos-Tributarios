#!/usr/bin/env node
/* EUCLIDIAN — validador de un máximo de un despliegue de producción por día.
   No crea despliegues ni usa tokens. Recibe evidencia JSON de GitHub y Vercel
   recolectada al momento de la publicación, sin datos de usuarios.
   Aplicar, además, revisión humana para cambios legales, privacidad y cobros. */
import {readFileSync} from 'node:fs';
const HEX=/^[a-f0-9]{40}$/i;
function fechaBerlin(milisegundos){
 const fecha=new Date(milisegundos);
 if(!Number.isFinite(fecha.getTime()))return null;
 const partes=new Intl.DateTimeFormat('en-GB',{
  timeZone:'Europe/Berlin',year:'numeric',month:'2-digit',day:'2-digit'
 }).formatToParts(fecha);
 const obj=Object.fromEntries(partes.map(x=>[x.type,x.value]));
 return obj.year+'-'+obj.month+'-'+obj.day;
}
export function decidirDespliegueDiario(estado){
 if(!estado||typeof estado!=='object'||Array.isArray(estado))
  return {publicar:false,motivo:'faltan_datos'};
 const {mainSha,ahora,produccion,ci,proteccionesVerificadas}=estado;
 if(!HEX.test(String(mainSha||''))||!Array.isArray(produccion)||!Array.isArray(ci)||
   !fechaBerlin(ahora)||!Number.isFinite(Number(ahora)))
  return {publicar:false,motivo:'evidencia_incompleta'};
 const hoy=fechaBerlin(ahora);
 // Controlar CUALQUIER intento de producción hoy, incluso con fallo.
 if(produccion.some(d=>{
  const milis=Number(d?.created);
  return Number.isFinite(milis)&&fechaBerlin(milis)===hoy;
 }))return {publicar:false,motivo:'ya_hubo_intento_hoy',fecha:hoy};
 const ultima=produccion.find(d=>d?.state==='READY');
 if(!ultima)return {publicar:false,motivo:'sin_ultima_version_estable',fecha:hoy};
 if(ultima.sha===mainSha)return {publicar:false,motivo:'sin_cambios',fecha:hoy};
 if(proteccionesVerificadas!==true)
  return {publicar:false,motivo:'revision_prepublicacion_pendiente',fecha:hoy};
 // No basta con que exista un check aprobado antiguo sobre otra revisión.
 const comprobaciones=ci.filter(r=>r?.sha===mainSha&&r?.name==='Control de calidad');
 if(!comprobaciones.length||comprobaciones.some(r=>r.status!=='completed'||r.conclusion!=='success'))
  return {publicar:false,motivo:'ci_incompleto_o_fallido',fecha:hoy};
 // Una liberación manual en Vercel deberá usar exactamente mainSha.
 return {publicar:true,motivo:'lote_validado',sha:mainSha,fecha:hoy};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 try{
  if(process.argv.length!==3)throw Error('Uso: node scripts/verificar_despliegue_diario.mjs evidencia.json');
  const decision=decidirDespliegueDiario(JSON.parse(readFileSync(process.argv[2],'utf8')));
  console.log(JSON.stringify(decision,null,2));
  if(!decision.publicar)process.exitCode=2;
 }catch(error){console.error('Puerta cerrada: '+error.message);process.exitCode=2;}
}
