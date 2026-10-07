# Suscripción sandbox — contrato de acceso

Este frente no procesa cobros reales. Define el contrato que debe respetar la implementación antes de conectar un proveedor de pagos.

## Tiers

- `explorar`: consulta básica con límite configurable; sin seguimientos avanzados.
- `profesional`: consulta completa, seguimientos y exportación. El precio queda deliberadamente sin fijar hasta validar producto y mercado.

## Entitlements

Los permisos se resuelven en servidor a partir de `user_id` autenticado. El navegador nunca decide si una cuenta puede consultar. `/api/session` expone solo el estado necesario para UI y `autorizarConsulta()` vuelve a comprobar acceso en cada consulta.

Entitlements iniciales: `consulta`, `seguimientos`, `exportacion`. Los límites cuantitativos deben vivir en datos de plan, no codificados en la interfaz.

## Estados

`sandbox`, `trial` y `activa` pueden conceder acceso mientras el periodo no haya vencido. `pausada`, `cancelada` y `vencida` no conceden acceso. `cancelar_al_fin` no corta el acceso antes de `periodo_fin`.

## RLS y seguridad

- Cada usuario solo puede leer su propia suscripción y perfil.
- El cliente autenticado no puede crear, modificar ni borrar suscripciones.
- Cambios de plan/estado solo ocurren desde backend confiable.
- Las funciones de acceso reciben el `user_id` derivado del token verificado; nunca un identificador enviado por el navegador.
- La service key nunca se entrega al navegador.
- Webhooks futuros deben validar firma, ser idempotentes y registrar el identificador del evento antes de mutar estado.
- Ningún flujo sandbox puede convertirse en cobro real por una bandera del cliente.

## Criterio de salida

Antes de conectar pagos reales deben existir pruebas de: ownership, denegación cross-user, expiración, cancelación al final del periodo, replay de webhook, transición inválida de estado y ausencia de secretos en cliente.
