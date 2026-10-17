# EUCLIDIAN · Puesta en marcha web: inventario de control

**Fecha de auditoría:** 17 de octubre de 2026. **Estado global: NO AUTORIZADO PARA LANZAMIENTO COMERCIAL PÚBLICO.**  
Todos los resultados son estados comprobados por conectores de Cloudflare, Vercel, GitHub y Supabase, o tareas marcadas como pendientes. No confundir `READY` de un despliegue con una prueba E2E. No almacenar en GitHub nombre, domicilio personal, credenciales ni datos tributarios identificables.

## A. Dominio, DNS y redirecciones

- [x] Dominio `euclidianet.com` adquirido en Vercel y verificado; caduca 17/10/2027. `renew:false` (renovación manual).
- [x] Dominio raíz asociado al proyecto EUCLIDIAN.
- [x] `www.euclidianet.com` asociado y redirección **308** al dominio raíz.
- [x] Zona Cloudflare **Free activa**, nameservers `meg.ns.cloudflare.com` y `wilson.ns.cloudflare.com`.
- [x] DNS `@` y `www` como CNAME DNS-only al destino específico recomendado por Vercel `a79d2a01b3dd56ae.vercel-dns-017.com`. Sin conflictos de configuración según Vercel.
- [ ] Verificar resolución desde varios operadores y ubicación geográfica; comprobar que no hay errores intermitentes de redirección.
- [ ] Evaluar **DNSSEC** solo tras verificar soporte de registro DS en Vercel y tener procedimiento de reversión. No activar sin DS.
- [ ] Crear recordatorio de renovación de dominio con antelación suficiente (manual o tarea; titular decide).

## B. HTTPS, cabeceras y seguridad

- [x] Vercel emitió certificados TLS para raíz y www.
- [x] Cloudflare configurado en `Full (strict)`, `Always Use HTTPS:on`, TLS mínimo 1.2.
- [x] Los registros web están en **DNS-only**, por lo tanto Cloudflare no hace de proxy para la web: estos ajustes Cloudflare no sustituyen el HTTPS/seguridad de Vercel ni ofrecen WAF/CDN en este modo.
- [x] Vercel Authentication se aplica a **todos** los despliegues mientras falta aprobación legal.
- [x] En esta propuesta se preparan headers HTTP: X-Content-Type-Options, Referrer-Policy, X-Frame-Options, Permissions-Policy y no-store sobre `/api/*`.
- [ ] Comprobar headers reales al desplegar, CDN, emisión/caducidad de certificados y comportamiento móvil/escritorio.
- [ ] Diseñar **CSP** tras inventariar orígenes de Stripe, Supabase, Google Fonts y assets; no activar CSP restrictivo a ciegas que rompa la app.
- [ ] Valorar activar proxy Cloudflare (nube naranja) solo si añade valor; probar verificación Vercel, cookies, SSO, Webhooks, caché y latencia antes de cambiar.
- [ ] Revisar protección de endpoints sensibles, bruteforce, límites de frecuencia, tamaño de cuerpos, cookies, CORS, política de contraseñas, restablecimiento y tratamiento de errores.
- [ ] Confirmar secretos del proyecto (nunca exponer sus valores), rotación, minimización de permisos, y que no estén incluidos en frontend ni en los logs.

## C. Correo y mensajes

- [x] Cloudflare **Email Routing Free enabled / ready**, MX y SPF/DKIM gestionados por Cloudflare.
- [x] Destino Gmail verificado; las tres rutas están **enabled**, hacia el mismo buzón: `contacto@`, `errores@`, `sugerencias@` sobre `euclidianet.com`.
- [x] Registro TXT DMARC inicial `v=DMARC1; p=none; pct=100; adkim=r; aspf=r`, **modo observación**, no bloqueo anti-spoof efectivo.
- [x] Enviado un mensaje de prueba desde el mismo Gmail a `contacto@`; al instante solo se verificó el mensaje en **Enviados**, no recepción.
- [ ] Probar entrega E2E **desde una cuenta independiente** hacia cada alias; medir llegada, encabezados, spam, demora y rebotes. Gmail remitente = Gmail destino no constituye prueba suficiente.
- [ ] Definir y probar **cómo responder** con identidad legal `contacto@euclidianet.com`. Email Routing es **solo entrada** (no SMTP/IMAP). No contratar servicios sin presupuesto y aprobación.
- [ ] Elegir política DMARC definitiva una vez autentificado el correo saliente; si se endurece a `quarantine/reject` documentar impacto.
- [ ] Organizar filtros/etiquetas en Gmail para contactos, errores y sugerencias, confirmar notificaciones y protocolo RGPD de retención.
- [ ] Verificar que los correos de recuperación de contraseña de Supabase y avisos de suscripción se envían y llegan en producción desde un remitente autenticado.

## D. Interfaz, SEO y comunicación de producto

- [x] `index.html`: canonical, OG/Twitter y URL principales usan `euclidianet.com`.
- [x] `robots.txt` y `sitemap.xml` apuntan al dominio definitivo.
- [x] `app.html`: `noindex,nofollow`.
- [ ] Añadir página de aportes/contacto de PR #78, enlazada desde portada, autenticación y vista principal, **después de prueba de correo y aprobación legal**. La página `mailto` solo prepara el mensaje; exige cliente de correo del visitante.
- [ ] Destacar visualmente **E** y **T** en «Elementos Tributarios», coherente con la **i** coloreada de EUCLiDIAN, sin alterar identidad principal.
- [ ] Verificar roturas de enlaces, alturas, imágenes no repetidas, GIF HD, el hero limpio de portada, navegación y alt de imágenes en móvil/escritorio.
- [ ] Accesibilidad manual y automatizada WCAG: foco visible, contraste, teclado, lectores de pantalla, etiquetas, idioma, reducción de movimiento y tamaño táctil.
- [ ] Metadatos para páginas **públicas** definitivas; evitar indexar paneles, datos personales y URLs de búsqueda con tokens. Search Console, sitemap/robots tras publicación legal.
- [ ] Favicon/manifest y tarjetas sociales correctas, sin logos oficiales de la DIAN que impliquen aval.

## E. Aplicación, pagos, datos y seguridad de Supabase

- [x] Rutas serverless existentes en el repositorio: `/api/auth`, `/api/documentos`, `/api/checkout`, `/api/session`, `/api/profile`, `/api/plans`. No es solo estática.
- [x] Variables de entorno Vercel encontradas: `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `SUPABASE_PUBLISHABLE_KEY`, `EUCLIDIAN_CLAVE`, `EUCLIDIAN_REVISOR_CLAVE`, `EUCLIDIAN_LEGAL_EMAIL`, `EUCLIDIAN_LEGAL_APPROVED`. Comprobada solo presencia/nombre/target, **no valores**.
- [x] Supabase proyecto `ACTIVE_HEALTHY`, organización en plan Free.
- [!] Supabase DB medida en **861,5 MiB** frente a referencia Free de **500 MiB**. Principales ocupantes: `inspector_resultados` 406 MB; `documentos_tributarios` 257 MB; `fuentes_dian_mapeadas` 55 MB. **No borrar sin backup/restore comprobado.**
- [i] Supabase advisor devuelve 28 avisos informativos `rls_enabled_no_policy`; pueden responder al diseño server-only. Revisar caso por caso: esquema `private`, permisos PostgreSQL/grants, roles de acceso reales, y endpoint server con SERVICE_KEY. No desactivar RLS masivamente.
- [i] Supabase advisor devuelve una FK sin índice en `direccion_documental` y 28 índices sin uso registrado; no eliminar índices automáticamente.
- [ ] Exportar respaldos de BD y Storage, cifrar fuera del repo y **ensayar restauración**; política de retención, restauración y objetivos RPO/RTO.
- [ ] Diseñar archivo/compresión reversible para bajar cuota con margen, con medición posterior y pruebas de consulta.
- [ ] Pruebas E2E: crear cuenta, iniciar/cerrar sesión, recuperación, entitlements, límites, consulta, filtrado, fuentes oficiales, documentos faltantes, errores, tiempo de respuesta.
- [ ] Revisar integración Stripe webhook, secreto, idempotencia, suscripciones, cancelación y devolución **sin habilitar cobros** antes del control legal.
- [ ] Comprobar configuración de logs (sin tokens, correos o datos fiscales expuestos), errores controlados, monitoreo y alertas.

## F. Comercial, RGPD y publicación

- [ ] **Gewerbeanmeldung / razón social y domicilio notificable**: verificación de la titular y responsable LEGAL.ia. No publicar datos sin consentimiento.
- [ ] Impressum, Datenschutz, aviso legal, política de cookies (según rastreadores reales) y condiciones, revisión Alemania/Colombia, accesibilidad y fuentes oficiales. Expediente #83 y PR #67.
- [ ] Responsable/encargados de tratamiento: Cloudflare, Vercel, Google/Gmail, Supabase, Stripe si se habilita; DPA, transferencias, protección y conservación.
- [ ] Política de informes de usuarios: propósito, recogida mínima, borrado, respuestas y comprobación del correo de derechos RGPD.
- [ ] **Vercel Hobby** no cubre uso comercial; definir transición a hosting comercial compatible: Pro con presupuesto aprobado o Cloudflare Pages/Workers/Netlify con backend probado. Plan #73.
- [ ] Probar en entorno de staging bajo protección y generar evidencia: HTTP, HTTPS, www→raíz, páginas, correo entrante/saliente, auth, RLS, documentos, móvil, accesibilidad, SEO/legal.
- [ ] Procedimiento de rollback, estado de infraestructura, responsable del sitio y aprobación humana para abrir el acceso público.
- [ ] Publicar solo después de aprobar todos los bloqueos P0. Revisar errores en las primeras 24 y 72 h y monitorizar renovaciones/cuotas.

## Referencias del proyecto

- #68: dominio, compra y migración DNS
- #73: alojamiento sin suscripción Vercel Pro
- #83 y PR #67: LEGAL.ia
- PR #78: canal de correcciones y sugerencias
- Esta revisión aplica controles defensivos **sin exponer la web ni activar cobros**.
