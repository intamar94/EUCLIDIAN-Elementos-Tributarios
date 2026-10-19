const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [360,1180]){
  const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'}),page=await context.newPage(),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await context.addInitScript(()=>{localStorage.setItem('euclidian_access_token','test-only');localStorage.setItem('euclidian_expires_at',String(Date.now()/1000+3600));localStorage.setItem('euclidian_guia_inicio_v1','completada');});
  await page.route('**/api/**',async route=>{
   const path=new URL(route.request().url()).pathname;
   const body=path==='/api/session'?{user:{id:'test-user',email:'test@example.com'},access:{permitido:true,estado:'activo',plan_codigo:'individual'}}:path==='/api/documentos'?{documentos:[],total:0,pagina:1,paginas:1,porPagina:25,temas:['iva'],anios:[]}:path==='/api/plans'?{planes:[],billing_enabled:false}:{};
   await route.fulfill({json:body});
  });
  await page.goto((process.env.UI_BASE_URL||'http://127.0.0.1:8765')+'/app.html');
  await page.locator('#inicioPanel').waitFor({state:'visible'});await page.locator('#navExplorar').click();
  await page.locator('#carteraFormulario input[value="iva"]').check();await page.locator('#carteraFormulario button[type="submit"]').click();
  assert.equal(await page.locator('.cartera-lista li').count(),1);
  await page.locator('#labTabAgenda').click();await page.locator('#agendaTarea').fill('Revisar una fuente de prueba');await page.locator('#agendaFecha').fill('2026-10-25');await page.locator('#agendaReferencia').fill('Fuente de ejercicio');await page.locator('#agendaUrl').fill('https://www.dian.gov.co/');await page.locator('#agendaFormulario button').click();
  assert.equal(await page.locator('.agenda-lista li').count(),1);await page.locator('#agendaTarea').fill('Borrador que debe borrarse al salir');
  await page.locator('#labTabExogena').click();
  const example=await page.evaluate(()=>window.EuclidianExogena.ejemplo);
  await page.locator('#exogenaPanel input[type="file"]').setInputFiles({name:'ejercicio.csv',mimeType:'text/csv',buffer:Buffer.from(example)});
  await page.locator('[data-exogena-estado]').filter({hasText:'sin errores estructurales'}).waitFor();
  await page.locator('#labTabAsistente').click();await page.locator('#asistentePregunta').fill('Retención en servicios desde el exterior');await page.locator('[data-asistente-sin-datos]').check();await page.locator('#asistentePanel button[type="submit"]').click();
  await page.locator('[data-asistente-pasos]').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true,'Sin desbordamiento '+width);
  await page.locator('#labTabAsistente').focus();await page.keyboard.press('Home');assert.equal(await page.locator('#labTabCartera').getAttribute('aria-selected'),'true');await page.keyboard.press('End');assert.equal(await page.locator('#labTabAsistente').getAttribute('aria-selected'),'true');
  await page.getByRole('button',{name:'Buscar estas palabras',exact:true}).click();await page.locator('#controles').waitFor({state:'visible'});assert.ok((await page.locator('#consulta').inputValue()).length>0);
  await page.evaluate(()=>window.euclidianAuthExpirada());await page.locator('#puerta').waitFor({state:'visible'});
  assert.equal(await page.evaluate(()=>window.EuclidianCartera.estadoActual().length),0);assert.equal(await page.evaluate(()=>window.EuclidianAgenda.tieneDatos()),false);assert.equal(await page.locator('#agendaTarea').inputValue(),'','El borrador del formulario también se borra al expirar');assert.equal(await page.locator('#asistentePregunta').inputValue(),'');assert.equal(await page.locator('#exogenaPanel input[type="file"]').inputValue(),'');
  assert.deepEqual(errors,[]);await context.close();console.log('Laboratorio integrado '+width+'px: perfiles, agenda, CSV ficticio, guía, teclado, búsqueda y limpieza de sesión OK');
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
