const {chromium}=require('playwright');
const assert=require('node:assert/strict');
(async()=>{
 const browser=await chromium.launch({headless:true,
  ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
  args:['--no-sandbox','--disable-dev-shm-usage']});
 try{
  for(const width of [360,1180]){
   const page=await browser.newPage({viewport:{width,height:860}});
   const errors=[];page.on('pageerror',err=>errors.push(err.message));
   await page.setContent('<!doctype html><html lang="es"><head><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><main id="fichas"></main></body></html>');
   await page.addStyleTag({path:'comparador.css'});
   await page.addScriptTag({path:'comparador.js'});
   await page.evaluate(()=>{
    const uno={id:'doc-a',titulo:'Concepto anterior',numero_resolucion:'DIAN-OFICIO-1-2025',
     enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/concepto_anterior.htm',
     tipo_documento:'oficio',texto_completo:'Los servicios establecidos en el supuesto reciben el tratamiento previsto en el artículo indicado con algunas condiciones específicas.',
     estado_fuente_verificacion:'verificado_oficial',evaluacion_resultado:'APPROVE'};
    const dos={...uno,id:'doc-b',titulo:'Concepto posterior',numero_resolucion:'DIAN-OFICIO-2-2026',
     enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/docs/concepto_posterior.htm',
     texto_completo:'Los servicios establecidos en el supuesto podrían recibir tratamiento diferente tras revisar las condiciones aplicables.'};
    document.getElementById('fichas').innerHTML='<article>'+window.EuclidianComparador.panel(uno)+
      '</article><article>'+window.EuclidianComparador.panel(dos)+'</article>';
   });
   assert.equal(await page.locator('.comparador-selector').count(),2);
   await page.locator('[data-comp-lado="a"]').first().click();
   assert.match(await page.locator('.comparador-mensaje').first().textContent(),/Texto A seleccionado/);
   assert.match(await page.locator('#euComparadorSeleccion').textContent(),/Texto A: DIAN-OFICIO-1-2025/);
   assert.match(await page.locator('#euComparadorSeleccion').textContent(),/Falta elegir texto B/);
   await page.locator('[data-comp-lado="b"]').last().click();
   const dlg=page.locator('#euComparadorDialog');
   assert.equal(await dlg.evaluate(el=>el.open),true);
   assert.match(await page.locator('#euComparadorMetaA').textContent(),/OFICIO-1-2025/);
   assert.match(await page.locator('#euComparadorMetaB').textContent(),/OFICIO-2-2026/);
   assert.equal(await page.locator('#euComparadorLinkA').getAttribute('href'),'https://normograma.dian.gov.co/dian/compilacion/docs/concepto_anterior.htm');
   await page.locator('#euComparadorTextoA').fill('Una regla anterior tenía un requisito específico.');
   await page.locator('#euComparadorTextoB').fill('Una regla posterior establece condiciones adicionales.');
   await page.locator('[data-comp-cerrar]').click();
   await page.locator('[data-comp-lado="b"]').last().click();
   assert.equal(await page.locator('#euComparadorTextoA').inputValue(),'Una regla anterior tenía un requisito específico.');
   assert.equal(await page.locator('#euComparadorTextoB').inputValue(),'Una regla posterior establece condiciones adicionales.');
   await page.locator('[data-comp-ejecutar]').click();
   assert.equal(await page.locator('#euComparadorResultado').isVisible(),true);
   assert.ok(await page.locator('#euComparadorAntes mark').count()>0);
   assert.ok(await page.locator('#euComparadorDespues mark').count()>0);
   assert.match(await page.locator('#euComparadorEstado').textContent(),/diferencias de redacción/);
   const exportPromise=page.waitForEvent('download');
   await page.locator('[data-comp-exportar]').click();
   const exportFile=await exportPromise;assert.match(exportFile.suggestedFilename(),/borrador.*\.txt$/);
   await page.locator('#euComparadorTextoA').fill('Un nuevo pasaje modificado para revisar.');
   assert.equal(await page.locator('#euComparadorResultado').isVisible(),false,'Editar invalida diferencias anteriores');
   const geometry=await page.evaluate(()=>{
    const dialog=document.getElementById('euComparadorDialog').getBoundingClientRect();
    return {window:window.innerWidth,left:dialog.left,right:dialog.right,
     scroll:document.documentElement.scrollWidth};
   });
   assert.ok(geometry.left>=0&&geometry.right<=width+1,'Modal dentro de pantalla '+width+': '+JSON.stringify(geometry));
   await page.locator('[data-comp-cerrar]').click();
   assert.equal(await dlg.evaluate(el=>el.open),false);
   await page.locator('[data-comp-limpiar-global]').click();
   assert.equal(await page.locator('#euComparadorSeleccion').count(),0,'Limpiar no deja datos locales');
   assert.equal(await dlg.evaluate(el=>el.open),false);
   await page.close();
   assert.deepEqual(errors,[],'Sin errores JavaScript '+width);
  }
 }finally{await browser.close();}
 console.log('Browser comparator: A/B, enlaces, resaltados, modal, cierre, 360/1180 sin desbordamiento OK');
})().catch(e=>{console.error(e);process.exitCode=1;});