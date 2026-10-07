import assert from 'node:assert/strict';

const url=process.env.SUPABASE_URL;
const key=process.env.SUPABASE_SERVICE_KEY;
assert.ok(url&&key,'Faltan SUPABASE_URL/SUPABASE_SERVICE_KEY');

const headers={apikey:key,Authorization:`Bearer ${key}`};
const cases=[
  {name:'IVA',q:'IVA',min:1},
  {name:'retencion',q:'retención',min:1},
  {name:'factura electronica',q:'factura electrónica',min:1},
  {name:'SIMPLE',q:'SIMPLE',min:1},
  {name:'historica identificador',q:'DIAN-OFICIO-12666-2026',min:1},
  {name:'sin resultados',q:'zzqv-no-existe-euclidian-938271',max:0}
];

function filterFor(q){
  const t=q.replace(/[(),*]/g,' ').trim();
  return encodeURIComponent(`(numero_resolucion.ilike.*${t}*,titulo.ilike.*${t}*,contenido.ilike.*${t}*,descripcion_limpia.ilike.*${t}*)`);
}

let passed=0;
for(const tc of cases){
  const endpoint=`${url}/rest/v1/v_bandeja?select=id,numero_resolucion,enlace_oficial,estado_vigencia,fecha_es_real,fecha_publicacion_web&publicado_cliente=is.true&or=${filterFor(tc.q)}&limit=10`;
  const r=await fetch(endpoint,{headers});
  assert.equal(r.ok,true,`${tc.name}: HTTP ${r.status}`);
  const rows=await r.json();
  if(tc.min!==undefined) assert.ok(rows.length>=tc.min,`${tc.name}: sin resultados`);
  if(tc.max!==undefined) assert.ok(rows.length<=tc.max,`${tc.name}: esperaba <=${tc.max}, obtuvo ${rows.length}`);
  for(const row of rows){
    assert.ok(/^https:\/\/([a-z0-9-]+\.)*dian\.gov\.co\//i.test(row.enlace_oficial||''),`${tc.name}: fuente no DIAN`);
    assert.ok(row.estado_vigencia,`${tc.name}: sin vigencia`);
  }
  console.log(`OK - ${tc.name}: ${rows.length} resultados`);
  passed++;
}
console.log(`Eval consulta datos: ${passed}/${cases.length} casos OK`);
