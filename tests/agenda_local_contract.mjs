import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';
const code=readFileSync(new URL('../agenda.js',import.meta.url),'utf8');
const context={window:{addEventListener(){}},document:{readyState:'loading',addEventListener(){},getElementById(){return null;}},URL,Map,Date,Object,String,setTimeout};
vm.runInNewContext(code,context);const a=context.window.EuclidianAgenda;
const base={titulo:'Revisar resolución',fecha:'2026-10-20',referencia:'Resolución DIAN',url:'https://www.dian.gov.co/resolucion.pdf'};
assert.equal(a.fechaValida('2024-02-29'),true);for(const f of ['2026-02-29','2026-04-31','2026-00-10','2026-13-01','2026-1-01','2026-10-20T00:00Z','1899-01-01','9999-01-01'])assert.equal(a.fechaValida(f),false,f);
for(const url of ['http://dian.gov.co','https://dian.gov.co.evil.com','https://evildian.gov.co','https://user@dian.gov.co','javascript:alert(1)','https://dian.gov.co:8443','https://haciendabogota.gov.co.evil.com','https://fakehaciendabogota.gov.co','https://user@haciendabogota.gov.co','https://haciendabogota.gov.co:8443'])assert.throws(()=>a.agregar({...base,url}),/enlace HTTPS/);
assert.throws(()=>a.agregar({...base,fecha:'2026-02-30'}),/fecha válida/);
assert.throws(()=>a.agregar({...base,referencia:''}),/referencia/);
const bogota={...base,url:'https://www.haciendabogota.gov.co/es/calendario-tributario'};
const b=a.agregar(bogota);assert.equal(a.listar()[0].jurisdiccion,'Bogotá · Hacienda Distrital');assert.ok(a.csv().includes('Jurisdicción de la fuente'));
const id=a.agregar(base);assert.equal(a.listar()[0].jurisdiccion,'Bogotá · Hacienda Distrital');assert.equal(a.listar().length,2);assert.equal(a.listar()[0].fecha,base.fecha);assert.equal(a.completar(id,true),true);assert.equal(a.listar()[0].completada,true);assert.equal(a.completar(id,'yes'),false);const copy=a.listar();copy[0].titulo='mutado';assert.equal(a.listar()[0].titulo,base.titulo);
a.agregar({...base,titulo:'=HYPERLINK("https://evil")',fecha:'2026-10-19'});a.agregar({...base,titulo:'@SUM(1)\r\n=1'});assert.ok(a.csv().includes('"\'=HYPERLINK(""https://evil"")"'));assert.ok(a.csv().includes('"\'@SUM(1) =1"'));assert.equal(a.listar()[0].fecha,'2026-10-19');assert.ok(a.csv().includes('Fecha elegida por el usuario'));
a.agregar({...base,titulo:'<img src=x onerror=alert(1)>'});assert.ok(a.csv().includes('<img')); // CSV is data, no HTML execution path.
assert.equal(a.eliminar(b),true);assert.equal(a.eliminar(id),true);assert.equal(a.eliminar(id),false);a.limpiar();assert.equal(a.listar().length,0);
for(let i=0;i<40;i++)a.agregar(base);assert.throws(()=>a.agregar(base),/40 tareas/);a.limpiar();
const borrador={elements:Object.fromEntries(['titulo','fecha','referencia','url'].map(k=>[k,{value:''}]))};
borrador.reset=()=>Object.values(borrador.elements).forEach(el=>el.value='');
context.document.getElementById=id=>id==='agendaFormulario'?borrador:null;
assert.equal(a.tieneDatos(),false);
for(const campo of ['titulo','fecha','referencia','url']){
 borrador.elements[campo].value='Dato sin añadir';assert.equal(a.tieneDatos(),true,campo+' pendiente');
 a.limpiar();assert.equal(a.tieneDatos(),false,'Limpiar elimina también '+campo);
}
assert.ok(!/localStorage|sessionStorage|fetch\(|XMLHttpRequest|sendBeacon/.test(code));
console.log('Agenda local: DIAN/Bogotá, fecha/fuente, tareas, aislamiento, límites y CSV seguro aprobados.');
