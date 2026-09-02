/* EUCLIDIAN — transparencia de cobertura.
   No cambia qué documentos puede ver el cliente: solo informa cuántos existen
   en producción, cuántos están aprobados y qué fecha tiene el más reciente. */
(function(){
  function esc(v){return String(v??'').replace(/[&<>\"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','\"':'&quot;'}[c]));}
  function fecha(v){if(!v)return 'sin fecha';const d=new Date(v);return Number.isNaN(d.getTime())?String(v).slice(0,10):d.toLocaleDateString('es-CO',{day:'numeric',month:'short',year:'numeric'});}
  async function cargarCobertura(){
    const clave=sessionStorage.getItem('euclidian_clave')||''; if(!clave)return;
    try{
      const r=await fetch('/api/documentos?pagina=1&orden=recientes',{headers:{'x-clave':clave},cache:'no-store'});
      if(!r.ok)return; const d=await r.json(),c=d.cobertura||{};
      const box=document.getElementById('cobertura'); if(!box)return;
      box.innerHTML=`<span><b>${esc(c.baseTotal??'—')}</b> en base</span><span><b>${esc(c.publicados??d.total??'—')}</b> publicados</span><span>Más reciente: <b>${esc(fecha(c.fechaMasReciente))}</b></span>`;
      box.hidden=false;
      const sello=document.getElementById('sello'); if(sello)sello.textContent='Consulta '+new Date().toLocaleTimeString('es-CO',{hour:'2-digit',minute:'2-digit'});
      const rango=document.getElementById('rango'); if(rango&&d.total!=null)rango.textContent=`${d.total} documentos publicados · mostrando ${d.documentos?.length||0}`;
    }catch(_){/* la transparencia nunca debe bloquear la bandeja */}
  }
  function iniciar(){
    const s=document.createElement('style');s.textContent='.cobertura{display:flex;gap:10px;flex-wrap:wrap;align-items:center;margin:0 auto 18px;padding:10px 14px;border:1px solid #d8d1c4;border-radius:10px;background:#f8f6ef;color:#5f6558;font:500 12px IBM Plex Sans,sans-serif;letter-spacing:.04em}.cobertura span{padding-right:10px;border-right:1px solid #d8d1c4}.cobertura span:last-child{border-right:0}.cobertura b{color:#202820}';document.head.appendChild(s);
    const cab=document.getElementById('cab'); if(cab){const box=document.createElement('div');box.id='cobertura';box.className='marco cobertura';box.hidden=true;cab.insertAdjacentElement('afterend',box);}
    cargarCobertura();
  }
  if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',iniciar,{once:true});else iniciar();
})();
