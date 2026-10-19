import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

// Exercise the shipped guide with a small DOM harness; no database or account needed.
function setup({storageBlocked=false,locked=false}={}){
  const nodes=new Map(),stored=new Map();let focused='';
  function node(id){
    if(nodes.has(id))return nodes.get(id);
    const listeners={};const item={id,hidden:false,disabled:false,dataset:{},textContent:'',
      addEventListener(type,fn){listeners[type]=fn;},
      click(){if(!this.disabled)listeners.click?.({target:this});},
      dispatch(target){listeners.click?.({target});},
      focus(){focused=id;},scrollIntoView(){},closest(selector){return selector==='[hidden]'&&this.hidden?this:null;},
      set innerHTML(value){this.html=value;for(const match of value.matchAll(/id="([^"]+)"/g))node(match[1]);}
    };nodes.set(id,item);return item;
  }
  for(const id of ['guiaIndice','guiaPaso','guiaProgreso','guiaAnterior','guiaSiguiente','abrirGuia','saltarGuia','bienvenida','atajos','navConsultar','navNovedades','navExplorar','navCuenta'])node(id);
  let view='inicio';const views={navConsultar:['consultar','consulta'],navNovedades:['novedades','novedadesCab'],navExplorar:['explorar','agregarTema'],navCuenta:['cuenta','cuentaPanel']};
  for(const [id,[name,target]] of Object.entries(views))node(id).addEventListener('click',()=>{view=locked?'cuenta':name;node(target).hidden=locked&&name!=='cuenta';});
  const context={document:{getElementById:node,querySelector:()=>node('atajos')},localStorage:{setItem(k,v){if(storageBlocked)throw Error('denied');stored.set(k,v);},getItem(k){if(storageBlocked)throw Error('denied');return stored.get(k);}},window:{matchMedia:()=>({matches:true}),euclidianCambiarVista(v){view=v;}}};
  vm.runInNewContext(fs.readFileSync('bienvenida.js','utf8'),context);
  return {node,stored,context,get focused(){return focused;},get view(){return view;},shortcut(id){const button={dataset:{inicioDestino:id},closest(){return this;}}; // Dispatch through the actual listener registered on the container.
    // Node click events normally target the button, including clicks on its nested label.
    node('atajos').dispatch(button);
  }};
}


const ui=setup();
ui.context.window.euclidianIniciarGuia();assert.equal(ui.view,'guia');assert.equal(ui.node('guiaProgreso').textContent,'Paso 1 de 5');
ui.node('guiaSiguiente').click();assert.equal(ui.node('guiaProgreso').textContent,'Paso 2 de 5');assert.equal(ui.focused,'guiaPasoTitulo');
ui.node('guiaAnterior').click();assert.equal(ui.node('guiaAnterior').disabled,true);assert.equal(ui.focused,'guiaPasoTitulo');
ui.node('guiaDestino').click();assert.equal(ui.view,'consultar');assert.equal(ui.focused,'consulta');assert.equal(ui.stored.get('euclidian_guia_inicio_v1'),'completada');
for(const [id,view,focus] of [['navConsultar','consultar','consulta'],['navNovedades','novedades','novedadesCab'],['navExplorar','explorar','agregarTema']]){
 ui.shortcut(id);assert.equal(ui.view,view);assert.equal(ui.focused,focus);
}
ui.node('abrirGuia').click();assert.equal(ui.view,'guia');assert.equal(ui.focused,'saltarGuia');
for(let i=0;i<5;i++)ui.node('guiaSiguiente').click();assert.equal(ui.view,'inicio');assert.equal(ui.focused,'abrirGuia');
const blocked=setup({storageBlocked:true});blocked.context.window.euclidianIniciarGuia();blocked.node('guiaDestino').click();assert.equal(blocked.view,'consultar');
const locked=setup({locked:true});locked.shortcut('navConsultar');assert.equal(locked.view,'cuenta');assert.notEqual(locked.focused,'consulta');
console.log('Navegación UX: accesos reales, foco de pasos y destinos, retorno, almacenamiento bloqueado y acceso denegado OK');
