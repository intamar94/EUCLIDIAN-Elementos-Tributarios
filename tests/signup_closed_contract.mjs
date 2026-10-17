import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import handler from '../api/auth.js';

const read=(file)=>readFileSync(new URL('../'+file,import.meta.url),'utf8');
function response(){
 return {statusCode:200,headers:{},body:null,
  setHeader(k,v){this.headers[k]=v;return this},
  status(code){this.statusCode=code;return this},
  json(body){this.body=body;return this},
  end(text=''){this.body=text;return this}};
}
const oldEnv=process.env.EUCLIDIAN_SIGNUP_ENABLED;
const oldURL=process.env.SUPABASE_URL;
const oldKey=process.env.SUPABASE_PUBLISHABLE_KEY;
try {
 process.env.SUPABASE_URL='https://example.supabase.co';
 process.env.SUPABASE_PUBLISHABLE_KEY='not-a-secret-test';
 for(const v of [undefined,'false','0','TRUE']){
  if(v===undefined)delete process.env.EUCLIDIAN_SIGNUP_ENABLED;
  else process.env.EUCLIDIAN_SIGNUP_ENABLED=v;
  const res=response();
  await handler({method:'POST',body:{action:'signup',email:'person@example.test',password:'some-password'}},res);
  assert.equal(res.statusCode,403,'Signup must fail closed for '+String(v));
  assert.equal(res.body?.error,'registro_cerrado');
  assert.equal(res.headers['Cache-Control'],'no-store');
 }
}finally{
 for(const [k,v] of [['EUCLIDIAN_SIGNUP_ENABLED',oldEnv],['SUPABASE_URL',oldURL],['SUPABASE_PUBLISHABLE_KEY',oldKey]]) {
  if(v===undefined)delete process.env[k];else process.env[k]=v;
 }
}
const portada=read('index.html');
const app=read('app.html');
const auth=read('auth.js');
assert.ok(!portada.includes('/app.html?registro=1'));
assert.ok(portada.includes('contacto@euclidianet.com'));
assert.match(app,/id="tabCrear"[^>]*hidden disabled/);
assert.match(app,/id="authRegisterForm"[^>]*hidden inert/);
assert.match(auth,/registro de nuevos usuarios está cerrado/);
assert.match(auth,/authRecuperacionDesdeHash\(\)/);
console.log('LEGAL.ia: signup API fails closed; app hides signup; login and recovery preserved');
