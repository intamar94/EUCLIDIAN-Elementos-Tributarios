# Inicio guiado y correcciones de la revisión de usuario

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
