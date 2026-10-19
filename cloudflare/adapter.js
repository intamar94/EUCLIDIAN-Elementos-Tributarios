import {Buffer} from 'node:buffer';
const MAX_BODY=262144;
export async function invokeHandler(handler,request){
  const url=new URL(request.url);
  let size=0;const chunks=[];
  if(request.body){
    const reader=request.body.getReader();
    try{
      for(;;){const {done,value}=await reader.read();if(done)break;size+=value.byteLength;
        if(size>MAX_BODY){await reader.cancel();return Response.json({error:'payload_demasiado_grande'},{status:413});}
        chunks.push(Buffer.from(value));
      }
    }finally{reader.releaseLock();}
  }
  const raw=Buffer.concat(chunks);
  let body;
  if(url.pathname!=='/api/payment-webhook'&&raw.length){
    const type=request.headers.get('content-type')||'';
    try{
      if(type.includes('application/json'))body=JSON.parse(raw.toString('utf8'));
      else if(type.includes('application/x-www-form-urlencoded'))body=Object.fromEntries(new URLSearchParams(raw.toString('utf8')));
      else return Response.json({error:'content_type_no_soportado'},{status:415});
    }catch{return Response.json({error:'json_invalido'},{status:400});}
  }
  const req={method:request.method,url:url.pathname+url.search,headers:Object.fromEntries(request.headers),
    query:Object.assign(Object.create(null),Object.fromEntries(url.searchParams)),body,
    async *[Symbol.asyncIterator](){if(raw.length)yield raw;}};
  const headers=new Headers({'Cache-Control':'private, no-store, max-age=0'});
  let status=200,payload=null,ended=false;
  const res={
    setHeader(key,value){headers.set(key,String(value));return res;},
    status(value){status=value;return res;},
    json(value){headers.set('Content-Type','application/json; charset=utf-8');payload=JSON.stringify(value);ended=true;return res;},
    send(value){if(typeof value==='object'&&!Buffer.isBuffer(value))return res.json(value);payload=value;ended=true;return res;},
    end(value=null){payload=value;ended=true;return res;}
  };
  try{await handler(req,res);}catch{return Response.json({error:'servicio_no_disponible'},{status:500,headers});}
  if(!ended)return Response.json({error:'respuesta_no_disponible'},{status:500,headers});
  return new Response(request.method==='HEAD'||[204,304].includes(status)?null:payload,{status,headers});
}
