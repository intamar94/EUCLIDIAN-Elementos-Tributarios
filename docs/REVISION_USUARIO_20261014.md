# Inicio guiado y correcciones de la revisión de usuario

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
