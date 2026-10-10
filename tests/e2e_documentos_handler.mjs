import assert from 'node:assert/strict';

assert.ok(process.env.SUPABASE_URL&&process.env.SUPABASE_SERVICE_KEY,'Faltan credenciales Supabase de CI');
process.env.EUCLIDIAN_CLAVE='ci-euclidian-local';

const {default:handler}=await import('../api/documentos.js?ci='+Date.now());

function response(){
  return {
    code:200,body:null,headers:{},
    status(n){this.code=n;return this;},
    json(v){this.body=v;return this;},
    setHeader(k,v){this.headers[k]=v;}
  };
}

async function call({key='ci-euclidian-local',query={}}={}){
  const req={headers:{'x-clave':key},query};
  const res=response();
  await handler(req,res);
  return res;
}

{
  const res=await call({key:'incorrecta'});
  assert.equal(res.code,401,'La API debe fallar cerrada cuando no existe una autorización válida');
  assert.ok(['sesion_requerida','acceso_denegado'].includes(res.body?.error),'La API debe responder con un estado de autenticación neutro');
  console.log('OK - acceso no autorizado bloqueado');
}

{
  const res=await call({query:{periodo:'todo',estado:'todos',q:'IVA',pagina:'1'}});
  assert.equal(res.code,200,`Consulta IVA devolvió HTTP ${res.code}`);
  assert.ok(Array.isArray(res.body?.documentos)&&res.body.documentos.length>0,'Consulta IVA sin resultados');
  assert.ok(res.body.total>=res.body.documentos.length,'Total incoherente');
  for(const d of res.body.documentos){
    assert.ok(/^https:\/\/([a-z0-9-]+\.)*dian\.gov\.co\//i.test(d.enlace_oficial||''),'Resultado sin fuente DIAN');
    assert.ok(d.estado_vigencia,'Resultado sin vigencia');
    assert.ok(d.fuente_raiz,'Resultado sin trazabilidad de índice');
  }
  console.log(`OK - consulta real IVA: ${res.body.documentos.length} resultados de ${res.body.total}`);
}

{
  const res=await call({query:{periodo:'todo',estado:'todos',q:'zzqv-no-existe-euclidian-938271',pagina:'1'}});
  assert.equal(res.code,200);
  assert.deepEqual(res.body.documentos,[],'Una consulta inexistente no debe inventar resultados');
  assert.equal(res.body.total,0);
  console.log('OK - ausencia de evidencia devuelve 0 resultados');
}

console.log('E2E handler documentos: 3/3 escenarios OK');
