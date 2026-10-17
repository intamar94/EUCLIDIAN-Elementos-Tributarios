import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';

// Contrato automatizado de las correcciones detectadas por la auditoría.
const read=path=>readFileSync(new URL('../'+path,import.meta.url),'utf8');
const cartas=read('fichas.js'), auth=read('auth.js');
const portada=read('index.html'), acceso=read('app.html');
const robots=read('robots.txt'), sitemap=read('sitemap.xml');

class FechaFija extends Date {
  constructor(...args){super(...(args.length?args:['2026-10-17T02:00:00.000Z']));}
}
const fechas={Date:FechaFija,Intl,console};
vm.createContext(fechas);
vm.runInContext(cartas,fechas,{filename:'fichas.js'});
assert.equal(fechas.fechaDePlazo('hasta el 31 de febrero de 2026'),null,'No convertir fechas imposibles');
assert.equal(fechas.fechaDePlazo('hasta el 31 de abril de 2026'),null,'Abril no tiene 31 días');
assert.equal(fechas.fechaDePlazo('hasta el 29 de febrero de 2025'),null,'No bisiesto');
assert.equal(fechas.fechaDePlazo('hasta el 29 de febrero de 2024')?.toISOString(),'2024-02-29T00:00:00.000Z');
assert.equal(fechas.diasHasta(fechas.fechaDePlazo('hasta el 16 de octubre de 2026')),0,
  'Las 02:00 UTC del día 17 todavía son 16 de octubre en Bogotá');
assert.equal(fechas.diasHasta(fechas.fechaDePlazo('hasta el 17 de octubre de 2026')),1);
console.log('OK: fechas civiles reales y cómputo colombiano sin dependencia del huso del visitante');

const serverSource=read('api/documentos.js')
  .replace(/^import .+;$/gm,'')
  .replace('export default async function handler','async function handler');
const servidor={Date:FechaFija,Intl,process:{env:{}},AbortController,console,setTimeout,clearTimeout};
vm.createContext(servidor);
vm.runInContext(serverSource,servidor,{filename:'api/documentos.js'});
assert.equal(servidor.fechaHoyColombia(),'2026-10-16');
assert.equal(servidor.fechaCorteNovedades(),'2026-10-02');
assert.equal(servidor.fechaReciente('2026-10-16'),true);
assert.equal(servidor.fechaReciente('2026-10-17'),false,'Un día futuro en Bogotá no es novedad');
assert.equal(servidor.fechaCivilValida('2025-02-29'),false,'Un año no bisiesto no tiene 29 de febrero');
assert.equal(servidor.fechaCivilValida('2024-02-29'),true,'Un día bisiesto real es válido');
assert.equal(servidor.fechaDocumentoCoherente({numero_resolucion:'DIAN-TEST-1-2026',fecha_es_real:true,fecha_publicacion:'2026-04-31'}),false,'El acto con fecha imposible no acredita novedad');
class FechaMarzo extends Date {
  constructor(...args){super(...(args.length?args:['2026-03-03T12:00:00.000Z']));}
}
const marzo={Date:FechaMarzo,Intl,process:{env:{}},AbortController,console,setTimeout,clearTimeout};
vm.createContext(marzo);
vm.runInContext(serverSource,marzo,{filename:'api/documentos.js'});
assert.equal(marzo.fechaReciente('2026-02-28'),true,'Una fecha válida dentro de la ventana se conserva');
assert.equal(marzo.fechaReciente('2026-02-31'),false,'Una fecha imposible dentro de la ventana no es novedad');
console.log('OK: ventana API de novedades coherente con el calendario colombiano');

// Ejecutar el JavaScript real de ingreso con un DOM mínimo y comprobar teclado.
const elementos=new Map();
function elemento(id){
  if(!elementos.has(id))elementos.set(id,{
    id,hidden:false,tabIndex:0,value:'',dataset:{},textContent:'',
    attrs:{},listeners:{},focused:false,
    setAttribute(k,v){this.attrs[k]=v;},
    addEventListener(k,fn){this.listeners[k]=fn;},
    focus(){this.focused=true;}
  });
  return elementos.get(id);
}
const browser={
  window:{addEventListener(){}},
  document:{getElementById:elemento,addEventListener(){}},
  location:{hash:'',search:''},
  URLSearchParams,Date,Intl,console,setTimeout,clearTimeout,
  localStorage:{getItem(){return null;},setItem(){},removeItem(){}}
};
vm.createContext(browser);
vm.runInContext(auth,browser,{filename:'auth.js'});
const tecla=(id,key)=>{
  let prevented=false;
  const callback=elemento(id).listeners.keydown;
  assert.equal(typeof callback,'function','Hay manejador de teclado en '+id);
  callback({key,preventDefault(){prevented=true;}});
  return prevented;
};
// El teclado y la URL no pueden abrir el registro mientras está cerrado.
assert.equal(tecla('tabEntrar','ArrowRight'),true);
assert.equal(elemento('tabCrear').attrs['aria-selected'],'false');
assert.equal(elemento('tabCrear').tabIndex,-1);
assert.equal(elemento('tabEntrar').attrs['aria-selected'],'true');
assert.equal(elemento('authRegisterForm').hidden,true);
assert.equal(elemento('authLoginForm').hidden,false);
assert.equal(tecla('tabCrear','Home'),true);
assert.equal(tecla('tabEntrar','End'),true);
assert.equal(tecla('tabCrear','ArrowLeft'),true);
assert.equal(elemento('tabEntrar').attrs['aria-selected'],'true');
assert.equal(tecla('tabEntrar','Escape'),false);
assert.match(acceso, /id="authLoginForm"[^>]*role="tabpanel"/);
assert.match(acceso, /id="authRegisterForm"[^>]*hidden inert/);
assert.match(acceso, /id="tabCrear"[^>]*hidden disabled/);
console.log('OK: ingreso accesible por teclado, foco y ARIA');

// Comprobaciones SEO técnicas de la página pública; no sustituyen Search Console.
const canonical=portada.match(/<link rel="canonical" href="([^"]+)"/)?.[1];
const title=portada.match(/<title>([^<]+)<\/title>/)?.[1]||'';
const description=portada.match(/<meta name="description" content="([^"]+)"/)?.[1]||'';
assert.ok(canonical?.startsWith('https://'));
assert.equal(canonical,'https://euclidianet.com/','El canonical apunta al dominio propio');
assert.ok(title.length>=35&&title.length<=75,'Título descriptivo');
assert.ok(description.length>=110&&description.length<=180,'Meta descripción útil');
assert.ok(portada.includes('<meta name="robots" content="index,follow">'));
assert.ok(acceso.includes('<meta name="robots" content="noindex,nofollow">'));
assert.equal((portada.match(/<h1(?:\s|>)/g)||[]).length,1,'H1 principal único');
assert.ok(portada.includes('application/ld+json'),'Datos estructurados');
assert.match(portada, /property="og:site_name"/);
assert.ok(portada.includes('<meta property="og:url" content="'+canonical+'">'));
assert.ok(portada.includes('<meta property="og:image" content="'+canonical+'euclides.png">'));
assert.match(portada, /name="twitter:image"/);
assert.ok(sitemap.includes('<loc>'+canonical+'</loc>'),'Sitemap y canonical iguales');
assert.ok(robots.includes('Sitemap: '+canonical+'sitemap.xml'));
assert.ok(robots.includes('Disallow: /api/'));
assert.ok(portada.indexOf('<figure class="hero-visual">') < portada.indexOf('<div class="hero-copy">'));
assert.ok(!portada.includes('class="eu-hero-gif"'));
console.log('OK: SEO técnico básico, metadatos sociales e identidad visual de portada');

// El cliente nunca lleva credenciales de servicio ni revela el catálogo sin pasar por API.
assert.ok(!acceso.includes('SUPABASE_SERVICE_KEY'));
assert.ok(!portada.includes('SUPABASE_SERVICE_KEY'));
console.log('Auditoría focalizada: 3 grupos de pruebas completados.');
