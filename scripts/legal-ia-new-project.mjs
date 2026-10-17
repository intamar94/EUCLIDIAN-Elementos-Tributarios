#!/usr/bin/env node
/* LEGAL.ia project initializer. Writes only public, non-sensitive metadata. */
import fs from 'node:fs';
import path from 'node:path';
import process from 'node:process';
const [slug,...labelParts]=process.argv.slice(2);
if(!slug||!/^[a-z][a-z0-9-]{1,59}$/.test(slug)||labelParts.length===0){
 console.error('Uso: node scripts/legal-ia-new-project.mjs <slug> <nombre del proyecto>');
 process.exit(2);
}
const name=labelParts.join(' ').trim();
if(name.length<2||name.length>100){console.error('Nombre de proyecto inválido');process.exit(2)}
const template=JSON.parse(fs.readFileSync('LEGALIA/plantillas/project.template.json','utf8'));
template.project=name;
const dest=path.join('LEGALIA','proyectos',slug+'.json');
try{
 fs.mkdirSync(path.dirname(dest),{recursive:true});
 fs.writeFileSync(dest,JSON.stringify(template,null,2)+'\n',{flag:'wx',mode:0o644});
 console.log('Expediente LEGAL.ia generado en '+dest+' (estado REVIEW, no publica ni registra dominio)');
}catch(e){if(e.code==='EEXIST')console.error('Proyecto ya existe: '+dest);else console.error(e.message);process.exit(1)}
