# FARO / LEGAL.ia — Dominio y publicación controlada

**Principio:** costo nuevo o cambio público necesita aprobación; la automatización ejecuta solo lo verificable y reversibles. Nunca comprar ni renovar automáticamente sin presupuesto/autorización.

## Registro inicial
1. Registrar en expediente: nombre proyecto, operador Faro de Intamar, audiencia/país, marca, finalidad, tipo de contrato, datos y riesgos.
2. Comprobar marca previa en DPMA/EUIPO y nombres semejantes (NO equivale a clearance jurídico), y disponibilidad en registrador confiable; presupuestos anual, renovación y WHOIS.
3. Validar nombre registrado del operador, derechos de uso, email de control y MFA. No hacer público el domicilio particular sin revisión.
4. Registrar fecha de compra, renovación, costo, titularidad, DNSSEC/renovación cuando corresponda y políticas de bloqueo.

## Vercel / DNS / SSL
5. Crear/seleccionar proyecto Vercel específico, vincular GitHub, identificar despliegue base que ya funciona y respaldar configuración.
6. Añadir dominio SOLO después de tener propiedad verificada. Leer registros exactos propuestos por Vercel (A/CNAME/TXT), aplicarlos en el registrador y verificar propagación real.
7. Comprobar HTTPS, certificado, HTTP→HTTPS, www/apex y redirecciones, URL canonical, sitemap, robots, CSP, autorización del admin y que la web pública no requiera login de Vercel.
8. No copiar claves service_role Supabase al frontend; revisar variables de producción/preview, permisos, backups, RLS y DPA.
9. Publicar Impressum/Datenschutz aprobados y enlaces visibles en landing, login y cada vista. Bloquear pagos hasta aprobación de condiciones aplicables.
10. Si se necesita correo con dominio, verificar si Google AI Plus cubre el servicio (**normalmente no equivale a Google Workspace**) y configurar proveedor adecuado con MX, SPF, DKIM, DMARC; probar recepción/entrega.
11. Ejecutar legal-ia-gate en modo release y las pruebas de la app; guardar capturas/URLs, fecha y aprobación humana.
12. Activar vigilancia de vencimiento de dominio, validez de TLS, uptime, enlace de páginas legales y cambios regulatorios con avisos accionables.

## Control de seguridad
- No hacer cambios DNS/servicio ni compras sin consentimiento puntual.
- No abrir permisos admin de Supabase/Vercel para arreglar visibilidad pública.
- No subir dirección, documentos oficiales, identificadores fiscales o secretos a repositorios públicos.
- La fecha 19 de octubre de 2026 está prevista para la presentación del Gewerbe; cambiar status solo con prueba.
