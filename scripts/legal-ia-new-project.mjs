#!/usr/bin/env node
/** Generate a fail-closed public metadata dossier: never store names/addresses/IDs. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const args=process.argv.slice(2);
const opts=args.findIndex(v=>v.startsWith('--'));
const positional=opts<0?args:args.slice(0,opts);
const flags=opts<0?[]:args.slice(opts);
const [slug,...labelParts]=positional;
const name=labelParts.join(' ').trim();
if(!slug||!/^[a-z][a-z0-9-]{1,59}$/.test(slug)||name.length<2||name.length>100){
  console.error('Uso: node scripts/legal-ia-new-project.mjs <slug> "Nombre" [--type saas,digital_product] [--markets DE,CO] [--risks user_accounts]');
  process.exit(2);
}
const template=JSON.parse(fs.readFileSync('LEGALIA/plantillas/project.template.json','utf8'));
const catalog=JSON.parse(fs.readFileSync('LEGALIA/catalogo-riesgos.json','utf8'));
const option=(key)=>{const idx=flags.indexOf(key);return idx<0?null:(flags[idx+1]||'');};
const csv=(v)=>v===null?null:v.split(',').map(s=>s.trim()).filter(Boolean);
const types=csv(option('--type'));
const markets=csv(option('--markets'));
const risks=csv(option('--risks'));
const allowedTypes=new Set(['landing','content','saas','digital_product','ecommerce','physical_goods','marketplace','local_service','hardware']);
if(types&&types.some(t=>!allowedTypes.has(t))) {console.error('Tipo no reconocido');process.exit(2)}
if(markets&&markets.some(x=>!/^[A-Z]{2}$/.test(x))) {console.error('País debe ser código ISO de 2 letras (DE,CO...)');process.exit(2)}
if(risks&&risks.some(x=>!Object.hasOwn(template.features,x))) {console.error('Riesgo no reconocido');process.exit(2)}
const known=new Set([...Object.keys(catalog.shared),...catalog.conditional.flatMap(x=>x.controls)]);
template.project=name;
template.slug=slug;
template.project_type=types||[];
template.target_market=markets||[];
if(risks)for(const key of risks)template.features[key]=true;
for(const key of known)if(!Object.hasOwn(template.controls,key))template.controls[key]='REVIEW';
template.classification_reviewed=false;
template.risk_inventory_confirmed=false;
template.human_approval.status='REVIEW';
const output=path.join('LEGALIA','proyectos',slug+'.json');
try{
 fs.mkdirSync(path.dirname(output),{recursive:true});
 fs.writeFileSync(output,JSON.stringify(template,null,2)+'\n',{flag:'wx',mode:0o644});
 console.log('LEGAL.ia: expediente creado: '+output+' (REVIEW). Sin datos privados, compra de dominio ni despliegue.');
}catch(err){
 console.error(err.code==='EEXIST'?'El expediente ya existe: '+output:err.message);
 process.exit(1);
}
