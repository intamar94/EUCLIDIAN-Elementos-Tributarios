import assert from 'node:assert/strict';
process.env.SUPABASE_URL='https://test.invalid';
process.env.SUPABASE_SERVICE_KEY='test-only';
process.env.EUCLIDIAN_CLAVE='test-only';
const {default:handler}=await import('../api/documentos.js');
const documents=Array.from({length:30},(_,i)=>({id:`doc-${i}`,numero_resolucion:`DIAN-TEST-${i}-${new Date().getUTCFullYear()}`,fecha_publicacion_web:new Date().toISOString().slice(0,10),enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/test.htm',temas:[],tipo_documento:'concepto'}));
let usage=0;
globalThis.fetch=async(url,opts={})=>{
 const u=new URL(url);let body;
 if(u.pathname.endsWith('/v_bandeja'))body=documents;
 else if(u.pathname.endsWith('/documentos_tributarios'))body=documents.map(d=>({id:d.id,texto_completo:'Publicación en la DIAN: '+ 'Prueba documental '.repeat(30)}));
 else if(u.pathname.endsWith('/revisor_fiscal_euclidian_evaluaciones'))body=[];
 else if(u.pathname.endsWith('/metadatos_catalogo_cliente'))body={temas:[],anios:[]};
 else {usage++;throw Error('Unexpected request '+url);}
 return new Response(JSON.stringify(body),{headers:{'content-type':'application/json','content-range':'0-29/30'}});
};
async function call(query,key='test-only'){const res={code:200,setHeader(){},status(n){this.code=n;return this;},json(v){this.body=v;return this;}};await handler({method:'GET',query,headers:{'x-clave':key}},res);return res;}
let r=await call({estado:'nuevos',periodo:'todo',resumen:'1'});assert.equal(r.code,200);assert.equal(r.body.total,30,'El resumen incluye más de una página');assert.equal('documentos' in r.body,false,'El resumen no entrega fichas ni sirve para eludir medición');assert.equal(usage,0);
r=await call({estado:'nuevos',periodo:'todo',pagina:'2'});assert.equal(r.body.total,30);assert.equal(r.body.documentos.length,5);assert.ok(r.body.documentos.every(d=>d.consulta_documental&&!d.tesis_juridica));
r=await call({resumen:'1'},'incorrecta');assert.equal(r.code,401);
console.log('OK resumen global: total de 30, segunda página de 5, salida mínima, aprobación y autenticación conservadas');
