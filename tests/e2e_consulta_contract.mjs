import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const api=fs.readFileSync('api/documentos.js','utf8');
const nav=fs.readFileSync('bandeja.js','utf8');
const blocks=fs.readFileSync('bloques.js','utf8');

const checks=[
 ['entrada de consulta',html.includes('id="consulta"')&&html.includes('id="formBuscar"')],
 ['API fail-closed',api.includes('falta_configuracion')&&api.includes('clave_incorrecta')],
 ['solo documentos publicables',api.includes('publicado_cliente=is.true')],
 ['fuente oficial expuesta',api.includes('enlace_oficial')&&api.includes('normograma.dian.gov.co')],
 ['vigencia expuesta',api.includes('estado_vigencia')&&api.includes('fecha_entrada_vigencia')],
 ['trazabilidad expuesta',api.includes('fuentes_formales')&&api.includes('modifica_a')&&api.includes('modificado_por')],
 ['verificacion expuesta',api.includes('fecha_es_real')&&api.includes('anotaciones_vigencia')],
 ['novedades exigen evidencia',api.includes('fecha_es_real===true')&&api.includes('texto_completo')],
 ['UI consulta API',nav.includes("fetch('/api/documentos?" )],
 ['UI enlaza fuente DIAN',blocks.includes('enlace_oficial')&&blocks.includes('Abrir fuente DIAN')],
 ['UI muestra fuentes oficiales',blocks.includes('Fuentes oficiales')&&blocks.includes('Abrir documento oficial')]
];
let failed=0;
for(const [name,ok] of checks){console.log((ok?'OK':'FAIL')+' - '+name);if(!ok)failed++;}
assert.equal(failed,0,failed+' invariantes incumplidas');
console.log('Contrato E2E estático: '+checks.length+'/'+checks.length+' OK');
