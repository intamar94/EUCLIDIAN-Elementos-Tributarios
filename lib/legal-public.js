/* EUCLIDIAN legal pages; never store the proprietor's address in the public source. */
const base='https://euclidianet.com';
const esc=x=>String(x??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const block=(title,text)=>'<section><h2>'+esc(title)+'</h2>'+text+'</section>';
function info(env){
 const name=String(env.EUCLIDIAN_LEGAL_NAME||'').trim();
 const address=String(env.EUCLIDIAN_LEGAL_ADDRESS||'').trim();
 const email=String(env.EUCLIDIAN_LEGAL_EMAIL||'').trim();
 const phone=String(env.EUCLIDIAN_LEGAL_PHONE||'').trim();
 const vat=String(env.EUCLIDIAN_LEGAL_VAT_ID||'').trim();
 const good=(env.EUCLIDIAN_LEGAL_APPROVED==='1'&&name.length>=5&&name.length<130
 &&address.length>=12&&address.length<450&&/(?:Deutschland|Germany)/i.test(address)
 &&/^[^\s@<>"]+@[^\s@<>"]+\.[^\s@<>"]+$/.test(email)
 &&![name,address,email].some(x=>/[{}<>]/.test(x)));
 return {good,name,address,email,phone,vat};
}
function link(email){return '<a href="mailto:'+encodeURIComponent(email)+'">'+esc(email)+'</a>';}
function layout(title,path,body){
 return '<!doctype html><html lang="es-CO"><head><meta charset="utf-8">'
 +'<meta name="viewport" content="width=device-width,initial-scale=1">'
 +'<title>'+esc(title)+' | EUCLIDIAN</title>'
 +'<meta name="description" content="Información legal de EUCLIDIAN — Elementos Tributarios">'
 +'<link rel="canonical" href="'+base+path+'">'
 +'<link rel="icon" type="image/svg+xml" href="/icono-euclidian.svg">'
 +'<link rel="stylesheet" href="/legal.css"></head>'
 +'<body><a class="skip" href="#contenido">Ir al contenido</a>'
 +'<header class="top"><div class="wrap"><a class="brand" href="/">EUCL<span>i</span>DIAN</a>'
 +'<span>Elementos Tributarios</span><a href="/app.html">Entrar</a></div></header>'
 +'<main id="contenido" class="wrap legal"><a class="back" href="/">← Volver al inicio</a>'
 +body+'</main><footer class="wrap legal-footer"><p>EUCLIDIAN es independiente de la DIAN. '
 +'Faro de Intamar es el nombre comercial del operador indicado en el Impressum.</p>'
 +'<nav aria-label="Información legal"><a href="/impressum">Impressum</a>'
 +'<a href="/datenschutz">Privacidad / Datenschutz</a><a href="/">Inicio</a></nav>'
 +'</footer></body></html>';
}
function imprint(i){
 const address=esc(i.address).replace(/\r?\n/g,'<br>');
 const id='<strong>'+esc(i.name)+'</strong><br>Handelnd unter der Geschäftsbezeichnung '
 +'<strong>Faro de Intamar</strong><br>EUCLIDIAN — Elementos Tributarios';
 let contact='<p>E-Mail: '+link(i.email)+'</p>';
 if(i.phone)contact+='<p>Teléfono / Telefon: '+esc(i.phone)+'</p>';
 const extra=i.vat?block('Umsatzsteuer-Identifikationsnummer','<p>'+esc(i.vat)+'</p>'):'';
 return layout('Impressum','/impressum',
 '<p class="kicker">IDENTIFICACIÓN DEL PRESTADOR</p><h1>Impressum</h1>'
 +'<p class="lead">Angaben gemäß § 5 Digitale-Dienste-Gesetz (DDG).</p>'
 +block('Diensteanbieter / responsable','<p>'+id+'</p>')
 +block('Ladungsfähige Anschrift / dirección','<p>'+address+'</p>')
 +block('Kontakt / contacto',contact)+extra
 +block('Sobre EUCLIDIAN','<p>EUCLIDIAN es una plataforma independiente para localizar y consultar '
 +'documentos tributarios de la DIAN de Colombia. No es un sitio oficial de la DIAN ni sustituye '
 +'la comprobación de normas originales o el asesoramiento profesional.</p>'
 +'<p>La fecha de publicación no acredita por sí sola que un criterio tributario esté vigente.</p>')
 +block('Protección de datos','<p>Consulta nuestra <a href="/datenschutz">política de privacidad</a>.</p>')
 +'<p class="ref">Base legal: <a href="https://www.gesetze-im-internet.de/ddg/__5.html" '
 +'target="_blank" rel="noopener noreferrer">§ 5 DDG</a>.</p>');
}
function privacy(i){
 const person='<strong>'+esc(i.name)+'</strong>, Faro de Intamar, '
 +esc(i.address).replace(/\r?\n/g,'<br>');
 const mail=link(i.email);
 const sections=[
 ['Responsable y contacto','<p>'+person+'. Correo para consultas de privacidad: '+mail+'.</p>'],
 ['Finalidades del tratamiento','<p>Al visitar EUCLIDIAN, el alojamiento puede procesar la dirección IP, '
 +'fecha y datos técnicos para entregar el servicio, prevenir abusos y diagnosticar fallos. '
 +'Las bases jurídicas deben evaluarse según los arts. 6.1.b y 6.1.f RGPD, '
 +'de acuerdo con el servicio solicitado y los intereses legítimos ponderados.</p>'
 +'<p>Al crear una cuenta se procesa la dirección de correo electrónico, datos de autenticación, '
 +'identificadores de usuario y estado de acceso. Estas operaciones sirven para gestionar el registro, '
 +'permitir el acceso autorizado y proteger la plataforma. El contacto con soporte implica tratar '
 +'el contenido del mensaje para responder a su solicitud.</p>'],
 ['Proveedores y transferencias internacionales','<p>El alojamiento y la entrega web utilizan '
 +'<strong>Vercel</strong>. La autenticación y el almacenamiento de información del proyecto '
 +'se apoyan en <strong>Supabase</strong>, con base de datos en la región '
 +'<strong>sa-east-1 (Brasil)</strong>. Las transferencias internacionales deberán cumplir '
 +'las garantías aplicables de los artículos 44 y siguientes del RGPD, conforme '
 +'a los contratos reales de los proveedores.</p>'
 +'<p>La interfaz carga tipografías desde <strong>Google Fonts</strong>; '
 +'el navegador se conecta con sus servidores y puede transmitir datos técnicos como la dirección IP. '
 +'La eliminación de esta carga externa está contemplada en la revisión técnica.</p>'],
 ['Almacenamiento en el dispositivo','<p>EUCLIDIAN utiliza <code>localStorage</code> '
 +'para tokens de acceso y renovación de sesión y preferencias como temas guardados. '
 +'La modalidad interna de acceso puede utilizar <code>sessionStorage</code>. '
 +'Se audita qué operaciones son estrictamente necesarias conforme al § 25 TDDDG '
 +'y cuáles, de existir, requieren consentimiento previo.</p>'],
 ['Documentación oficial y pagos','<p>Los enlaces a la DIAN conducen a sitios externos '
 +'con sus propias políticas. Los precios publicados son informativos; '
 +'la contratación pública todavía no está habilitada. Si se activan cobros, '
 +'se incorporarán los procesadores de pago y condiciones que correspondan.</p>'],
 ['Conservación y seguridad','<p>La duración de conservación depende de la finalidad, '
 +'la vigencia de la cuenta y las obligaciones legales aplicables. '
 +'Los periodos específicos para registros, soporte y eventuales datos contractuales '
 +'deben contrastarse con la configuración y los contratos efectivos de los proveedores '
 +'antes de dar la política por aprobada.</p>'],
 ['Tus derechos','<p>Dependiendo de los requisitos legales aplicables puedes solicitar acceso, '
 +'rectificación, supresión, limitación, portabilidad, oposición y retirar consentimientos. '
 +'Para ejercerlos escribe a '+mail+'. También tienes derecho a reclamar ante una autoridad '
 +'de protección de datos competente.</p>'],
 ['Clientes en Colombia','<p>Según las actividades concretas y la naturaleza de los datos, '
 +'pueden corresponder obligaciones adicionales de protección de datos y consumo en Colombia. '
 +'La aplicación y los textos deben revisarse antes de activar cobros.</p>']
 ];
 const body=sections.map(x=>block((sections.indexOf(x)+1)+'. '+x[0],x[1])).join('');
 return layout('Privacidad','/datenschutz',
 '<p class="kicker">INFORMACIÓN SOBRE DATOS PERSONALES</p>'
 +'<h1>Privacidad · Datenschutzerklärung</h1>'
 +'<p class="lead">Tratamiento de información personal en EUCLIDIAN.</p>'
 +body+'<p class="ref">Referencias: '
 +'<a href="https://eur-lex.europa.eu/eli/reg/2016/679/oj" target="_blank" rel="noopener noreferrer">RGPD</a> · '
 +'<a href="https://www.gesetze-im-internet.de/ttdsg/__25.html" target="_blank" rel="noopener noreferrer">§ 25 TDDDG</a>.</p>');
}
export function renderLegal(req,res,kind,env=process.env){
 res.setHeader('Cache-Control','no-store, max-age=0');
 res.setHeader('X-Content-Type-Options','nosniff');
 res.setHeader('Content-Security-Policy',"default-src 'none'; style-src 'self'; img-src 'self'; base-uri 'none'; frame-ancestors 'none'");
 if(req.method!=='GET'&&req.method!=='HEAD')return res.status(405).end();
 const i=info(env);
 if(!i.good){
  res.setHeader('X-Robots-Tag','noindex, nofollow');
  res.setHeader('Content-Type','text/plain; charset=utf-8');
  return res.status(503).end(req.method==='HEAD'?'':'La información legal está pendiente de verificación.');
 }
 res.setHeader('Content-Type','text/html; charset=utf-8');
 return res.status(200).end(req.method==='HEAD'?'':kind==='impressum'?imprint(i):privacy(i));
}
