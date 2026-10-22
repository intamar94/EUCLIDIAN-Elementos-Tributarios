import {timingSafeEqual} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {handlers} from './routes.js';
import {invokeHandler} from './adapter.js';
const aliases={'/impressum':'/api/impressum','/impressum.html':'/api/impressum','/datenschutz':'/api/datenschutz','/datenschutz.html':'/api/datenschutz','/privacidad':'/api/datenschutz'};
function privatePreview(request,env){
  if(env.EUCLIDIAN_CLOUDFLARE_MODE==='production')return false;
  const expected=env.EUCLIDIAN_PREVIEW_KEY;
  const actual=request.headers.get('x-euclidian-preview-key');
  if(!expected||!actual)return true;
  const a=Buffer.from(actual),b=Buffer.from(expected);
  return a.length!==b.length||!timingSafeEqual(a,b);
}
function secure(response,preview){
  const out=new Response(response.body,response);
  out.headers.set('X-Content-Type-Options','nosniff');
  out.headers.set('Referrer-Policy','strict-origin-when-cross-origin');
  out.headers.set('X-Frame-Options','DENY');
  out.headers.set('Permissions-Policy','camera=(), microphone=(), geolocation=()');
  if(preview){out.headers.set('X-Robots-Tag','noindex, nofollow');out.headers.set('Cache-Control','private, no-store, max-age=0');}
  return out;
}
export default {
  async fetch(request,env){
    const preview=env.EUCLIDIAN_CLOUDFLARE_MODE!=='production';
    if(privatePreview(request,env))return secure(new Response('Entorno privado de preparación.',{status:503}),true);
    const url=new URL(request.url);
    // The public Worker owns canonical routing; never redirect an authenticated
    // private preview to the public site or trust a forwarded Host header.
    if(!preview&&['euclidianet.com','www.euclidianet.com'].includes(url.hostname)&&
       (url.hostname==='www.euclidianet.com'||url.protocol!=='https:')){
      url.protocol='https:';url.hostname='euclidianet.com';url.port='';
      return secure(new Response(null,{status:308,headers:{Location:url.href}}),false);
    }
    const route=aliases[url.pathname]||url.pathname;
    if(Object.hasOwn(handlers,route))return secure(await invokeHandler(handlers[route],request),preview);
    if(url.pathname.startsWith('/api/'))return secure(Response.json({error:'ruta_no_encontrada'},{status:404}),preview);
    if(!['GET','HEAD'].includes(request.method))return secure(new Response(null,{status:405}),preview);
    // Match Vercel's existing extensionless frontend URLs without exposing repository files.
    if(url.pathname==='/')url.pathname='/index.html';
    else if(!url.pathname.split('/').pop().includes('.'))url.pathname+='.html';
    return secure(await env.ASSETS.fetch(new Request(url,request)),preview);
  }
};
