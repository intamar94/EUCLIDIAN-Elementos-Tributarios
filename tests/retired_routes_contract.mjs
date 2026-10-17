import assert from 'node:assert/strict';
import fs from 'node:fs';
const api=fs.readdirSync('api').filter(x=>x.endsWith('.js'));
assert.ok(api.length<=12,'Máximo Vercel Hobby: 12 funciones, actual='+api.length);
for(const route of ['decidir','inspector']){
 assert.equal(fs.existsSync('api/'+route+'.js'),false,'Ruta retirada no debe desplegarse: '+route);
 for(const file of ['bandeja.js','bloques.js','app.html']){
  assert.equal(fs.readFileSync(file,'utf8').includes('/api/'+route),false,'Sin frontend obsoleto: '+route);
 }
}
const vercel=JSON.parse(fs.readFileSync('vercel.json','utf8'));
for(const route of ['decidir','inspector']){
 assert.ok(!(vercel.rewrites||[]).some(r=>r.source==='/api/'+route),'Ningún rewrite restaura la ruta retirada');
}
assert.equal(fs.existsSync('inspector.html'),false);
console.log('Rutas retiradas definitivamente: sin autorización, sin endpoints ni links; máximo 12 funciones Vercel OK');
