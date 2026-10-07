import assert from 'node:assert/strict';

process.env.SUPABASE_URL='https://example.supabase.co';
process.env.SUPABASE_SERVICE_KEY='service-test';
const {reclamarEventoPago,finalizarEventoPago}=await import('../lib/payment-events.js?test='+Date.now());

{
  let seen;
  global.fetch=async(url,options)=>{seen={url,options};return new Response(JSON.stringify([{id:1,proveedor:'sandbox',evento_id:'evt_1'}]),{status:201,headers:{'content-type':'application/json'}});};
  const r=await reclamarEventoPago({proveedor:'sandbox',evento_id:'evt_1',tipo:'payment.updated'});
  assert.equal(r.nuevo,true);
  assert.ok(String(seen.url).includes('on_conflict=proveedor,evento_id'));
  assert.ok(String(seen.options.headers.Prefer).includes('resolution=ignore-duplicates'));
  console.log('OK - primer webhook reclama el evento');
}
{
  global.fetch=async()=>new Response(JSON.stringify([]),{status:200,headers:{'content-type':'application/json'}});
  const r=await reclamarEventoPago({proveedor:'sandbox',evento_id:'evt_1'});
  assert.equal(r.nuevo,false);
  console.log('OK - webhook duplicado no reclama de nuevo');
}
{
  let body;
  global.fetch=async(_url,options)=>{body=JSON.parse(options.body);return new Response('',{status:204});};
  const ok=await finalizarEventoPago({proveedor:'sandbox',evento_id:'evt_1',ok:true});
  assert.equal(ok,true);assert.equal(body.estado,'procesado');assert.equal(body.error,null);
  console.log('OK - evento procesado queda cerrado');
}
console.log('Contrato pagos idempotentes: 3/3 escenarios OK');
