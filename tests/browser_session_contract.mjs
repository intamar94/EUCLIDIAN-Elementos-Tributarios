import assert from 'node:assert/strict';
import vm from 'node:vm';
import {readFile} from 'node:fs/promises';
const storage=new Map(),events=new Map();
const elementos=new Map();
for(const id of ['lista','paginas','hoyLista','hoyResumen','cuentaEmail','perfilNombre','puerta','mal'])elementos.set(id,{hidden:false,textContent:'datos previos',value:'perfil anterior',dataset:{},replaceChildren(){this.textContent='';},addEventListener(){}});
const ctx=vm.createContext({URL,URLSearchParams,Date,Number,String,Object,Promise,console,setTimeout,
  localStorage:{getItem:k=>storage.get(k)||null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)},
  document:{getElementById:id=>elementos.get(id)||null},location:{hash:'',pathname:'/app.html',search:''},
  history:{replaceState(){}},window:{addEventListener:(name,fn)=>events.set(name,fn)}});
vm.runInContext(await readFile(new URL('../auth.js',import.meta.url),'utf8'),ctx);
let liberar,llamadas=0;
ctx.fetch=async()=>{llamadas++;await new Promise(resolve=>liberar=resolve);return {ok:true,json:async()=>({access_token:'nuevo',refresh_token:'nuevo-refresh',expires_in:3600})};};
storage.set('euclidian_access_token','vencido');storage.set('euclidian_refresh_token','refresh');storage.set('euclidian_expires_at','1');
const primera=ctx.window.euclidianAuthToken(),segunda=ctx.window.euclidianAuthToken();
assert.equal(llamadas,1,'La renovación concurrente debe compartir una solicitud');
ctx.window.euclidianAuthExpirada();liberar();
assert.equal(await primera,'');assert.equal(await segunda,'');
assert.equal(storage.has('euclidian_access_token'),false,'Un refresh tardío no debe restaurar una sesión cerrada');
assert.equal(elementos.get('lista').textContent,'');assert.equal(elementos.get('perfilNombre').value,'');
elementos.get('lista').textContent='otra pestaña';elementos.get('puerta').hidden=true;
events.get('storage')({key:'euclidian_access_token'});
assert.equal(elementos.get('lista').textContent,'');assert.equal(elementos.get('puerta').hidden,false);
storage.set('euclidian_access_token','vigente');storage.set('euclidian_expires_at',String(Date.now()/1000+3600));
let liberarCuenta;const espera=new Promise(resolve=>liberarCuenta=resolve);
ctx.fetch=async()=>{await espera;return {ok:true,status:200,json:async()=>({user:{email:'cuenta@example.com'},access:{permitido:true}})};};
const cuenta=ctx.window.euclidianMostrarCuenta();await new Promise(resolve=>setTimeout(resolve,0));
ctx.window.euclidianAuthExpirada();liberarCuenta();assert.equal(await cuenta,null,'Una cuenta tardía no debe reabrir el panel tras cerrar sesión');
console.log('Sesión navegador: refresh concurrente, logout durante refresh, limpieza y cierre entre pestañas OK');
