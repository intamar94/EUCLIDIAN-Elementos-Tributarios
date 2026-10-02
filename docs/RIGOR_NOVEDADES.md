# Rigor de novedades DIAN

Una novedad llega desde una de estas dos entradas oficiales de la DIAN:

1. [Normograma tributario](https://normograma.dian.gov.co/dian/compilacion/tributario.html).
2. [Novedades y boletines](https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html).

El recolector solo sigue enlaces DIAN derivados de esas páginas. Para cada
documento conserva el enlace individual y el índice de procedencia.

La vista de publicaciones recientes exige tres evidencias antes de mostrar un
registro: fecha exacta del documento, texto capturado desde su fuente y enlace
individual del Normograma. Una fecha del encabezado del acto y una fecha de
publicación web se guardan en campos distintos.

El enriquecedor se ejecuta diariamente. Además de completar fechas y texto,
identifica Diario Oficial, vigencia, efectos hacia períodos anteriores, zonas y
plazos cuando el documento lo dice expresamente. Si una evidencia no está,
EUCLIDIAN no la inventa ni muestra una fecha exacta.
