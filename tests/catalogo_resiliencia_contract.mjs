import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SERVICE_KEY='test-only';
process.env.EUCLIDIAN_CLAVE='test-only';
const {default:handler}=await import('../api/documentos.js');
async function call(){
  const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};
  await handler({method:'GET',query:{periodo:'todo',estado:'todos'},headers:{'x-clave':'test-only'}},res);return res;
}
global.fetch=async()=>new Response(JSON.stringify({code:'57014',message:'canceling statement due to statement timeout',details:'private database diagnostic'}),{status:500});
let res=await call();assert.equal(res.code,502);assert.equal(res.body.error,'consulta_lenta');assert.match(res.body.mensaje,/Inténtalo de nuevo/);assert.doesNotMatch(JSON.stringify(res.body),/57014|statement|private database/);
global.fetch=async()=>{throw new Error('sensitive upstream URL and SQL');};
res=await call();assert.equal(res.code,502);assert.equal(res.body.error,'fallo_lectura');assert.doesNotMatch(JSON.stringify(res.body),/sensitive|SQL/);
const normalTimeout=global.setTimeout;
global.setTimeout=(fn,ms,...args)=>normalTimeout(fn,ms===12000?0:ms,...args);
global.fetch=(_url,{signal})=>new Promise((_,reject)=>{
  const fail=()=>reject(new DOMException('aborted','AbortError'));
  if(signal.aborted)fail();else signal.addEventListener('abort',fail,{once:true});
});
try{res=await call();assert.equal(res.code,504);assert.equal(res.body.error,'consulta_lenta');assert.match(res.body.mensaje,/Inténtalo de nuevo/);}finally{global.setTimeout=normalTimeout;}
console.log('Catálogo: timeout SQL, fallo de red y petición sin respuesta devuelven mensajes recuperables sin diagnósticos internos');
