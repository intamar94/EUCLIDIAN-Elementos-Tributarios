#!/usr/bin/env node
// Laboratorio de recuperación: solo lee respuestas ya autorizadas; no cambia el catálogo.
import {readFileSync} from 'node:fs';
import {performance} from 'node:perf_hooks';

const oficial=url=>/^https:\/\/(?:[a-z0-9-]+\.)*dian\.gov\.co\//i.test(String(url||''));
const leer=path=>JSON.parse(readFileSync(path,'utf8'));
const percentil=(valores,p)=>valores.length?valores.slice().sort((a,b)=>a-b)[Math.ceil(valores.length*p)-1]:null;
function revisarConsultas(manifest){
 if(!Array.isArray(manifest.queries)||!manifest.queries.length)throw Error('Se requieren consultas');
 const ids=new Set();
 for(const q of manifest.queries){
  if(!/^[a-z0-9_-]+$/.test(q.id)||ids.has(q.id)||!String(q.text||'').trim()||String(q.text).length>160)throw Error('Consulta inválida o repetida');
  ids.add(q.id);
 }
 return manifest.queries;
}
export function evaluar(gold,run){
 const consultas=revisarConsultas(gold);
 if(!gold.corpus_version||run.corpus_version!==gold.corpus_version||!Array.isArray(run.results))throw Error('Cohorte o versión del corpus incompatible');
 const resultados=new Map();
 for(const r of run.results){if(resultados.has(r.query_id)||(!r.error&&!Array.isArray(r.candidates)))throw Error('Resultado repetido o inválido');resultados.set(r.query_id,r);}
 let juzgadas=0,rr=0,recall=0,dcg=0,dcgIdeal=0,exactas=0,exactasPrimero=0,negativas=0,falsosPositivos=0,trazabilidad=0,candidatos=0,errores=0;
 const latencias=[];
 for(const q of consultas){
  const r=resultados.get(q.id);
  if(!r)throw Error('Falta resultado para '+q.id);
  if(r.error)errores++;
  if(r.latency_ms!==undefined){
   if(!Number.isFinite(r.latency_ms)||r.latency_ms<0)throw Error('Latencia inválida en '+q.id);
   latencias.push(r.latency_ms);
  }else if(!r.error)throw Error('Falta latencia en '+q.id);
  const ids=new Set();
  const candidatosResultado=r.error?[]:r.candidates;
  for(const c of candidatosResultado){
   if(!c.id||ids.has(c.id))throw Error('Documento ausente o duplicado en '+q.id);
   ids.add(c.id);candidatos++;if(!oficial(c.source_url))trazabilidad++;
  }
  if(q.relevant===null||q.relevant===undefined)continue; // Falta juicio humano.
  if(!Array.isArray(q.relevant)||new Set(q.relevant).size!==q.relevant.length)throw Error('Juicios inválidos en '+q.id);
  if(q.relevant.length===0){negativas++;if(candidatosResultado.length)falsosPositivos++;continue;}
  juzgadas++;
  const buenos=new Set(q.relevant),top=candidatosResultado.slice(0,10);
  if(q.exact_id&&!buenos.has(q.exact_id))throw Error('Identificador exacto sin juicio en '+q.id);
  recall+=candidatosResultado.slice(0,5).filter(c=>buenos.has(c.id)).length/buenos.size;
  const pos=top.findIndex(c=>buenos.has(c.id));if(pos>=0)rr+=1/(pos+1);
  top.forEach((c,i)=>{if(buenos.has(c.id))dcg+=1/Math.log2(i+2)});
  for(let i=0;i<Math.min(10,buenos.size);i++)dcgIdeal+=1/Math.log2(i+2);
  if(q.exact_id){exactas++;if(candidatosResultado[0]?.id===q.exact_id)exactasPrimero++;}
 }
 return {system:run.system,corpus_version:gold.corpus_version,consultas:consultas.length,juzgadas,errores,
  recall_at_5:juzgadas?recall/juzgadas:null,mrr_at_10:juzgadas?rr/juzgadas:null,ndcg_at_10:dcgIdeal?dcg/dcgIdeal:null,
  exactas_top_1:exactas?exactasPrimero/exactas:null,negativas,falsos_positivos:falsosPositivos,
  candidatos_sin_fuente_dian:trazabilidad,candidatos,p50_ms:percentil(latencias,.5),p95_ms:percentil(latencias,.95),
  coste_usd_medido:Number.isFinite(run.measured_cost_usd)?run.measured_cost_usd:null};
}
async function recolectar(path){
 const consultas=revisarConsultas(leer(path));
 if(!process.env.SUPABASE_URL||!process.env.SUPABASE_SERVICE_KEY||!process.env.EUCLIDIAN_CLAVE||!process.env.EUCLIDIAN_CORPUS_VERSION)
  throw Error('Faltan credenciales de CI o versión fija del corpus; no se ejecutó ninguna consulta');
 const {default:handler}=await import('../api/documentos.js');
 const results=[];
 for(const q of consultas){
  const req={method:'GET',headers:{'x-clave':process.env.EUCLIDIAN_CLAVE},query:{periodo:'todo',estado:'todos',q:q.text,pagina:'1'}};
  const res={code:200,body:null,setHeader(){},status(n){this.code=n;return this},json(v){this.body=v;return this}};
  const start=performance.now();
  try{await handler(req,res);const latency_ms=Math.round(performance.now()-start);
   results.push(res.code===200?{query_id:q.id,latency_ms,candidates:(res.body.documentos||[]).map(d=>({id:d.numero_resolucion,source_url:d.enlace_oficial}))}:
    {query_id:q.id,latency_ms,error:'HTTP '+res.code});
  }catch(_){results.push({query_id:q.id,error:'handler_error'});}
 }
 return {system:'actual',corpus_version:process.env.EUCLIDIAN_CORPUS_VERSION,observed_at:new Date().toISOString(),results};
}
if(process.argv[1]&&import.meta.url===new URL('file://'+process.argv[1]).href){
 const [mode,...paths]=process.argv.slice(2);
 try{
  if(mode==='collect'&&paths.length===1)console.log(JSON.stringify(await recolectar(paths[0]),null,2));
  else if(mode==='evaluate'&&paths.length>=2){const gold=leer(paths[0]);console.log(JSON.stringify(paths.slice(1).map(p=>evaluar(gold,leer(p))),null,2));}
  else throw Error('Uso: collect consultas.json | evaluate juicios.json resultados1.json [resultados2.json...]');
 }catch(e){console.error(e.message);process.exitCode=1;}
}
