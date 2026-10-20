import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
const code=fs.readFileSync('asistente.js','utf8');
// DOM mínimo para ejecutar eventos y estados reales, sin añadir dependencias.
class Node{
 constructor(tag,text=''){this.tag=tag;this.textContent=text;this.attrs={};this.children=[];this.events={};this.value='';this.checked=false;this.hidden=false;this.classList={add(){}};}
 setAttribute(k,v){this.attrs[k]=String(v);if(k==='type')this.type=v;}
 append(...nodes){this.children.push(...nodes);}
 appendChild(n){this.append(n);}
 replaceChildren(...nodes){this.children=nodes;}
 get childNodes(){return this.children;}
 addEventListener(ev,cb){this.events[ev]=cb;}
 emit(ev){this.events[ev]?.({preventDefault(){}});}
 matches(s){if(s==='textarea,input')return ['textarea','input'].includes(this.tag);if(s.startsWith('['))return Object.hasOwn(this.attrs,s.slice(1,-1));return this.tag===s;}
 querySelectorAll(s){const out=[];for(const c of this.children){if(c.matches(s))out.push(c);out.push(...c.querySelectorAll(s));}return out;}
 querySelector(s){return this.querySelectorAll(s)[0]??null;}
 focus(){this.focused=true;}
 click(){this.emit('click');}
 remove(){}
}
const panel=new Node('div'),body=new Node('body');
const document={readyState:'complete',getElementById:id=>id==='asistentePanel'?panel:null,createElement:t=>new Node(t),createTextNode:t=>new Node('#text',t),body};
const ctx={window:{},document,Blob,URL,setTimeout:cb=>cb()};vm.runInNewContext(code,ctx);
const api=ctx.window.EuclidianAsistente,field=()=>panel.querySelector('[data-asistente-pregunta]'),confirmation=()=>panel.querySelector('[data-asistente-sin-datos]'),status=()=>panel.querySelector('[data-asistente-estado]').textContent,steps=()=>panel.querySelector('[data-asistente-pasos]');
const submit=()=>panel.querySelector('form').emit('submit');
const buttons=()=>panel.querySelectorAll('button');
assert.equal(api.montar(),true);assert.equal(panel.querySelectorAll('form').length,1);
field().value='IVA';confirmation().checked=true;submit();assert.equal(steps().hidden,true);assert.match(status(),/8 caracteres/);
field().value='Cómo aplica la retención sobre servicios';confirmation().checked=false;submit();assert.match(status(),/Confirma/);assert.equal(steps().hidden,true);
confirmation().checked=true;submit();assert.equal(steps().hidden,false);assert.equal(panel.querySelector('[data-asistente-consulta]').value,'retención servicios');
const contadorChecks=panel.querySelectorAll('[data-contador-evidencia-check]');assert.equal(contadorChecks.length,3);assert.equal(api.estadoEvidencia(),'pendiente_de_cotejo');contadorChecks.forEach(n=>{n.checked=true;n.emit('change');});assert.equal(api.estadoEvidencia(),'requiere_revisor');
const revision=panel.querySelectorAll('[data-asistente-check]').find(n=>n.attrs['data-asistente-check']==='revision');revision.checked=true;revision.emit('change');assert.equal(api.estadoEvidencia(),'documentado');
assert.match(status(),/no se ha consultado/);buttons().find(n=>n.textContent==='Buscar estas palabras').click();assert.match(status(),/no está disponible/);
let sent='';ctx.window.euclidianBuscarTexto=q=>{sent=q;return true;};buttons().find(n=>n.textContent==='Buscar estas palabras').click();assert.equal(sent,'retención servicios');assert.match(status(),/no se ha verificado/);
ctx.window.euclidianBuscarTexto=()=>false;buttons().find(n=>n.textContent==='Buscar estas palabras').click();assert.match(status(),/no confirmó/);
ctx.window.euclidianBuscarTexto=()=>{throw Error('secret db error');};buttons().find(n=>n.textContent==='Buscar estas palabras').click();assert.match(status(),/No se pudo/);assert.doesNotMatch(status(),/secret/);
const checks=panel.querySelectorAll('[data-asistente-check]');assert.equal(checks.length,5);checks.forEach(n=>{n.checked=true;n.emit('change');});assert.match(panel.querySelector('[data-asistente-pendientes]').textContent,/no ha comprobado/);assert.match(api.hoja(),/no acredita aprobación profesional/);assert.equal((api.hoja().match(/Marcado por el usuario/g)||[]).length,5);
panel.querySelector('[data-asistente-consulta]').emit('input');assert(checks.every(n=>!n.checked));assert.equal((api.hoja().match(/\[Pendiente\]/g)||[]).length,5);
field().value='<img src=x onerror=alert(1)> https://evil.invalid <script>hack</script> '+ 'x'.repeat(700);confirmation().checked=true;submit();assert.equal(field().value.length,600);assert.equal(panel.querySelectorAll('img').length,0);assert.equal(panel.querySelectorAll('script').length,0);assert(api.palabras(field().value).length<=180);assert.match(api.hoja(),/BORRADOR/);assert.doesNotMatch(api.palabras(field().value),/[<>]/);
field().value='tema cambiado';field().emit('input');assert.equal(steps().hidden,true);assert.match(status(),/Prepara de nuevo/);assert.doesNotMatch(api.hoja(),/evil/);
field().value='NIT 123456789';confirmation().checked=true;submit();assert.equal(api.estadoEvidencia(),'abstencion');assert.equal(field().value,'');assert.equal(steps().hidden,true);
api.limpiar();assert.equal(field().value,'');assert.equal(confirmation().checked,false);assert(checks.every(n=>!n.checked));assert.equal(api.estadoEvidencia(),'pendiente_de_cotejo');assert.equal(steps().hidden,true);assert.match(status(),/limpiada/);
assert.doesNotMatch(code,/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon|innerHTML|SUPABASE/);
// No fuente/cita inventada, ni dominios arbitrarios navegables: únicamente invoca el buscador existente.
assert.doesNotMatch(code,/window\.open|location\s*=|https?:\/\//);assert.match(code,/ok===true/);
const css=fs.readFileSync('asistente.css','utf8');assert.match(css,/font-size:16px/);assert.match(css,/focus-visible/);assert.match(css,/\[hidden\]/);
console.log('Guía M8: límites, consentimiento, búsqueda explícita, fallos, checklist autodeclarado, XSS, edición y limpieza aprobados.');
