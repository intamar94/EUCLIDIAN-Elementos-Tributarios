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
  const start=Date.now();
  const res=await call({query:{periodo:'todo',estado:'todos',orden:'recientes',pagina:'1'}});
  assert.equal(res.code,200,'La entrada sin filtros debe cargar el catálogo real');
  assert.equal(res.body.documentos.length,25);
  console.log(`OK - entrada real sin filtros: ${res.body.documentos.length} documentos en ${Date.now()-start} ms`);
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

{
  // Detecta una ficha presente en la base que se pierda al pasar por el handler.
  const headers={apikey:process.env.SUPABASE_SERVICE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_KEY}`};
  const raw=await fetch(`${process.env.SUPABASE_URL}/rest/v1/documentos_tributarios?select=id,numero_resolucion,fecha_publicacion_web&publicado_cliente=is.true&fecha_publicacion_web=not.is.null&order=fecha_publicacion_web.desc,numero_resolucion.desc&limit=1`,{headers});
  assert.equal(raw.ok,true);
  const [latest]=await raw.json();assert.ok(latest,'Catálogo sin publicaciones con fecha web');
  const res=await call({query:{doc:latest.id}});
  assert.equal(res.code,200);assert.equal(res.body.documentos[0]?.id,latest.id);
  assert.equal(res.body.documentos[0].fecha_publicacion_web,latest.fecha_publicacion_web,'El handler descartó la fecha oficial más reciente');
  const cutoff=new Date();cutoff.setUTCDate(cutoff.getUTCDate()-14);
  if(latest.fecha_publicacion_web>=cutoff.toISOString().slice(0,10)){
    const news=await call({query:{periodo:'todo',estado:'nuevos'}});
    const summary=await call({query:{periodo:'todo',estado:'nuevos',resumen:'1'}});
    assert.equal(news.code,200);assert.equal(summary.code,200);
    assert.ok(news.body.documentos.some(d=>d.id===latest.id),'La publicación más reciente no aparece en Novedades');
    assert.equal(summary.body.total,news.body.total,'Inicio y Novedades discrepan');
  }
  console.log(`OK - última publicación visible de extremo a extremo: ${latest.numero_resolucion}, web ${latest.fecha_publicacion_web}`);
}

{
  const headers={apikey:process.env.SUPABASE_SERVICE_KEY,Authorization:`Bearer ${process.env.SUPABASE_SERVICE_KEY}`};
  const raw=await fetch(`${process.env.SUPABASE_URL}/rest/v1/v_bandeja?select=id,numero_resolucion,fecha_orden_documental&publicado_cliente=is.true&order=fecha_orden_documental.desc.nullslast,numero_resolucion.desc&limit=1`,{headers});
  assert.equal(raw.ok,true);const [latest]=await raw.json();assert.ok(latest);
  const res=await call({query:{periodo:'todo',estado:'todos',orden:'recientes'}});
  assert.equal(res.code,200);assert.equal(res.body.documentos[0]?.id,latest.id,'Lo más reciente debe ordenar por publicación DIAN, con fecha del acto como alternativa');
  console.log(`OK - orden real de publicación: ${latest.numero_resolucion}, ${latest.fecha_orden_documental}`);
}

console.log('E2E handler documentos: 6/6 escenarios OK');
