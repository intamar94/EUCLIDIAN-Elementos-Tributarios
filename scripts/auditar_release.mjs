#!/usr/bin/env node
import {readFile} from 'node:fs/promises';

const STATUS=new Set(['PASS','FAIL','BLOCKED','NOT-ASSESSED']);
const SEVERITY=new Set(['P0','P1','P2','P3']);
const CLASSES=new Set(['seguridad','legal','fiscal','UX','SEO','operación']);
const shaOk=value=>typeof value==='string'&&/^[a-f0-9]{7,64}$/i.test(value);
const dateOk=value=>typeof value==='string'&&!Number.isNaN(Date.parse(value));
const text=value=>typeof value==='string'&&value.trim().length>0;

export function validarEvidencia(input){
 const errors=[];const release=input?.release||{};const controls=Array.isArray(input?.controls)?input.controls:[];
 if(!shaOk(release.sha))errors.push('release.sha debe ser un SHA hexadecimal de 7 a 64 caracteres.');
 if(!text(release.environment))errors.push('release.environment es obligatorio.');
 if(!dateOk(release.checked_at))errors.push('release.checked_at debe ser una fecha ISO válida.');
 if(!release.ci||release.ci.conclusion!=='success'||!text(release.ci.run))errors.push('release.ci requiere run y conclusión success.');
 if(!controls.length)errors.push('Debe existir al menos un control.');
 const seen=new Set();
 controls.forEach((control,index)=>{
  const at='controls['+index+']';
  if(!text(control?.id)||seen.has(control.id))errors.push(at+'.id debe ser único.');else seen.add(control.id);
  if(!CLASSES.has(control?.class))errors.push(at+'.class no es válida.');
  if(!SEVERITY.has(control?.severity))errors.push(at+'.severity no es válida.');
  if(!STATUS.has(control?.status))errors.push(at+'.status no es válido.');
  if(!text(control?.owner))errors.push(at+'.owner es obligatorio.');
  if(control?.status==='PASS'){
   if(!shaOk(control.sha||release.sha))errors.push(at+' PASS requiere SHA válido.');
   if(!text(control.environment||release.environment))errors.push(at+' PASS requiere entorno.');
   if(!dateOk(control.checked_at||release.checked_at))errors.push(at+' PASS requiere fecha.');
   if(!text(control?.evidence?.reference))errors.push(at+' PASS requiere referencia de evidencia.');
  }
  if(/^POST-LEGAL-|LEGAL-LIVE/i.test(control?.id||'')&&control?.status==='PASS'){
   const remote=control?.evidence?.remote;
   if(!remote||!/^https:\/\//.test(remote.url||'')||remote.status!==200||!dateOk(remote.checked_at))errors.push(at+' legal live PASS requiere URL HTTPS, HTTP 200 y fecha de comprobación remota.');
  }
 });
 return {valid:errors.length===0,errors,release,controls};
}

export function informe(input){
 const result=validarEvidencia(input);
 const lines=['# Auditor Profesional · Evidencia de release','',`Resultado: **${result.valid?'EVIDENCIA VÁLIDA':'EVIDENCIA INCOMPLETA'}**`,'',`SHA: \`${result.release.sha||'—'}\``, `Entorno: ${result.release.environment||'—'}`, `Fecha: ${result.release.checked_at||'—'}`, `CI: ${result.release.ci?.run||'—'} (${result.release.ci?.conclusion||'—'})`,'','| ID | Clase | Prioridad | Estado | Responsable | Evidencia |','| --- | --- | --- | --- | --- | --- |'];
 for(const c of result.controls)lines.push(`| ${c.id||'—'} | ${c.class||'—'} | ${c.severity||'—'} | ${c.status||'—'} | ${c.owner||'—'} | ${c.evidence?.reference||'—'} |`);
 if(result.errors.length)lines.push('','## Pendientes de evidencia','',...result.errors.map(error=>'- '+error));
 lines.push('','Este informe no es una certificación ni una autorización comercial.');
 return lines.join('\n');
}

if(import.meta.url===new URL(process.argv[1],'file:').href){
 const path=process.argv[2];
 if(!path){console.error('Uso: node scripts/auditar_release.mjs evidencia.json');process.exitCode=2;}
 else{
  try{const value=JSON.parse(await readFile(path,'utf8'));const result=validarEvidencia(value);console.log(informe(value));if(!result.valid)process.exitCode=1;}
  catch(error){console.error('No se pudo leer la evidencia: '+error.message);process.exitCode=2;}
 }
}
