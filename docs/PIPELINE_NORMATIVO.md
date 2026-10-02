# Pipeline normativo de EUCLIDIAN

EUCLIDIAN mantiene una cadena de evidencia desde la publicación DIAN hasta
la ficha que consulta el suscriptor. Solo entran documentos cuya procedencia
se pueda reconstruir.

## Fuentes autorizadas

1. [Normograma tributario DIAN](https://normograma.dian.gov.co/dian/compilacion/tributario.html)
2. [Novedades y boletines DIAN](https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html)

Los índices y documentos individuales se aceptan únicamente cuando derivan de
esas páginas y permanecen en los dominios DIAN permitidos.

## Recorrido diario

| Momento | Control | Resultado |
| --- | --- | --- |
| 06:15 UTC | Actualización documental | Vuelve a validar las fuentes, captura contenido y aparta fechas futuras. |
| 11:00 UTC | Scraper DIAN | Recorre los índices tributarios y las publicaciones enlazadas. |
| 12:00 UTC | Enriquecimiento | Captura texto fuente, fecha del acto, fecha web, vigencia, plazos y efectos. |
| 13:15 UTC | Extracción jurídica | Estructura problema, tesis, fuentes y relaciones de la ficha. |
| 13:30 UTC | Redacción por reglas | Produce una síntesis trazable para el contador. |
| 14:00 UTC | Control de calidad | Comprueba fichas visibles, procedencia, fechas, duplicados y enlaces oficiales. |
| Cada 5 min | Revisor fiscal automático | Recorre registros nuevos o modificados contra la evidencia DIAN. |

## Reglas que protegen al suscriptor

- La fecha del acto no se confunde con la fecha de publicación web.
- Una fecha futura se elimina de inmediato y se marca como no verificable.
- Las novedades recientes exigen fecha exacta, texto capturado y enlace
  individual del Normograma.
- Un cambio detectado en el contenido DIAN reinicia su contraste técnico.
- La ficha conserva el documento individual y el registro de procedencia de
  la fuente raíz e índice DIAN.
- El correo se genera solo después de los controles de fuente, fecha, vigencia
  y enlace oficial.
