/* Regression: legal audit must never silently approve missing evidence. */
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {spawnSync} from 'node:child_process';
const root='LEGALIA/';
const c=JSON.parse(fs.readFileSync(root+'empresa.template.json','utf8'));
const p=JSON.parse(fs.readFileSync(root+'proyectos/euclidian.json','utf8'));
assert.equal(c.trade_registration.status,'PENDING','Gewerbe must remain pending until official evidence');
assert.equal(p.features.payment_checkout_live,false,'Checkout must remain off until approved');
assert.equal(c.legal_identity.address_value,'NOT_STORED_IN_PUBLIC_REPOSITORY','Never leak address in public repository');
for(const path of ['plantillas/IMPRESSUM.de.muster.md','plantillas/DATENSCHUTZ.de.muster.md']){
 const s=fs.readFileSync(root+path,'utf8');
 assert.match(s,/ENTWURF, NICHT VERÖFFENTLICHEN/,'Templates must remain visibly unapproved');
}
const cmd=(script,args)=>spawnSync(process.execPath,[script,...args],{encoding:'utf8'});
const audit=cmd('scripts/legal-ia-gate.mjs',['--mode','audit','--json']);
assert.equal(audit.status,0,'Read-only audit should not block development');
const data=JSON.parse(audit.stdout);
assert.equal(data.status,'REVIEW');
assert.ok(data.pending>0,'Missing evidence must remain flagged');
const release=cmd('scripts/legal-ia-gate.mjs',['--mode','release','--json']);
assert.equal(release.status,1,'Release must fail closed');
const staticAudit=cmd('scripts/legal-ia-static-audit.mjs',['--json']);
assert.equal(staticAudit.status,0);
const staticData=JSON.parse(staticAudit.stdout);
assert.ok(staticData.checks.some(x=>x.id==='impressum'&&x.status==='REVIEW'),'Missing Impressum must be detected');
assert.ok(staticData.checks.some(x=>x.id==='datenschutz'&&x.status==='REVIEW'),'Missing Datenschutz must be detected');
console.log('LEGAL.ia: public metadata safe; audit/release and static checks OK');
