/* Guía local: nunca concede acceso ni modifica la suscripción. */
(function(){
  const pasos=[
    ['Consultar','Encuentra el documento que necesitas','En Consultar, escribe un número, una palabra o un tema. Usa los filtros de año y tema para acotar los resultados.','Ir a Consultar','navConsultar'],
    ['Novedades','Comprueba qué se publicó recientemente','Novedades reúne publicaciones de los últimos 14 días con fecha y fuente comprobables. Abre esta sección para verlas sin mezclar los filtros de tu búsqueda.','Ver novedades','navNovedades'],
    ['Explorar','Entra por tu área de trabajo','En Explorar, añade temas desde el desplegable. Solo verás los que elijas, guardados en este navegador; puedes abrir sus documentos o quitarlos. Esta selección no activa avisos ni se sincroniza entre dispositivos.','Explorar temas','navExplorar'],
    ['Fichas','Lee la ficha y comprueba la fuente','Cada resultado muestra su descripción, sus fechas y el estado de vigencia. Fuente contrastada significa que se cotejó el documento; enlace disponible solo indica que puedes abrirlo. En Ver detalles encontrarás identificación, relaciones y procedencia. Si solo hay datos de catálogo, consulta el original antes de aplicar un criterio.','Ver documentos','navConsultar'],
    ['Cuenta','Gestiona tu acceso','En Cuenta puedes ver tu suscripción, actualizar tu perfil o cerrar sesión. La consulta requiere una suscripción activa; crear una cuenta por sí solo no la activa. EUCLIDIAN apoya tu criterio profesional.','Abrir Cuenta','navCuenta']
  ];
  const clave='euclidian_guia_inicio_v1';let paso=0,iniciada=false;
  const el=id=>document.getElementById(id);
  const focos={navConsultar:'consulta',navNovedades:'novedadesCab',navExplorar:'agregarTema',navCuenta:'cuentaPanel'};
  function irADestino(id){
    const destino=el(id);
    if(!destino||destino.hidden||destino.disabled)return false;
    destino.click();
    const foco=el(focos[id]);
    if(foco&&!foco.closest('[hidden]'))foco.focus({preventScroll:true});
    return true;
  }
  function recordarGuia(){try{localStorage.setItem(clave,'completada');}catch(_){}}
  function pintar(enfocar=false){
    const actual=pasos[paso];
    el('guiaIndice').innerHTML=pasos.map((p,i)=>`<li><button type="button" data-guia-paso="${i}" ${i===paso?'aria-current="step"':''}>${i+1}. ${p[0]}</button></li>`).join('');
    el('guiaPaso').innerHTML=`<h2 id="guiaPasoTitulo" tabindex="-1">${actual[1]}</h2><p>${actual[2]}</p><button type="button" id="guiaDestino">${actual[3]} →</button>`;
    el('guiaProgreso').textContent=`Paso ${paso+1} de ${pasos.length}`;
    el('guiaAnterior').disabled=paso===0;
    el('guiaSiguiente').textContent=paso===pasos.length-1?'Terminar guía':'Siguiente';
    el('guiaDestino').addEventListener('click',()=>{if(irADestino(actual[4]))recordarGuia();});
    if(enfocar)el('guiaPasoTitulo').focus({preventScroll:true});
  }
  function cerrar(){window.euclidianCambiarVista?.('inicio');recordarGuia();el('abrirGuia').focus();}
  function abrir(){paso=0;pintar();window.euclidianCambiarVista?.('guia');el('bienvenida').hidden=false;el('bienvenida').scrollIntoView({behavior:window.matchMedia?.('(prefers-reduced-motion: reduce)').matches?'instant':'smooth',block:'start'});el('saltarGuia').focus({preventScroll:true});}
  window.euclidianIniciarGuia=()=>{if(iniciada)return;iniciada=true;let completa=false;try{completa=!!localStorage.getItem(clave);}catch(_){}if(!completa){pintar();window.euclidianCambiarVista?.('guia');el('bienvenida').hidden=false;}};
  document.querySelector('.inicio-atajos')?.addEventListener('click',e=>{
    const boton=e.target.closest('[data-inicio-destino]');
    if(boton)irADestino(boton.dataset.inicioDestino);
  });
  el('abrirGuia')?.addEventListener('click',abrir);
  el('saltarGuia')?.addEventListener('click',cerrar);
  el('guiaAnterior')?.addEventListener('click',()=>{if(paso>0){paso--;pintar(true);}});
  el('guiaSiguiente')?.addEventListener('click',()=>{if(paso===pasos.length-1)cerrar();else{paso++;pintar(true);}});
  el('guiaIndice')?.addEventListener('click',e=>{const boton=e.target.closest('[data-guia-paso]');if(boton){paso=Number(boton.dataset.guiaPaso);pintar(true);}});
})();
