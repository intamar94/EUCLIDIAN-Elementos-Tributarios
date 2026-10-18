import assert from 'node:assert/strict';
import {huellaSHA256,urlOficialDIAN,validarPropuestaEvidencia,cotejarPasajes} from '../lib/evidencia-pasajes.js';
import {readFileSync} from 'node:fs';

const uuid='00000000-0000-4000-8000-000000000001';
const actual='PRIMER PÁRRAFO oficial de prueba.\nEl concepto desarrolla hechos relevantes y contiene un pasaje literal sobre tratamiento de IVA para un caso determinado.\nCIERRE.';
const previo='PUBLICACIÓN DIAN anterior.\nEl pasaje oficial anterior tenía condiciones y excepciones distintas, pendientes de interpretación jurídica.\nFIN.';
const parrafo='El concepto desarrolla hechos relevantes y contiene un pasaje literal sobre tratamiento de IVA para un caso determinado.';
const anteriorParrafo='El pasaje oficial anterior tenía condiciones y excepciones distintas, pendientes de interpretación jurídica.';
const baseFuente=(texto,pasaje)=>({
 url:'https://normograma.dian.gov.co/dian/compilacion/docs/oficio_001_2026.htm',
 documento_sha256:huellaSHA256(texto),
 pasaje,pasaje_sha256:huellaSHA256(pasaje),
 capturado_en:'2026-10-18T08:12:00Z',
 localizador:{pagina:3,epigrafe:'Tema IVA'}
});
const fuente=baseFuente(actual,parrafo);
function base(extra={}){
 return {
 documento_id:uuid,clase:'vigencia',
 afirmacion:'Revisar cómo se interpreta el criterio tributario en el período correspondiente.',
 fuente,...extra
 };
}
const basica=validarPropuestaEvidencia(base());
assert.equal(basica.estado,'pendiente_cotejo');
assert.deepEqual(basica.errores,[]);
const cotejo=cotejarPasajes(base(),{texto_actual:actual});
assert.equal(cotejo.cotejo_tecnico,true);
assert.equal(cotejo.estado,'pendiente_revision_juridica');
assert.equal(cotejo.revision_humana,false);
assert.equal(cotejo.ubicacion_pendiente,true);
assert.match(cotejo.advertencia,/no demuestra vigencia/i);
const falsasCredenciales=cotejarPasajes(base({estado:'confirmado',revision_humana:true,revisor_id:'administrador'}),{texto_actual:actual});
assert.equal(falsasCredenciales.estado,'pendiente_revision_juridica');
assert.equal(falsasCredenciales.revision_humana,false);

const modificado=cotejarPasajes(base(),{texto_actual:actual+'\nTexto nuevo'});
assert.equal(modificado.estado,'por_confirmar');
assert.equal(modificado.actual.motivo,'version_documental_no_coincide');
const pasajeInexistente=cotejarPasajes(base({fuente:{...fuente,pasaje:'Aquí aparece una afirmación falsa, no sustentada por el documento.',pasaje_sha256:huellaSHA256('Aquí aparece una afirmación falsa, no sustentada por el documento.')}}),{texto_actual:actual});
assert.equal(pasajeInexistente.estado,'por_confirmar');
assert.equal(pasajeInexistente.actual.motivo,'pasaje_no_localizado');
const falsoHash=validarPropuestaEvidencia(base({fuente:{...fuente,pasaje_sha256:huellaSHA256('Otro texto')}}));
assert.equal(falsoHash.estado,'incompleto');
assert.ok(falsoHash.errores.includes('fuente:huella_pasaje_incorrecta'));

const cambio=base({clase:'cambio',fuente_anterior:baseFuente(previo,anteriorParrafo)});
const dosFuentes=cotejarPasajes(cambio,{texto_actual:actual,texto_anterior:previo});
assert.equal(dosFuentes.cotejo_tecnico,true);
assert.equal(dosFuentes.revision_humana,false);
assert.equal(dosFuentes.estado,'pendiente_revision_juridica');
const sinAnterior=validarPropuestaEvidencia(base({clase:'cambio'}));
assert.ok(sinAnterior.errores.includes('fuente_anterior:objeto_requerido'));
const docAnteriorAlterado=cotejarPasajes(cambio,{texto_actual:actual,texto_anterior:previo+' alterar'});
assert.equal(docAnteriorAlterado.estado,'por_confirmar');
assert.equal(docAnteriorAlterado.anterior.motivo,'version_documental_no_coincide');

for(const url of [
 'http://normograma.dian.gov.co/dian/compilacion/tributario.html',
 'https://evil.invalid/diAN',
 'https://dian.gov.co.evil.invalid/tributario',
 'https://usr:pass@dian.gov.co/tributario',
 'https://dian.gov.co:444/tributario',
 'javascript:alert(1)'
])assert.equal(urlOficialDIAN(url),'','Solo URL HTTPS oficial: '+url);
assert.ok(urlOficialDIAN('https://normograma.dian.gov.co/dian/compilacion/tributario.html'));
assert.equal(huellaSHA256('abc'),'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
for(const [mod,error] of [
 [{documento_id:'otro'},'documento_id:uuid_invalido'],
 [{clase:'impacto_confirmado'},'clase:no_permitida'],
 [{clase:'fecha_aplicacion',fecha_propuesta:'2026-02-30'},'fecha_propuesta:invalida'],
 [{fuente:{...fuente,capturado_en:'2026-02-30T08:12:00Z'}},'fuente:captura_utc_invalida'],
 [{fuente:{...fuente,localizador:{}}},'fuente:localizador_requerido'],
]){
 const result=validarPropuestaEvidencia(base(mod));
 assert.ok(result.errores.includes(error),'Esperado '+error+'; recibido '+result.errores);
}
assert.equal(cotejarPasajes(null).estado,'incompleto');
assert.equal(cotejarPasajes(base(),{}).estado,'por_confirmar');
assert.doesNotMatch(readFileSync('lib/evidencia-pasajes.js','utf8'),/fetch\(|SUPABASE_SERVICE_KEY|localStorage|new Function/);
assert.ok(!readFileSync('app.html','utf8').includes('evidencia-pasajes.js'),'El validador no debe exponerse al navegador');
console.log('Contrato de pasajes DIAN: cotejo literal, hash, versión, URL, fecha UTC, antecedente, fraude y revisión humana pendiente OK');
