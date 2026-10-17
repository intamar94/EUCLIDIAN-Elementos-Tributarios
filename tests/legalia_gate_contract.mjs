/* LEGAL.ia: reusable tests. No identity values, secrets, network calls or public deployments. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {spawnSync} from 'node:child_process';
const read=f=>JSON.parse(fs.readFileSync(f,'utf8'));
const cmd=(script,args=[])=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
const root='LEGALIA/';
const company=read(root+'empresa.template.json');
const schema=read(root+'plantillas/project.template.json');
assert.equal(company.legal_identity.address_value,'NOT_STORED_IN_PUBLIC_REPOSITORY');
assert.equal(schema.human_approval.status,'REVIEW','New products must not be preapproved');
assert.equal(schema.classification_reviewed,false,'New products require human review of feature inventory');
assert.equal(schema.risk_inventory_confirmed,false);
for(const template of [
  'plantillas/IMPRESSUM.de.muster.md',
  'plantillas/DATENSCHUTZ.de.muster.md',
  'plantillas/DATENSCHUTZ-general.de.entwurf.md',
  'plantillas/AGB-SaaS.de.entwurf.md',
  'plantillas/AGB-Shop.de.entwurf.md',
  'plantillas/WIDERRUF-KUENDIGUNG.de.entwurf.md',
  'plantillas/COOKIE-CONSENT.de.entwurf.md'
]) {
 const text=fs.readFileSync(root+template,'utf8');
 assert.match(text,/ENTWURF/,'Every public legal template must be marked as draft: '+template);
}
const all=cmd('scripts/legal-ia-gate.mjs',['--mode','audit','--all','--json']);
assert.equal(all.status,0,'Portfolio read-only audit should never block development');
const portfolio=JSON.parse(all.stdout);
assert.ok(portfolio.reports.some(p=>p.slug==='euclidian'));
assert.ok(portfolio.reports.some(p=>p.slug==='zweitierras'));
for(const report of portfolio.reports){
 assert.ok(['REVIEW','REJECTED','READY_FOR_HUMAN_RELEASE_DECISION'].includes(report.status));
 assert.ok(report.checks.some(c=>c.id==='operator.identity'));
 assert.ok(report.checks.some(c=>c.id==='project.classification'));
}
const check=cmd('scripts/legal-ia-static-audit.mjs',['--json']);
assert.equal(check.status,0,'Static inventory should remain nonblocking');
const parsed=JSON.parse(check.stdout);
assert.ok(parsed.checks.some(c=>c.id==='impressum'));
assert.ok(parsed.checks.some(c=>c.id==='datenschutz'));
// Ensure a new website can be registered without accidentally going live.
const slug='test-legal-'+process.pid;
const filepath=path.join(root,'proyectos',slug+'.json');
try{
 const init=cmd('scripts/legal-ia-new-project.mjs',[slug,'Proyecto de prueba','--type','marketplace','--markets','DE,CO','--risks','customer_funds_held,user_accounts']);
 assert.equal(init.status,0,'Template initializer must create a new valid dossier: '+init.stderr);
 const dossier=read(filepath);
 assert.equal(dossier.classification_reviewed,false);
 assert.equal(dossier.features.customer_funds_held,true);
 assert.ok(Object.hasOwn(dossier.controls,'payments_regulated'));
 const audit=cmd('scripts/legal-ia-gate.mjs',['--mode','audit','--project',slug,'--json']);
 assert.equal(audit.status,0);
 const data=JSON.parse(audit.stdout);
 assert.equal(data.status,'REVIEW','Unverified project must not be approved');
 assert.ok(data.checks.some(c=>c.id==='control.payments_regulated'),'Risk-based guard was not applied');
 assert.ok(data.checks.some(c=>c.id==='control.marketplace_roles'),'Sector guard was not applied');
 assert.ok(data.checks.some(c=>c.id==='control.account_legal'),'Account guard was not applied');
 // APPROVED labels cannot make unfinished draft texts publishable.
 const fixture='LEGALIA/test-web-'+process.pid;
 try{
   fs.mkdirSync(fixture,{recursive:true});
   fs.writeFileSync(path.join(fixture,'index.html'),'<a href="/impressum.html">Impressum</a><a href="/datenschutz.html">Datenschutz</a>');
   fs.writeFileSync(path.join(fixture,'impressum.html'),'ENTWURF {{LEGAL_NAME}}');
   fs.writeFileSync(path.join(fixture,'datenschutz.html'),'BORRADOR {{VERANTWORTLICHER}}');
   dossier.web_root=fixture;
   dossier.pages.impressum={path:'/impressum.html',status:'APPROVED',evidence:'PRIVATE-REF-001'};
   dossier.pages.datenschutz={path:'/datenschutz.html',status:'APPROVED',evidence:'PRIVATE-REF-002'};
   fs.writeFileSync(filepath,JSON.stringify(dossier,null,2));
   const guard=JSON.parse(cmd('scripts/legal-ia-gate.mjs',['--mode','audit','--project',slug,'--json']).stdout);
   assert.equal(guard.checks.find(x=>x.id==='page.impressum')?.result,'REVIEW');
   assert.equal(guard.checks.find(x=>x.id==='page.datenschutz')?.result,'REVIEW');
 }finally{fs.rmSync(fixture,{recursive:true,force:true})}
 const release=cmd('scripts/legal-ia-gate.mjs',['--mode','release','--project',slug,'--json']);
 assert.equal(release.status,1,'Release must fail closed');
 const same=cmd('scripts/legal-ia-new-project.mjs',[slug,'Duplicate']);
 assert.notEqual(same.status,0,'A second initializer must not overwrite an existing project dossier');
}finally{try{fs.unlinkSync(filepath)}catch{}}
console.log('LEGAL.ia: portfolio, country/sector flags, evidence guard and fail-closed checks OK');
