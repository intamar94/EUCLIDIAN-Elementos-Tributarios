# EUCLIDIAN — Expediente de investigación profesional M3 · Beta privada

**18/10/2026 · Incremento M3/1 · Documento de alcance y validación**

## Resultado disponible
En **Explorar → Mis expedientes de investigación** se puede crear y alternar entre hasta **ocho expedientes de trabajo temporales**. Desde las fichas de **Consultar** se adjunta la referencia de un documento DIAN oficial (URL, referencia y título). Cada expediente recoge seis campos: asunto, pregunta, hechos a verificar, hipótesis, salvedades y conclusión propuesta. Admite hasta 18 fuentes.

**Regla jurídica:** las fuentes adjuntas son referencias, NO pasajes jurídicamente aprobados. Las hipótesis y conclusiones se identifican siempre como **borrador sin revisión**. No se muestra “vigente”, “afecta al cliente” ni “obligación” a partir de coincidencias o URLs.

## Privacidad por diseño
- Las notas **no se guardan automáticamente** ni en localStorage, cookies, Supabase, Vercel o correos: residen exclusivamente en memoria JavaScript de esa pestaña durante la sesión.
- La pestaña o el navegador pueden perderlas al actualizar, cerrar o navegar fuera. **Es responsabilidad del usuario exportar el expediente en JSON antes de salir**.
- El cierre de sesión de EUCLIDIAN destruye expresamente las referencias y los expedientes temporales; cambiar de cuenta no conserva el expediente anterior.
- La opción de recuperar datos requiere que el usuario seleccione manualmente un **archivo JSON de máximo 200 KB**, sin subida al servidor. El importador exige el esquema explícito `euclidian-expediente-v1` y valida enlaces HTTPS de host DIAN, tipos, longitud y cantidad de fuentes.
- Las marcas de revisión/aprobación del archivo importado **no son de confianza**; el estado resultante siempre será `borrador_sin_revision`. Se descartan supuestos campos de revisor y de cotejo humano.
- El usuario recibe una advertencia expresa de no escribir nombres, NIT, declaraciones, importes ni otros datos personales de contribuyentes. **Esta versión no está autorizada para expedientes con datos privados reales**.
- El archivo JSON que el usuario descarga **no está cifrado**, por lo que debe custodiarlo en un lugar privado. Esta limitación se señala claramente y bloquea presentarlo como solución empresarial de almacenamiento seguro.

## Exportaciones
**JSON** — formato de archivo para reabrir el borrador en otra sesión. **TXT** — informe preliminar con hechos, hipótesis, salvedades, conclusión pendiente y enlaces DIAN. No se envían mensajes, no se firman criterios ni se generan comunicaciones automáticas a clientes.

## Aceptación técnica
- Prueba determinista `tests/expedientes_contract.mjs`: límites, fuente HTTPS, importación, salida en borrador, falsificación de revisión, no storage y limpieza.
- Prueba Chromium `tests/ui_expedientes_browser.cjs`: creación, edición, anexos, exportación/importación y limpieza a 360px y 1180px.
- Se conserva la navegación, login `/euclides.png`, tipografía, paleta, GIF y el catálogo. No se añade función serverless ni esquema de base de datos.

## Qué NO es todavía
Esto no constituye almacenamiento persistente multiusuario, expediente auditable, PDF defendible, aprobación jurídica, notificación ni seguimiento de cambio de hash. Tampoco garantiza recuperación tras fallo del navegador.

## Etapas siguientes antes de usar expedientes de clientes reales
1. Diseñar estructura normalizada con identificador de usuario/organización y versión por documento.
2. Elaborar evaluación de privacidad y retención con LEGAL.ia; consentimiento, política de eliminación y datos mínimos.
3. Habilitar persistencia opcional únicamente con RLS real y **pruebas de aislamiento cruzado entre dos usuarios**, control server-side de roles y ninguna clave privilegiada en el cliente.
4. Incorporar autenticación de revisor, bitácora inmutable, estado `revisado` otorgado exclusivamente por servidor autorizado y cotejo por pasaje/documento hash.
5. Implementar informes PDF/DOCX con evidencias y revisiones profesionales, no borradores presentados como asesoría.
6. Validar las cinco tareas del piloto con contadores, midiendo pérdida de contexto, claridad y tiempo ahorrado.
7. Abrir registro/pagos solo con aprobación del Gewerbe, Impressum, privacidad y comercialización.

**Backlog:** [#102](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/102) (expedientes), [#88](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88) (evidencia), [#93](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93) (negocio).
