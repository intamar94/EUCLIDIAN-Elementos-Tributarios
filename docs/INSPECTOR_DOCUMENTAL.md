# Inspector documental

El inspector se ejecuta cada día por GitHub Actions y también puede lanzarse
manualmente. El panel privado está en `/inspector.html` y requiere
`EUCLIDIAN_REVISOR_CLAVE`. El navegador nunca recibe la clave de Supabase.

## Qué verifica

- Recorre **todas** las filas de `documentos_tributarios` por páginas ordenadas,
  comprueba que el número de IDs únicos coincida con el total y guarda el
  resultado actual de cada registro en `inspector_resultados`.
- Revisa identificación, URL oficial, fechas imposibles o invertidas,
  duplicados numéricos, fichas escasas, plazos aparentemente recortados y citas
  manifiestamente incompletas.
- Los PDF alojados en `www.dian.gov.co` se aceptan solo si son boletines de la
  carpeta jurídica oficial y el registro conserva la ruta de procedencia desde
  Novedades del Normograma y la URL verificada.
- Compara cinco casos centinela con la página oficial DIAN en cada ejecución.
  Incluyen IVA, SIMPLE, firma del revisor fiscal, emergencia y MAP. Comprueba
  las dos fechas de los conceptos cuando la fuente las indica.
- Consulta 500 enlaces del archivo por día en rotación, más todos los registros
  creados o fechados en los últimos 14 días, con cuatro conexiones simultáneas. La cifra
  de enlaces comprobados se muestra separada de la
  cobertura estructural. No se afirma que los 17.750 enlaces fueron abiertos
  diariamente.

## Cómo avisa

La ejecución se guarda en `inspector_ejecuciones` con inicio, fin, cobertura,
motivos, casos y fallos de enlaces. Un hallazgo crítico, un caso fallido o un
enlace roto deja la ejecución en `alerta` y el trabajo de GitHub Actions falla.
El panel muestra el estado y los documentos afectados. Una ejecución truncada
queda en `fallo` o `en_curso`; nunca aparece como cobertura completa.

## Alcance

Un barrido automático no demuestra por sí solo que una interpretación jurídica
sea correcta. La comparación íntegra de cada síntesis con todos los artículos,
excepciones y cambios posteriores exige controles documentales más profundos.
Los casos centinela detectan regresiones concretas, pero no sustituyen esa
revisión. La interfaz presenta esta distinción expresamente.

## Operación

El flujo está en `.github/workflows/inspector_euclidian.yml`. Requiere los
secretos `SUPABASE_URL` y `SUPABASE_SERVICE_KEY` ya usados por otros flujos.
La migración aplicada a Supabase está documentada en `sql/inspector_euclidian.sql`.
Las tablas nuevas tienen RLS activo y solo el servidor usa `service_role`.
