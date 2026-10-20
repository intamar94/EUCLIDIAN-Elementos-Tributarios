import assert from 'node:assert/strict';
import {validarEvidencia,informe} from '../scripts/auditar_release.mjs';

const base={release:{sha:'15c392c20345ae13a4b3dd4661a65fa58e1dad6f',environment:'CI',checked_at:'2026-10-20T09:00:00Z',ci:{run:'39395598723',conclusion:'success'}},controls:[{id:'PRE-REL-01',class:'operación',severity:'P0',status:'PASS',owner:'Auditor',sha:'15c392c20345ae13a4b3dd4661a65fa58e1dad6f',environment:'CI',checked_at:'2026-10-20T09:00:00Z',evidence:{reference:'CI 39395598723'}}]};
assert.equal(validarEvidencia(base).valid,true);
for(const mutate of [
 value=>{value.release.sha='no-sha';},
 value=>{value.release.ci.conclusion='failure';},
 value=>{delete value.release.checked_at;},
 value=>{delete value.controls[0].environment;},
 value=>{delete value.controls[0].sha;},
 value=>{delete value.controls[0].checked_at;},
 value=>{value.controls[0].sha='438692a533ea5bc304ffadae980c720f235f928e';},
 value=>{value.controls[0].environment='production';},
 value=>{value.controls[0].checked_at='2026-10-21T09:00:00Z';},
 value=>{delete value.controls[0].evidence.reference;}
]){
 const value=structuredClone(base);mutate(value);assert.equal(validarEvidencia(value).valid,false,'Un PASS no puede carecer de evidencia básica');
}
const legal=structuredClone(base);legal.controls.push({id:'POST-LEGAL-01',class:'legal',severity:'P0',status:'PASS',owner:'Responsable legal',sha:base.release.sha,environment:'CI',checked_at:'2026-10-20T09:00:00Z',evidence:{reference:'Comprobación local'}});
assert.equal(validarEvidencia(legal).valid,false,'Una ruta legal no pasa sin comprobación remota');
legal.controls[1].evidence.remote={url:'https://euclidianet.com/impressum',status:200,checked_at:'2026-10-20T09:04:00Z'};
assert.equal(validarEvidencia(legal).valid,true);
assert.match(informe(legal),/no es una certificación/i);
console.log('Auditor Pro: exige SHA, CI, fecha, entorno y comprobación remota para legal live.');
