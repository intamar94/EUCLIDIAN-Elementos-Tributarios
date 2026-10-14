/* Guía local: nunca concede acceso ni modifica la suscripción. */
(function(){
  const pasos=[
    ['Consultar','Encuentra el documento que necesitas','En Consultar, escribe un número, una palabra o un tema. Usa los filtros de año y tema para acotar los resultados.','Ir a Consultar','navConsultar'],
    ['Novedades','Comprueba qué se publicó recientemente','Novedades reúne publicaciones de los últimos 14 días con fecha y fuente comprobables. El resumen de toda la biblioteca es independiente de los filtros; el radar de tu consulta solo describe la página visible.','Ver novedades','navNovedades'],
    ['Explorar','Entra por tu área de trabajo','Explorar agrupa los documentos por tema. En Temas que sigues puedes marcar tus intereses: se guardan en este navegador y priorizan el radar de la página visible.','Explorar temas','navExplorar'],
    ['Fichas','Lee la ficha y comprueba la fuente','Cada ficha separa descripción, vigencia y fuente DIAN. Abre sus detalles para revisar fechas y relaciones. Fuente contrastada no significa revisión humana; una ficha documental sin aprobación no ofrece conclusiones verificadas.','Ver documentos','lista'],
    ['Cuenta','Gestiona tu acceso','En Cuenta puedes ver tu suscripción, actualizar tu perfil o cerrar sesión. Si el cobro no está habilitado, crear una cuenta no activa el acceso. EUCLIDIAN apoya tu criterio profesional.','Abrir Cuenta','navCuenta']
  ];
  const clave='euclidian_guia_inicio_v1';let paso=0,iniciada=false;
  const el=id=>document.getElementById(id);
  function pintar(){
    const actual=pasos[paso];
    el('guiaIndice').innerHTML=pasos.map((p,i)=>`<li><button type="button" data-guia-paso="${i}" ${i===paso?'aria-current="step"':''}>${i+1}. ${p[0]}</button></li>`).join('');
    el('guiaPaso').innerHTML=`<h2>${actual[1]}</h2><p>${actual[2]}</p><button type="button" id="guiaDestino">${actual[3]} →</button>`;
    el('guiaProgreso').textContent=`Paso ${paso+1} de ${pasos.length}`;
    el('guiaAnterior').disabled=paso===0;
    el('guiaSiguiente').textContent=paso===pasos.length-1?'Terminar guía':'Siguiente';
    el('guiaDestino').addEventListener('click',()=>{const destino=el(actual[4]);if(!destino)return;if(destino.tagName==='A'||destino.tagName==='BUTTON')destino.click();else destino.scrollIntoView({behavior:'smooth',block:'start'});});
  }
  function cerrar(){el('bienvenida').hidden=true;try{localStorage.setItem(clave,'completada');}catch(_){}el('abrirGuia').focus();}
  function abrir(){paso=0;pintar();el('bienvenida').hidden=false;el('bienvenida').scrollIntoView({behavior:'smooth',block:'start'});el('saltarGuia').focus({preventScroll:true});}
  window.euclidianIniciarGuia=()=>{if(iniciada)return;iniciada=true;let completa=false;try{completa=!!localStorage.getItem(clave);}catch(_){}if(!completa){pintar();el('bienvenida').hidden=false;}};
  el('abrirGuia')?.addEventListener('click',abrir);
  el('saltarGuia')?.addEventListener('click',cerrar);
  el('guiaAnterior')?.addEventListener('click',()=>{if(paso>0){paso--;pintar();}});
  el('guiaSiguiente')?.addEventListener('click',()=>{if(paso===pasos.length-1)cerrar();else{paso++;pintar();}});
  el('guiaIndice')?.addEventListener('click',e=>{const boton=e.target.closest('[data-guia-paso]');if(boton){paso=Number(boton.dataset.guiaPaso);pintar();el('guiaSiguiente').focus();}});
})();
