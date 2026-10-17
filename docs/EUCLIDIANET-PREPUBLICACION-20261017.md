# EUCLIDIANET — Acta técnica de prepublicación
**Preparado:** 17 de octubre de 2026 · **Estado:** código en rama de revisión, NO autorizado para apertura pública/comercial.

## Cambios de esta entrega
- Acceso de clientes cerrado por defecto: `EUCLIDIAN_PUBLIC_ACCESS_ENABLED=0` en Vercel producción/preview; el backend rechaza inicio, renovación, recuperación y acceso por tokens antiguos, y la validación central impide operaciones de cliente. Se preserva la entrada interna con `EUCLIDIAN_CLAVE`.
- Alta pública mantiene su propio cierre `EUCLIDIAN_SIGNUP_ENABLED`, sin navegación visible ni formulario operable.
- Cabeceras HTTP para el sitio y `Cache-Control: no-store` para `/api/*` sin sobrescribir los rewrites de `/impressum`, `/datenschutz` y `/privacidad`.
- Área **Cuenta → Aporta a EUCLIDIAN → /aportes.html**. Categorías: error, dato tributario, documento faltante y sugerencia. Un aporte por usuario, categoría y día de Colombia (control único en DB). Sin ficheros adjuntos ni datos tributarios sensibles.
- El formulario se cierra si falta cualquiera de: `EUCLIDIAN_PUBLIC_ACCESS_ENABLED=1`, `EUCLIDIAN_LEGAL_APPROVED=1`, `EUCLIDIAN_APORTES_ENABLED=1`, fechas civiles `EUCLIDIAN_APORTES_DESDE` y `EUCLIDIAN_APORTES_HASTA` (ambas `YYYY-MM-DD`, inclusivas, zona `America/Bogota`).
- Tabla Supabase `public.aportes_usuario` **creada y verificada el 17/10/2026** en proyecto EUCLIDIAN, vacía (0 registros), RLS activada y sin permisos `anon` ni `authenticated`; inserciones solo por `service_role` en el backend. El archivo `sql/aportes_usuario_euclidian.sql` deja reproducible su configuración.
- Correo público `/contacto.html` con enlaces a las tres direcciones del dominio; no pretende enviar mensajes automáticamente.
- Guías SEO originales públicas: `/fuentes-dian.html`, `/fechas-y-vigencia.html`, `/novedades-tributarias.html`, canonical único, título, descripción, datos estructurados, enlaces internos y sitemap. `/app.html`, `/aportes.html` y `/contacto.html` fuera del sitemap y con `noindex`.
- Pruebas incorporadas al control de calidad de GitHub: prelaunch, aportes, SEO, enlaces y cabeceras. Estas comprobaciones estáticas no reemplazan mediciones Lighthouse ni validación jurídica.

## Verificaciones previas ya realizadas
- PR #76 y PR #82 fusionados en `main`; páginas legales existen en código con barrera de aprobación.
- `euclidianet.com` verificado en proyecto Vercel; `www` redirige al dominio canónico según verificación anterior.
- Vercel: plan **Hobby** y protección SSO vigente; este modo impide rastreo normal de las páginas públicas. El dominio registrado NO implica que el código nuevo esté publicado.
- Cloudflare Email Routing configurado para `contacto@`, `errores@` y `sugerencias@euclidianet.com`. Recepción real extremo a extremo todavía no certificada.
- Supabase región `sa-east-1`, base de datos ~**861 MB**; revisar almacenamiento contratado y mantenimiento antes de operación comercial.
- No se publicaron nombre, dirección privada, credenciales ni justificante de Gewerbe.

## Bloqueos reales antes de publicar al público
1. **LEGAL.ia:** verificar Gewerbeanmeldung, fecha efectiva prevista 19/10/2026, identidad fiscal y nombre/domicilio, autorización expresa de publicación. Revisar Impressum y privacidad aplicables al flujo real del sitio y nuevo formulario (usuario, contenido, período de conservación, derechos, proveedores y transferencias). Solo entonces autorizar `EUCLIDIAN_LEGAL_APPROVED=1`.
2. **Hosting comercial:** Vercel Hobby permite únicamente uso personal no comercial; antes de vender suscripciones migrar a alojamiento apto para actividad comercial o cambiar de plan, comprobando costes. El DNS propio no elimina límites de alojamiento ni ejecuta por sí solo las APIs Node.
3. **Capacidad Supabase:** resolver límite de almacenamiento y verificar plan/recursos de la base de datos. No borrar datos del catálogo tributario sin auditoría.
4. **Flujo correo:** prueba real de envío y recepción desde un buzón externo, incluso Android/iOS; revisar política de privacidad y tiempos de respuesta.
5. **Pruebas E2E:** esperar CI verde, probar navegador móvil/escritorio, acceso interno, formulario de aportes (cerrado y luego activado en entorno controlado), errores, fuente DIAN, rendimiento, contraste y seguridad de servicios.
6. **Autorización de publicación:** comprobar versión exacta de `main` vs despliegue producción. La apertura debe incluir prueba real de páginas legales 200, TLS, contacto, inspección de cabeceras, plan de reversión y comprobación de que /api y /app quedan cerrados hasta activación expresa.
7. **SEO medible:** cuando el dominio pueda abrirse públicamente y legal esté aprobada, verificar propiedad en Search Console, inspeccionar URLs canónicas y sitemap, registrar la indexación real, LCP/INP/CLS móvil y escritorio y errores de rastreo. Ningún ranking está garantizado.

## Secuencia controlada con Vercel operativo
1. Ejecutar PR de esta rama en GitHub, revisar diffs y exigencias de LEGAL.ia; mantener flags en `0`.
2. Fusionar a `main` únicamente con CI verde y aprobación técnica. La fusión podría disparar un build; no confundir con permiso de lanzamiento.
3. Desplegar `main` con entorno revisado, primero con dominio todavía protegido. Verificar commit e integridad en preview, y después producción según acceso disponible.
4. Solo tras permiso legal/hospedaje comercial, abrir portada pública; conservar cerrados clientes/cobros si no están aprobados.
5. Definir por escrito las fechas de campaña. Habilitar aportes en producción únicamente cuando la declaración de privacidad esté actualizada, las sesiones de cliente autorizadas y la ventana confirmada. Probar autorización y cierre por fecha.
6. En caso de error, restaurar despliegue seguro y fijar flags `0`.

**No cambiar automáticamente protección global de Vercel, DNS, método de cobro o estado legal.** Correo, ubicación exacta de la titular y secretos solo en proveedores autorizados, jamás en el repositorio público.
