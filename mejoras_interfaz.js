/* EUCLIDIAN — pequeños refuerzos de interfaz. La ficha ya contiene el resumen final. */
(function(){
  function actualizar(){
    const paginas=document.getElementById('paginas');
    const total=document.getElementById('totalDocumentos');
    if(!paginas||!total)return;
    const texto=paginas.querySelector('.rango')?.textContent||'';
    const m=texto.match(/\bde\s+(\d+)$/);
    total.textContent=m?`${m[1]} documentos publicados`:'Cargando documentos…';
  }
  function iniciar(){
    const controles=document.getElementById('controles');
    const paginas=document.getElementById('paginas');
    if(!controles||!paginas)return;
    let total=document.getElementById('totalDocumentos');
    if(!total){
      total=document.createElement('div');
      total.id='totalDocumentos';
      total.className='total-documentos';
      controles.parentNode.insertBefore(total,controles);
    }
    new MutationObserver(actualizar).observe(paginas,{childList:true,subtree:true,characterData:true});
    actualizar();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
