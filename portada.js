/* Las vistas de la portada son demostraciones; no abren una sesión ni consumen consultas. */
(()=>{
  const tabs=[...document.querySelectorAll('.muestra-tabs [role="tab"]')];
  function activar(tab){
    for(const t of tabs){const activa=t===tab;t.setAttribute('aria-selected',String(activa));t.tabIndex=activa?0:-1;document.getElementById(t.getAttribute('aria-controls')).hidden=!activa;}
  }
  tabs.forEach((tab,i)=>{
    tab.addEventListener('click',()=>activar(tab));
    tab.addEventListener('keydown',event=>{
      let siguiente;
      if(event.key==='ArrowRight')siguiente=tabs[(i+1)%tabs.length];
      if(event.key==='ArrowLeft')siguiente=tabs[(i+tabs.length-1)%tabs.length];
      if(event.key==='Home')siguiente=tabs[0];
      if(event.key==='End')siguiente=tabs[tabs.length-1];
      if(siguiente){event.preventDefault();activar(siguiente);siguiente.focus();}
    });
  });
})();
