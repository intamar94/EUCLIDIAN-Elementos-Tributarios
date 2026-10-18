import assert from 'node:assert/strict';
import {evaluar} from '../scripts/evaluar_busqueda_mikai.mjs';
const gold={corpus_version:'fijo',queries:[
 {id:'identificador',text:'DIAN-OFICIO-1-2026',relevant:['A'],exact_id:'A'},
 {id:'pregunta',text:'pregunta de prueba',relevant:['B']},
 {id:'negativa',text:'sin documento',relevant:[]},
 {id:'sin_juicio',text:'consulta nueva',relevant:null}
]};
const run={system:'simulacion',corpus_version:'fijo',results:[
 {query_id:'identificador',latency_ms:10,candidates:[{id:'A',source_url:'https://normograma.dian.gov.co/a'}]},
 {query_id:'pregunta',latency_ms:20,candidates:[{id:'X',source_url:'https://example.com/x'},{id:'B',source_url:'https://www.dian.gov.co/b'}]},
 {query_id:'negativa',latency_ms:30,candidates:[{id:'X',source_url:'https://example.com/x'}]},
 {query_id:'sin_juicio',latency_ms:40,candidates:[]}
]};
const m=evaluar(gold,run);
assert.equal(m.juzgadas,2);assert.equal(m.recall_at_5,1);assert.equal(m.mrr_at_10,.75);
assert.equal(m.exactas_top_1,1);assert.equal(m.falsos_positivos,1);assert.equal(m.candidatos_sin_fuente_dian,2);
assert.equal(m.p50_ms,20);assert.equal(m.p95_ms,40);assert.equal(m.coste_usd_medido,null);
assert.throws(()=>evaluar({...gold,corpus_version:'otro'},run),/incompatible/);
assert.throws(()=>evaluar(gold,{...run,results:run.results.slice(1)}),/Falta resultado/);
const fallido=evaluar(gold,{...run,results:run.results.map(r=>r.query_id==='identificador'?{query_id:r.query_id,error:'HTTP 502',latency_ms:12000}:r)});
assert.equal(fallido.errores,1);assert.equal(fallido.exactas_top_1,0);assert.equal(fallido.recall_at_5,.5);
console.log('Evaluador MIKAI: métricas, fuente, negativos, cohorte y datos faltantes OK (fixture sintético)');
