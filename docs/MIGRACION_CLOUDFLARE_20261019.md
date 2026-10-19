# EUCLIDIAN: migración económica a Cloudflare

Decisión de dirección, 19/10/2026: preparar Cloudflare Free + Supabase Pro. Presupuesto de referencia 25 USD/mes de Supabase, no 25 EUR; precio final con impuestos y uso pendiente. Sin contratación, upgrade ni gasto ejecutado.

## Entrega comprobada

- Adaptador de los 12 endpoints existentes, query y JSON/form-urlencoded, cuerpo limitado a 256 KiB.
- Webhook conserva bytes originales; Stripe usa constructEventAsync, necesario en Workers. Validada firma sintética auténtica en Node y en workerd; no equivale a compra de sandbox.
- Alias legales y cabeceras de seguridad preservados.
- Construcción copia solo archivos de interfaz y medios permitidos. Excluye api, lib, docs, sql, secretos y configuración.
- Preview privado por defecto: requiere cabecera x-euclidian-preview-key y secreto EUCLIDIAN_PREVIEW_KEY; si falta, 503 para todas las rutas, incluidos medios. workers.dev y URLs de preview desactivados.
- Registro, acceso público, aportes, legal aprobado, precios y cobros siguen cerrados.
- No modificar process.env por petición: nodejs_compat carga bindings estables del despliegue.
- Cloudflare conectado y cuenta accesible; no se modificó el Worker existente de otro proyecto.

## Validación reproducible

`npm ci` y `npm run cloudflare:test` construyen assets, compilan con Wrangler sin publicar, ejecutan contratos del adaptador y ejecutan el bundle en workerd con Miniflare. Todo usa credenciales ficticias y no consulta datos productivos. La prueba de workerd usa un binding de assets simulado que lee el paquete local; falta probar el servicio de assets desplegado.

En el entorno restringido de esta sesión fue necesario un preloader temporal para os.networkInterfaces; no forma parte del producto. Miniflare actual requiere convertV4MiniflareOptions para las opciones de su API anterior.

Se ejecutaron 35 archivos *_contract.mjs sin fallos. Bundle observado: aproximadamente 780 KiB sin comprimir / 103 KiB gzip. Tamaño no prueba encajar en límite CPU Free de 10 ms ni rendimiento bajo carga.

## Activación pendiente

1. Guardar cambios revisables en GitHub; control de calidad incluye cloudflare:test, sin despliegues automáticos.
2. Proveer autorización de despliegue con soporte de assets y secretos. La conexión API permite leer cuenta y Workers; el cargador de assets requiere token específico de sesión. No crear tokens amplios ni publicar credenciales para sortearlo.
3. Publicar preview privado sin dominio productivo y probar servicio real de assets, red hacia Supabase, sesiones, CORS, límites CPU/subrequests y flujos de Stripe de sandbox. Mantener acceso privado durante toda la prueba.
4. Revisar contratos de Cloudflare y aviso de privacidad del alojamiento nuevo, respaldar base y comprobar restauración, confirmar importe final Supabase Pro y aprobar contratación antes de upgrade. No eliminar evidencia para reducir cuota.
5. Configurar secretos separados de producción, SMTP y tarifas aprobadas. Verificar aislamiento entre usuarios y límites de suscripciones.
6. Solo después de controles y política diaria, cambiar euclidianet.com con rollback preparado. Preservar DNS de correo (MX/SPF/DKIM/DMARC). El acceso y los cobros se abren únicamente al cerrar revisión legal y comercial.

No se ha migrado producción, cambiado DNS, contratado planes ni trasladado secretos. Vercel queda como origen anterior hasta demostrar sustitución. Free sigue siendo una hipótesis de capacidad que debe medirse; si excede límites, presentar alternativa y coste antes de contratar.
