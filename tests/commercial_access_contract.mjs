import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_PUBLISHABLE_KEY='publishable-test';
process.env.SUPABASE_SERVICE_KEY='service-test';
process.env.EUCLIDIAN_PRICING_PUBLICADO='false';

const uid='00000000-0000-4000-8000-0000000000aa';

function response(){
  return {code:200,body:null,headers:{},status(n){this.code=n;return this;},json(v){this.body=v;return this;},setHeader(k,v){this.headers[k]=v;}};
}
function req(method='GET',body){
  return {method,body,headers:{authorization:'Bearer user-token'}};
}
function authUser(){
  return new Response(JSON.stringify({id:uid,email:'persona@example.com'}),{status:200,headers:{'content-type':'application/json'}});
}

const {default:plansHandler}=await import('../api/plans.js?test='+Date.now());
const {default:usageHandler}=await import('../api/usage.js?test='+Date.now());
const {default:profileHandler}=await import('../api/profile.js?test='+Date.now());

{
  let calls=[];
  global.fetch=async(url,options={})=>{
    calls.push({url:String(url),options});
    if(String(url).includes('/auth/v1/user')) return authUser();
    if(String(url).includes('/planes_suscripcion')) return new Response(JSON.stringify([{codigo:'pro',nombre:'Pro',descripcion:'Prueba',precio_mensual:99,moneda:'EUR',limite_consultas_mensual:50}]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error('upstream inesperado');
  };
  const res=response(); await plansHandler(req(),res);
  assert.equal(res.code,200);
  assert.equal(res.body.pricing_publicado,false);
  assert.equal('precio_mensual' in res.body.planes[0],false);
  assert.equal('moneda' in res.body.planes[0],false);
  assert.ok(calls.some(c=>c.url.includes('/auth/v1/user')&&c.options.headers.apikey==='publishable-test'));
  console.log('OK - catálogo autenticado oculta precio hasta publicación explícita');
}
{
  const urls=[];
  global.fetch=async(url)=>{
    const s=String(url); urls.push(s);
    if(s.includes('/auth/v1/user')) return authUser();
    if(s.includes('/uso_consultas')) return new Response(JSON.stringify([{id:1}]),{status:200,headers:{'content-type':'application/json','content-range':'0-0/1'}});
    if(s.includes('/accesos_suscripcion')) return new Response(JSON.stringify([{plan_codigo:'pro'}]),{status:200,headers:{'content-type':'application/json'}});
    if(s.includes('/planes_suscripcion')) return new Response(JSON.stringify([{limite_consultas_mensual:50}]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error('upstream inesperado');
  };
  const res=response(); await usageHandler(req(),res);
  assert.equal(res.code,200); assert.equal(res.body.consultas_mes,1); assert.equal(res.body.limite_consultas_mensual,50);
  for(const s of urls.filter(x=>x.includes('/uso_consultas')||x.includes('/accesos_suscripcion'))) assert.ok(s.includes('user_id=eq.'+uid),'consulta comercial sin ownership');
  console.log('OK - uso y suscripción quedan acotados al usuario autenticado');
}
{
  const urls=[];
  global.fetch=async(url,options={})=>{
    const s=String(url); urls.push(s);
    if(s.includes('/auth/v1/user')) return authUser();
    if(s.includes('/perfiles_usuario')) return new Response(JSON.stringify([{nombre:'Ada',ciudad:'Bogotá',onboarding_completado:true}]),{status:200,headers:{'content-type':'application/json'}});
    throw new Error('upstream inesperado');
  };
  const res=response(); await profileHandler(req(),res);
  assert.equal(res.code,200); assert.equal(res.body.profile.nombre,'Ada');
  assert.ok(urls.find(s=>s.includes('/perfiles_usuario')).includes('user_id=eq.'+uid));
  console.log('OK - lectura de perfil queda acotada al propietario');
}
{
  let patchUrl='',patchBody=null;
  global.fetch=async(url,options={})=>{
    const s=String(url);
    if(s.includes('/auth/v1/user')) return authUser();
    if(s.includes('/perfiles_usuario')){patchUrl=s;patchBody=JSON.parse(options.body);return new Response(JSON.stringify([patchBody]),{status:200,headers:{'content-type':'application/json'}});}
    throw new Error('upstream inesperado');
  };
  const res=response(); await profileHandler(req('PATCH',{nombre:'  Ada   Lovelace  ',ciudad:'  Bogotá  ',user_id:'otro',rol:'admin'}),res);
  assert.equal(res.code,200); assert.ok(patchUrl.includes('user_id=eq.'+uid));
  assert.equal(patchBody.nombre,'Ada Lovelace'); assert.equal(patchBody.ciudad,'Bogotá');
  assert.equal('user_id' in patchBody,false); assert.equal('rol' in patchBody,false);
  console.log('OK - PATCH ignora identidad/rol suministrados por cliente');
}
console.log('Contrato comercial y ownership: 4/4 escenarios OK');
