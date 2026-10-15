# Arquitectura verificada de EUCLIDIAN

Actualización: 15 de octubre de 2026, Europe/Berlin.

## Responsabilidades

| Capa | Responsabilidad y comprobación |
|---|---|
| Interfaz | Inicio, Consultar, Novedades, Explorar y Cuenta; conserva el diseño. No contiene un modo de aprobación fiscal. |
| API de consulta | Autenticación y acceso antes de leer; solo versiones publicadas; fuente oficial, fecha y evidencia; orden coherente por publicación web y fecha del acto como alternativa. |
| Supabase | Datos, permisos, cola persistente, exclusión del escritor, estados de etapas y puerta atómica. Una ficha modificada vuelve a la cola. |
| Ciclo documental | Único responsable de mapa, ingreso, captura completa, adaptación literal, segundo contraste y publicación por documento. |
| Recuperación | Comprueba latido y exclusión; solicita otro ciclo solo cuando corresponde. Un dispatch fallido libera su reserva. |
| Calidad | Pruebas de código y contratos, incluida consulta real contra la base. No funciona como escritor del catálogo. |
| Boletín | Activación y envío manuales; conserva sus controles de consentimiento. No se envió correo durante esta verificación. |

Hay cuatro workflows. No se añaden revisores paralelos. Las rutas de aprobación e inspector antiguos devuelven 410 y se retiran sus páginas y controles de la interfaz. Las tablas históricas permanecen para preservar la trazabilidad.

## Hallazgos corregidos

- Varios escritores y cadenas dependientes de un inspector: sustituidos por dirección única, cola y latidos.
- Mapeador solo diagnóstico: ahora persiste fuentes e ingresa cambios reales. La lista dinámica de boletines se lee desde el contexto y la API públicos de la página oficial.
- Falsas colisiones por anclas y URLs antiguas con ceros: se normalizan las anclas; los alias se cierran solo contra una ficha canónica validada con la misma huella de fuente.
- Lote de 1.000 fichas con texto que agotaba el tiempo de respuesta: la cola devuelve solo identificadores. Se leen metadatos en grupos de 20, sin descargar el texto anterior; los grupos se reducen si alcanzan el límite. La prioridad se mantiene al escribir en la cola. La selección real de 1.000 pendientes midió 114 ms, frente al timeout del lote anterior.
- «Lo más reciente» priorizaba expedición sobre publicación web: se incorpora un único orden documental en la vista y la API. El Oficio 16681, publicado el 5 de octubre, precede al Concepto 16898, publicado el 30 de septiembre.
- Vigencia desconocida tratada como urgencia: se excluye de las marcas de acción por cambio de vigencia.
- Fallo al lanzar un proceso que podía dejar una etapa en curso: ahora se registra el fallo; cerrar un ciclo también cierra las etapas interrumpidas.
- Reserva de recuperación consumida aunque GitHub rechazara el dispatch: ahora se libera para permitir el siguiente intento.
- Campos heredados de los PDF: un período editorial no se conserva como fecha exacta y una mención territorial no se presenta como ámbito de aplicación.

## Evidencia

El mapa histórico terminó con 17.949 fuentes en esa ejecución, cero colisiones y cero errores, e ingresó 108 publicaciones que faltaban: el universo pasó de 17.875 a 17.983 documentos. La lectura de las publicaciones institucionales encuentra 207 PDF únicos.

Se contrastaron directamente 540 documentos de 2026 sin errores de acceso. Los documentos con publicación web más reciente identificada en esas fuentes son del 5 de octubre; entre ellos, el Oficio 16681. Su ficha está publicada con adaptación 5.0. Este alcance corresponde a las fuentes tributarias autorizadas; no afirma conocer cualquier publicación futura o ajena a esos índices.

Las pruebas incluyen 57 regresiones Python, contratos de acceso, perfil, sesión, consulta, extractos, rutas retiradas y readiness. Las pruebas SQL transaccionales comprobaron exclusión, pérdida y recuperación de reserva, cierre sin etapas huérfanas, CAS, evidencia incompleta rechazada y alias vinculados a una ficha canónica publicada; los datos de prueba se revierten.

Producción respondió 200 en salud y 401 al intentar consultar sin sesión. Las tablas operativas tienen RLS y permisos de servidor; las advertencias informativas de ausencia de políticas en tablas internas corresponden al cierre de acceso a anon/authenticated. No se habilitó lectura pública para silenciar esas advertencias.

## Límites que impiden declarar todo terminado

El reprocesamiento histórico continúa. «Mapa completo» y «ciclo completo» no significan que todas las fichas hayan superado la nueva adaptación. La cobertura se confirma con los estados de cada documento; contradicciones de fuente y capturas incompletas permanecen aisladas con motivo y próxima acción.

Los horarios de GitHub pueden retrasarse y la DIAN puede cambiar o dejar de responder. El sistema registra la falta de frescura y recupera interrupciones; no promete ejecución al segundo ni disponibilidad absoluta de una fuente externa. El cobro real sigue desactivado en la configuración; los contratos de autenticación y suscripción no equivalen a un pago real probado.
