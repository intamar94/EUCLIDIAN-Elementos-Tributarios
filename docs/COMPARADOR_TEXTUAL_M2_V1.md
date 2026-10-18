# EUCLIDIAN | Comparador textual exploratorio de documentos DIAN

**M2 — Primer incremento operativo, 18/10/2026.** Ruta principal: [M2 comparador](RUTA_MAESTRA_CONTADOR_DIA_A_DIA_2026.md). Fundamentación jurídica: [#88](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/88), [#90](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/90).

## Uso en el día a día
1. Abrir resultados que contengan **texto documental** y enlace oficial DIAN HTTPS; pulsar *Elegir como texto A*.
2. Buscar el segundo documento (puede estar en otra página) y pulsar *Elegir como texto B*.
3. Se abre una ventana con identificador y enlace oficial de cada documento, dos fragmentos editables y una explicación de límites.
4. El usuario puede pegar pasajes específicos cotejados en la DIAN en lugar del fragmento inicial mostrado.
5. Pulsar *Resaltar diferencias*: naranja marca términos presentes solo en A; verde marca términos presentes solo en B.
6. Revisar los enlaces originales. Este producto **no confirma** una derogatoria, reconsideración, vigencia o aplicación a un contribuyente.

## Lo que implementa
- Interfaz para selección A/B desde fichas; la selección sobrevive a nuevas búsquedas dentro de la pestaña.
- Fuentes limitadas a URL HTTPS de un host DIAN permitido; no habilita documentos sin texto registrado.
- Fragmentos iniciales limitados a 2.200 caracteres, comparaciones de hasta 320 palabras por lado por rendimiento. La ventana advierte sobre los límites.
- Algoritmo de diferencias léxicas por subsecuencia común de palabras (LCS), sin dependencia ni conexión a IA. Solo **diferencias textuales**.
- Edición local de pasajes, sin persistencia, sin subir contenido al servidor ni transmitir datos del cliente; escape seguro de metadatos y renderizado de tokens con textContent.
- Ventana accesible con títulos, controles de teclado, enlaces DIAN, botón de cierre y diseño móvil acorde con el estilo EUCLIDIAN.
- No se cambia la ficha principal, el login `/euclides.png`, las animaciones, la leyenda jurídica ni las funciones de Auth.

## Límites jurídicos y técnicos
- Un orden A/B **no es orden temporal**. Fecha de acto, publicación y efecto jurídico deben verificarse independientemente.
- Se muestra el **inicio** del texto disponible como ejemplo; para comparar el fragmento pertinente el profesional debe sustituirlo. No es comparación exhaustiva del documento completo.
- El origen del texto es el catálogo; la prueba SHA-256 por pasaje de PR #100 es infraestructura separada. **Esta herramienta no demuestra ni certifica citas por pasaje** y no hereda automáticamente aprobación humana.
- La ausencia de una frase en B no demuestra que exista derogación o reconsideración.
- El diff no compara posiciones de página, PDFs, anexos ni contexto jurídico.
- Ningún resultado se almacena ni constituye un expediente auditable en esta versión.
- Se requieren M1 (evidencia aprobada), la auditoría y un expediente persistente antes de convertir diferencias en recomendaciones o alertas personalizadas.

## Prueba y aceptación
- `tests/comparador_documental_contract.mjs`: filtros de fuente, enlaces maliciosos, XSS, truncamiento, diferencias y coincidencias idénticas, límites, carga y CSS responsive.
- Auditoría CI de navegación/ingreso y consulta real de catálogo.
- Prueba de usabilidad con contadores para decidir si debe incorporarse un selector de pasajes por artículo/apartado y una vista de evidencia por fuente.

## Próximos hitos
1. Resolver evidencia por pasaje con revisor jurídico, fuente/versiones y permisos.
2. Añadir selector de fragmento desde ambas fichas con localizadores verificables, no solo edición manual.
3. Comparador de criterios revisados (fecha, tipo de relación, contexto normativo), sin convertir edición de texto en causal legal.
4. Integrar comparación en expediente profesional y exportación de informe.
