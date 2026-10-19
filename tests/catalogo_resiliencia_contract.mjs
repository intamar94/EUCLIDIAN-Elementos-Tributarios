import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SERVICE_KEY='test-only';
process.env.EUCLIDIAN_CLAVE='test-only';
const {default:handler}=await import('../api/documentos.js');
async function call(){
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
  await handler({method:'GET',query:{periodo:'todo',estado:'todos'},headers:{'x-clave':'test-only'}},res);return res;
}
const doc={id:'00000000-0000-4000-8000-000000000000',tipo_documento:'boletin',temas:[]};
const etapas=[
  ['v_bandeja','biblioteca_no_disponible',[doc]],
  ['documentos_tributarios','evidencia_no_disponible',[{id:doc.id,texto_completo:'Texto sintético sin conclusiones legales.'}]],
  ['boletin_referencias','referencias_no_disponibles',[]],
  ['revisor_fiscal_euclidian_evaluaciones','evaluacion_no_disponible',[]],
  ['metadatos_catalogo_cliente','metadatos_no_disponibles',{temas:[],anios:[]}]
];
let escenarios=0;
// Simular el fallo de cada dependencia: nunca entregar una ficha incompleta.
for(const [indice,[etapa,error]] of etapas.entries()){
  for(const tipo of ['sql_timeout','gateway_timeout','otro','html','nulo']){
    const llamadas=[];
    global.fetch=async url=>{
      const recurso=new URL(url).pathname.split('/').pop();llamadas.push(recurso);
      if(recurso===etapa){
        const cuerpo=tipo==='sql_timeout'?{code:'57014',message:'private database diagnostic',details:'SQL sensitive query'}:
          tipo==='nulo'?null:{code:'XX000',message:'private database diagnostic'};
        return new Response(tipo==='html'?'<html>private upstream</html>':JSON.stringify(cuerpo),{status:tipo==='gateway_timeout'?504:500});
      }
      const fixture=etapas.find(([nombre])=>nombre===recurso);
      assert.ok(fixture,'La prueba no debe contactar recursos inesperados');
      return new Response(JSON.stringify(fixture[2]),{headers:{'content-range':'0-0/1'}});
    };
    const res=await call();const timeout=tipo==='sql_timeout'||tipo==='gateway_timeout';
    assert.equal(res.code,timeout?504:502,`${etapa}: ${tipo}`);
    assert.equal(res.body.error,timeout?'consulta_lenta':error,`${etapa}: ${tipo}`);
    if(timeout)assert.match(res.body.mensaje,/Inténtalo de nuevo/);
    assert.doesNotMatch(JSON.stringify(res.body),/57014|private|sensitive|SQL|XX000/);
    assert.equal(res.body.documentos,undefined,'No exponer evidencia parcial como éxito');
    assert.equal(llamadas.length,indice+1,'Detener lecturas después del fallo, sin reintentos automáticos');
    escenarios++;
  }
}
global.fetch=async()=>{throw new Error('sensitive upstream URL and SQL');};
let res=await call();assert.equal(res.code,502);assert.equal(res.body.error,'fallo_lectura');assert.doesNotMatch(JSON.stringify(res.body),/sensitive|SQL/);escenarios++;
const normalTimeout=global.setTimeout;
global.setTimeout=(fn,ms,...args)=>normalTimeout(fn,ms===12000?0:ms,...args);
try{
  for(const cuerpoPendiente of [false,true]){
    global.fetch=(_url,{signal})=>{
      const pendiente=()=>new Promise((_,reject)=>{
        const fail=()=>reject(new DOMException('aborted','AbortError'));
        if(signal.aborted)fail();else signal.addEventListener('abort',fail,{once:true});
      });
      // La cabecera de error puede llegar mientras su cuerpo queda detenido.
      return cuerpoPendiente?Promise.resolve({ok:false,status:500,json:pendiente}):pendiente();
    };
    res=await call();assert.equal(res.code,504);assert.equal(res.body.error,'consulta_lenta');assert.match(res.body.mensaje,/Inténtalo de nuevo/);escenarios++;
  }
}finally{global.setTimeout=normalTimeout;}
console.log(`Catálogo: ${escenarios} escenarios de errores multietapa y deadline; sin datos parciales ni diagnósticos internos`);
