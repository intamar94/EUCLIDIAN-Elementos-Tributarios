const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const fs=require('node:fs');
(async()=>{
 const html=fs.readFileSync('app.html','utf8');
 const match=html.match(/<section class="exp-panel" id="expedientesPanel"[\s\S]*?<\/section>/);
 assert.ok(match,'Expediente presente');
 const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [360,1180]){
   const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
   const errors=[];page.on('pageerror',e=>errors.push(e.message));
   await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main>'+match[0]+'</main></body></html>');
   await page.addStyleTag({path:'expedientes.css'});
   await page.addStyleTag({path:'informes.css'});
   await page.addScriptTag({path:'informes.js'});
   await page.addScriptTag({path:'expedientes.js'});
   await page.locator('#expNuevo').click();
   await page.locator('[data-exp-campo="titulo"]').fill('Informe tributario ficticio');
   await page.locator('[data-exp-campo="hipotesis"]').fill('Interpretación <provisional> para contrastar');
   const downloadPromise=page.waitForEvent('download');
   await page.locator('[data-exp-export="docx"]').click();
   const download=await downloadPromise;
   assert.match(download.suggestedFilename(),/\.docx$/);
   assert.match(await page.locator('#expEstado').innerText(),/Word descargado como borrador/);
   await page.locator('[data-exp-export="pdf"]').click();
   const dialog=page.locator('#euInformePreview');
   assert.equal(await dialog.evaluate(el=>el.open),true);
   const frame=page.frameLocator('#euInformeMarco');
   await frame.locator('h1').waitFor();
   assert.match(await frame.locator('h1').innerText(),/Informe tributario ficticio/);
   assert.match(await frame.locator('.aviso').innerText(),/BORRADOR SIN REVISIÓN JURÍDICA/);
   const documentText=await frame.locator('body').innerText();
   assert.match(documentText,/Interpretación <provisional>/);
   const dimensions=await dialog.boundingBox();
   assert.ok(dimensions.x>=-1&&dimensions.x+dimensions.width<=width+1,'Vista previa dentro de pantalla '+width);
   await page.locator('[data-inf-cerrar]').click();
   assert.equal(await dialog.evaluate(el=>el.open),false);
   const clientPromise=page.waitForEvent('download');
   await page.locator('[data-exp-export="cliente-docx"]').click();
   const client=await clientPromise;
   assert.match(client.suggestedFilename(),/cliente-borrador\.docx$/);
   await page.close();
   assert.deepEqual(errors,[],'Sin errores JS al exportar informes '+width);
  }
 }finally{await browser.close();}
 console.log('Chromium M4: DOCX descargable, borrador visible, PDF imprimible, texto escapado, móvil/escritorio OK');
})().catch(e=>{console.error(e);process.exitCode=1;});