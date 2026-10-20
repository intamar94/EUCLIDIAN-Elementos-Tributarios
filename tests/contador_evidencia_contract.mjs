import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';

const readJson=path=>JSON.parse(readFileSync(path,'utf8'));
const policy=readJson('data/contador/politica.json');
const schema=readJson('data/contador/schema-fuente-v1.json');
const cases=readJson('data/contador/casos-sinteticos-v1.json');
const dian=url=>{try{const u=new URL(url);return u.protocol==='https:'&&!u.username&&!u.password&&(u.hostname==='dian.gov.co'||u.hostname.endsWith('.dian.gov.co'));}catch{return false;}};
const sha=text=>createHash('sha256').update(text).digest('hex');
const pii=texto=>/\b(?:nit|correo|e-?mail|contrase(?:ñ|n)a|documento de identidad|saldo|declaraci[oó]n)\b/i.test(texto)||/\b\d{9,10}\b/.test(texto);
const allowed=policy.reglas.afirmaciones_restringidas;
function validate(source){
 const required=schema.required.filter(k=>!(k in source));
 const valid=dian(source.origen_raiz)&&dian(source.url_final)&&/^[a-f0-9]{64}$/.test(source.documento_sha256)&&/^[a-f0-9]{64}$/.test(source.pasaje_sha256)&&source.pasaje_sha256===sha(source.pasaje)&&!required.length;
 return {valid,required};
}

assert.equal(policy.estado,'documental_sin_ia_externa');
assert.deepEqual(policy.reglas.estados_salida,['documentado','pendiente_de_cotejo','requiere_revisor','abstencion']);
assert.ok(cases.casos.every(c=>policy.reglas.estados_salida.includes(c.estado_esperado)));
assert.equal(pii('Mi NIT es 900123456 y tengo saldo.'),true);
assert.equal(pii('Busco un oficio DIAN sobre IVA.'),false);
assert.equal(dian('https://normograma.dian.gov.co/dian/compilacion/tributario.html'),true);
assert.equal(dian('https://dian.gov.co.evil.test/tributario'),false);
const source={origen_raiz:policy.reglas.fuentes_permitidas[1],url_final:'https://normograma.dian.gov.co/dian/compilacion/docs/ejemplo.htm',tipo_documento:'caso sintético',capturado_en:'2026-10-20T00:00:00Z',documento_sha256:sha('documento sintético'),pasaje:'Pasaje sintético: revisar la fuente original.',pasaje_sha256:sha('Pasaje sintético: revisar la fuente original.'),localizador:'Ejemplo, apartado 1',estado:'pendiente_de_cotejo',version:'sintética-v1'};
assert.equal(validate(source).valid,true);
assert.equal(validate({...source,pasaje_sha256:sha('otro')}).valid,false);
assert.equal(validate({...source,url_final:'https://externo.example/'}).valid,false);
const guide=readFileSync('docs/CONTADOR_DE_EVIDENCIA.md','utf8');
for(const term of allowed)assert.match(guide,new RegExp('«'+term+'»'));
assert.match(guide,/No es un contador público humano/i);
assert.doesNotMatch(guide,/asesoramiento personalizado|garantiza resultado/i);
console.log('Contador de Evidencia: fuentes DIAN, hashes, abstención, PII y vocabulario restringido aprobados.');
