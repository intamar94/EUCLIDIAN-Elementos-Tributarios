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
  // Una fecha sin coherencia con el año del identificador interno no se promueve.
  fechaActo:d.fecha_es_real===true&&
    (!/-((?:19|20)\d{2})$/.test(String(d.numero_resolucion||''))||
    String(d.numero_resolucion).slice(-4)===fechaValida(d.fecha_publicacion).slice(0,4))
    ?fechaValida(d.fecha_publicacion):'',
  fechaWeb:fechaValida(d.fecha_publicacion_web),
  fechaAplicacion:cotejado?fechaValida(d.fecha_entrada_vigencia):'',
  resumen:cotejado?limpiar(d.resumen_humano||'',460):'',
  // El borrador usa campos normalizados: no conserva datos sin revisar ni datos de clientes.
  temas:lista(d.temas).filter(t=>!t.startsWith('dian:')&&t!=='boletin_mensual'),
  relaciones:lista(d.modifica_a)
 };
}

/* La matriz distingue procedencia y cotejo documental de evidencia por pasaje.
   La API actual NO expone citas por afirmación: ninguna obligación, modificación
   ni fecha efectiva puede considerarse demostrada automáticamente. */
function matrizEvidencia(d,p=preparar(d)){
 const filas=[
  {campo:'fuente',rotulo:'Fuente oficial',estado:p.fuente?'registrado':'pendiente',
   detalle:p.fuente?'Enlace HTTPS del documento DIAN registrado. No prueba disponibilidad actual.':'Falta un enlace individual permitido y comprobable.'},
  {campo:'fecha_acto',rotulo:'Fecha del acto',estado:p.fechaActo?'registrado':'pendiente',
   detalle:p.fechaActo?'Fecha exacta registrada, con bandera de fecha real y año coherente.':'Fecha exacta pendiente o inconsistente con el identificador.'},
  {campo:'sintesis',rotulo:'Síntesis',estado:p.resumen?'registrado':'pendiente',
   detalle:p.resumen?'Síntesis incluida tras controles documentales. Falta cita por pasaje para cada afirmación.':'No hay síntesis contrastada disponible en esta ficha.'},
  {campo:'cambio',rotulo:'Cambio de criterio',estado:'pendiente',
   detalle:p.relaciones.length?'Hay relaciones catalogadas; falta acreditar el efecto mediante pasaje y documento anterior.':'No hay modificación acreditada mediante citas de los documentos.'},
  {campo:'alcance',rotulo:'Sujetos y excepciones',estado:'pendiente',
   detalle:'Falta vincular hechos, sujetos, período y excepciones a pasajes oficiales y al caso individual.'},
  {campo:'aplicacion',rotulo:'Aplicación temporal',estado:'pendiente',
   detalle:p.fechaAplicacion?'El catálogo contiene '+p.fechaAplicacion+'; sin cita específica no se acredita el efecto temporal.':'No consta fecha efectiva verificada con pasaje y excepciones.'}
 ];
 return filas;
}

const tareas=[
 'Contrastar el documento íntegro y la fuente oficial.',
 'Comprobar sujetos, hechos, períodos y excepciones.',
 'Verificar vigencia y fecha efectiva antes de informar o actuar.'
];
function borrarFalsasCertezas(){} // Contract marker for conservative reports
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
  'El análisis no acredita modificaciones, fecha efectiva ni sujetos afectados sin citar los pasajes oficiales.','',
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
  'Matriz de evidencia y límites:',
  ...matrizEvidencia(p.original||{},p).map(r=>'- '+r.rotulo+': '+r.estado.toUpperCase()+' — '+r.detalle),'',
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
 const evidencias=matrizEvidencia(d,p);
 return `<details class="practico-30"><summary><span class="practico-signo" aria-hidden="true">◇</span><span><strong>Lectura práctica · 30 segundos</strong><small>Qué sabemos y qué falta comprobar · Preparar informe</small></span></summary>
 <div class="practico-interior"><p class="practico-nota">Guía de revisión, no conclusión jurídica sobre un cliente.</p>
 <dl class="practico-grid">
  <div><dt>Qué dice el documento</dt><dd>${escapar(p.resumen||'No hay síntesis contrastada. Consulta el texto oficial.')}</dd></div>
  <div><dt>Qué cambió</dt><dd>${escapar(cambio)}</dd></div>
  <div><dt>A quién puede afectar</dt><dd>Determinar sujetos y excepciones según los hechos del cliente.${p.temas.length?' Materias registradas: '+escapar(p.temas.join(' · '))+'.':''}</dd></div>
  <div><dt>Desde cuándo</dt><dd>${escapar(fecha)}</dd></div>
 </dl>
 <div class="practico-evidencia">
  <strong>Mapa de evidencia</strong>
  <p>Lo registrado en el catálogo no equivale a una conclusión jurídica. Se requiere cita del pasaje oficial para afirmar un cambio o una obligación.</p>
  <ul>${evidencias.map(r=>`<li><span class="practico-evidencia-etiqueta">${escapar(r.rotulo)}</span><span class="practico-estado ${r.estado}">${r.estado==="registrado"?"Dato registrado":"Por confirmar"}</span><small>${escapar(r.detalle)}</small></li>`).join("")}</ul>
 </div>
 <div class="practico-check"><strong>Qué revisar</strong>${tareas.map(t=>`<label><input type="checkbox"><span>${escapar(t)}</span></label>`).join('')}</div>
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
window.EuclidianPractico={panel,preparar,borrador,fuenteSegura,matrizEvidencia};
})();