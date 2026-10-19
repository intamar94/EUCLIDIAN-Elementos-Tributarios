/* EUCLIDIAN · Informes profesionales M4/1.
   DOCX creado 100 % local; vista imprimible para guardar PDF.
   Solo borradores, nunca revisión/obligación jurídica acreditada. */
(function(){
'use strict';
const OPCIONES=new Set(['tecnico','cliente']);
const textoSeguro=v=>String(v??'').replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\uFFFE\uFFFF]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g,'');
const ESCAPE=v=>textoSeguro(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const FORMATO='euclidian-expediente-v1';
const ADVERTENCIA='BORRADOR SIN REVISIÓN JURÍDICA. Las fuentes son referencias de consulta, no citas por pasaje verificadas. No confirma vigencia, derogación, cambio de doctrina, obligación ni aplicación individual. Requiere cotejo de documentos oficiales, hechos y excepciones por un profesional.';
const CORTE='Fecha de preparación (no acredita vigencia)';
function fuenteValida(v){
 try{
  const u=new URL(String(v??''));
  if(u.protocol!=='https:'||u.username||u.password||u.href.length>1600||u.port&&!['443'].includes(u.port))return '';
  return u.hostname==='dian.gov.co'||u.hostname.endsWith('.dian.gov.co')?u.href:'';
 }catch(_){return '';}
}
function extraer(exp,tipo='tecnico'){
 if(!OPCIONES.has(tipo))throw Error('Tipo de informe no permitido.');
 if(!exp||exp.formato!==FORMATO||exp.version!==1||!exp.campos||!Array.isArray(exp.fuentes))throw Error('Se requiere un expediente EUCLIDIAN válido.');
 const campos={};
 for(const [k,max] of Object.entries({titulo:140,pregunta:1800,hechos:3000,hipotesis:3000,salvedades:3000,conclusion:3000})){
  const v=exp.campos[k];
  campos[k]=typeof v==='string'?textoSeguro(v).slice(0,max).trim():'';
 }
 const fuentes=exp.fuentes.slice(0,18).map(f=>{
  const url=fuenteValida(f?.url);
  if(!url)throw Error('La referencia contiene una fuente no oficial.');
  return {url,ref:String(f.ref??'').slice(0,125),titulo:String(f.titulo??'').slice(0,190)};
 });
 const etiquetas={titulo:'Título',pregunta:'Pregunta de investigación',hechos:'Hechos',hipotesis:'Hipótesis provisional',salvedades:'Salvedades y excepciones',conclusion:'Conclusión propuesta'};
 const pendientes=Object.entries(etiquetas).filter(([k])=>!campos[k]).map(([,nombre])=>'Completar '+nombre.toLowerCase()+'.');
 if(!fuentes.length)pendientes.push('Adjuntar documentos oficiales DIAN para cotejar la investigación.');
 pendientes.push('Cotejar cada conclusión con el pasaje exacto del documento oficial.',
  'Comprobar versión, período aplicable, vigencia y excepciones.',
  'Revisar hechos, datos personales y destinatario antes de compartir.',
  'Obtener revisión profesional: completar los campos no acredita aprobación.');
 const fecha=new Date().toISOString().slice(0,10);
 const secciones=tipo==='tecnico'
 ?[
  ['Pregunta de investigación',campos.pregunta],['Hechos pendientes de cotejar',campos.hechos],
  ['Hipótesis provisional',campos.hipotesis],['Salvedades, condiciones y excepciones',campos.salvedades],
  ['Conclusión propuesta — NO APROBADA',campos.conclusion]
 ]:[
  ['Asunto que se desea aclarar',campos.pregunta],
  ['Contexto por verificar',campos.hechos],
  ['Explicación provisional para el cliente',campos.hipotesis],
  ['Qué falta comprobar',campos.salvedades],
  ['Mensaje propuesto — NO ENVIAR SIN REVISIÓN',campos.conclusion]
 ];
 return {titulo:campos.titulo||'Investigación tributaria sin título',tipo,fecha,
  etiqueta:tipo==='tecnico'?'INFORME DE INVESTIGACIÓN · BORRADOR':'COMUNICACIÓN AL CLIENTE · BORRADOR',
  secciones:secciones.map(([titulo,contenido])=>({titulo,contenido:contenido||'[Pendiente de completar y verificar]'})),
  fuentes,pendientes,advertencia:ADVERTENCIA,fechaTitulo:CORTE};
}
function html(exp,tipo='tecnico'){
 const d=extraer(exp,tipo);
 const secciones=d.secciones.map(s=>'<section><h2>'+ESCAPE(s.titulo)+'</h2><p>'+ESCAPE(s.contenido).replace(/\r?\n/g,'<br>')+'</p></section>').join('');
 const referencias=d.fuentes.length?d.fuentes.map((f,i)=>
  '<li><strong>'+String(i+1)+'. '+ESCAPE(f.ref)+'</strong><span>'+ESCAPE(f.titulo)+'</span><a href="'+ESCAPE(f.url)+'" target="_blank" rel="noopener noreferrer">'+ESCAPE(f.url)+'</a><small>Referencia para cotejo: pasaje, versión, período y excepciones por confirmar.</small></li>'
 ).join(''):'<li>No hay referencias DIAN adjuntas a este borrador.</li>';
 return '<!doctype html><html lang="es"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">'+
  '<title>EUCLIDIAN · '+ESCAPE(d.titulo)+'</title>'+
  '<style>@page{size:A4;margin:19mm 18mm}*{box-sizing:border-box}body{margin:0;color:#243d2e;background:#fffefa;font-family:Arial,sans-serif;font-size:11pt;line-height:1.55}main{max-width:820px;margin:0 auto;padding:24px}header{border-top:5px solid #315b42;padding-top:16px;border-bottom:1px solid #d6ded1;padding-bottom:18px;margin-bottom:18px}.marca{color:#41644d;font-weight:700;font-size:12px;letter-spacing:.12em}.tipo{font-size:10px;letter-spacing:.07em;color:#986c52;text-transform:uppercase;margin:11px 0}h1{font-family:Georgia,serif;font-size:27px;color:#254633;line-height:1.18;margin:8px 0;overflow-wrap:anywhere}h2{break-after:avoid;font-family:Georgia,serif;font-size:16px;margin:0 0 7px;color:#28503a}header p{color:#56695a;font-size:12px;margin:5px 0}.aviso{border-left:4px solid #ac7857;background:#f8eee1;padding:12px 14px;color:#624a3b;font-size:11px;line-height:1.55;margin-bottom:20px}section{padding:13px 0;border-bottom:1px solid #e4e9df;}section p{orphans:3;widows:3;margin:0;white-space:normal;overflow-wrap:anywhere}ol{padding-left:25px}li{padding:8px 0;overflow-wrap:anywhere;break-inside:avoid}li span,li a,li small{display:block}li a{color:#28533c;font-size:10px;word-break:break-all;margin:3px 0}li small{font-size:9px;color:#69776b}footer{font-size:10px;color:#66786a;margin-top:22px;border-top:1px solid #d6ded1;padding-top:10px}@media print{body{background:white}main{padding:0}a{color:#243d2e}section{break-inside:auto}h2{break-after:avoid}}</style>'+
  '</head><body><main><header><div class="marca">EUCLIDIAN · ELEMENTOS TRIBUTARIOS</div><p class="tipo">'+ESCAPE(d.etiqueta)+'</p><h1>'+ESCAPE(d.titulo)+'</h1><p>'+ESCAPE(d.fechaTitulo)+': '+ESCAPE(d.fecha)+' · Estado: borrador sin revisión</p></header>'+
  '<aside class="aviso" role="note"><strong>Revisión profesional obligatoria.</strong> '+ESCAPE(d.advertencia)+'</aside>'+
  '<section aria-labelledby="revision-pendiente"><h2 id="revision-pendiente">Antes de compartir este borrador</h2><ul>'+d.pendientes.map(p=>'<li>'+ESCAPE(p)+'</li>').join('')+'</ul></section>'+
  secciones+'<section><h2>Documentos de referencia DIAN (por comprobar)</h2><ol>'+referencias+'</ol></section>'+
  '<footer>Generado localmente por EUCLIDIAN. Documento de trabajo sin firma ni aprobación, no apto para envío automático a clientes.</footer></main></body></html>';
}
function xmlEscape(v){
 return textoSeguro(v).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&apos;');
}
function parrafo(v,estilo){
 const pStyle=estilo?'<w:pPr><w:pStyle w:val="'+xmlEscape(estilo)+'"/></w:pPr>':'';
 return '<w:p>'+pStyle+'<w:r>'+textoSeguro(v).split(/\r\n|\r|\n/).map(linea=>'<w:t xml:space="preserve">'+xmlEscape(linea)+'</w:t>').join('<w:br/>')+'</w:r></w:p>';
}
function crc32(bytes){
 let c=0xffffffff;
 for(const b of bytes){c^=b;for(let i=0;i<8;i++)c=c&1?(c>>>1)^0xedb88320:c>>>1;}
 return (c^0xffffffff)>>>0;
}
function construirZip(archivos){
 const te=new TextEncoder(),locales=[],centrales=[];
 let desplazamiento=0;
 const dec=(n,bytes)=>{const v=new Uint8Array(bytes);const d=new DataView(v.buffer);if(bytes===2)d.setUint16(0,n,true);else d.setUint32(0,n,true);return v;};
 const concat=(partes)=>{const len=partes.reduce((n,p)=>n+p.length,0),res=new Uint8Array(len);let pos=0;for(const p of partes){res.set(p,pos);pos+=p.length;}return res;};
 for(const [nombre,contenido] of archivos){
  const fn=te.encode(nombre),data=te.encode(contenido),crc=crc32(data);
  const cab=concat([dec(0x04034b50,4),dec(20,2),dec(0x0800,2),dec(0,2),dec(0,2),dec(0,2),
   dec(crc,4),dec(data.length,4),dec(data.length,4),dec(fn.length,2),dec(0,2),fn]);
  locales.push(cab,data);
  centrales.push(concat([dec(0x02014b50,4),dec(20,2),dec(20,2),dec(0x0800,2),dec(0,2),
   dec(0,2),dec(0,2),dec(crc,4),dec(data.length,4),dec(data.length,4),dec(fn.length,2),
   dec(0,2),dec(0,2),dec(0,2),dec(0,2),dec(0,4),dec(desplazamiento,4),fn]));
  desplazamiento+=cab.length+data.length;
 }
 const dir=concat(centrales);
 const pie=concat([dec(0x06054b50,4),dec(0,2),dec(0,2),dec(archivos.length,2),
  dec(archivos.length,2),dec(dir.length,4),dec(desplazamiento,4),dec(0,2)]);
 return concat([...locales,dir,pie]);
}
function docx(exp,tipo='tecnico'){
 const d=extraer(exp,tipo);
 let p=parrafo('EUCLIDIAN · ELEMENTOS TRIBUTARIOS','Title')+
  parrafo(d.etiqueta,'Subtitle')+parrafo(d.titulo,'Heading1')+
  parrafo(d.fechaTitulo+': '+d.fecha+' · Estado: borrador sin revisión')+
  parrafo('REVISIÓN PROFESIONAL OBLIGATORIA · '+d.advertencia,'Warning');
 p+=parrafo('Antes de compartir este borrador','Heading2');
 for(const pendiente of d.pendientes)p+=parrafo('Pendiente: '+pendiente);
 for(const s of d.secciones)p+=parrafo(s.titulo,'Heading2')+parrafo(s.contenido);
 p+=parrafo('Documentos de referencia DIAN (por comprobar)','Heading2');
 if(!d.fuentes.length)p+=parrafo('Sin referencias oficiales adjuntas.');
 for(let i=0;i<d.fuentes.length;i++){
  const f=d.fuentes[i];p+=parrafo((i+1)+'. '+f.ref+' · '+f.titulo)+parrafo(f.url)+
   parrafo('Pasaje, versión y excepciones por confirmar.');
 }
 p+=parrafo('Generado localmente por EUCLIDIAN. Documento sin firma ni aprobación.');
 const doc='<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'+
  '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
  '<w:body>'+p+'<w:sectPr><w:pgSz w:w="11906" w:h="16838"/><w:pgMar w:top="1080" w:right="1080" w:bottom="1080" w:left="1080"/></w:sectPr></w:body></w:document>';
 const styles='<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">'+
  '<w:docDefaults><w:rPrDefault><w:rPr><w:rFonts w:ascii="Arial" w:hAnsi="Arial"/><w:sz w:val="22"/><w:lang w:val="es-CO"/></w:rPr></w:rPrDefault><w:pPrDefault><w:pPr><w:spacing w:after="120"/></w:pPr></w:pPrDefault></w:docDefaults>'+
  '<w:style w:type="paragraph" w:styleId="Title"><w:name w:val="Title"/><w:rPr><w:b/><w:color w:val="254633"/><w:sz w:val="36"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Subtitle"><w:name w:val="Subtitle"/><w:rPr><w:color w:val="996B52"/><w:sz w:val="20"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Heading1"><w:name w:val="heading 1"/><w:pPr><w:keepNext/><w:outlineLvl w:val="0"/></w:pPr><w:rPr><w:b/><w:sz w:val="30"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Heading2"><w:name w:val="heading 2"/><w:pPr><w:keepNext/><w:outlineLvl w:val="1"/></w:pPr><w:rPr><w:b/><w:sz w:val="24"/></w:rPr></w:style>'+
  '<w:style w:type="paragraph" w:styleId="Warning"><w:name w:val="Warning"/><w:rPr><w:b/><w:color w:val="935638"/></w:rPr></w:style></w:styles>';
 const files=[
 ['[Content_Types].xml','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/><Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/></Types>'],
 ['_rels/.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>'],
 ['word/document.xml',doc],
 ['word/_rels/document.xml.rels','<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'],
 ['word/styles.xml',styles]
 ];
 return construirZip(files);
}
function nombreArchivo(exp,tipo='tecnico'){
 const d=extraer(exp,tipo);
 const asunto=d.titulo.normalize('NFKD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-+|-+$/g,'').slice(0,65).replace(/-+$/,'')||'sin-titulo';
 return 'euclidian-'+d.fecha+'-'+asunto+'-'+tipo+'-borrador.docx';
}
function descargarWord(exp,tipo='tecnico'){
 const bytes=docx(exp,tipo);
 const archivo=new Blob([bytes],{type:'application/vnd.openxmlformats-officedocument.wordprocessingml.document'});
 const url=URL.createObjectURL(archivo);
 try{
  const a=document.createElement('a');a.href=url;a.download=nombreArchivo(exp,tipo);
  document.body.appendChild(a);a.click();a.remove();
 }finally{setTimeout(()=>URL.revokeObjectURL(url),1000);}
}
function abrirPDF(exp,tipo='tecnico'){
 const source=html(exp,tipo),dlg=document.getElementById('euInformePreview')||document.createElement('dialog');
 dlg.setAttribute('aria-label','Vista previa del informe profesional, borrador sin aprobación');
 if(!dlg.id){
  dlg.id='euInformePreview';dlg.className='eu-informe-dialog';
  dlg.innerHTML='<div class="eu-informe-toolbar"><div><strong>Vista previa · Informe no aprobado</strong><small>Imprime o elige «Guardar como PDF» en tu dispositivo.</small></div><button type="button" data-inf-imprimir>Imprimir / PDF</button><button type="button" data-inf-cerrar aria-label="Cerrar vista previa">Cerrar</button></div><iframe id="euInformeMarco" sandbox="allow-same-origin allow-modals" title="Vista previa del informe profesional"></iframe>';
  document.body.appendChild(dlg);
  dlg.addEventListener('click',e=>{
   if(e.target.closest('[data-inf-cerrar]')){dlg.close();return;}
   if(e.target.closest('[data-inf-imprimir]')){const frame=dlg.querySelector('iframe');frame.contentWindow?.focus();frame.contentWindow?.print();}
  });
 }
 dlg.querySelector('#euInformeMarco').srcdoc=source;
 if(!dlg.open)dlg.showModal();
}
function limpiar(){
 if(typeof document==='undefined')return;
 const dlg=document.getElementById('euInformePreview');
 const marco=document.getElementById('euInformeMarco');
 if(marco){marco.srcdoc='';marco.removeAttribute('src');marco.remove();}
 if(dlg){if(dlg.open)dlg.close();dlg.remove();}
}
window.EuclidianInformes={extraer,html,docx,fuenteValida,nombreArchivo,descargarWord,abrirPDF,limpiar};
})();