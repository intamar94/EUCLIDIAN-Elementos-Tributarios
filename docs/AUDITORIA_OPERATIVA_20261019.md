# EUCLIDIAN — Auditoría operativa, 19 de octubre de 2026

## Evidencia verificada

- Proyecto Vercel `prj_nJnvzv4tBt8sLoH2jDzzTC7Tn5o3`, equipo `team_YSuRDinZbF2w9wTiU5GGAd0u`: Node 24.x, dominio `euclidianet.com`, protección SSO en todos los despliegues. No se ha modificado.
- La lectura de equipo no expone el plan de facturación: **plan actual no confirmado**. Los documentos del 17 de octubre mencionan Hobby; esa observación no demuestra el plan de hoy.
- Última producción observada: `dpl_9i4Ut2Jqv3KvtjS6nwYxCwHqmsSM`, READY, SHA `84182af200000b9568c1a455a44f4996c6e325f4`, 18 de octubre. El último preview READY es `e634710622179fe34e7f9349332ef9efd3700cbf`; no confundirlo con producción.
- Inventario de producción desde el inicio del 19 de octubre en Berlín (`1792360800000`): cero solicitudes. Volver a consultar inmediatamente antes de cualquier publicación; esta observación no reserva el turno del día.
- `main` observado: `829ae551fab964a448b0c5148714bd14c86fc4d4`. [Control de calidad, run 39141040315](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/actions/runs/39141040315): completado con éxito, evento push, mismo SHA.
- El código mantiene `git.deploymentEnabled:false` y el contrato local de publicación diaria pasa. El inventario no demuestra por sí solo que cada push futuro esté bloqueado remotamente.
- Hay 12 archivos de API Node. No añadir rutas separadas sin revisar el empaquetado y la cuota efectiva del plan; los documentos actuales mantienen ese presupuesto.

## Capacidad y recuperación

Supabase confirma organización en plan **Free**, proyecto `frbhrxifbqautumikaqw` ACTIVE_HEALTHY, región `sa-east-1`, Postgres 17.6.1.155. Consulta de metadatos, sin leer contenido de usuarios: `pg_database_size(current_database()) = 904883347` bytes, aproximadamente **863 MiB**. Supera la cuota oficial Free de 500 MB. El estado healthy no demuestra ausencia de restricciones de cuota ni capacidad de escritura de cada API.

| Relación | Tamaño total aproximado | Filas vivas estimadas |
| --- | --- | --- |
| inspector_resultados | 406 MiB | 2.117.076 |
| documentos_tributarios | 258 MiB | 18.103 |
| fuentes_dian_mapeadas | 55 MiB | 18.347 |
| control_interno_casos | 42 MiB | 73.805 |

No se borraron filas, ejecutó VACUUM ni cambió ninguna cuota. El tamaño procede principalmente de datos vivos; no recomendar limpieza ciega. La reducción requiere política de retención, archivo cifrado, restauración demostrada y autorización específica antes de retirar evidencia. No se encontró procedimiento de restauración probado en el repositorio auditado. La lectura de metadatos no confirma backups remotos existentes.

La documentación oficial recomienda exportaciones y almacenamiento externo para Free. Pro incluye copias diarias accesibles durante siete días. Las copias de base no incluyen los objetos almacenados mediante Storage API; requieren respaldo separado si se usan.

## Correo técnico

El boletín usa Resend mediante workflow manual; no se ha ejecutado ni enviado correo de prueba. No se han leído secretos. Su fallback de enlaces de baja apuntaba a `euclidian.co`; esta rama lo corrige a `https://euclidianet.com`. Las variables configuradas pueden prevalecer sobre el fallback y deben validarse sin exponer credenciales.

Quedan por verificar remitente propio validado, SPF/DKIM/DMARC y el transporte SMTP de Auth con el responsable de cuentas. El fallback `onboarding@resend.dev` no constituye prueba de remitente comercial listo. No activar envíos masivos por esta corrección.

## Opciones mínimas y costes orientativos

| Opción | Precio base publicado, USD/mes | Condición previa |
| --- | --- | --- |
| Mantener Vercel si ya es Pro | Según facturación real | Confirmar plan e importes; no asumir Hobby |
| Vercel Pro si sigue Hobby | 20 + impuestos y uso adicional | Aprobación de precio final y límite de gasto |
| Supabase Pro, primer proyecto Micro | Desde 25 + impuestos/excesos aplicables | Aprobación final, comprobar factura y add-ons; incluye 8 GB y backups diarios de siete días |
| Supabase Free con archivo y retención | 0 de plan | Demostrar respaldo/restauración y bajar tamaño con autorización; margen para crecimiento posterior |
| Cloudflare Workers Free, candidato de migración | 0 dentro de cuota | Validar términos comerciales, adaptar APIs Node y firmas raw, protección y pruebas; no basta mover DNS |

Cloudflare publica 100.000 peticiones diarias y 10 ms CPU por invocación en Free. No se demuestra en esta auditoría que el conjunto actual de APIs y protecciones funcione allí. No es una migración lista para producción.

Vercel Hobby restringe el uso a proyectos personales no comerciales. Si sigue siendo el plan vigente, el alta de Gewerbe no elimina esa restricción contractual. Los precios de la tabla son referencias públicas, **no un precio final autorizado**. No se contrató ni modificó ningún plan.

## Próximo lote autorizado de preparación

1. Corregir el enlace de baja y revisar el diff, sin ejecutar el workflow de envío.
2. Confirmar plan Vercel desde facturación y coordinar con seguridad la restricción efectiva de Supabase.
3. Preparar restauración y propuesta de retención de resultados del inspector, sin retirar datos de producción.
4. Antes de un despliegue: volver a comprobar el SHA integrado, CI del mismo SHA y contador diario; conservar SSO y las compuertas existentes mientras responsables de legal, cuentas y pagos terminan sus validaciones.

## Fuentes primarias consultadas

- https://vercel.com/docs/plans/hobby
- https://vercel.com/pricing
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/database-size
- https://supabase.com/docs/guides/platform/backups
- https://developers.cloudflare.com/workers/platform/pricing/

Lecturas de conectores Vercel/Supabase/GitHub del 19 de octubre y código auditado en rama aislada. No hubo despliegues, fusiones, cambios DNS/SSO, compras ni mensajes a terceros.
