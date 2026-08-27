# EUCLIDIAN — consolidación

## Objetivo
Reducir el trabajo manual del contador extrayendo únicamente información respaldada por las fuentes autorizadas y presentándola de forma útil, fechada y trazable.

## Flujo
`fuentes autorizadas → captura → extracción → normalización → filtro de calidad → validación cruzada → ficha → aprobación`

## Reglas de confianza
- Cada dato debe conservar fuente y fecha.
- No completar información ausente con conocimiento externo.
- Separar texto original, dato extraído y conclusión.
- El filtro automático puede aprobar un resultado solo cuando todas las reglas exigidas se cumplen; si no, debe marcarlo para revisión.
- La aprobación debe ser por ficha/resultados, no texto por texto.

## Interfaz
Priorizar fecha, obligación/plazo, sujeto, valor, acción requerida, fuente, estado y nivel de confianza. Ocultar ruido y redundancia. La pantalla inicial debe responder rápidamente: qué cambió, qué importa y qué debe hacer el contador.

## Estado de trabajo
El repositorio ya contiene bandeja, fichas, lectores DIAN, filtros y estilos. La consolidación debe centrarse en trazabilidad, validación automática y una salida profesional para trabajo diario antes de ampliar funcionalidades.

## Despliegue
No gastar despliegues en cambios pequeños. Preparar el bloque completo y ejecutar una prueba integrada cuando el entorno lo permita.
