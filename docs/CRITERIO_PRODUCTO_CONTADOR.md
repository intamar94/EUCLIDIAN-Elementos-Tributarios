# EUCLIDIAN para contadores y revisores fiscales

## Promesa del producto

Cada ficha debe permitir contestar, con evidencia, estas preguntas:

1. ¿Qué publicó la DIAN y cuándo?
2. ¿Cuál es el documento primario y dónde está el texto íntegro?
3. ¿Qué dice literalmente la fuente y qué es una síntesis humana o un borrador automático?
4. ¿Qué cambió, desde cuándo rige y qué documento modifica o sustituye?
5. ¿Qué falta confirmar antes de aplicar el criterio a un contribuyente?

La interfaz no debe convertir una etiqueta del scraper ni una comprobación automática en una conclusión sobre una obligación particular. La aplicación concreta depende de hechos, período, sujetos, excepciones y vigencia.

## Cobertura observada

El scraper de producción recorre cuatro índices internos del Normograma:

| Índice | Uso en EUCLIDIAN |
| --- | --- |
| `nyb_novedades_derecho_tributario` | Novedades tributarias |
| `t_1_normativa_tributaria` | Normativa tributaria |
| `t_2_doctrina_tributaria` | Doctrina tributaria |
| `t_3_jurisprudencia_tributaria` | Jurisprudencia tributaria |

`tributario.html` enlaza normativa, doctrina y jurisprudencia. `novedades_boletines.html` enlaza novedades tributarias y también una sección separada de novedades jurídicas del portal DIAN. Esa sección incluye Doctriflash, el Boletín Actualidad Jurídica y otros recursos. **Los cuatro índices del scraper no ingieren esa sección externa ni sus publicaciones**; por eso la cobertura de novedades y boletines todavía no es completa. El flujo que buscaba publicaciones en `Normatividad.aspx` se retiró del trabajo diario porque construía enlaces/identificadores sin demostrar correspondencia documental.

Fuentes DIAN consultadas:

- [Tributario](https://normograma.dian.gov.co/dian/compilacion/tributario.html)
- [Novedades y boletines](https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html)
- [Novedades jurídicas en el portal web DIAN](https://normograma.dian.gov.co/dian/compilacion/nyb_novedades_juridicas_portal_web_dian.html)
- [Doctriflash](https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/Paginas/DoctriFlash.aspx)
- [Boletín Actualidad Jurídica DIAN](https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/Paginas/Boletin-Actualidad-Juridica-DIAN.aspx)

## Reglas de confianza implementadas

- El control automático registra su fecha por separado de `revisado_por_humano`; nunca aprueba para publicación ni para correo. La bandeja de pendientes usa la bandera humana, no la fecha del control automático.
- La similitud de vocabulario con la fuente queda como control técnico; no prueba que una síntesis conserve negaciones, excepciones o alcance.
- El scraper conserva las decisiones de revisión ya existentes al actualizar un documento.
- El enriquecedor actualiza metadatos y texto capturado sin reiniciar publicación ni revisión humana.
- Un control sin errores del scraper falla si un índice no carga, no tiene la estructura esperada o una parte listada no está disponible.
- No se asigna el 1 de enero como fecha del acto cuando el índice solo informa el año.
- La ficha separa el texto capturado, la descripción del índice, el borrador automático y la síntesis humana, y presenta un enlace directo a la fuente primaria.
- La clasificación de tipo documental se presenta como orientación de lectura; no afirma por sí misma que una obligación aplique a un cliente.

## Trabajo pendiente para una herramienta lista para uso profesional

1. Crear un adaptador específico para Doctriflash y los boletines del portal DIAN. Registrar URL, título, período/edición, fecha de captura, documento enlazado y huella del archivo; validar que el PDF/HTML corresponda a la edición listada. No convertir titulares en doctrina integral.
2. Registrar ejecuciones de ingesta por fuente con cantidad esperada/obtenida, fecha de última lectura correcta, páginas fallidas y alertas. Un cron diario solo indica frecuencia de intento, no frescura confirmada.
3. Mantener historial de versiones de las fuentes capturadas y un vínculo explícito entre boletín, norma/doctrina citada y texto primario.
4. Configurar `EUCLIDIAN_REVISOR_CLAVE` como secreto independiente del acceso de lectura para habilitar el modo de revisión. El modo ya separa guardar síntesis, aprobar para biblioteca y autorizar correo; aún falta identidad individual, historial de cambios y comentario firmado para que sea una bitácora suficiente para una firma de auditoría.
5. Completar la fecha efectiva, derogatorias, modificaciones, excepciones y población afectada con evidencia por campo. Si la DIAN no lo informa, indicarlo como no determinado.
6. Revisar índices de búsqueda y alertas por contribuyente/tema con período fiscal, tipo de impuesto y perfil de exposición definidos por el contador.

## Forma recomendada de una ficha

**Qué publicó la DIAN** (tipo, número, fecha exacta o solo año) · **fuente primaria** · **texto oficial** · **síntesis** con autor/estado · **qué cambió** · **vigencia** · **a quién podría afectar** · **hechos y excepciones por confirmar** · **relaciones normativas** · **historial de revisión**.

Cada afirmación de la síntesis debe llevar a una cita o sección/página verificable de la fuente. Hasta implementar cita por pasaje, toda síntesis sigue marcada como pendiente de revisión humana y el enlace oficial debe permanecer visible.
