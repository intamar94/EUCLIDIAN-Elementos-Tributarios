# EUCLIDIAN — M3/2 | Persistencia privada de expedientes, bloqueada hasta validación
**18/10/2026 · Diseño + API + contratos; sin migración en Supabase de producción**

## Qué se ha construido
1. **Migración propuesta:** `sql/expedientes_profesionales_rls_preparacion.sql`. Crea `expedientes_profesionales` y `expediente_revisiones` con propietario basado en la identidad `auth.uid()`, RLS con `FORCE ROW LEVEL SECURITY`, campos editables restringidos, versión monotónica, snapshots generados automáticamente y borrado en cascada.
2. **API preparada:** `lib/expedientes-api.js`. Atiende la ruta ya existente `/api/profile?accion=expedientes` a través de `api/profile.js`, para no crear una decimotercera función Vercel Hobby.
3. **Acceso mínimo:** usa JWT Supabase del usuario autenticado (`SUPABASE_PUBLISHABLE_KEY`, **no service role**) y filtros por propietario; la protección real depende también de RLS.
4. **Conflictos:** la escritura y eliminación requieren versión esperada. Si el expediente cambia en otro dispositivo, responde 409 en vez de sobrescribir a ciegas.
5. **Revisión jurídica:** ningún cliente puede insertar/editar historial directamente, cambiar propietario ni promover `borrador_sin_revision` a un estado de aprobación; futura aprobación profesional requiere módulo distinto y revisión humana.

## Bloqueo efectivo
La API devuelve **503 antes de consultar usuarios o bases de datos** salvo que existan **simultáneamente** estas tres variables configuradas expresamente en producción:
- `EUCLIDIAN_EXPEDIENTES_PERSISTENCIA_ENABLED=1` (nueva, no activar ahora).
- `EUCLIDIAN_LEGAL_APPROVED=1` (debe derivarse de LEGAL.ia y del Gewerbe).
- `EUCLIDIAN_PUBLIC_ACCESS_ENABLED=1` (la compuerta real de usuarios).

El escritorio actual de **Explorar** sigue usando exclusivamente memoria de la pestaña y exportaciones manuales. **No hay nueva API activa ni escritura de expedientes privados en producción.** No confundir la entrega de código con la función de sincronización disponible.

## Pruebas necesarias antes de aplicar SQL o encender una variable
**Fase A — revisión legal:** finalidad del tratamiento, contrato, política de privacidad, encargados/transferencias, minimización, periodos, exportación y supresión, seguridad del almacenamiento y autorización explícita de LEGAL.ia.

**Fase B — base de ensayo:** aplicar la migración en un proyecto Supabase separado o en un entorno de prueba controlado. Crear dos usuarios de prueba `A` y `B`, con JWT independientes, y comprobar vía conexión `authenticated`:
- A crea su expediente, recibe `version=1`, y un evento de `creacion`.
- B no puede leer, modificar, eliminar ni ver la revisión de A incluso si conoce el UUID.
- A actualiza y genera versión 2, evento `edicion` inmutable. Dos actualizaciones simultáneas con versión 1: una gana, otra falla.
- Ningún usuario puede enviar `owner_id` de otro ni falsificar `estado=aprobado`, fecha, historial o revisor.
- `anon` no puede hacer CRUD ni consultar snapshots.
- Al eliminar expediente o cuenta, se eliminan snapshots relacionados; confirmar eliminación en consultas y backups según la política vigente.
- El trigger de historial con `FORCE RLS` inserta efectivamente con el propietario/rol de ejecución del entorno; si falla, NO publicar ni debilitar RLS.
- No existe acceso mediante el rol `service_role` desde la API de expedientes; contrastar logs sin registrar contenido de notas.

**Fase C — pilotaje:** integrar botón «Guardar en mi cuenta» opcional en el mismo panel editorial **solo después** de que los pasos anteriores pasen. El usuario debe distinguir «borrador en pestaña» frente a «guardado privado». Implementar recuperación, eliminación, historial y consentimiento antes de usar datos reales.

## Pruebas incluidas ahora
- `tests/expedientes_persistencia_contract.mjs`: contratos estáticos de políticas RLS y permisos; entorno cerrado por defecto; llamadas HTTP simuladas con autorización del usuario; bloqueo de campos ilegales; control de versión; no service key en llamadas a los nuevos expedientes.
- Pipeline GitHub sigue ejecutando los recorridos de inicio, buscador, comparador y beta temporal.
- **Estas pruebas no equivalen a un test de aislamiento real con dos JWT**: ese test necesita la base de ensayo y es un bloqueo explícito.

## Consideraciones técnicas pendientes
- El historial almacena copias de notas privadas: requiere política de retención, tamaño total por usuario, backups cifrados y supresión trazable.
- La migración no incorpora todavía adjuntos de documentos; solo registra notas. Diseñar tabla `expediente_fuentes` con enlaces oficiales validados y RLS antes de persistir fuentes.
- El trigger de revisión y la separación entre roles deben revisarse en una base de ensayo para confirmar `SECURITY DEFINER` con `FORCE RLS`. No sustituir pruebas negativas por inspección de SQL.
- Fijar límite de expedientes, quota y protección contra uso abusivo antes de habilitar tráfico real.
- Hacer pruebas de concurrencia por versión, idempotencia y reintentos antes de ofrecer sincronización.

## Conservación del producto
No cambia la portada, login `/euclides.png`, GIF, marca, consulta, comparador, datos tributarios, perfil actual, registro ni pagos. Se añade una capa de persistencia **preparada pero cerrada**.

Seguimiento: [#102](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/102), [#93](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93), revisión LEGAL.ia y Gewerbe prevista para lunes.
