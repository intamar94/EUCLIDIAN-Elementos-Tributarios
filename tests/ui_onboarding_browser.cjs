const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
for(const width of [390,1440]){
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{localStorage.setItem('euclidian_access_token','test-only');localStorage.setItem('euclidian_expires_at',String(Date.now()/1000+3600));});
 const doc={id:'11111111-1111-4111-8111-111111111111',numero_resolucion:'DIAN-TEST-1-2026',titulo:'Documento simulado para revisar la interfaz',tipo_documento:'resolucion',descripcion_limpia:'Ejemplo de prueba visual. No representa información tributaria real.',temas:['iva'],enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/tributario.html',consulta_documental:true,estado_vigencia:'desconocido',modifica_a:Array.from({length:7},(_,i)=>({numero:`Relación de prueba ${i+1}`,enlace:'https://normograma.dian.gov.co/dian/compilacion/tributario.html'}))};
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(u.pathname==='/api/documentos')body=u.searchParams.get('resumen')?{total:42}:{documentos:[doc],total:1,pagina:1,paginas:1,porPagina:25,temas:['iva'],anios:[{anio:2026,total:1}]};else if(u.pathname==='/api/session')body={user:{id:'test-user',email:'prueba@example.com'},profile:{},access:{permitido:true,estado:'activo',plan_codigo:'individual'}};else if(u.pathname==='/api/plans')body={plans:[],billing_enabled:false};else if(u.pathname==='/api/usage')body={};await route.fulfill({json:body});});
 await page.goto(`${process.env.UI_BASE_URL||'http://127.0.0.1:8765'}/app.html`);await page.locator('#bienvenida').waitFor({state:'visible'});await page.locator('#novedadesGlobalesEstado').filter({hasText:'42'}).waitFor();
 assert.equal(await page.locator('#guiaProgreso').textContent(),'Paso 1 de 5');
 for(let i=0;i<4;i++)await page.locator('#guiaSiguiente').click();assert.equal(await page.locator('#guiaSiguiente').textContent(),'Terminar guía');await page.locator('#guiaSiguiente').click();assert.equal(await page.locator('#bienvenida').isVisible(),false);
 await page.locator('#abrirGuia').click();assert.equal(await page.locator('#guiaProgreso').textContent(),'Paso 1 de 5');await page.locator('#saltarGuia').click();
 await page.locator('#consulta').fill('prueba');await page.locator('#formBuscar button').click();await page.waitForFunction(()=>!document.querySelector('#lista').getAttribute('aria-busy')||document.querySelector('#lista').getAttribute('aria-busy')==='false');
 await page.locator('#navInicio').click();await page.waitForFunction(()=>document.querySelector('#consulta').value==='');assert.equal(await page.locator('#selTema').inputValue(),'');assert.equal(await page.locator('#selOrden').inputValue(),'recientes');
 await page.locator('.timeline-mas summary').click();assert.equal(await page.locator('.timeline-mas li').count(),2);
 await page.locator('#abrirGuia').click();await page.screenshot({path:`/tmp/euclidian-${width}.png`,fullPage:true});
 const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth);assert.equal(overflow,false,'Horizontal overflow '+width);
 const small=await page.locator('.estado-clave-item small').first().evaluate(e=>parseFloat(getComputedStyle(e).fontSize));assert.ok(small>=12);
 await page.locator('#saltarGuia').click();await page.reload();await page.locator('#hoy').waitFor({state:'visible'});assert.equal(await page.locator('#bienvenida').isVisible(),false);
 await page.evaluate(()=>window.euclidianAuthExpirada());assert.equal(await page.locator('#bienvenida').isVisible(),false);assert.equal(await page.locator('#novedadesGlobales').isVisible(),false);assert.equal(await page.locator('#puerta').isVisible(),true);
 assert.deepEqual(errors,[]);console.log(`OK ${width}px: guía, pasos, reabrir, persistencia, filtros, relaciones, resumen, logout, sin desbordamiento ni errores JS`);await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
