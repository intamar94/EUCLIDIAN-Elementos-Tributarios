# SEO y oferta de EUCLIDIAN

## Oferta propuesta, no cobro activo
Tarifa regular aprobada: 49.900 COP/mes por usuario. Tarifa para primeros suscriptores: 29.900 COP/mes. Cupos, duración y elegibilidad pendientes: no inventar condiciones. No se modifica Stripe ni el entitlement. Confirmar costos reales, impuestos aplicables, límite de consultas, renovación y cancelación antes de abrir la venta. No prometer consultas ilimitadas sin un plan configurado. La portada distingue propuesta y contratación disponible.

## Search Console
Usar como propiedad principal de Search Console el dominio verificado `euclidianet.com` (o una propiedad de prefijo URL `https://euclidianet.com/` si así se administra). No usar el subdominio provisional de Vercel como propiedad principal. Verificar con el archivo HTML proporcionado por Google (conservar su nombre y contenido exactos), o con la etiqueta proporcionada en el head de index.html. No inventar identificadores. Enviar /sitemap.xml tras verificar. app.html conserva noindex; no bloquear su rastreo en robots, para que Google pueda leer esa directiva.

## Analytics 4
Pendiente propiedad e identificador de medición reales. No hay etiqueta instalada ni tráfico enviado. Antes de habilitar: consentimiento y aviso de privacidad aplicables; desactivar captura automática de búsquedas, formularios y URL con parámetros. Medir únicamente portada, ejemplo elegido, clic de registro y entrada; nunca claves, correos, tokens, consulta tributaria, contenido de documentos ni identificadores de usuario. Verificar payloads en DebugView antes de activar en producción.

## Investigación de palabras clave
Hipótesis iniciales: conceptos DIAN, consultar oficio DIAN, normativa tributaria Colombia, biblioteca tributaria para contadores. No son volúmenes comprobados. Usar consultas, impresiones, clics y CTR de Search Console y contrastar demanda en Keyword Planner/Google Trends. No crear páginas repetidas por cada término. Mantener contenido útil, fuentes y fechas reales. No garantizar posiciones ni indexación.

## Verificación
Revisar /robots.txt, /sitemap.xml, canonical, título, descripción, imagen social y JSON-LD. El sitemap contiene solo la portada pública; no cuenta, consultas autenticadas ni fichas restringidas.

## Inventario SEO del dominio definitivo (preparación, sin publicación)
La portada, las guías `/fuentes-dian.html`, `/fechas-y-vigencia.html` y `/novedades-tributarias.html` son las únicas URL públicas inicialmente propuestas para indexación. El sitemap debe incluir exactamente estas cuatro URL canónicas cuando las guías estén aprobadas editorial y jurídicamente y realmente publicadas con HTTP 200. Hasta entonces, no comunicar que Google ya las indexó.
`/app.html` y `/aportes.html` (SIGNA) deben conservar `noindex`; `/contacto.html` se mantiene fuera del índice mientras solo sirva como canal operativo. Las páginas legales requieren comprobación y aprobación de LEGAL.ia: con identidad o estado legal pendiente, responden 503 y noindex. El robots.txt no equivale a una medida de seguridad.
El formulario SIGNA está preparado en la rama de prepublicación con cierre por defecto en el backend; no establecer un precio, un plazo contractual ni activar cobros sin definición aprobada, revisión legal y controles de autorización de pago.
En las guías se incluyen Open Graph, Twitter Card y BreadcrumbList congruentes con las URL oficiales. Verificar que las imágenes sociales carguen de verdad y que no se compartan rutas de cuentas.
Ver además `docs/FARO_KIT_SEO_REUTILIZABLE.md`.
