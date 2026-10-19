import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY='service-test';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.PAYMENT_PROVIDER='sandbox';
process.env.EUCLIDIAN_CLAVE='internal-test';

const {default:health}=await import('../api/health.js?test='+Date.now());
function response(){return {code:200,body:null,headers:{},status(n){this.code=n;return this;},json(v){this.body=v;return this;},setHeader(k,v){this.headers[k]=v;}};}

{
  global.fetch=async()=>new Response('[]',{status:200,headers:{'content-type':'application/json'}});
  const res=response(); await health({method:'GET'},res);
  assert.equal(res.code,200); assert.equal(res.body.ok,true);
  assert.deepEqual(res.body.checks,{database:true,commercial_schema:true,auth_configured:true});
  assert.equal('payment_provider_configured' in res.body,false);
  assert.equal('documental' in res.body,false);
  assert.equal('version' in res.body,false);
  assert.equal('SUPABASE_SERVICE_KEY' in res.body,false);
  assert.equal(JSON.stringify(res.body).includes('service-test'),false);
  console.log('OK - health confirma dependencias sin exponer secretos');
}
{
  let n=0;
  global.fetch=async()=>{n++;return new Response('[]',{status:n===1?200:503});};
  const res=response(); await health({method:'GET'},res);
  assert.equal(res.code,503); assert.equal(res.body.ok,false);
  assert.equal(res.body.checks.database,true); assert.equal(res.body.checks.commercial_schema,false);
  console.log('OK - health falla cerrado si el sustrato comercial no responde');
}
{
  const res=response(); await health({method:'POST'},res);
  assert.equal(res.code,405); assert.equal(res.body.error,'method_not_allowed');
  console.log('OK - health es exclusivamente de lectura');
}
{
  const calls=[];
  global.fetch=async url=>{calls.push(String(url));return new Response('[]',{status:200});};
  for(const headers of [{},{'x-clave':'wrong'},{authorization:'Bearer client-token'}]){
    const res=response();await health({method:'GET',headers},res);
    assert.equal(res.code,200);
    assert.equal('documental' in res.body,false,'Cliente no ve operación interna');
  }
  assert.equal(calls.some(url=>url.includes('estado_direccion_documental')),false,
    'Una llamada pública no consulta el RPC interno');
  const internal=response();await health({method:'GET',headers:{'x-clave':'internal-test'}},internal);
  assert.equal(internal.body.documental.estado,'sin_ejecucion');
  assert.equal(internal.body.payment_provider_configured,false);
  assert.ok(calls.some(url=>url.includes('estado_direccion_documental')));
  delete process.env.EUCLIDIAN_CLAVE;
  const noKey=response();await health({method:'GET',headers:{'x-clave':''}},noKey);
  assert.equal('documental' in noKey.body,false,'Sin credencial configurada, cerrado');
  console.log('OK - detalle operativo exige credencial interna; JWT de cliente no basta');
}
console.log('Contrato readiness/observabilidad: 4/4 escenarios OK');
