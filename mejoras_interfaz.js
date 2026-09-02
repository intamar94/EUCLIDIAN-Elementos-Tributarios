/* EUCLIDIAN — lectura completa y uniforme.
   No inventa contenido: cuando falta un resumen humano/borrador, muestra un
   extracto literal de la tesis o del texto oficial como apoyo de lectura. */
(function(){
  const original = window.ficha;
  if(typeof original !== 'function') return;

  function escapeHtml(v){
    return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));
  }

  function extracto(d){
    const existente = String(d.resumen_humano||d.resumen_borrador||'').trim();
    if(existente) return {texto:existente, etiqueta:d.resumen_humano?'Resumen redactado':'Borrador disponible'};
    const base = String(d.tesis_juridica||d.descripcion_limpia||d.contenido||'').replace(/\s+/g,' ').trim();
    if(!base) return null;
    const partes = base.match(/[^.!?]+[.!?]+/g) || [];
    const texto = (partes.slice(0,2).join(' ') || base).slice(0,850).trim();
    return {texto, etiqueta:'Extracto del texto oficial'};
  }

  window.ficha = function(d){
    const html = original(d);
    const e = extracto(d);
    if(!e) return html;

    const bloque = `<section class="resumen-lectura" aria-label="Resumen de lectura">
      <div class="resumen-cab">
        <span>Resumen de lectura</span>
        <small>${escapeHtml(e.etiqueta)}</small>
      </div>
      <p>${escapeHtml(e.texto)}</p>
    </section>`;

    const marca = '<div class="escribir">';
    return html.includes(marca) ? html.replace(marca,bloque+marca) : html;
  };

  function actualizarRango(){
    const rango=document.getElementById('rango');
    const paginas=document.getElementById('paginas');
    if(!rango) return;
    const texto=(paginas?.querySelector('.rango')?.textContent||'').trim();
    if(texto){rango.textContent=texto;return;}
    const cards=document.querySelectorAll('#lista article').length;
    if(cards) rango.textContent=`Mostrando ${cards} documentos de esta página`;
  }

  function iniciar(){
    const controles=document.getElementById('controles');
    if(!controles) return;
    const total=document.createElement('div');
    total.id='totalDocumentos';
    total.className='total-documentos';
    controles.parentNode.insertBefore(total,controles);

    const originalCargar=window.cargar;
    if(typeof originalCargar==='function'){
      window.cargar=async function(){
        await originalCargar();
        actualizarTotal();
        actualizarRango();
      };
    }
    actualizarTotal();
  }

  function actualizarTotal(){
    const total=document.getElementById('totalDocumentos');
    if(!total) return;
    const rango=document.getElementById('paginas');
    const r=rango?.querySelector('.rango')?.textContent||'';
    const m=r.match(/(?:de|\/)?\s*(\d+)$/);
    if(m) total.textContent=`${m[1]} documentos publicados`;
    else if(r) total.textContent=r;
  }

  if(document.readyState==='loading') document.addEventListener('DOMContentLoaded',iniciar,{once:true});
  else iniciar();
})();
