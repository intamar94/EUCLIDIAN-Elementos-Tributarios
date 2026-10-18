/* EUCLIDIAN · Validador documental v2 (solo servidor y pruebas).
   Un cotejo técnico jamás autoriza conclusiones jurídicas automáticamente. */
import {createHash} from 'node:crypto';

const CLASES=new Set(['cambio','vigencia','fecha_aplicacion','sujetos','excepcion']);
const UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const HEX64=/^[0-9a-f]{64}$/i;
const MAX_BYTES=5*1024*1024;
const esObjeto=x=>!!x&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const textoValido=(s,min,max)=>typeof s==='string'&&s.trim().length>=min&&s.length<=max;

export function huellaSHA256(texto){
 if(typeof texto!=='string')throw new TypeError('texto_fuente_invalido');
 return createHash('sha256').update(texto,'utf8').digest('hex');
}
export function urlOficialDIAN(valor){
 if(typeof valor!=='string'||valor.length>2000)return '';
 try{
  const u=new URL(valor);
  const host=u.hostname.toLowerCase();
  if(u.protocol!=='https:'||u.username||u.password||(!['','443'].includes(u.port))||
    !(host==='dian.gov.co'||host.endsWith('.dian.gov.co'))||
    !u.pathname||u.pathname==='/')return '';
  return u.href;
 }catch(_){return '';}
}
function fechaISO(valor){
 if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}$/.test(valor))return false;
 const d=new Date(valor+'T00:00:00Z');
 return !Number.isNaN(d.getTime())&&d.toISOString().slice(0,10)===valor;
}
function fechaUTC(valor){
 if(typeof valor!=='string'||!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(valor))return false;
 const d=new Date(valor);
 return !Number.isNaN(d.getTime())&&d.toISOString()===valor.replace(/Z$/,valor.includes('.')?(''+'Z'):'Z')
   ||(!Number.isNaN(d.getTime())&&Date.parse(valor)===d.getTime());
}
function validarFuente(fuente,campo,errores){
 if(!esObjeto(fuente)){errores.push(campo+':objeto_requerido');return;}
 if(!urlOficialDIAN(fuente.url))errores.push(campo+':url_no_oficial');
 if(!HEX64.test(fuente.documento_sha256||''))errores.push(campo+':huella_documental_invalida');
 if(!textoValido(fuente.pasaje,20,2000))errores.push(campo+':pasaje_requerido');
 else if(fuente.pasaje_sha256!==huellaSHA256(fuente.pasaje))errores.push(campo+':huella_pasaje_incorrecta');
 if(!fechaUTC(fuente.capturado_en))errores.push(campo+':captura_utc_invalida');
 if(!esObjeto(fuente.localizador)||!(
   Number.isInteger(fuente.localizador.pagina)&&fuente.localizador.pagina>=1&&fuente.localizador.pagina<=30000||
   textoValido(fuente.localizador.epigrafe,3,200))){
  errores.push(campo+':localizador_requerido');
 }
}
export function validarPropuestaEvidencia(propuesta){
 const errores=[];
 if(!esObjeto(propuesta))return {estado:'incompleto',errores:['propuesta:objeto_requerido']};
 if(!UUID.test(propuesta.documento_id||''))errores.push('documento_id:uuid_invalido');
 if(!CLASES.has(propuesta.clase))errores.push('clase:no_permitida');
 if(!textoValido(propuesta.afirmacion,15,1500))errores.push('afirmacion:invalida');
 if(propuesta.clase==='fecha_aplicacion'&&!fechaISO(propuesta.fecha_propuesta))
  errores.push('fecha_propuesta:invalida');
 validarFuente(propuesta.fuente,'fuente',errores);
 if(propuesta.clase==='cambio')validarFuente(propuesta.fuente_anterior,'fuente_anterior',errores);
 return {estado:errores.length?'incompleto':'pendiente_cotejo',errores};
}
function cotejarFuente(referencia,contenido){
 if(typeof contenido!=='string'||Buffer.byteLength(contenido,'utf8')>MAX_BYTES)
  return {coincide:false,motivo:'contenido_ausente_o_excesivo'};
 if(huellaSHA256(contenido)!==referencia.documento_sha256)
  return {coincide:false,motivo:'version_documental_no_coincide'};
 if(!contenido.includes(referencia.pasaje))
  return {coincide:false,motivo:'pasaje_no_localizado'};
 return {coincide:true,motivo:'texto_literal_coincidente'};
}
/* Los textos completos los suministra un backend de ingesta con autorización;
   nunca se confía en una huella o revisión enviada por un navegador. */
export function cotejarPasajes(propuesta,{texto_actual,texto_anterior}={}){
 const forma=validarPropuestaEvidencia(propuesta);
 if(forma.errores.length)return {estado:'incompleto',errores:forma.errores};
 const actual=cotejarFuente(propuesta.fuente,texto_actual);
 const anterior=propuesta.clase==='cambio'
  ?cotejarFuente(propuesta.fuente_anterior,texto_anterior)
  :null;
 const concuerda=actual.coincide&&(anterior===null||anterior.coincide);
 return {
  estado:concuerda?'pendiente_revision_juridica':'por_confirmar',
  cotejo_tecnico:concuerda,revision_humana:false,
  // La comprobación del localizador requiere además comparar la página o epígrafe.
  ubicacion_pendiente:true,
  actual,anterior,
  advertencia:'El cotejo del texto no demuestra vigencia, cambio jurídico ni aplicabilidad individual.'
 };
}
