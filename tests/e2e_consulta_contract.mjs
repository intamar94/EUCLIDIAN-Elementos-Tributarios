import assert from 'node:assert/strict';
import fs from 'node:fs';

const html=fs.readFileSync('index.html','utf8');
const api=fs.readFileSync('api/documentos.js','utf8');
const nav=fs.readFileSync('bandeja.js','utf8');
const blocks=fs.readFileSync('bloques.js','utf8');
const cards=fs.readFileSync('fichas.js','utf8');
const auth=fs.readFileSync('auth.js','utf8');
const authApi=fs.readFileSync('api/auth.js','utf8');
const sessionApi=fs.readFileSync('api/session.js','utf8');
const authServer=fs.readFileSync('lib/auth-server.js','utf8');

const checks=[
 ['entrada de consulta',html.includes('id="consulta"')&&html.includes('id="formBuscar"')],
 ['API fail-closed',api.includes('falta_configuracion')&&api.includes('autorizarConsulta(req)')],
 ['solo documentos publicables',api.includes('publicado_cliente=is.true')],
 ['fuente oficial expuesta',api.includes('enlace_oficial')&&api.includes('normograma.dian.gov.co')],
 ['vigencia expuesta',api.includes('estado_vigencia')&&api.includes('fecha_entrada_vigencia')],
 ['trazabilidad expuesta',api.includes('fuentes_formales')&&api.includes('modifica_a')&&api.includes('modificado_por')],
 ['verificacion expuesta',api.includes('fecha_es_real')&&api.includes('anotaciones_vigencia')],
 ['novedades exigen evidencia',api.includes('fecha_es_real===true')&&api.includes('texto_completo')],
 ['fecha no verificada no se presenta como exacta',cards.includes('fechaDocumentoConfiable')&&cards.includes('fecha aproximada')&&cards.includes('Índice DIAN')],
 ['UI consulta API',nav.includes("fetch('/api/documentos?")],
 ['UI enlaza fuente DIAN',blocks.includes('enlace_oficial')&&blocks.includes('Abrir fuente DIAN')],
 ['UI muestra fuentes oficiales',blocks.includes('Fuentes oficiales')&&blocks.includes('Abrir documento oficial')],
 ['P3 navegación completa',['Inicio','Consultar','Novedades','Explorar','Seguimientos','Cuenta'].every(x=>html.includes(x))],
 ['P3 carga accesible',html.includes('cargaGeometrica')&&nav.includes('estadoCarga(true')&&nav.includes('estadoCarga(false)')],
 ['P3 exploración funcional',html.includes('explorarTemas')&&nav.includes('renderExplorar(data)')],
 ['P3 acciones de ficha',blocks.includes('ficha-acciones-lectura')&&blocks.includes('data-copy-ref')],
 ['P3 estado esencial legible',blocks.includes('bloqueEstadoClave')&&blocks.includes('Estado esencial del documento')],
 ['P3 historia normativa',blocks.includes('relaciones-vivas')&&blocks.includes('timeline-relaciones')],
 ['P3 estados recuperables',nav.includes('vistaVacia')&&nav.includes('vistaError')&&nav.includes('data-retry-load')],
 ['P3 contexto de consulta',nav.includes('describirConsulta(data)')],
 ['P3 radar visual',nav.includes('visualPrioridad')&&nav.includes('radar-metrica')&&nav.includes('hoy-senal')],
 ['P4 acceso personal visible',html.includes('authLoginForm')&&html.includes('authRegisterForm')&&html.includes('cuentaPanel')],
 ['P4 flujo auth cliente',auth.includes("action:'signin'")&&auth.includes("action:'signup'")&&auth.includes("action:'refresh'")&&auth.includes("action:'recover'")&&auth.includes("action:'logout'")],
 ['P4 consultas usan bearer',nav.includes('Authorization:')&&nav.includes('Bearer')&&api.includes('autorizarConsulta(req)')],
 ['P4 entitlement server-side',authServer.includes('euclidian_estado_acceso')&&authServer.includes("error:'suscripcion_requerida'")],
 ['P4 recuperación de contraseña',auth.includes("action:'update_password'")&&html.includes('authResetForm')],
 ['P4 service role no llega al navegador',!auth.includes('SUPABASE_SERVICE_KEY')&&!html.includes('SUPABASE_SERVICE_KEY')],
 ['P4 session endpoint',sessionApi.includes('verificarUsuario(req)')&&sessionApi.includes('estadoAcceso(user.id)')],
 ['P4 Auth API usa publicable',authApi.includes('SUPABASE_PUBLISHABLE_KEY')&&!authApi.includes('SUPABASE_SERVICE_KEY')]
];
let failed=0;
for(const [name,ok] of checks){console.log((ok?'OK':'FAIL')+' - '+name);if(!ok)failed++;}
assert.equal(failed,0,failed+' invariantes incumplidas');
console.log('Contrato E2E estático: '+checks.length+'/'+checks.length+' OK');
