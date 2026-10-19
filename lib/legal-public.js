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
 ['Responsable y contacto','<p>'+person+'. Contacto para consultas y derechos de privacidad: '+mail+'.</p>'],
 ['Estado actual de EUCLIDIAN','<p>EUCLIDIAN está en preparación. El registro, el acceso de usuarios externos, '
 +'las suscripciones, los cobros y el envío de aportes están desactivados. '
 +'No es necesario crear una cuenta ni facilitar datos de pago para contactar con la responsable. '
 +'La información de esta página describe esta fase; se actualizará antes de habilitar nuevos tratamientos.</p>'],
 ['Visitas y seguridad técnica','<p>El alojamiento y la protección de acceso de <strong>Vercel</strong> '
 +'pueden tratar la dirección IP, la fecha y hora, la ruta solicitada, el navegador y datos técnicos '
 +'para entregar la página, controlar el acceso y diagnosticar incidencias. La base jurídica es '
 +'el interés legítimo en mantener un sitio operativo y seguro (art. 6.1.f RGPD). '
 +'Si una ruta conduce al inicio de sesión de Vercel, ese proveedor trata la identificación '
 +'según su propia <a href="https://vercel.com/legal/privacy-notice" target="_blank" rel="noopener noreferrer">información de privacidad</a>.</p>'],
 ['Contacto por correo','<p>Cuando escribes a '+mail+' se tratan tu dirección de correo y el contenido '
 +'que decidas enviar para responder y gestionar la consulta. Para solicitudes relacionadas con una futura '
 +'contratación se aplica el art. 6.1.b RGPD; para otras consultas, el interés legítimo en atenderlas '
 +'conforme al art. 6.1.f RGPD. No envíes contraseñas, declaraciones tributarias ni datos de terceros.</p>'
 +'<p>El correo del dominio utiliza <strong>Cloudflare Email Routing</strong> para reenviar los mensajes '
 +'a la cuenta de correo de la responsable en <strong>Gmail (Google)</strong>. '
 +'El enlace de contacto abre tu aplicación de correo; por sí solo no envía un mensaje.</p>'],
 ['Proveedores y transferencias','<p><strong>Vercel</strong> proporciona alojamiento y protección de acceso; '
 +'<strong>Cloudflare</strong>, servicios de dominio y reenvío de correo; '
 +'<strong>Google</strong>, la recepción y gestión del correo de contacto. '
 +'Estos servicios pueden implicar tratamiento fuera del Espacio Económico Europeo. '
 +'Los proveedores describen sus destinos y mecanismos de transferencia en sus documentos de privacidad y tratamiento: '
 +'<a href="https://vercel.com/legal/dpa" target="_blank" rel="noopener noreferrer">Vercel</a>, '
 +'<a href="https://www.cloudflare.com/privacypolicy/" target="_blank" rel="noopener noreferrer">Cloudflare</a> y '
 +'<a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer">Google</a>. '
 +'Puedes solicitar a la responsable información sobre las garantías aplicables a tu consulta.</p>'
 +'<p>La infraestructura interna de <strong>Supabase</strong> está configurada con base de datos en '
 +'<strong>Brasil (sa-east-1)</strong>. La plataforma mantiene cerrado el alta de usuarios externos. '
 +'Antes de abrirla se actualizará este aviso con el flujo de cuentas, destinatarios y garantías de '
 +'transferencia que correspondan al servicio habilitado.</p>'],
 ['Almacenamiento en el dispositivo','<p>El acceso interno utiliza <code>localStorage</code> para la sesión '
 +'y preferencias y puede utilizar <code>sessionStorage</code> para el acceso de la pestaña. '
 +'Los datos de sesión se usan para el acceso solicitado y las medidas de seguridad, '
 +'conforme a la excepción de necesidad del § 25.2 TDDDG cuando se cumplen sus requisitos. '
 +'La selección de temas y documentos guardados permanece en ese navegador hasta que se elimine. '
 +'Puedes borrar esos datos desde los ajustes del navegador; hacerlo cierra la sesión y elimina preferencias.</p>'
 +'<p>Esta versión no carga tipografías desde <strong>Google Fonts</strong>. '
 +'No incorpora scripts de publicidad ni de analítica de audiencia. '
 +'Las cookies propias de la pantalla de acceso de un proveedor se explican en su aviso correspondiente.</p>'],
 ['Conservación','<p>Los mensajes de contacto se conservan mientras sea necesario para responder y completar '
 +'el seguimiento de la consulta. Una vez concluida esa finalidad, se eliminan, salvo que deban '
 +'conservarse por una obligación legal o para formular, ejercer o defender reclamaciones; '
 +'en ese caso se mantienen únicamente para esa finalidad y durante el plazo que corresponda. '
 +'Este criterio no implica un borrado automático en una fecha fija.</p>'
 +'<p>La disponibilidad de los registros técnicos depende del producto y la configuración del proveedor. '
 +'El plazo de visualización de logs de ejecución no equivale a la eliminación de todos los registros '
 +'de seguridad del proveedor. Para los datos almacenados en tu navegador, la conservación depende '
 +'de la sesión y de la eliminación local descritas arriba.</p>'],
 ['Tus derechos','<p>En los casos previstos por el RGPD puedes solicitar acceso, rectificación, supresión, '
 +'limitación, portabilidad y oposición, incluida la oposición al tratamiento basado en intereses legítimos '
 +'por motivos relacionados con tu situación particular. Si un tratamiento se basa en consentimiento, '
 +'puedes retirarlo sin afectar a su licitud anterior. Escribe a '+mail+'.</p>'
 +'<p>Puedes reclamar ante una autoridad de protección de datos, en particular la de tu residencia, '
 +'lugar de trabajo o lugar de la presunta infracción. En Hessen: '
 +'<a href="https://datenschutz.hessen.de/" target="_blank" rel="noopener noreferrer">'
 +'Der Hessische Beauftragte für Datenschutz und Informationsfreiheit</a>.</p>'],
 ['Datos necesarios y decisiones automáticas','<p>Contactar es voluntario; sin una dirección de respuesta '
 +'y el contenido necesario no podemos atender la consulta. En esta fase no se utiliza el contacto '
 +'para decisiones automatizadas con efectos jurídicos ni para elaborar perfiles comerciales. '
 +'Los enlaces a la DIAN llevan a sitios externos con sus propias condiciones de privacidad.</p>']
 ];
 const body=sections.map((x,n)=>block((n+1)+'. '+x[0],x[1])).join('');
 return layout('Privacidad','/datenschutz',
 '<p class="kicker">INFORMACIÓN SOBRE DATOS PERSONALES</p>'
 +'<h1>Privacidad · Datenschutzerklärung</h1>'
 +'<p class="lead">Información para la fase de preparación de EUCLIDIAN. Actualizada el 19 de octubre de 2026.</p>'
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
