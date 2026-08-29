# EUCLIDIAN — Resiliencia del pipeline

## Regla principal
Un fallo de un documento, una fuente temporalmente inaccesible o una excepción de código nunca debe abortar el lote completo.

## Capas de aislamiento

1. **Por documento:** cada documento tiene estado, iteración, motivo y próxima acción propios.
2. **Por etapa:** extracción, normalización, clasificación, ficha y revisión pueden devolver `REVIEW`/`REPROCESS` sin marcar el lote como fallido.
3. **Por fuente:** una falla temporal de red se registra como error recuperable; no se interpreta como evidencia de que el contenido sea incorrecto.
4. **Por regla:** una regla de calidad fallida afecta al documento, no al resto.
5. **Por iteración:** existe un máximo configurable para evitar ciclos infinitos.
6. **Por lote:** resultados parciales se conservan; un documento escalado no impide aprobar los demás.

## Clasificación de fallos

- `RECOVERABLE`: timeout, rate limit, respuesta temporalmente vacía → reintento con backoff.
- `CORRECTABLE`: extracción incompleta, variante de sintaxis, normalización insuficiente → corrección y reproceso.
- `REVIEW_REQUIRED`: evidencia disponible pero interpretación no resuelta → revisión fiscal/jurídica.
- `SOURCE_INVALID`: fuente no pertenece a las dos raíces autorizadas → no usar esa fuente; buscar nuevamente dentro de las raíces permitidas.
- `PERSISTENT`: no resuelto después del máximo de iteraciones → `ESCALATED`, sin detener el lote.
- `SYSTEM_ERROR`: excepción inesperada → registrar, aislar el documento y continuar; no convertirla en aprobación.

## Regla de seguridad
Nunca convertir un error técnico, una falta temporal de acceso o una discrepancia no entendida en una afirmación fiscal. Solo `APPROVED` puede alimentar el resultado final para contador, y solo con evidencia suficiente.

## Orden de recuperación

`RETRY_SOURCE → REEXTRACT → NORMALIZE → RECLASSIFY → REBUILD_FISCAL_SHEET → REVIEW`

El orden se elige según la causa registrada; no se repite todo innecesariamente cuando una corrección localizada es suficiente.

## Observabilidad

Cada transición debe conservar documento, iteración, etapa, causa, evidencia disponible, acción realizada, resultado y versión de reglas. Esto permite medir dónde fallan los documentos y convertir patrones repetidos en nuevas reglas.
