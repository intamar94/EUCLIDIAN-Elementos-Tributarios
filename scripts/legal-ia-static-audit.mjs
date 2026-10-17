#!/usr/bin/env node
/* LEGAL.ia: read-only inventory. Never inspects real identity, secrets or personal addresses. */
import fs from 'node:fs';
import process from 'node:process';
const safeRead=p=>fs.existsSync(p)?fs.readFileSync(p,'utf8'):'';
const index=safeRead('index.html'),app=safeRead('app.html'),auth=safeRead('auth.js'),bandeja=safeRead('bandeja.js');
const project=JSON.parse(safeRead('LEGALIA/proyectos/euclidian.json'));
const checks=[];
function add(id,status,evidence,action){checks.push({id,status,evidence,action})}
function hasHref(text,route){return new RegExp('href=["\\\'](?:\\/)?'+route.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'["\\\']','i').test(text)}
for(const [id,path] of [['impressum','impressum.html'],['datenschutz','datenschutz.html']]){
 const exists=fs.existsSync(path);
 const linked=hasHref(index,path)&&hasHref(app,path);
 add(id,exists&&linked?'PRESENT':'REVIEW',`file=${exists}, linked_in_both=${linked}`,`Verificar ${path}, publicarlo con datos legales aprobados y enlazar desde portada y aplicación`);
}
const fontExternal=/fonts\.googleapis\.com|fonts\.gstatic\.com/.test(index+app);
add('google_fonts',fontExternal?'REVIEW':'NO_EXTERNAL_CDN',fontExternal?'External Google Fonts URLs in HTML':'No external Google Fonts URLs detected','Autoalojar fuentes o completar evaluación de privacidad');
const localToken=/localStorage\.(?:setItem|getItem)\(/.test(auth);
add('browser_token_storage',localToken?'REVIEW':'NOT_DETECTED',localToken?'Auth JS uses localStorage':'No token storage found in auth.js','Auditar política CSP/XSS, retención de tokens y transparencia al usuario');
const internalSession=/sessionStorage\./.test(bandeja);
add('internal_session',internalSession?'REVIEW':'NOT_DETECTED',internalSession?'Internal access in sessionStorage':'No internal session storage found','Separar y proteger acceso interno y documentar uso');
add('domain',project.domain?.dns_verified&&project.domain?.canonical_website_checked&&project.domain?.public_access_without_vercel_login_checked?'CHECKED':'REVIEW','Domain verification flags in project manifest','Verificar DNS, TLS, canonical y acceso público real, con pruebas');
const payment=project.features?.payment_checkout_live===true;
add('commerce',!payment?'NOT_LIVE':'REVIEW',payment?'Live checkout declared':'Project declares no live payments','Si se habilita checkout, auditar contratos, impuestos y derecho consumidor antes de publicar');
const pending=checks.filter(x=>x.status==='REVIEW');
const result={tool:'LEGAL.ia static audit',project:project.project,status:pending.length?'REVIEW':'TECHNICALLY_REVIEWED',total:checks.length,pending:pending.length,checks};
if(process.argv.includes('--json'))console.log(JSON.stringify(result,null,2));
else{console.log(`LEGAL.ia static: ${checks.length} controls, ${pending.length} REVIEW`);for(const c of checks.filter(x=>x.status==='REVIEW'))console.log(`REVIEW ${c.id}: ${c.evidence}`)}
if(process.argv.includes('--enforce')&&pending.length)process.exitCode=1;
