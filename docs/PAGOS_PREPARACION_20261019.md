# Pagos EUCLIDIAN: preparación del 19 de octubre de 2026

## Resultado verificado en código

El adaptador existente utiliza Stripe Billing. No se ha creado ni vinculado una
cuenta, instalado una integración, configurado claves, activado facturación,
modificado precios ni realizado transacciones. Las pruebas de este cambio usan
respuestas simuladas y firmas de test: no acreditan un pago en Stripe Sandbox.

Una reserva de checkout podía devolver una sesión abierta de otro plan, precio
o dirección de retorno anterior. Ahora se recuperan sus líneas y se comprueban:
modo suscripción y test/live, cliente, identidad, metadatos de plan, una sola
línea con Price vigente y cantidad uno, y retornos del origen configurado.
Una discrepancia devuelve 409 `checkout_existente_no_coincide`, sin crear una
segunda sesión ni conceder acceso. La reserva temporal se libera igualmente.
La sesión anterior debe expirar o ser revisada de forma controlada antes de
intentar otro checkout. Nunca se cancela una compra o suscripción automáticamente.
Un cliente vinculado a otro proveedor también se rechaza antes de llamar a Stripe.

## Bloqueos concretos antes de activar

1. Confirmar la cuenta comercial del titular y proveedor elegido. No provisionar
   recursos ni aceptar condiciones sin autorización específica.
2. Resolver el precio definitivo: `CIERRE_INTERNO_20261010.md` conserva 59.900 COP,
   mientras `SEO_Y_OFERTA_COLOMBIA.md` menciona 49.900/29.900. Ninguno se cambia
   aquí ni se convierte automáticamente en oferta vigente. Fijar duración,
   elegibilidad y renovaciones de cualquier tarifa de fundadores.
3. Validar con asesoría competente el tratamiento de impuestos y la facturación
   para titular alemán y clientes objetivo, las condiciones de contratación,
   cancelación, desistimiento y reembolso. No se ha activado `automatic_tax`:
   su ausencia en código no determina la obligación tributaria.
4. Preparar, en un entorno aislado de prueba, `PAYMENT_PROVIDER=stripe`,
   `STRIPE_SECRET_KEY` de test, `STRIPE_WEBHOOK_SECRET` de ese endpoint y
   `EUCLIDIAN_APP_URL` como origen HTTPS exacto. Confirmar las variables Supabase
   de servidor, migración `sql/cierre_acceso_y_pagos.sql`, restricciones RLS y RPC.
   No compartir claves con el navegador.
5. Crear/configurar únicamente tras autorización el producto y Price mensual
   de prueba y su correspondencia en `planes_suscripcion.stripe_price_id`,
   importe y moneda; configurar portal con cancelación al final del período.
6. Entregar eventos snapshot al endpoint `/api/payment-webhook`:
   `customer.subscription.created`, `.updated`, `.deleted`, `invoice.paid` e
   `invoice.payment_failed`. Usar el secreto del endpoint y modo correctos.
7. Probar con proveedor real de test: checkout, webhook firmado y acceso;
   renovación pagada y fallida; cancelación al final del período y expiración;
   eventos duplicados/desordenados y reintento tras fallo; rechazo entre usuarios;
   precio/plan modificado durante una sesión abierta; portal e identidad.
8. Mantener las banderas comerciales `EUCLIDIAN_BILLING_ENABLED` y
   `EUCLIDIAN_PRICING_PUBLICADO` desactivadas en producción mientras faltan
   estas evidencias. La configuración de test no autoriza copiar claves live.
   Apertura pública y legal quedan coordinadas con sus responsables.

## Validación local

- `node tests/billing_flow_contract.mjs`: firma, modo, impago, cancelación,
  duplicación/reintento, acceso por período, identidad y precio en servidor,
  reutilización válida, 14 variantes de sesión incompatible y liberación de reserva.
- `node tests/payment_events_contract.mjs`: idempotencia (3 escenarios).
- `node tests/commercial_access_contract.mjs`: propiedad y precio cerrado (4 escenarios).

Referencias técnicas oficiales consultadas:
https://docs.stripe.com/api/checkout/sessions/retrieve
https://docs.stripe.com/api/checkout/sessions/object
