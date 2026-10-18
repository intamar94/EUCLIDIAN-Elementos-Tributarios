import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.SUPABASE_SERVICE_KEY='service-test';
process.env.EUCLIDIAN_CLAVE='ci-interno';
process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED='0';
const {default:handler}=await import('../api/auth.js');
const {autorizarConsulta}=await import('../lib/auth-server.js');
const response=()=>({code:200,body:null,headers:{},setHeader(k,v){this.headers[k]=v},status(c){this.code=c;return this},json(v){this.body=v;return this}});
let calls=0;globalThis.fetch=async()=>{calls++;throw Error('sin llamadas externas')};
for(const action of ['signin','refresh','recover','update_password','signup']){
 const res=response();
 await handler({method:'POST',body:{action,email:'person@example.com',password:'contrasena-de-prueba'}},res);
 assert.equal(res.code,403,action);
 assert.ok(['acceso_publico_cerrado','registro_cerrado'].includes(res.body.error));
}
// La activación aislada del registro nunca debe abrir una vía de alta.
process.env.EUCLIDIAN_SIGNUP_ENABLED='true';
for(const [publico,legal] of [['0','1'],['1','0']]){
 process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED=publico;
 process.env.EUCLIDIAN_LEGAL_APPROVED=legal;
 const res=response();await handler({method:'POST',body:{action:'signup'}},res);
 assert.equal(res.code,403);assert.equal(res.body.error,'registro_cerrado');
}
process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED='0';
const denegado=await autorizarConsulta({headers:{authorization:'Bearer prueba'}});
assert.equal(denegado.ok,false);assert.equal(denegado.status,403);
const interno=await autorizarConsulta({headers:{'x-clave':'ci-interno'}});
assert.equal(interno.ok,true);assert.equal(interno.modo,'interno');assert.equal(calls,0);
console.log('OK: APIs de acceso público cerradas por defecto, sin comprometer acceso interno.');
