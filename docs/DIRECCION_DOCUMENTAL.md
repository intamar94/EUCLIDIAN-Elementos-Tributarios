# Dirección documental de EUCLIDIAN

El inventario encontró 21 workflows y 15 con horario propio. Había varios escritores del catálogo, un mapeador exclusivamente diagnóstico y cadenas en las que el fallo de un inspector impedía ejecutar la corrección posterior. Un HTTP 504 real de lectura de resultados dejó saltada la revisión siguiente.

Se conservan cuatro workflows:

| Flujo | Responsabilidad | Activación |
|---|---|---|
| Ciclo documental | Mapa oficial, ingreso incremental, captura íntegra, adaptación literal, contraste y publicación atómica | Cada 15 minutos; barrido de índices históricos semanal; cambios de implementación en main; manual |
| Recuperación documental | Detectar falta de latido y solicitar una ejecución de recuperación, con reserva atómica | Cada 15 minutos y al terminar el ciclo |
| Control de calidad | Regresiones de código, contratos de API, autenticación y consulta real | Push, pull request y manual; sin modificar documentos |
| Enviar boletín | Preparar o enviar únicamente cuando se solicita su acción manual | Manual |

Se eliminan 19 definiciones antiguas y se añaden las dos de operación unificada. Los dos ejecutores fiscales se retiran; sus funciones históricas permanecen disponibles exclusivamente para regresiones de compatibilidad. No existe un revisor fiscal activo ni una aprobación humana simulada. Los nombres heredados de algunas columnas y tablas se conservan para no romper clientes.

## Responsabilidad por documento

Todo registro existente queda en `adaptaciones_documentales`; los nuevos ingresan mediante trigger. La cola contiene estado, versión, intentos, próxima fecha, evidencia, motivo y acción concreta. El orden prioriza publicaciones recientes y continúa con el resto del catálogo. Cada documento se procesa independientemente; un fallo no detiene los demás. Los reintentos transitorios tienen espera creciente; las contradicciones de fuente y capturas no acreditadas quedan aisladas y se vuelven a contrastar.

El mapa persiste la URL oficial, raíz, índice, registro e impresión de los metadatos. No fusiona URLs diferentes solo porque sus números parecen equivalentes. Los índices no sobrescriben la clasificación y el título contrastados con el cuerpo. Solo las dos raíces autorizadas y sus enlaces oficiales alimentan el mapa. Una raíz caída o una lista histórica dinámica incompleta se registran como cobertura parcial.

La adaptación descarga el documento completo, extrae campos literales, vuelve a descargar de forma independiente y compara la huella SHA-256 y la identidad. Conserva el texto sin el recorte histórico de 60.000 caracteres. Excluye notas al pie y despedidas como extracto; retira campos opcionales sin respaldo, fechas supuestas, vigencia asumida y geografía inferida por menciones. La ausencia de una síntesis no impide consultar una fuente correctamente identificada y completa. Los boletines se tratan como publicaciones informativas y exigen la cadena oficial de procedencia y texto de todas sus páginas.

La base bloquea publicaciones sin evidencia de captura completa, identidad, contraste y ficha actual. La comparación de `updated_at` evita aprobar una versión modificada durante la lectura. La huella de campos de la ficha evita reutilizar una aprobación antigua después de un cambio. Los ejecutores anteriores no pueden publicar mediante la RPC de cierre.

## Interrupciones y actualización

`direccion_documental` mantiene una exclusión con vencimiento, renovada mediante latidos. Cada etapa tiene inicio, estado, final y resultado persistidos. Si se interrumpe el proceso, el siguiente ciclo registra la interrupción y retoma la cola; no reinicia todo ni declara éxito por omisión. La recuperación no duplica un escritor vivo y limita sus solicitudes a una cada 45 minutos.

GitHub programa las ejecuciones, pero sus horarios pueden retrasarse. `/api/health` separa disponibilidad del servicio de frescura documental y muestra el último latido, antigüedad, etapas y recuentos, sin credenciales. No afirma cobertura completa si quedan pendientes, reintentos o cuarentenas. Las fuentes ya publicadas se contrastan de nuevo al vencer su plazo de refresco semanal; las fuentes nuevas entran desde el mapa periódico.

## Validación

Se instalaron las tablas, cola, exclusión, puerta y cierre atómico con RLS y acceso operativo restringido al servidor. La prueba transaccional verificó exclusión de dos escritores, latido, recuperación de una exclusión vencida, rechazo de evidencia incompleta, publicación con evidencia completa y rechazo de una versión concurrentemente modificada, con rollback de todos los datos de prueba. Los 17.875 registros iniciales quedaron en la cola; anon no puede leerla ni ejecutar la apertura de ciclos.

El reprocesamiento de todo el catálogo es gradual. Un ciclo completo significa que sus etapas terminaron, no que toda la cola histórica esté validada. La verificación operativa debe consultar sus recuentos y el resultado real de las fuentes; no basta con un workflow verde.
