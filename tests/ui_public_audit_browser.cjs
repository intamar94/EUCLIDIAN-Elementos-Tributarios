const {chromium}=require('playwright');
const assert=require('node:assert/strict');

(async()=>{
  const browser=await chromium.launch({
    headless:true,
    ...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),
    args:['--no-sandbox','--disable-dev-shm-usage']
  });
  try{
    for(const width of [320,390,768,1440]){
      const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});
      const page=await context.newPage(), errors=[];
      page.on('pageerror',error=>errors.push(error.message));
      const base=process.env.UI_BASE_URL||'http://127.0.0.1:8765';
      await page.goto(base+'/',{waitUntil:'domcontentloaded'});
      await page.locator('.hero-visual img').waitFor({state:'visible'});
      assert.equal(await page.locator('main h1').count(),1,'H1 único en '+width);
      assert.equal(await page.locator('.hero-visual video').count(),0,'Portada solo imagen');
      const imagen=page.locator('.hero-visual img'),copy=page.locator('.hero-copy');
      const ib=await imagen.boundingBox(),cb=await copy.boundingBox();
      assert.ok(ib&&cb&&ib.y < cb.y,'Hero debe abrir con imagen '+width);
      assert.ok(await imagen.evaluate(el=>el.complete&&el.naturalWidth>=1000),'Imagen original nítida '+width);
      const desborde=await page.evaluate(()=>{
        const margen=window.innerWidth;
        return {ancho:document.documentElement.scrollWidth,ventana:margen,
          elementos:[...document.querySelectorAll('body *')]
            .map(el=>({el,rect:el.getBoundingClientRect()}))
            .filter(x=>x.rect.right>margen+1&&x.rect.width>0)
            .sort((a,b)=>b.rect.right-a.rect.right).slice(0,12)
            .map(x=>({tag:x.el.tagName,clase:x.el.className?.baseVal||x.el.className,
              derecha:Math.round(x.rect.right),ancho:Math.round(x.rect.width)}))};
      });
      if(desborde.ancho>width)console.log('Diagnóstico de desbordamiento '+width,JSON.stringify(desborde));
      assert.ok(desborde.ancho<=width,'Sin desbordamiento portada '+width);
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'index,follow');
      const canonical=await page.locator('link[rel="canonical"]').getAttribute('href');
      assert.ok(canonical?.startsWith('https://'));
      assert.equal(await page.locator('meta[property="og:site_name"]').count(),1);
      await page.locator('#muestraNovedades').click();
      assert.equal(await page.locator('#muestraNovedades').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('#vistaNovedades').isVisible(),true);
      await page.locator('#muestraTemas').focus();
      await page.keyboard.press('Home');
      assert.equal(await page.locator('#muestraConsulta').getAttribute('aria-selected'),'true');
      await page.screenshot({path:`/tmp/euclidian-publica-${width}.png`,fullPage:true});

      await page.goto(base+'/app.html',{waitUntil:'domcontentloaded'});
      await page.locator('#puerta').waitFor({state:'visible'});
      assert.equal(await page.locator('meta[name="robots"]').getAttribute('content'),'noindex,nofollow');
      await page.locator('#tabEntrar').focus();
      await page.keyboard.press('ArrowRight');
      assert.equal(await page.locator('#tabCrear').getAttribute('aria-selected'),'true');
      assert.equal(await page.locator('#authRegisterForm').isVisible(),true);
      await page.keyboard.press('Home');
      assert.equal(await page.locator('#tabEntrar').getAttribute('aria-selected'),'true');
      await page.keyboard.press('End');
      assert.equal(await page.locator('#tabCrear').getAttribute('aria-selected'),'true');
      await page.locator('#tabEntrar').click();
      assert.equal(await page.locator('#authLoginForm').isVisible(),true);
      assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>window.innerWidth),false,'Sin desbordamiento ingreso '+width);
      await page.screenshot({path:`/tmp/euclidian-ingreso-${width}.png`,fullPage:true});
      assert.deepEqual(errors,[],'Sin errores de JavaScript '+width);
      console.log(`OK ${width}px: portada, imagen, SEO visible, pestañas, teclado, ingreso y sin desbordamientos`);
      await context.close();
    }
  }finally{
    await browser.close();
  }
})().catch(e=>{console.error(e);process.exit(1)});
