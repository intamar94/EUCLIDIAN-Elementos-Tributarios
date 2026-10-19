/* Ejecutar con Playwright y Chromium, como ui_informes_browser.cjs. */
const {chromium}=require('playwright');
const assert=require('node:assert/strict');
const {readFileSync}=require('node:fs');
(async()=>{
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [360,1180]){
   const page=await browser.newPage({viewport:{width,height:850},acceptDownloads:true});
   await page.setContent('<html lang="es"><body><button id="abrir">Informe</button></body></html>');
   await page.addStyleTag({path:'informes.css'});
   await page.addScriptTag({path:'informes.js'});
   const exp={formato:'euclidian-expediente-v1',version:1,campos:{titulo:'IVA Bogotá',hipotesis:'Primera línea\nSegunda línea <script> & prueba'},fuentes:[]};
   await page.evaluate(exp=>EuclidianInformes.abrirPDF(exp),exp);
   const frame=page.frameLocator('#euInformeMarco');
   await frame.locator('h1').waitFor();
   assert.match(await frame.locator('body').innerText(),/Completar pregunta de investigación/);
   assert.match(await frame.locator('body').innerText(),/Adjuntar documentos oficiales DIAN/);
   assert.match(await frame.locator('body').innerText(),/Segunda línea <script> & prueba/);
   assert.equal(await frame.locator('script').count(),0);
   const downloadPromise=page.waitForEvent('download');
   await page.evaluate(exp=>EuclidianInformes.descargarWord(exp,'cliente'),exp);
   assert.match((await downloadPromise).suggestedFilename(),/^euclidian-\d{4}-\d{2}-\d{2}-iva-bogota-cliente-borrador\.docx$/);
   await page.evaluate(()=>EuclidianInformes.limpiar());
   assert.equal(await page.locator('#euInformePreview').count(),0,'Sin diálogo al limpiar la sesión');
   assert.equal(await page.locator('#euInformeMarco').count(),0,'Sin documento sensible retenido en iframe');
   await page.evaluate(()=>EuclidianInformes.limpiar()); // Idempotente.
   await page.evaluate(exp=>EuclidianInformes.abrirPDF(exp),exp);
   await page.frameLocator('#euInformeMarco').locator('h1').waitFor();
   await page.evaluate(()=>EuclidianInformes.limpiar());
   const source=await page.evaluate(exp=>EuclidianInformes.html(exp),exp);
   await page.setContent(source);
   assert.equal(await page.locator('html').getAttribute('lang'),'es');
   const pdf=await page.pdf({format:'A4',printBackground:true,preferCSSPageSize:true});
   assert.equal(pdf.subarray(0,5).toString(),'%PDF-');
   assert.ok(pdf.length>5000,'PDF de impresión no vacío');
   const overflow=await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1);
   assert.equal(overflow,false,'Documento legible sin desbordamiento '+width);
   await page.close();
  }
 }finally{await browser.close();}
 console.log('M4 cierre Chromium: checklist en preview, DOCX con asunto, PDF generado y móvil sin desbordamiento OK');
})().catch(error=>{console.error(error);process.exitCode=1;});
