# Suscripción sandbox — contrato de acceso

Este frente **no procesa cobros reales**. Define el contrato técnico que debe respetarse antes de conectar un proveedor.

## Producto y tiers

EUCLIDIAN es un producto común para cualquier persona u organización que necesite la información. Los planes se diferencian por **uso, capacidad, volumen, usuarios/equipo o funciones que generen valor/coste**, no por profesión.

La base contiene actualmente un plan activo con código `pro`, pero **precio y estructura final de tiers no se consideran aprobados por este documento**. La API `/api/plans` oculta el precio salvo que exista una habilitación explícita del servidor.

No se ofrece una prueba gratuita abierta. El esquema puede reconocer estados técnicos del proveedor, pero ningún flujo de registro crea automáticamente acceso `trialing`.

## Ownership y entitlement

- `perfiles_usuario.user_id` y `accesos_suscripcion.user_id` referencian `auth.users.id`.
- Al crear un usuario, el trigger `on_auth_user_created_euclidian` crea perfil y acceso en estado `pendiente`.
- El navegador presenta la sesión, pero **el servidor vuelve a comprobar el entitlement en cada consulta**.
- `/api/documentos` concede acceso al usuario cuando `euclidian_estado_acceso` devuelve `permitido=true`.
- La clave compartida histórica queda solo como vía interna transitoria; no es el mecanismo de cliente.

## Estados reales

`accesos_suscripcion.estado` utiliza actualmente:

- `pendiente`: cuenta creada, sin acceso pagado.
- `trialing`: estado técnico reconocido por la integración; no se crea como prueba gratuita pública.
- `active`: acceso concedido.
- `past_due`, `unpaid`, `incomplete`: estados de cobro que no deben tratarse como acceso normal.
- `canceled`: suscripción cancelada.

`cancelar_al_fin` y `periodo_fin` permiten representar cancelación al cierre del periodo sin borrar historial.

## Uso y límites

`uso_consultas` registra únicamente `user_id`, fecha, latencia, número de resultados y estado técnico. **No almacena el texto buscado ni los filtros de la consulta.**

El límite mensual vive en `planes_suscripcion.limite_consultas_mensual`. En este momento el plan existente no tiene límite publicado; medir uso precede a fijar límites definitivos.

## RLS y seguridad

- El usuario no puede leer datos de otra cuenta.
- Suscripciones no son editables desde el navegador.
- `service_role` permanece exclusivamente en servidor.
- Funciones privilegiadas de entitlement no son ejecutables por `anon` ni `authenticated`.
- Webhooks deben validar firma antes de procesar.
- La tabla `eventos_pago` impone `UNIQUE(proveedor, evento_id)` y no está concedida a roles cliente.
- No se almacena el payload completo del proveedor; puede conservarse un hash para trazabilidad.
- Un evento repetido no puede volver a producir efectos de negocio.

## Criterio de salida de sandbox

Antes de un cobro real deben probarse: registro/login/recuperación, ownership, denegación cross-user, entitlement activo, expiración, cancelación, pago fallido, replay de webhook, transición inválida de estado, ausencia de secretos en cliente y flujo checkout → webhook auténtico → entitlement.
