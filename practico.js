/* EUCLIDIAN — ficha de trabajo v1. Sin inferir obligaciones ni vigencias. */
(function(){
'use strict';
const registros=new Map();
const limpiar=(v,limite=600)=>String(v??'').replace(/\s+/g,' ').trim().slice(0,limite);
const escapar=v=>limpiar(v,2500).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
const lista=(v,max=4)=>Array.isArray(v)?v.filter(x=>typeof x==='string'&&limpiar(x)).slice(0,max).map(x=>limpiar(x,160)):[];
function fuenteSegura(v){try{const u=new URL(String(v||''));return u.protocol==='https:'&&(u.hostname==='dian.gov.co'||u.hostname.endsWith('.dian.gov.co'))?u.href:'';}catch(_){return '';}}
function fechaValida(v){const s=String(v||'').slice(0,10);if(!/^\d{4}-\d\d-\d\d$/.test(s))return '';const d=new Date(s+'T00:00:00Z');return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===s?s:'';}
function preparar(d){
 const fuente=fuenteSegura(d.enlace_oficial);
 const cotejado=String(d.evaluacion_resultado||'').toUpperCase()==='APPROVE'&&d.estado_fuente_verificacion==='verificado_oficial'&&!!fuente;
 return {
  id:limpiar(d.id,120),referencia:limpiar(d.numero_resolucion||d.numero_interno||'',120)||'Por identificar',
  titulo:limpiar(d.titulo||d.numero_resolucion||'',230)||'Documento del catálogo',
  fuente,cotejado,estadoVigencia:limpiar(d.estado_vigencia||'',50),
  fechaActo:d.fecha_es_real===true?fechaValida(d.fecha_publicacion):'',
  fechaWeb:fechaValida(d.fecha_publicacion_web),
  fechaAplicacion:cotejado?fechaValida(d.fecha_entrada_vigencia):'',
  resumen:cotejado?limpiar(d.resumen_humano||'',460):'',
  temas:lista(d.temas).filter(t=>!t.startsWith('dian:')&&t!=='boletin_mensual'),
  relaciones:lista(d.modifica_a)
 };
}
const tareas=[
 'Contrastar el documento íntegro y la fuente oficial.',
 'Comprobar sujetos, hechos, períodos y excepciones.',
 'Verificar vigencia y fecha efectiva antes de informar o actuar.'
];
function borrador(p,tipo){
 const cabecera=[tipo==='cliente'?'MENSAJE PARA CLIENTE — BORRADOR':'INFORME TÉCNICO — BORRADOR',
  'EUCLIDIAN · Elementos Tributarios','',`Documento: ${p.titulo}`,`Referencia: ${p.referencia}`,
  `Fuente DIAN: ${p.fuente||'No disponible para cotejo en esta ficha'}`,
  `Fecha del acto: ${p.fechaActo||'Por confirmar'}`,
  `Publicación web: ${p.fechaWeb||'Por confirmar'}`,''];
 if(tipo==='cliente')return [...cabecera,
  'Mensaje para revisar antes de enviar:',
  `Se ha identificado una publicación de la DIAN relacionada con ${p.temas.join(', ')||'materias tributarias por determinar'}.`,
  'Estamos verificando el alcance, las personas a quienes puede aplicar, las excepciones y las fechas correspondientes.',
  'Esta publicación no implica por sí sola que exista una nueva obligación para usted.',
  'Cualquier recomendación concreta requiere consultar la fuente oficial y las circunstancias de su caso.','',
  'Explicación personalizada: [completar tras revisión profesional]','',
  'BORRADOR. No enviado; no sustituye una interpretación profesional.'
 ].join('\n');
 return [...cabecera,
  `Síntesis del catálogo: ${p.resumen||'No hay síntesis contrastada disponible.'}`,
  `Temas: ${p.temas.join(' · ')||'Por determinar en la fuente'}`,
  `Qué cambió: ${p.relaciones.length?'Relaciones registradas: '+p.relaciones.join('; ')+'. Verificar contenido y alcance.':'No existe un cambio concreto acreditado en esta ficha; comprobar en la fuente.'}`,
  'A quién afecta: por determinar con hechos, sujetos y excepciones.',
  `Vigencia: ${p.estadoVigencia||'Por confirmar'} (dato de catálogo: verificar para el caso).`,
  `Fecha de aplicación: ${p.fechaAplicacion?p.fechaAplicacion+' (comprobar excepciones)':'Por confirmar'}`,
  `Respaldo: ${p.cotejado?'Metadatos cotejados; no constituye análisis de aplicación individual.':'Cotejo pendiente para una conclusión.'}`,'',
  'Checklist del profesional:',...tareas.map(x=>'☐ '+x),'',
  'Conclusión propia: [completar tras comprobación]','',
  'BORRADOR. No acredita por sí solo obligación, cambio, fecha ni vigencia para un cliente.'
 ].join('\n');
}
function panel(d){
 if(!d||d.tipo_documento==='boletin')return '';
 const p=preparar(d);if(!p.id)return '';
 registros.set(p.id,p);if(registros.size>250)registros.delete(registros.keys().next().value);
 const cambio=p.relaciones.length?'Hay relaciones documentales registradas; verifica su efecto.':'Cambio concreto pendiente de comprobación.';
 const fecha=p.fechaAplicacion?'Fecha registrada: '+p.fechaAplicacion+'; verificar alcance y excepciones.':'Fecha de aplicación por confirmar.';
 return `<details class="practico-30"><summary><span class="practico-signo" aria-hidden="true">◇</span><span><strong>Lectura práctica · 30 segundos</strong><small>Qué sabemos y qué falta comprobar · Preparar informe</small></span></summary>
 <div class="practico-interior"><p class="practico-nota">Guía de revisión, no conclusión jurídica sobre un cliente.</p>
 <dl class="practico-grid">
  <div><dt>Qué dice el documento</dt><dd>${escapar(p.resumen||'No hay síntesis contrastada. Consulta el texto oficial.')}</dd></div>
  <div><dt>Qué cambió</dt><dd>${escapar(cambio)}</dd></div>
  <div><dt>A quién puede afectar</dt><dd>Determinar sujetos y excepciones según los hechos del cliente.${p.temas.length?' Materias registradas: '+escapar(p.temas.join(' · '))+'.':''}</dd></div>
  <div><dt>Desde cuándo</dt><dd>${escapar(fecha)}</dd></div>
 </dl><div class="practico-check"><strong>Qué revisar</strong>${tareas.map(t=>`<label><input type="checkbox"><span>${escapar(t)}</span></label>`).join('')}</div>
 <div class="practico-acciones">
 ${p.fuente?`<a href="${escapar(p.fuente)}" target="_blank" rel="noopener noreferrer">Consultar fuente DIAN ↗</a>`:'<span>Fuente individual por confirmar</span>'}
 <button type="button" data-practico-tipo="tecnico" data-practico-id="${escapar(p.id)}">Informe técnico (.txt)</button>
 <button type="button" data-practico-tipo="cliente" data-practico-id="${escapar(p.id)}">Texto para cliente (.txt)</button>
 </div><p class="practico-pie">Borradores descargables para editar. No se envían ni generan una asesoría automática.</p></div></details>`;
}
function descargar(p,tipo){
 const texto=borrador(p,tipo);
 const ref=p.referencia.normalize('NFD').replace(/[\u0300-\u036f]/g,'').replace(/[^a-zA-Z0-9_-]/g,'-').slice(0,65)||'documento';
 const blob=new Blob([texto],{type:'text/plain;charset=utf-8'}),url=URL.createObjectURL(blob);
 const a=document.createElement('a');a.href=url;a.download=`euclidian-${tipo}-${ref}.txt`;
 document.body.appendChild(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
if(typeof document!=='undefined')document.addEventListener('click',e=>{
 const b=e.target.closest?.('[data-practico-tipo]');if(!b)return;
 const p=registros.get(b.dataset.practicoId);if(p)descargar(p,b.dataset.practicoTipo==='cliente'?'cliente':'tecnico');
});
window.EuclidianPractico={panel,preparar,borrador,fuenteSegura};
})();