/* Solo carga y reproduce las animaciones cuando están realmente a la vista.
   En conexiones lentas o con movimiento reducido se conserva el póster HD. */
(()=>{'use strict';
  const videos=[...document.querySelectorAll('[data-eu-video]')];
  if(!videos.length)return;
  const motion=window.matchMedia('(prefers-reduced-motion: reduce)');
  function activo(video){
    const visual=video.closest('.eu-gif,.eu-hero-gif');
    if(!visual||video.dataset.fallo==='1'||document.hidden||motion.matches||video.dataset.enVista!=='1')return false;
    // Las distintas secciones de la aplicación se ocultan con hidden.
    for(let n=visual;n;n=n.parentElement)if(n.hidden)return false;
    return true;
  }
  function ajustar(video){
    if(!activo(video)){video.pause();return;}
    if(!video.dataset.cargado){
      const source=video.querySelector('source[data-src]');
      if(!source)return;
      source.src=source.dataset.src;
      video.dataset.cargado='1';
      video.load();
    }
    const playing=video.play();
    if(playing&&typeof playing.catch==='function')playing.catch(()=>{video.dataset.fallo='1';video.hidden=true;});
  }
  function sincronizar(){for(const video of videos)ajustar(video);}
  if(!('IntersectionObserver' in window)){
    for(const v of videos)v.dataset.enVista='1';
    sincronizar();
  }else{
    const obs=new IntersectionObserver(entries=>{
      for(const entry of entries){
        const video=entry.target;
        video.dataset.enVista=entry.isIntersecting?'1':'0';
        ajustar(video);
      }
    },{rootMargin:'80px 0px',threshold:0.05});
    for(const v of videos)obs.observe(v);
  }
  document.addEventListener('visibilitychange',sincronizar);
  if(typeof motion.addEventListener==='function')motion.addEventListener('change',sincronizar);
  else if(typeof motion.addListener==='function')motion.addListener(sincronizar);
  // Detecta cambios de vista sin volver a solicitar todos los vídeos.
  const changes=new MutationObserver(sincronizar);
  changes.observe(document.body,{subtree:true,attributes:true,attributeFilter:['hidden']});
  for(const v of videos)v.addEventListener('error',()=>{v.dataset.fallo='1';v.hidden=true;});
})();
