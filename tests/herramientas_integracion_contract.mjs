import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
let cleared=0,dirty=false,confirmations=0;
const context={window:{EuclidianExpedientes:{hayCambiosSinExportar:()=>dirty},EuclidianAgenda:{limpiar(){cleared++;},tieneDatos:()=>false},EuclidianCartera:{limpiar(){cleared++;},estadoActual:()=>[]},EuclidianExogena:{limpiar(){cleared++;}},EuclidianAsistente:{limpiar(){cleared++;}},confirm(){confirmations++;return false;}}};
vm.runInNewContext(readFileSync('herramientas.js','utf8'),context);
const api=context.window.EuclidianHerramientas;
assert.equal(api.confirmarSalida(),true);assert.equal(confirmations,0);dirty=true;assert.equal(api.confirmarSalida(),false);assert.equal(confirmations,1);api.limpiar();assert.equal(cleared,4);
const html=readFileSync('app.html','utf8'),auth=readFileSync('auth.js','utf8'),bandeja=readFileSync('bandeja.js','utf8');
for(const module of ['cartera','agenda','exogena','asistente']){assert.match(html,new RegExp('id="'+module+'Panel"'));assert.match(html,new RegExp('/'+module+'\\.js'));assert.match(html,new RegExp('/'+module+'\\.css'));}
assert.match(auth,/function authMostrarPuerta\(\)[\s\S]*?EuclidianHerramientas\?\.limpiar\(\)/);
assert.match(bandeja,/if\(r.status===402\)\{\s*window.EuclidianHerramientas\?\.limpiar\(\)/);
assert.match(bandeja,/euclidianBuscarTexto=texto=>\{\s*if\(typeof texto!=='string'\|\|!accesoConsulta/);
console.log('Integración local: módulos, limpieza, salida voluntaria y búsqueda detrás de acceso comprobados.');
