# Auditoría independiente de recorridos EUCLIDIAN

Fecha: 19 de octubre de 2026. Base auditada: `ef8c519`.

## Alcance y evidencia

Inspección de código de portada, aplicación, bandeja, guía, comparador,
expedientes e informes. Auditoría de solo lectura: no modifica la aplicación,
la base de datos, la publicación ni las opciones comerciales.

Los hallazgos identifican recorridos y funciones concretos; las consecuencias
de foco y presentación móvil requieren evidencia de navegador vinculada al SHA
que se publique. Esta nota original corresponde a una inspección de solo
lectura de `ef8c519`; no afirma una revisión visual de esa base concreta.
Posteriormente, la CI ejecutó Chromium en recorridos móvil y escritorio para
versiones posteriores. Esa evidencia no cierra por sí sola los hallazgos de
esta nota: debe registrarse con SHA, ejecución, fecha y entorno en el Auditor
Profesional. La prueba Node aislada sí confirmó que
`EuclidianExpedientes.limpiar()` elimina el expediente actual y que ningún
JavaScript de raíz registra `beforeunload`.

P1: pérdida de trabajo o bloqueo de un recorrido principal. P2: fricción
importante de uso o accesibilidad. P3: claridad o acabado, sin impedir la tarea.

## Hallazgos prioritarios

| ID | Gravedad | Recorrido y evidencia | Corrección recomendada |
| --- | --- | --- | --- |
| UX-01 | P1 | Crear expediente, escribir pregunta y cerrar sesión o recargar. `expedientes.js` mantiene todo en `coleccion` en memoria; `auth.js:authMostrarPuerta()` invoca `limpiar()` directamente. Solo el botón `expCerrar` pide confirmación. No hay guardia de recarga/salida. La advertencia inicial existe, pero no evita un clic accidental. | Detectar cambios no exportados. Antes del cierre voluntario, ofrecer exportar o descartar. Usar `beforeunload` mientras haya trabajo pendiente, respetando sus límites móviles. No introducir persistencia oculta ni impedir un cierre forzado por seguridad. |
| UX-02 | P2 | Abrir una ficha desde Inicio, un guardado desde Explorar o un destino de la guía. `bandeja.js:mostrarVista()` oculta el panel que contiene el botón activado y solo llama a `scrollTo`. `bienvenida.js:guiaDestino` simula un clic en navegación sin enfocar el nuevo contenido. | Enfocar el título o primer control útil del destino, con `tabindex=-1` en títulos no interactivos. El foco debe permanecer visible y permitir continuar con Tab; evitar robárselo cuando llegan respuestas asíncronas. |
| UX-03 | P2 | Editar el comparador o expediente en teléfono. `comparador.css` define `.eu-comparador-matrices textarea` a 13 px; `expedientes.css` define `.exp-campos input,.exp-campos textarea` a 14 px. La regla móvil `consulta.css` de `textarea` a 16 px tiene menor especificidad y no gana. Los inputs de expediente tampoco coinciden con `.buscador input` ni `.perfil-form input`. | Establecer 16 px explícitos en estos selectores dentro del punto de corte móvil. Confirmar tamaño computado y zoom al enfocar en Safari iOS real; no restringir el zoom del usuario. |
| UX-04 | P2 | Pulsar Página siguiente al final de un listado largo. `bandeja.js:irA()` solo cambia `F.pagina` y llama a `cargar()`. Esta función sustituye resultados y botones de paginación sin llevar foco al contenido ni desplazar al inicio de resultados. | Al completar una paginación iniciada por la persona, enfocar el contenedor de resultados y llevarlo al área visible. Anunciar página y rango. Conservar filtros; no aplicar el salto al refresco de fondo. |
| UX-05 | P3 | Abrir una ficha de Inicio o Guardados. Ambas rutas fijan `F.doc`; `describirConsulta()` anuncia siempre «Documento abierto desde el correo». Si no existe, `vistaVacia()` muestra «ENLACE DEL CORREO». | Usar «Documento seleccionado» y «Esta ficha no está disponible», o registrar el origen real. Evitar atribuir un correo inexistente a una acción interna. |

UX-01 requiere distinguir salida voluntaria de expiración/revocación. La
revocación debe retirar inmediatamente el acceso y borrar datos según el
modelo de privacidad. No conservar trabajo de una sesión expirada por omisión
ni impedir el borrado por un diálogo. Sí puede advertirse y facilitarse la
exportación antes de una salida voluntaria.

## Fricciones del recorrido de investigación

1. El comparador conserva su selección A/B en memoria, pero el aviso de la
   primera selección queda dentro de la ficha. Al cambiar de búsqueda no hay
   resumen visible del texto A elegido. Un pequeño estado «1 de 2 textos» y
   opción de limpiar daría continuidad sin crear otro menú principal.
2. `comparador.js:abrir()` siempre repone los fragmentos originales de ambas
   selecciones. Si se cierra el diálogo después de ajustar el pasaje y se vuelve
   a abrir mediante los selectores, se pierden esas ediciones. Debe explicarse
   o conservarse el borrador local mientras no cambien las fuentes.
3. Añadir una fuente crea un expediente automáticamente si no hay uno. El
   mensaje indica «Revisa tu expediente en Explorar», pero exige descubrir la
   navegación y el panel. Un botón «Abrir expediente» junto al aviso completaría
   el recorrido sin mover a la persona de forma inesperada.
4. La exportación ofrece seis acciones simultáneas. Para el primer uso conviene
   separar «Guardar trabajo para continuar (.json)» de «Preparar borrador para
   revisión», explicando que Word/PDF no permiten recuperar el expediente.
5. `informes.js:abrirPDF()` crea un `<dialog>` sin nombre accesible mediante
   `aria-labelledby` o `aria-label`. Su iframe tiene título, pero el diálogo
   debe identificar por sí mismo «Vista previa del informe». El diálogo nativo
   ya proporciona comportamiento modal; no se necesita una trampa de foco
   manual adicional sin evidencia de un fallo del navegador.

## Elementos correctos que deben conservarse

- La portada implementa pestañas con roles, estado seleccionado y manejo de
  flechas en `portada.js`; sus paneles ya son enfocables.
- La navegación móvil no desaparece: las hojas complementarias deben revisarse
  antes de diagnosticar un fallo por una única regla CSS.
- Expedientes e informes indican que son borradores sin revisión y separan
  fuentes de conclusiones. No ofrecen vigencia jurídica automática.
- Los expedientes no guardan notas en servidor ni almacenamiento del navegador.
  Esa decisión de privacidad no debe alterarse para resolver UX-01.
- El comparador restringe la longitud, pide dos documentos distintos, informa
  del corte de 320 palabras y no promete detectar cambios jurídicos.
- Las interfaces de comparador y expediente ya tienen rejillas móviles y estilos
  de foco visibles. No se encontró evidencia suficiente para afirmar un fallo
  general de desbordamiento o ausencia completa de accesibilidad.
- La bandeja distingue errores y estados vacíos, tiene límite de espera de 15
  segundos y acciones de reintento. No hace falta sustituirlos por un spinner
  indefinido.

## Criterios para una prueba de aceptación real

Usar datos ficticios y respuestas controladas; no exponer claves ni documentos
personales. Ejecutar a 320, 390, 768 y 1440 px, con teclado y movimiento reducido.

| Prueba | Resultado observable esperado |
| --- | --- |
| Portada → pestañas de ejemplo con flechas y Tab | Un solo tab seleccionado; contenido accesible y foco visible. |
| Guía → Consultar mediante teclado | Desaparece la guía y el foco llega a un destino visible de consulta. |
| Inicio → ficha; Guardados → ficha; tema → consulta | No queda foco en un ancestro oculto; no aparece un mensaje de correo falso. |
| Resultados largos → página siguiente | Se ven y anuncian la nueva página y su rango; el foco no se pierde en un botón eliminado. |
| Crear expediente → editar → cierre voluntario | Se permite exportar o confirmar descarte; cancelar mantiene todo el trabajo. |
| Expediente → recargar tras interacción | Se ofrece advertencia nativa cuando el navegador lo permita; documentar que el cierre abrupto móvil no es recuperable. |
| Sesión revocada con expediente abierto | Se retira acceso sin permitir que una confirmación lo mantenga activo. |
| Seleccionar A → otra búsqueda → seleccionar B | Se reconoce qué texto estaba elegido; comparación solo de dos documentos distintos. |
| Ajustar pasaje → cerrar → reabrir comparador | Edición conservada o aviso explícito de su descarte; nunca confundirla con el original DIAN. |
| Campo de expediente/comparador en Safari iOS | Tamaño computado mínimo de 16 px; no hay zoom de foco inesperado ni bloqueo del zoom manual. |
| Exportar JSON → importar → Word/PDF | Se recuperan notas y fuentes desde JSON; los informes mantienen estado de borrador y referencias oficiales. |
| Diálogo de informe con lector de pantalla | Se anuncia un nombre útil, se cierra con Escape y el foco vuelve al disparador disponible. |

## Diferenciación que ayuda al uso

El objetivo no debe ser acumular menús para igualar calendarios o asistentes de
la competencia. Este análisis de código no sustituye una investigación actual
de sus productos. La oportunidad verificable dentro de EUCLIDIAN es reducir los
saltos entre **buscar → comprobar fuente y fechas → reunir evidencia → preparar
un borrador revisable**. Cada paso debe mostrar qué se tiene, qué falta verificar
y cómo continuar. La comparación textual, los expedientes temporales y los
informes ya proporcionan piezas para ese recorrido, pero todavía necesitan las
transiciones y salvaguardas descritas.

Esta auditoría no certifica finalización del producto. Los cambios de otros
agentes deben contrastarse de nuevo con los hallazgos y las pruebas de aceptación
antes de publicar o afirmar que están resueltos.

## Integración posterior

Los cinco hallazgos se abordaron en el bloque UX consolidado: guardia de salida voluntaria y beforeunload con cambios no exportados; foco de navegación/paginación; campos móviles específicos; y origen neutral de ficha. La expiración de sesión siempre limpia memoria sin pedir autorización. Guardar un texto o abrir impresión no equivale a recuperar un expediente: el formato JSON es el respaldo recuperable. La CI posterior ejecutó recorridos Chromium para versiones posteriores; la revalidación de cada hallazgo exige anotar el SHA y el run que lo demuestra.
