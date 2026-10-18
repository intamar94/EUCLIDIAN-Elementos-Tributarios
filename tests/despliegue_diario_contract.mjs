import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {decidirDespliegueDiario} from '../scripts/verificar_despliegue_diario.mjs';
const vercel=JSON.parse(readFileSync('vercel.json','utf8'));
assert.deepEqual(vercel.git,{deploymentEnabled:false},
 'No se permiten publicaciones automáticas por push o PR');
assert.ok(Array.isArray(vercel.rewrites)&&vercel.rewrites.some(x=>x.source==='/impressum'));
assert.ok(vercel.headers.some(x=>x.source==='/api/(.*)'));
const antiguo='a'.repeat(40),main='b'.repeat(40);
const hoy=Date.parse('2026-10-19T13:00:00Z'); // 15:00 Europa/Berlín
const ayer=Date.parse('2026-10-18T13:00:00Z');
function estado(extra={}){return {
 mainSha:main,ahora:hoy,
 produccion:[{sha:antiguo,state:'READY',created:ayer}],
 ci:[{name:'Control de calidad',sha:main,status:'completed',conclusion:'success'}],
 proteccionesVerificadas:true,...extra
};}
assert.deepEqual(decidirDespliegueDiario(estado()),
 {publicar:true,motivo:'lote_validado',sha:main,fecha:'2026-10-19'});
assert.equal(decidirDespliegueDiario(estado({produccion:[
 {sha:antiguo,state:'READY',created:ayer},
 {sha:main,state:'ERROR',created:hoy-3600000}
]})).motivo,'ya_hubo_intento_hoy','No repetir despliegues fallidos en el mismo día');
assert.equal(decidirDespliegueDiario(estado({produccion:[
 {sha:antiguo,state:'READY',created:ayer},
 {sha:main,state:'BUILDING',created:hoy-3600000}
]})).motivo,'ya_hubo_intento_hoy');
assert.equal(decidirDespliegueDiario(estado({produccion:[
 {sha:main,state:'READY',created:ayer}
]})).motivo,'sin_cambios');
assert.equal(decidirDespliegueDiario(estado({ci:[
 {name:'Control de calidad',sha:antiguo,status:'completed',conclusion:'success'}
]})).motivo,'ci_incompleto_o_fallido');
assert.equal(decidirDespliegueDiario(estado({ci:[
 {name:'Control de calidad',sha:main,status:'in_progress',conclusion:null}
]})).motivo,'ci_incompleto_o_fallido');
assert.equal(decidirDespliegueDiario(estado({ci:[
 {name:'Control de calidad',sha:main,status:'completed',conclusion:'failure'}
]})).motivo,'ci_incompleto_o_fallido');
assert.equal(decidirDespliegueDiario(estado({proteccionesVerificadas:false})).motivo,'revision_prepublicacion_pendiente');
assert.equal(decidirDespliegueDiario(estado({mainSha:'rama-no-comprobada'})).motivo,'evidencia_incompleta');
assert.equal(decidirDespliegueDiario(null).motivo,'faltan_datos');
assert.equal(decidirDespliegueDiario(estado({produccion:[]})).motivo,'sin_ultima_version_estable');
assert.equal(decidirDespliegueDiario(estado({ahora:Date.parse('2026-10-18T22:30:00Z'),
 produccion:[{sha:antiguo,state:'READY',created:Date.parse('2026-10-18T22:29:00Z')}]})).motivo,
 'ya_hubo_intento_hoy','Usar día calendario de Alemania, incluso durante transición UTC');
console.log('Publicación diaria: Git auto cerrado; fecha Berlín, CI, versión y un intento/día OK');
