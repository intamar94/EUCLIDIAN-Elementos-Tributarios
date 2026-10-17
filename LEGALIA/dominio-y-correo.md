# Faro de Intamar · Dominio, DNS y correo corporativo
**Estado:** Preparado para contratación. No se ha comprado ni registrado ningún dominio.

## Consulta Vercel (17 octubre 2026)
- `farodeintamar.com`: disponible en consulta, precio anunciado de alta y renovación **11.25 USD / año** (sujeto a variación e impuestos).
- `faro-intamar.com`: disponible, **11.25 USD / año**.
- `farodeintamar.de`, `faro-de-intamar.de`, `faro-intamar.de`, `farodeintamar.eu`: no disponibles en esa consulta.
- Verificar disponibilidad y titularidad marcaria antes de comprar. **No registrar automáticamente sin elección de dominio y aprobación explícita del cargo.**

## Cadena técnica posterior a la compra
1. Fijar la titular real del dominio y datos de contacto con verificación de correo; usar 2FA, renovación automática y avisos de caducidad.
2. Escoger si `farodeintamar.com` es portal de empresa y el resto proyectos operan en subdominios como `euclidian.farodeintamar.com` (propuesta, no ejecutada). Evitar acoplar dominios hasta aprobar producto y SEO.
3. En Vercel, abrir el proyecto de destino, **Domains > Add**, introducir dominio/subdominio, leer exactamente registros A/CNAME/TXT que Vercel pide para esa combinación (no inventar IP ni registros).
4. Crear/editar DNS únicamente en el proveedor autoritativo; verificar resolución, propiedad, emisión TLS/HTTPS y redirección www/apex. Verificar Vercel Deployment Protection sin abrir accesos privados.
5. Ajustar enlaces canonical, metadatos OG, sitemap.xml, robots.txt y Search Console. No marcar sitio completo como listo solo por HTTP 200.
6. Elegir correo corporativo (p. ej. `kontakt@`, `datenschutz@` o `hola@`); confirmar proveedor y sus condiciones. Gmail personal actual NO habilita automáticamente el uso de una dirección @dominio propio.
7. Configurar los registros **MX, SPF, DKIM y DMARC** de acuerdo con instrucciones del proveedor real. SPF sin contradicciones; DKIM probado; comenzar DMARC con política gradual y monitorización; nunca inventar MX/DKIM.
8. Realizar pruebas: recibir/enviar, ver encabezados SPF/DKIM/DMARC, consultar abuse, enlaces de privacidad y mensajes automáticos.
9. Guardar prueba de compra y caducidad en carpeta privada; solo estado/fecha sin datos personales en GitHub.

## Protección económica
- No contratar Google Workspace, correos adicionales, dominios ni servicios hasta verificar necesidad real: por ahora el Gmail conectado puede usarse en trámites y pruebas.
- Dominio ≠ protección marcaria. Revisar DPMA/EUIPO y disponibilidad del nombre de empresa.
- No contratar dominio antes de que la titular apruebe el nombre y precio total.

## Estado EUCLIDIAN (17 oct 2026)
- URL en Vercel: `euclidian-elementos-tributarios.vercel.app` (verificado dentro del proyecto).
- El código incluye canonical y metadatos, pero el lanzamiento comercial sigue en REVIEW.
- Solo mostrar `https://...` en un enlace público si accesible sin login de Vercel; autenticar por separado las secciones de usuario/administración.
