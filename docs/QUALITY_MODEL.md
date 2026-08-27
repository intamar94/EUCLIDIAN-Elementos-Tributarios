# EUCLIDIAN — Modelo de calidad

## Principio
EUCLIDIAN prioriza precisión y trazabilidad sobre cobertura. Una afirmación sin evidencia suficiente no se aprueba.

## Estados
- `approved`: evidencia suficiente y fuente permitida.
- `rejected`: evidencia insuficiente, ambigua o fuera de las fuentes permitidas.
- `not_found`: no existe evidencia localizada.
- `not_applicable`: la regla no aplica al caso evaluado.

## Cada dato aprobado debe conservar
- valor estructurado;
- fecha de consulta/publicación cuando exista;
- vigencia cuando pueda determinarse;
- fuente oficial;
- evidencia trazable;
- estado de validación.

## Regla de seguridad
Un rechazo de contenido no es un fallo del pipeline. El pipeline solo falla ante un error técnico que impida completar la validación.

## Vercel
La publicación queda fuera de este control: antes de desplegar deben estar verdes las pruebas, validaciones y trazabilidad.
