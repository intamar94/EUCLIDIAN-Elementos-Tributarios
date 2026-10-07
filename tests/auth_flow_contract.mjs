import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.SUPABASE_SERVICE_KEY='service-test';
process.env.EUCLIDIAN_CLAVE='internal-test';

const {default:authHandler}=await import('../api/auth.js?test='+Date.now());
const {autorizarConsulta}=await import('../lib/auth-server.js?test='+Date.now());

function response(){
  return {code:200,body:null,headers:{},status(n){this.code=n;return this;},json(v){this.body=v;return this;},setHeader(k,v){this.headers[k]=v;}};
}
async function callAuth(body){
  const req={method:'POST',body,headers:{}},res=response();
  await authHandler(req,res);return res;
}

{
  let calls=0;global.fetch=async()=>{calls++;throw new Error('no debe llamarse');};
  const res=await callAuth({action:'signup',email:'mal',password:'123'});
  assert.equal(res.code,400);
  assert.equal(calls,0);
  console.log('OK - signup inválido falla antes de red');
}
{
  let seen=null;
  global.fetch=async(url,options)=>{seen={url,options};return new Response(JSON.stringify({
    access_token:'access-test',refresh_token:'refresh-test',expires_in:3600,
    user:{id:'00000000-0000-4000-8000-000000000001',email:'persona@example.com'}
  }),{status:200,headers:{'content-type':'application/json'}});};
  const res=await callAuth({action:'signin',email:'persona@example.com',password:'password-seguro'});
  assert.equal(res.code,200);
  assert.equal(res.body?.access_token,'access-test');
  assert.ok(String(seen.url).includes('/auth/v1/token?grant_type=password'));
  assert.equal(seen.options.headers.apikey,'publishable-test');
  assert.notEqual(seen.options.headers.apikey,'service-test');
  console.log('OK - signin usa exclusivamente clave publicable');
}
{
  global.fetch=async()=>new Response('{}',{status:200,headers:{'content-type':'application/json'}});
  const res=await callAuth({action:'recover',email:'persona@example.com'});
  assert.equal(res.code,200);
  assert.equal(res.body?.requested,true);
  assert.equal('user' in (res.body||{}),false);
  console.log('OK - recuperación no revela existencia de cuenta');
}
{
  let calls=0;global.fetch=async()=>{calls++;throw new Error('no debe llamarse');};
  const req={headers:{'x-clave':'internal-test'}};
  const acceso=await autorizarConsulta(req);
  assert.equal(acceso.ok,true);
  assert.equal(acceso.modo,'interno');
  assert.equal(calls,0);
  console.log('OK - acceso interno transitorio no depende de Auth externo');
}
{
  const uid='00000000-0000-4000-8000-000000000002';
  let n=0;
  global.fetch=async(url)=>{
    n++;
    if(n===1)return new Response(JSON.stringify({id:uid,email:'persona@example.com'}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify([{permitido:true,rol:'usuario',estado:'active',plan_codigo:'pro'}]),{status:200,headers:{'content-type':'application/json'}});
  };
  const acceso=await autorizarConsulta({headers:{authorization:'Bearer user-token'}});
  assert.equal(acceso.ok,true);
  assert.equal(acceso.modo,'usuario');
  assert.equal(acceso.user.id,uid);
  assert.equal(acceso.acceso.estado,'active');
  console.log('OK - sesión activa obtiene entitlement');
}
{
  const uid='00000000-0000-4000-8000-000000000003';
  let n=0;
  global.fetch=async()=>{
    n++;
    if(n===1)return new Response(JSON.stringify({id:uid,email:'pendiente@example.com'}),{status:200,headers:{'content-type':'application/json'}});
    return new Response(JSON.stringify([{permitido:false,rol:'usuario',estado:'pendiente',plan_codigo:null}]),{status:200,headers:{'content-type':'application/json'}});
  };
  const acceso=await autorizarConsulta({headers:{authorization:'Bearer pending-token'}});
  assert.equal(acceso.ok,false);
  assert.equal(acceso.status,402);
  assert.equal(acceso.error,'suscripcion_requerida');
  console.log('OK - cuenta sin suscripción no entra al corpus');
}
console.log('Contrato Auth: 6/6 escenarios OK');
