# Auditor Profesional de Evidencia · EUCLIDIAN

## Propósito

El Auditor Profesional convierte pruebas en evidencia revisable por versión. No certifica el producto, no interpreta normas tributarias y no autoriza aperturas comerciales. Sus únicas conclusiones admisibles son `PASS`, `FAIL`, `BLOCKED` y `NOT-ASSESSED`, ligadas a un SHA, entorno, fecha y evidencia concreta.

## Registro de un hallazgo o control

Cada control debe usar un ID estable y registrar:

| Campo | Obligatorio | Ejemplo |
| --- | --- | --- |
| ID | Sí | `PRE-SEC-01` |
| Clase | Sí | seguridad, legal, fiscal, UX, SEO u operación |
| Prioridad | Sí | P0, P1, P2 o P3 |
| Estado | Sí | PASS, FAIL, BLOCKED o NOT-ASSESSED |
| SHA | Sí para PASS | SHA exacto revisado |
| Entorno | Sí para PASS | CI, preview o dominio público |
| Fecha | Sí para PASS | ISO 8601 con zona horaria |
| Evidencia | Sí para PASS | run CI, URL, cabecera, captura o paso reproducible |
| Responsable | Sí | rol que valida o corrige |
| Revalidación | Sí si cambia el SHA o entorno | fecha y nueva evidencia |

`PASS` significa únicamente que la comprobación indicada pasó en ese entorno; no equivale a certificado legal, fiscal, de seguridad ni de calidad total.

## Puertas de control

### Antes de publicar

| ID | Prioridad | Control | Evidencia mínima |
| --- | --- | --- | --- |
| PRE-REL-01 | P0 | SHA y CI exactos | SHA, URL/run CI SUCCESS, fecha y entorno CI |
| PRE-SEC-01 | P0 | Acceso, altas y pagos cerrados según configuración | contrato y configuración revisada |
| PRE-SEC-02 | P0 | Secretos, rutas sensibles y sesión | prueba negativa, cabeceras y limpieza de sesión |
| PRE-FIS-01 | P0 | Fuente DIAN, pasaje, hash y revisión humana cuando se afirme una conclusión | referencia trazable o BLOCKED |
| PRE-LEGAL-01 | P0 | Cambio legal revisado | responsable, alcance y estado; nunca PASS por un mock |
| PRE-OPS-01 | P0 | Rollback/versionado posible | versión previa identificada y procedimiento |
| PRE-UX-01 | P1 | Recorridos de teclado, móvil, diálogos y exportación | navegador y viewport anotados |

### Después de publicar

| ID | Prioridad | Control | Evidencia mínima |
| --- | --- | --- | --- |
| POST-LIVE-01 | P0 | Dominio real, TLS y versión prevista | URL pública, fecha, respuesta y SHA/version |
| POST-LEGAL-01 | P0 | Rutas legales | comprobación remota 200, URL, fecha y contenido esperado; si falta aprobación debe ser BLOCKED, no PASS |
| POST-SEC-01 | P0 | Altas/pagos y rutas privadas siguen cerrados | HTTP y recorrido negativo reales |
| POST-SEO-01 | P1 | canonical, robots y sitemap | URLs y cabeceras reales |
| POST-UX-01 | P1 | 320/390/768/1440, teclado, zoom y lector | entorno/navegador y resultado por recorrido |
| POST-PERF-01 | P1 | LCP, INP y CLS | medición con fecha, dispositivo y URL |
| POST-OPS-01 | P1 | Contacto y correo | prueba de envío/recepción sin datos sensibles |

## Regla de evidencia legal y fiscal

Una prueba local, una simulación o una pantalla no vuelven una afirmación legal ni fiscal en `PASS`. Las normas, vigencia, obligaciones, sanciones, efectos para un cliente y rutas legales públicas necesitan la evidencia remota o la revisión humana indicada por el control. Si no está disponible, el estado es `BLOCKED` o `NOT-ASSESSED`.

## Uso

`node scripts/auditar_release.mjs evidencia.json` valida una evidencia en modo solo lectura y genera un informe Markdown en la salida estándar. El comando no despliega, no cambia DNS, no accede a cuentas ni modifica el repositorio.

La estructura se verifica en `tests/auditor_preflight_contract.mjs`. La fuente de evidencia debe conservarse fuera del repositorio cuando contenga contactos, secretos, capturas con datos personales o información de proveedores.
