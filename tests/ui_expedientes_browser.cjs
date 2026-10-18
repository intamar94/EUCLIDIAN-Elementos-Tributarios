const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const html=fs.readFileSync('app.html','utf8');
 const match=html.match(/<section class="exp-panel" id="expedientesPanel"[\s\S]*?<\/section>/);
 assert.ok(match,'El escritorio debe estar integrado en Explorar');
 const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [360,1180]){
   const page=await browser.newPage({viewport:{width,height:900}});
   const errores=[];page.on('pageerror',e=>errores.push(e.message));
   await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>'+match[0]+'</main><div id="prueba"></div></body></html>');
   await page.addStyleTag({path:'expedientes.css'});
   await page.addScriptTag({path:'expedientes.js'});
   await page.locator('#expNuevo').click();
   assert.equal(await page.locator('#expEditor').isVisible(),true);
   await page.locator('[data-exp-campo="titulo"]').fill('Estudio tributario hipotético');
   await page.locator('[data-exp-campo="pregunta"]').fill('¿Qué criterios deben cotejarse?');
   await page.evaluate(()=>{
    const d={id:'a7ce7389-5678-4679-9a50-3de4db1af011',
     numero_resolucion:'DIAN-CONCEPTO-1-2026',titulo:'Referencia de prueba',
     enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm'};
    document.getElementById('prueba').innerHTML=window.EuclidianExpedientes.panel(d);
   });
   await page.locator('[data-exp-adjuntar]').click();
   assert.equal(await page.locator('#expFuentes li').count(),1);
   assert.match(await page.locator('#expFuentes li a').getAttribute('href'),/^https:\/\/normograma\.dian\.gov\.co/);
   assert.match(await page.locator('#expContador').textContent(),/1 \/ 18/);
   const json=await page.evaluate(()=>window.EuclidianExpedientes.respaldo());
   assert.match(json,/Estudio tributario hipotético/);
   await page.locator('#expNuevo').click();
   await page.locator('#expElegir').selectOption('exp-1');
   assert.equal(await page.locator('[data-exp-campo="pregunta"]').inputValue(),'¿Qué criterios deben cotejarse?');
   await page.locator('#expImportar').setInputFiles({name:'expediente.json',mimeType:'application/json',buffer:Buffer.from(json,'utf8')});
   await page.waitForFunction(()=>document.getElementById('expEstado').textContent.includes('importado'));
   assert.equal(await page.locator('#expElegir option').count(),3);
   assert.equal(await page.locator('#expFuentes li').count(),1);
   const rect=await page.locator('#expedientesPanel').boundingBox();
   assert.ok(rect.x>=0&&rect.x+rect.width<=width+1,'Desborde de expediente '+width);
   await page.evaluate(()=>window.EuclidianExpedientes.limpiar());
   assert.equal(await page.locator('#expEditor').isVisible(),false);
   assert.equal(await page.locator('#expElegir option').count(),0);
   assert.deepEqual(errores,[],'Sin JS errors en '+width);
   await page.close();
  }
 }finally{await browser.close();}
 console.log('Navegador: expediente en 360/1180, nota, fuente DIAN, exportación, importación y limpieza OK');
})().catch(e=>{console.error(e);process.exitCode=1;});