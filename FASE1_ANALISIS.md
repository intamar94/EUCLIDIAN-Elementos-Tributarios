# FASE 1 — Ficha de análisis fiscal

Esta nota documenta la implementación prevista para la ficha de análisis fiscal sin modificar todavía búsqueda, historial ni relaciones entre normas.

La ficha debe separar hechos de interpretación y conservar la fuente oficial. Los campos se muestran únicamente cuando existen datos sustentables en el documento/base de datos.

## Campos

- Qué cambia: `descripcion_limpia` o contenido de la fuente.
- A quién afecta: `zonas_afectadas`, cuando esté disponible.
- Desde cuándo: `fecha_publicacion`, claramente rotulada como publicación; no se presentará como entrada en vigor salvo que exista un dato específico.
- Qué debe hacer el asesor: únicamente acciones derivables de `plazos_mencionados`, obligatoriedad o información explícita; si no existe sustento, se indica que requiere revisión humana.
- Importancia: derivada de la clasificación existente de obligatoriedad y estado, sin afirmar una valoración fiscal no sustentada.
- Riesgos/advertencias: retroactividad, estado de vigencia, fechas futuras, plazos y advertencias del borrador cuando existan.
- Fuente: número, fecha y enlace oficial.

## Regla de seguridad

El borrador IA continúa identificado como borrador y requiere revisión humana. La fuente oficial permanece enlazada y no se sustituye por texto generado.
