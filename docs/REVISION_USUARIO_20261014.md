# Inicio guiado y correcciones de la revisión de usuario

## Cierre del flujo documental — 14 de octubre de 2026

- Se contrastaron de nuevo las 13 fichas con publicación web del 5 de octubre, directamente en sus páginas DIAN. Las 13 superaron las reglas 4.2 y quedaron publicadas, sin modificar sus fechas ni atribuir revisión humana. Ejemplo: DIAN-OFICIO-16681-2026.
- La cola anterior solo encontraba revisado_fiscal_en vacío: omitía fichas enriquecidas o estructuradas después de una evaluación. Ahora detecta esas actualizaciones, prioriza publicaciones recientes y procesa lotes de 1000.
- Los cambios sustantivos retiran temporalmente la ficha y reinician su revisión. La evaluación y publicación se cierran en una transacción, condicionada a updated_at para rechazar versiones obsoletas. La puerta de inspección y los expedientes bloqueantes siguen aplicando.
- Se preparan párrafos completos y literales de la fuente, identificados como extractos DIAN. Se contrastan por coincidencia íntegra, conservando negaciones, cifras y excepciones. No se escribe resumen_humano ni revisado_por_humano.
- El ciclo de captura incorpora extracción de estructura; la revisión se ejecuta también al terminar el agente de integridad. Los registros distinguen aprobaciones, publicaciones efectivas y conflictos de versión.
- Portada alineada con las secciones actuales. Interfaz y estilo conservados; desplegable de temas y selección personal validados en cuatro anchuras.
- Validación: 27 regresiones Python, contratos JS de autenticación/consulta/pagos y pruebas transaccionales en la base con rollback. Estas últimas comprobaron rechazo de versión obsoleta, reencolado por cambio real, marcas de tiempo sin reencolado y conservación de la cuarentena crítica.
- Alcance de actualidad: el 5 de octubre es la fecha más reciente acreditada en las fuentes tributarias revisadas, no una certificación de toda publicación posible de la DIAN.
- El histórico tenía 12.102 evaluaciones anteriores a alguna extracción. Su reevaluación queda en la cola automática; no se presenta ese histórico como revisado de nuevo en esta entrega.
- Permanecen 3 contradicciones de fechas presentes en las propias fuentes oficiales, retenidas para análisis. Los cobros reales dependen de la configuración comercial del titular, todavía ausente; no se habilitan pagos ficticios.

## Selección personal de temas y tarjetas útiles

- Explorar usa un desplegable nativo para añadir temas y muestra únicamente los elegidos, con «Ver documentos» y un control independiente para quitar cada uno. No hay lista completa ni temas sugeridos preseleccionados.
- La selección persiste en este navegador. Se conservan elecciones anteriores, convirtiendo sus nombres a identificadores de tema. Los ya elegidos se excluyen del desplegable y reaparecen al quitarlos.
- Inicio muestra temas, una breve descripción del índice DIAN y la fecha disponible de cada documento. Si la fecha exacta no está acreditada, se conserva el rótulo de año aproximado. No se generan conclusiones nuevas ni se etiqueta la selección como novedad.
- Se elimina la etiqueta redundante del tipo de documento en Inicio; la identificación completa sigue en la ficha.
- Pruebas Chromium en 320, 390, 768 y 1440px: añadir/quitar varios temas, evitar duplicados, persistencia, recuperar selección anterior y abrir la consulta con el tema elegido; extracto/fecha en Inicio, navegación, guía y restricciones de acceso. Datos simulados.

## Simplificación posterior de la navegación

Esta revisión sustituye el diseño anterior de una página larga. Se conserva a continuación la evidencia histórica de la entrega inicial.

- Cada pestaña muestra únicamente su sección: Inicio, Consultar, Novedades, Explorar o Cuenta. La guía ocupa su propia vista y conserva omisión y reapertura.
- Inicio ofrece una introducción breve y hasta tres accesos a documentos; no muestra buscador, filtros ni radar. Las novedades disponibles tienen un acceso compacto; su ausencia ocupa una sola línea.
- Consultar reúne buscador, filtros y fichas. Novedades muestra publicaciones de los últimos 14 días, sin buscador ni filtros heredados. Si no hay resultados, presenta un solo estado vacío y oculta el contador y el ordenamiento.
- Explorar reúne temas y seguimientos locales. Cuenta conserva perfil y suscripción.
- Se retiran las métricas vacías, el mensaje de radar tranquilo y la fecha de modificación de una ficha presentada como actualización global.
- La reserva de espacio inferior usa la altura real de la barra. Se mantienen colores, tipografía, tarjetas y estados de foco.
- La autorización sigue en el servidor. La respuesta 402 y el cierre de sesión también limpian las vistas y bloquean la exposición de resultados previos al navegar.
- Pruebas: contratos de autenticación, sesión, E2E estático y resumen aprobados. Prueba Chromium en 320, 390, 768 y 1440px: secciones excluyentes, guía, fichas, búsqueda, novedades vacías/con resultados, temas, Cuenta, acceso pendiente y cierre de sesión. Datos simulados; no equivale a una sesión real de producción.

## Registro de la entrega inicial

## Implementado

- Guía inicial de cinco pasos dentro de app.html: Consultar, Novedades, Explorar/seguimientos, fichas/fuentes y Cuenta. Permite anterior/siguiente, saltar a un paso, abrir la sección, omitir y reabrir desde la cabecera. Se recuerda en este navegador; no concede acceso ni altera la suscripción.
- Novedades de toda la biblioteca: consulta independiente sin filtros, con el total validado de los últimos 14 días. Usa el mismo control de fecha, texto, fuente y autorización de documentos. El radar de fechas y vigencia sigue indicando expresamente que analiza solo la página visible; no se presenta como una revisión global.
- El resumen de Inicio devuelve únicamente total/actualización y no añade un consumo artificial de consulta.
- Inicio y Novedades reinician filtros anteriores. Consultar conserva la consulta y desplaza al buscador después de cargar. Los resultados vacíos ya no conservan un contador anterior.
- Relaciones adicionales realmente desplegables, con enlaces oficiales cuando están disponibles.
- Títulos orientados al profesional; el aviso de revisión humana pendiente conserva su significado. El contraste documental no se presenta como revisión humana.
- Etiquetas/fechas con mínimo de 12px, azul de orientación más oscuro, contraste reforzado en metadatos, foco visible, controles táctiles y anclas bajo la cabecera.
- Cierre de sesión y respuesta 402 ocultan tutorial, resumen y exploración.

## Validación

- Contratos existentes de Auth, sesión del navegador, acceso comercial, portada, pagos, idempotencia y readiness: aprobados.
- Contrato E2E estático: 36 comprobaciones aprobadas.
- Nuevo contrato `node tests/novedades_resumen_contract.mjs`: 30 novedades en total, cinco resultados en la segunda página, resumen sin fichas y rechazo de acceso no autorizado. Datos simulados, sin escritura en la base.
- Prueba de navegador Chromium a 390px y 1440px: cinco pasos, omisión, reapertura, persistencia tras recargar, limpieza de filtros, apertura de relaciones, resumen global, cierre de sesión, ausencia de desbordamiento horizontal y errores JavaScript. Capturas inspeccionadas. Datos y sesión simulados; no acredita una sesión real en producción ni la actualidad jurídica de documentos reales.
- Reproducción de la prueba visual: servir el repositorio en localhost:8765, instalar Playwright en el entorno de pruebas y ejecutar `node tests/ui_onboarding_browser.cjs`. Puede usarse `UI_BASE_URL` y `CHROMIUM_PATH` para adaptar servidor y navegador.

## Pendientes separados del cierre de interfaz

- Configurar cuenta comercial, tarifa definitiva y proveedor de pagos; probar una transacción de prueba real, renovación y cancelación con ese proveedor.
- Recorrido autenticado contra servicios reales en producción: quedó pendiente por indicación de la usuaria. Las pruebas visuales locales usan datos simulados.
- Seguimientos entre dispositivos: siguen siendo locales y así lo dice la interfaz y la guía; no se promete sincronización.
- Demostración pública con fichas aprobadas: propuesta comercial pendiente, no sustituida por el tutorial.
- Comprobación de actualidad sustantiva frente a fuentes oficiales y alertas globales de plazos/vigencia: no cubiertas por esta entrega de interfaz.
- Dominio y conexión final.
