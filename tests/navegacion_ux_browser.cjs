const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{
for(const width of [320,390,768,1440]){
 const browser=await chromium.launch({headless:true,...(process.env.CHROMIUM_PATH?{executablePath:process.env.CHROMIUM_PATH}:{}),args:['--no-sandbox','--disable-dev-shm-usage']});
 const context=await browser.newContext({viewport:{width,height:900},reducedMotion:'reduce'});const page=await context.newPage();const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await context.addInitScript(()=>{localStorage.setItem('euclidian_access_token','test-only');localStorage.setItem('euclidian_expires_at',String(Date.now()/1000+3600));});
 const doc={id:'11111111-1111-4111-8111-111111111111',numero_resolucion:'DIAN-TEST-1-2026',titulo:'Documento simulado para revisar la interfaz',fecha_publicacion:'2026-09-18',fecha_es_real:true,fecha_publicacion_web:'2026-10-05',tipo_documento:'resolucion',descripcion_limpia:'Ejemplo de prueba visual. No representa información tributaria real.',temas:['iva'],enlace_oficial:'https://normograma.dian.gov.co/dian/compilacion/tributario.html',consulta_documental:true,estado_vigencia:'desconocido',modifica_a:Array.from({length:7},(_,i)=>({numero:`Relación de prueba ${i+1}`,enlace:'https://normograma.dian.gov.co/dian/compilacion/tributario.html'}))};
 let novedadesVacias=true,sinAcceso=false;
 await page.route('**/api/**',async route=>{const u=new URL(route.request().url());let body={};if(u.pathname==='/api/documentos'){
 if(sinAcceso){await route.fulfill({status:402,json:{access:{estado:'pendiente'}}});return;}
 const nuevos=u.searchParams.get('estado')==='nuevos',vacio=nuevos&&novedadesVacias;
 body=u.searchParams.get('resumen')?{total:novedadesVacias?0:42}:{documentos:vacio?[]:[doc],total:vacio?0:1,pagina:1,paginas:1,porPagina:25,temas:['iva','renta','retencion','doctriflash','boletin_tributario_historico'],anios:[{anio:2026,total:1}]};
 }else if(u.pathname==='/api/session')body={user:{id:'test-user',email:'prueba@example.com'},profile:{},access:{permitido:!sinAcceso,estado:sinAcceso?'pendiente':'activo',plan_codigo:'individual'}};else if(u.pathname==='/api/plans')body={planes:[],billing_enabled:false};else if(u.pathname==='/api/usage')body={};await route.fulfill({json:body});});
 const visible=async id=>page.locator('#'+id).isVisible();
 const loaded=async()=>page.waitForFunction(()=>document.querySelector('#lista').getAttribute('aria-busy')==='false');
 await page.goto(`${process.env.UI_BASE_URL||'http://127.0.0.1:8765'}/app.html`);await page.locator('#bienvenida').waitFor({state:'visible'});
 assert.equal(await visible('inicioPanel'),false);assert.equal(await visible('controles'),false);
 for(let i=0;i<4;i++)await page.locator('#guiaSiguiente').click();await page.locator('#guiaSiguiente').click();await page.locator('#inicioPanel').waitFor({state:'visible'});
 assert.equal(await page.locator('.inicio-atajo').count(),3);
 await page.locator('.inicio-documento').click();await loaded();
 assert.equal(await page.locator('#controles').evaluate(el=>el.contains(document.activeElement)),true,'Abrir ficha traslada foco al panel visible');
 await page.locator('#navInicio').click();await loaded();
 await page.locator('[data-inicio-destino="navConsultar"]').click();await loaded();
 assert.equal(await visible('controles'),true);assert.equal(await page.locator('#consulta').evaluate(el=>document.activeElement===el),true);
 await page.locator('#consulta').fill('prueba');await page.locator('#formBuscar button').click();await loaded();
 await page.locator('#selAnio').selectOption('2026');await loaded();
 await page.locator('[data-quitar-filtro="q"]').click();await loaded();
 assert.equal(await page.locator('#consulta').inputValue(),'');
 assert.equal(await page.locator('#selAnio').inputValue(),'2026','Quitar consulta conserva año');
 await page.locator('#navInicio').click();await loaded();
 await page.locator('[data-inicio-destino="navNovedades"]').click();await loaded();
 assert.equal(await visible('novedadesCab'),true);assert.equal(await page.locator('#novedadesCab').evaluate(el=>document.activeElement===el),true);
 await page.locator('#navInicio').click();await loaded();
 await page.locator('[data-inicio-destino="navExplorar"]').click();
 assert.equal(await visible('explorar'),true);assert.equal(await page.locator('#agregarTema').evaluate(el=>document.activeElement===el),true);
 await page.locator('#abrirGuia').click();await page.locator('#guiaSiguiente').click();
 assert.equal(await page.locator('#guiaProgreso').textContent(),'Paso 2 de 5');
 assert.equal(await page.locator('#guiaPasoTitulo').evaluate(el=>document.activeElement===el),true);
 await page.locator('#guiaAnterior').click();
 assert.equal(await page.locator('#guiaAnterior').isDisabled(),true);
 assert.equal(await page.locator('#guiaPasoTitulo').evaluate(el=>document.activeElement===el),true);
 await page.locator('[data-guia-paso="2"]').click();
 assert.equal(await page.locator('#guiaPasoTitulo').evaluate(el=>document.activeElement===el),true);
 await page.locator('#guiaDestino').click();assert.equal(await visible('explorar'),true);
 assert.equal(await page.locator('#agregarTema').evaluate(el=>document.activeElement===el),true);
 assert.equal(await page.evaluate(()=>localStorage.getItem('euclidian_guia_inicio_v1')),'completada');
 await page.locator('#navInicio').click();await loaded();
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false,'Horizontal overflow '+width);
 for(const action of await page.locator('.inicio-atajo').all())assert.ok((await action.boundingBox()).height>=44);
 await page.screenshot({path:`/tmp/euclidian-nav-ux-${width}.png`,fullPage:true});
 assert.deepEqual(errors,[]);console.log(`OK ${width}px: accesos de inicio, foco de destinos y pasos, guía reutilizable, sin desbordamiento`);await browser.close();
}
})().catch(e=>{console.error(e);process.exit(1)});
