import assert from 'node:assert/strict';
import fs from 'node:fs';

const sql=fs.readFileSync('sql/expedientes_profesionales_rls_preparacion.sql','utf8');
const api=fs.readFileSync('lib/expedientes-api.js','utf8');
const entry=fs.readFileSync('api/profile.js','utf8');
const ui=fs.readFileSync('expedientes.js','utf8');
const tests=[
 /CREATE TABLE IF NOT EXISTS public\.expedientes_profesionales/i,
 /CREATE TABLE IF NOT EXISTS public\.expediente_revisiones/i,
 /REFERENCES auth\.users\(id\) ON DELETE CASCADE/g,
 /ALTER TABLE public\.expedientes_profesionales FORCE ROW LEVEL SECURITY/i,
 /ALTER TABLE public\.expediente_revisiones FORCE ROW LEVEL SECURITY/i,
 /WITH CHECK \(owner_id = \(SELECT auth\.uid\(\)\)\)/i,
 /FOR SELECT TO authenticated/i,
 /FOR UPDATE TO authenticated/i,
 /FOR DELETE TO authenticated/i,
 /GRANT SELECT ON TABLE public\.expediente_revisiones TO authenticated/i,
 /REVOKE ALL ON TABLE public\.expediente_revisiones FROM PUBLIC, anon, authenticated/i,
 /SECURITY DEFINER SET search_path = ''/i,
 /BEFORE INSERT OR UPDATE ON public\.expedientes_profesionales/i,
 /AFTER INSERT OR UPDATE ON public\.expedientes_profesionales/i,
 /NEW\.version := OLD\.version \+ 1/i,
 /NEW\.estado := 'borrador_sin_revision'/i,
 /owner_id IS DISTINCT FROM OLD\.owner_id/i,
 /REFERENCES public\.expedientes_profesionales\(id\) ON DELETE CASCADE/i
];
for(const re of tests)assert.match(sql,re,'Protección SQL ausente: '+re);
assert.doesNotMatch(sql,/GRANT (?:ALL|INSERT|UPDATE|DELETE) ON TABLE public\.expediente_revisiones TO authenticated/i,
 'Historial no debe permitir escritura directa');
assert.doesNotMatch(sql,/CREATE POLICY .+ FOR (?:ALL|INSERT|UPDATE|DELETE) TO (?:PUBLIC|anon)/i);
assert.match(api,/PUBLISHABLE_KEY/);
assert.doesNotMatch(api,/SUPABASE_SERVICE_KEY|Bearer \$\{SERVICE_KEY\}|localStorage/);
assert.match(api,/EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED==='1'/);
assert.match(api,/EUCLIDIAN_LEGAL_APPROVED==='1'/);
assert.match(api,/EUCLIDIAN_PUBLIC_ACCESS_ENABLED==='1'/);
assert.match(entry,/if\(req\.query\?\.accion==='expedientes'\)return expedientesHandler\(req,res\)/);
assert.doesNotMatch(ui,/expedientes_profesionales|EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED/,
 'La UI aún no debe activar la persistencia real');

process.env.SUPABASE_URL='https://supabase.test';
process.env.SUPABASE_PUBLISHABLE_KEY='test-public-token';
process.env.SUPABASE_SERVICE_KEY='test-server-only';
const calls=[];
const userA='a7ce7389-5678-4679-9a50-3de4db1af011',userB='b9e77389-5678-4679-9a50-3de4db1af012';
function http(status,rows){return {ok:status>=200&&status<300,status,json:async()=>rows};}
globalThis.fetch=async(url,opts={})=>{
 calls.push({url:String(url),...opts});
 if(String(url).endsWith('/auth/v1/user')){
  return opts.headers.Authorization==='Bearer tokenA'?http(200,{id:userA,email:'contador@example.invalid'}):
   http(401,{error:'no'});
 }
 if(String(url).includes('/rest/v1/rpc/euclidian_estado_acceso'))return http(200,{permitido:true,rol:'usuario',estado:'active',periodo_fin:'2099-12-31'});
 if(String(url).includes('/rest/v1/expedientes_profesionales')){
  if(opts.method==='PATCH')return http(200,[]); // Concurrencia optimista
  if(opts.method==='DELETE')return http(200,[{id:'ok'}]);
  if(opts.method==='POST')return http(201,[{id:userB,estado:'borrador_sin_revision',version:1}]);
  return http(200,[]);
 }
 if(String(url).includes('/rest/v1/expediente_revisiones'))return http(200,[]);
 throw Error('Salida no esperada '+url);
};
const {default:handler,expedienteContrato}=await import('../lib/expedientes-api.js');
function req(method,query={},body,token='tokenA'){return {method,query,body,headers:{authorization:'Bearer '+token}};}
function res(){
 return {code:0,jsonBody:null,headers:{},
  setHeader(k,v){this.headers[k]=v;return this;},
  status(n){this.code=n;return this;},
  json(value){this.jsonBody=value;return this;}};
}
async function use(r){const out=res();await handler(r,out);return out;}
for(const variable of ['EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED','EUCLIDIAN_LEGAL_APPROVED','EUCLIDIAN_PUBLIC_ACCESS_ENABLED'])delete process.env[variable];
let out=await use(req('GET'));assert.equal(out.code,503);assert.equal(calls.length,0);
process.env.EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED='1';process.env.EUCLIDIAN_LEGAL_APPROVED='1';
out=await use(req('GET'));assert.equal(out.code,503);assert.equal(calls.length,0);
process.env.EUCLIDIAN_PUBLIC_ACCESS_ENABLED='1';
assert.equal(expedienteContrato.abierto(),true);
out=await use(req('GET'));assert.equal(out.code,200);
let last=calls.at(-1);
assert.match(last.url,/owner_id=eq\./);
assert.match(decodeURIComponent(last.url),new RegExp(userA));
assert.equal(last.headers.Authorization,'Bearer tokenA');
assert.equal(last.headers.apikey,'test-public-token');
assert.notEqual(last.headers.apikey,process.env.SUPABASE_SERVICE_KEY);
out=await use(req('POST',{}, {titulo:'Trabajo sintético',hechos:'Sin NIT real'}));
assert.equal(out.code,201);
last=calls.at(-1);
assert.equal(JSON.parse(last.body).titulo,'Trabajo sintético');
assert.ok(!Object.hasOwn(JSON.parse(last.body),'owner_id'));
assert.ok(!Object.hasOwn(JSON.parse(last.body),'estado'));
out=await use(req('POST',{}, {titulo:'Prueba',owner_id:userB}));
assert.equal(out.code,400);
assert.equal(out.jsonBody.error,'campo_no_permitido');
out=await use(req('PATCH',{id:userB},{version:2,hipotesis:'Hipótesis revisable'}));
assert.equal(out.code,409);
last=calls.at(-1);
assert.equal(last.method,'PATCH');
assert.match(decodeURIComponent(last.url),/version=eq\.2/);
assert.match(decodeURIComponent(last.url),new RegExp('owner_id=eq\\.'+userA));
assert.deepEqual(JSON.parse(last.body),{hipotesis:'Hipótesis revisable'});
out=await use(req('GET',{id:userB,vista:'revisiones'}));
assert.equal(out.code,200);
last=calls.at(-1);assert.match(last.url,/expediente_revisiones/);assert.match(decodeURIComponent(last.url),new RegExp(userA));
out=await use(req('DELETE',{id:userB,version:'2'}));
assert.equal(out.code,200);
last=calls.at(-1);assert.equal(last.method,'DELETE');
out=await use(req('GET',{},undefined,'fakeJWT'));
assert.equal(out.code,401);
out=await use(req('GET',{id:'bad!'}));assert.equal(out.code,400);
assert.equal(expedienteContrato.analizar({titulo:'',version:3}).error,'titulo_requerido');
assert.equal(expedienteContrato.analizar({titulo:'A'.repeat(141)}).error,'campo_invalido');
console.log('Expediente cloud fail-closed: RLS SQL, token usuario, owner, version, importación y gate triple OK');
