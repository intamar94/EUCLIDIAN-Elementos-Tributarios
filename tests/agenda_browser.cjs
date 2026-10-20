const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{for(const width of [360,1180]){
  const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="agendaPanel"></div></body></html>');
  await page.addStyleTag({path:'agenda.css'});await page.addScriptTag({path:'agenda.js'});
  await page.locator('#agendaTarea').fill('<img src=x onerror=alert(1)>');await page.locator('#agendaFecha').fill('2026-10-23');await page.locator('#agendaReferencia').fill('Resolución de prueba');await page.locator('#agendaUrl').fill('https://dian.gov.co.evil.com');
  await page.locator('#agendaFormulario button').click();assert.match(await page.locator('#agendaError').textContent(),/enlace HTTPS/);assert.equal(await page.locator('#agendaTarea').inputValue(),'<img src=x onerror=alert(1)>');
  await page.locator('#agendaUrl').fill('https://www.dian.gov.co/resolucion.pdf');await page.locator('#agendaFormulario button').click();assert.equal(await page.locator('.agenda-lista li').count(),1);assert.equal(await page.locator('.agenda img').count(),0);assert.match(await page.locator('.agenda-tarea').textContent(),/<img/);
  assert.equal(await page.locator('#agendaTarea').inputValue(),'');await page.locator('#agendaTarea').fill('Borrador conservado');await page.locator('[data-completar]').check();assert.equal(await page.locator('#agendaTarea').inputValue(),'Borrador conservado');assert.match(await page.locator('.agenda-tarea').textContent(),/Completada/);
  const [download]=await Promise.all([page.waitForEvent('download'),page.locator('#agendaExportar').click()]);assert.equal(download.suggestedFilename(),'euclidian-agenda-investigacion.csv');
  assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.equal(await page.locator('#agendaTarea').evaluate(el=>getComputedStyle(el).fontSize),'16px');
  await page.locator('[data-eliminar]').click();assert.equal(await page.locator('.agenda-lista li').count(),0);assert.equal(await page.evaluate(()=>window.EuclidianAgenda.tieneDatos()),true,'El borrador todavía no añadido también es trabajo temporal');assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),true);
  await page.evaluate(()=>window.EuclidianAgenda.agregar({titulo:'Tarea temporal',fecha:'2026-11-01',referencia:'DIAN',url:'https://dian.gov.co/'}));await page.evaluate(()=>window.EuclidianAgenda.limpiar());assert.equal(await page.locator('#agendaTarea').inputValue(),'');assert.equal(await page.evaluate(()=>window.EuclidianAgenda.tieneDatos()),false);assert.equal(await page.evaluate(()=>{const e=new Event('beforeunload',{cancelable:true});window.dispatchEvent(e);return e.defaultPrevented;}),false);assert.deepEqual(errors,[]);await page.close();
 }}finally{await browser.close();}
 console.log('Agenda: formulario, fuente, XSS, CSV, cambios, limpieza y móvil aprobados.');
})().catch(e=>{console.error(e);process.exitCode=1;});
