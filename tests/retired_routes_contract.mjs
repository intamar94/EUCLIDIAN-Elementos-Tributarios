import assert from 'node:assert/strict';
import fs from 'node:fs';
process.env.SUPABASE_URL='https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY='test-service';
process.env.EUCLIDIAN_CLAVE='old-internal';
process.env.EUCLIDIAN_REVISOR_CLAVE='old-review-key';
let calls=0;global.fetch=async()=>{calls++;throw new Error('Una ruta retirada no debe llamar la base');};
for(const route of ['decidir','inspector']){
 const {default:handler}=await import(`../api/${route}.js`);
 const res={status(n){this.code=n;return this;},json(body){this.body=body;return this;},setHeader(){}};
 await handler({method:route==='decidir'?'POST':'GET',headers:{'x-clave':'old-review-key'},body:{decision:'aprobar',id:'doc',resumen:'nuevo criterio'}},res);
 assert.equal(res.code,410);assert.equal(res.body.error,'ruta_retirada');
}
assert.equal(calls,0);
for(const file of ['bandeja.js','bloques.js'])assert.equal(fs.readFileSync(file,'utf8').includes('/api/decidir'),false);
assert.equal(fs.existsSync('inspector.html'),false);
console.log('Rutas retiradas: ni aprueban, ni consultan ni muestran un inspector antiguo');
