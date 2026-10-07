# Excepciones de lanzamiento — residuo documental

Fecha de auditoría: 2026-10-07 UTC

## Criterio
EUCLIDIAN no fuerza un 100% cosmético del enriquecimiento. Un registro sin evidencia suficiente puede permanecer en la biblioteca interna, pero **no puede publicarse al cliente** hasta superar enriquecimiento y controles de fuente.

## Evidencia actual
- Corpus total: **17.792** registros.
- Enriquecidos: **17.761**.
- Pendientes de enriquecimiento: **31**.
- Los **31/31 pendientes** están fuera de publicación al cliente tras la cuarentena de lanzamiento.
- De esos 31, **24** son stubs duplicados detectados por identidad canónica de URL DIAN; cada grupo conserva el registro enriquecido/canónico cuando existe.
- Los **7** restantes son registros únicos sin texto completo/enriquecimiento suficiente; permanecen fuera de publicación hasta nueva evidencia.
- Registros publicados sin enriquecimiento y sin texto completo: **0**.
- En la última inspección de red consultada, los **15/15** enlaces reportados como rotos o con timeout quedaron fuera de publicación.

## Decisión
Estos 31 registros se aceptan como **excepciones documentadas de lanzamiento**, no como contenido listo. No bloquean el producto mientras permanezcan fail-closed (no publicados) y continúen en cola de recuperación/revalidación.

## Regla de reapertura
Un registro de esta excepción solo puede volver a `publicado_cliente=true` si:
1. dispone de fuente DIAN permitida y accesible o trazabilidad oficial equivalente;
2. el contenido fuente permite enriquecimiento suficiente;
3. vigencia/contexto requerido están presentes;
4. los controles de calidad aplicables pasan.

## Trazabilidad
La excepción no borra ni altera el registro fuente. La cuarentena es reversible y prioriza seguridad de publicación sobre porcentaje de enriquecimiento.
