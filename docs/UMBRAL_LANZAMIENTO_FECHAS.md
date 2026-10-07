# Umbral de lanzamiento — fechas no verificadas

Fecha: 2026-10-07 UTC

EUCLIDIAN distingue entre **fecha exacta verificada** y **referencia temporal aproximada**. Para lanzamiento no se exige inventar o rellenar fechas ausentes: se exige que la incertidumbre no se presente como precisión.

## Estado medido
- Fechas verificadas: **16.898 / 17.792**.
- Fechas no verificadas: **894**.
- Entre registros publicados: **848** sin fecha exacta verificada.
- De esos 848, **0** carecen de enlace oficial DIAN.
- 4 tienen fecha de publicación web DIAN; 844 quedan como año/aproximación cuando no existe día exacto verificado.

## Umbral de lanzamiento
El riesgo aceptable es **0 registros que presenten una fecha no verificada como día exacto o como “novedad”**.

Controles:
1. `fichas.js` usa `fechaDocumentoConfiable()`; si la fecha no es fiable muestra fecha web o año con clase `aproximada`.
2. `api/documentos.js` exige `fecha_es_real===true`, texto fuente suficiente y enlace DIAN para incluir una ficha en la vista de novedades.
3. La fuente oficial permanece enlazada para verificación por el usuario.
4. Fechas futuras/imposibles siguen tratándose como hallazgo crítico por el inspector.

La métrica 894 se mantiene visible como deuda de enriquecimiento/precisión, pero no debe convertirse en falsa precisión de producto. El lanzamiento se bloquea si cualquiera de estos controles falla.
