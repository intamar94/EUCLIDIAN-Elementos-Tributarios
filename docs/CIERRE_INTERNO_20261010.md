# Cierre interno de EUCLIDIAN — 10 de octubre de 2026

Se integra el frente de cliente de la PR 3 conservando la puerta editorial de main:
las fichas sin APPROVE permiten localizar la fuente, sin conclusiones profesionales
no contrastadas. El registro crea una cuenta pendiente y nunca una prueba gratuita.

## Cambios

- Acceso sujeto a plan activo y período iniciado y no vencido; funciones privilegiadas exclusivas del servidor.
- Cierre de sesión elimina resultados y credenciales internas e invalida respuestas que llegan después.
- Confirmación por correo y recuperación eliminan tokens de la URL; errores del servicio no simulan éxito.
- Checkout autenticado, importe y plan contrastados en servidor, reserva de compra y reutilización de sesión abierta.
- Webhook con firma sobre cuerpo original, comprobación de entorno y nueva lectura de la suscripción en Stripe.
- Factura sin pagar no activa acceso. Aplicación del evento y actualización de acceso en una sola transacción.
- Eventos duplicados y anteriores no repiten efectos; errores transitorios retornan 503 para reintento.
- Gestión de suscripción por portal del proveedor con identidad recuperada del servidor.
- Corrección literal de artículos omitidos y de tres casos centinela, con URL y hash de fuente.
- La portada utiliza el dominio Vercel existente hasta que haya un dominio propio.

## Configuración comercial pendiente

El plan interno `pro` contiene **59.900 COP/mes**. Es una referencia a validar,
no una tarifa publicada. Se propone empezar con un único plan personal mensual:
consulta del catálogo, fuentes originales, filtros y lectura de fichas contrastadas.
Vender ahorro de tiempo y trazabilidad; no prometer asesoramiento individual ni
que todo documento del catálogo tenga revisión profesional terminada.

El adaptador implementado es Stripe Billing y está deshabilitado. Antes de elegirlo
se debe confirmar que el país de la entidad comercial esté admitido por Stripe.
La moneda COP del catálogo no demuestra que esa entidad pueda abrir cuenta allí.
Si el comerciante está constituido en Colombia, validar el proveedor disponible
para esa entidad antes de fijar esta integración como definitiva.

Para configurar Stripe: cuenta comercial compatible, producto/Price recurrente
mensual que coincida con el plan, `planes_suscripcion.stripe_price_id`, claves
servidor `STRIPE_SECRET_KEY` y `STRIPE_WEBHOOK_SECRET`, `PAYMENT_PROVIDER=stripe`,
`EUCLIDIAN_APP_URL` (origen HTTPS), portal con cancelación al final del período,
y endpoint `/api/payment-webhook` con estos eventos snapshot:

- `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`
- `invoice.paid`, `invoice.payment_failed`

Mantener `EUCLIDIAN_BILLING_ENABLED` y `EUCLIDIAN_PRICING_PUBLICADO` apagados hasta
probar con credenciales de test registro, confirmación, compra, renovación,
cancelación, impago, expiración y reintentos. Después configurar producción y
las condiciones comerciales, impuestos y política de cancelación/reembolso.
Este cierre no acredita cobros reales ni valida el email/SMTP de producción.

Fuentes técnicas: https://docs.stripe.com/webhooks,
https://docs.stripe.com/api/checkout/sessions,
https://stripe.com/global.

## Evidencia de datos

Se comprobaron 15.986 registros publicados, sin fechas web anteriores a la fecha
del acto en ese conjunto. Las tres discrepancias históricas detectadas son
literales de la DIAN y siguen fuera del catálogo público; no se alteran para
conseguir un informe sin alertas. Persisten tareas editoriales del histórico.

Las correcciones de SIMPLE, firma de correcciones y decreto 1419 conservan la
fuente original y no conceden aprobación editorial automáticamente.
