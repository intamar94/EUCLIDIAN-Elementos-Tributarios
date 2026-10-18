# EUCLIDIAN — Una publicación agrupada al día
**Política de publicación, 18 de octubre de 2026 · Dominio: https://euclidianet.com**

## Decisión de dirección
Continuamos creando funcionalidades y correcciones en ramas, con revisiones por PR y pruebas automáticas. **No desplegar por cada cambio pequeño.** La publicación de producción puede ocurrir **una vez como máximo en cada día natural de Europa/Berlín**, y solo si hay cambios útiles, comprobados y seguros. Si no hay cambios, si el CI falla o si existe un bloqueo legal o de seguridad, **no publicar**. Nunca generar un despliegue solo para cumplir la frecuencia.

La prioridad es **calidad, continuidad, coste y evitar el límite de despliegues de Vercel Hobby**.

## Cambio técnico
- `vercel.json` usa `git.deploymentEnabled: false`: desactiva los despliegues automáticos de **todas las ramas**, incluidas PR y `main`. Fuente: [Vercel Git Configuration](https://vercel.com/docs/project-configuration/git-configuration).
- **No utilizar** la opción "Ignored Build Step" para ahorrar cantidad de despliegues: Vercel contabiliza los builds cancelados por ese paso en las cuotas; ver [documentación oficial](https://vercel.com/docs/project-configuration/project-settings).
- Se mantiene conexión GitHub ↔ Vercel, mismo proyecto y dominio. El último despliegue listo continúa sirviendo la web hasta que se cree el próximo.
- El fichero de configuración puede necesitar un despliegue inicial para que Vercel incorpore la nueva regla. Tras fusionar, comprobar en `list_deployments` que no se inicien compilaciones por nuevos commits. **No declarar aplicado el bloqueo hasta verificarlo.**
- La publicación siguiente se realiza manualmente por la API de Vercel `create_deployment` con `gitSource` de GitHub (`type:'github', org:'intamar94', repo:'EUCLIDIAN-Elementos-Tributarios', ref:'main', sha:<SHA validado>`) y `target:'production'`. No forzar `forceNew`, no usar un SHA distinto al verificado y no emplear la opción de redeploy del mismo commit si ya está READY.
- NO son necesarios nuevos secretos en GitHub para este proceso cuando se usa el conector autorizado de Vercel. Si la API está inaccesible o falla, dejar el despliegue pendiente y notificar; **nunca restaurar automáticamente los pushes a Vercel**.

## Revisión diaria automatizable
Aproximadamente a las **15:00 hora alemana** (horario de verano incluido, `Europe/Berlin`) una tarea de ChatGPT debe:
1. Reunir los PRs/commits fusionados en `main` desde el último despliegue READY. No fusionar automáticamente cambios de seguridad, legales, facturación ni SQL de producción sin autorización y revisión correspondiente.
2. Revisar el tablero maestro #93, Corrector General #77, QA GitHub de **exactamente el SHA de `main`**, proyecto Vercel, legal LEGAL.ia y estado de seguridad. No confiar solo en CI de otra rama.
3. Consultar los últimos despliegues Vercel de `target=production` **incluidos fallidos, cancelados y en construcción**. Si se creó cualquiera **durante ese día calendario de Alemania**, no iniciar otro.
4. Si ya está READY la misma revisión que `main`, no desplegar.
5. Verificar que el CI `Control de calidad` del SHA de `main` haya completado con éxito, y que no haya fallos de accesos, RLS, privacidad, API o rutas legales. Cualquier revisión manual pendiente bloquea los cambios afectados.
6. Ejecutar o reproducir `node scripts/verificar_despliegue_diario.mjs evidencia.json` con evidencia real actualizada (SHA, fecha epoch milisegundos, deploys y runs CI, banderas de revisión). El helper no conecta ni altera sistemas y **no sustituye la revisión de los cambios**.
7. Si todo está listo y hay cambios, iniciar **un único** despliegue Vercel del SHA exacto, con `target:production`. Confirmar estado READY y dominio, conservar el enlace y el commit desplegado. Si entra en ERROR, no reintentar automáticamente ese día.
8. Resumir: avances publicados, pendientes que esperan el próximo lote y necesidad de intervención manual. Si no hay publicación, informar la razón en lenguaje no técnico.

**Límite:** una solicitud de despliegue a producción al día, no "un reintento por fallo". Cualquier excepción de emergencia requiere consentimiento explícito de dirección y una estrategia de reversión segura.

## Roles de coordinación
- **Corrector General (#77):** verifica seguridad, funciones, regresiones, SEO y enlaces; no cambia el dominio ni abre Auth a espaldas del bloqueo legal.
- **Desarrollador EUCLIDIAN (#93):** sigue con features en PRs, pruebas, documentación y correcciones sin publicación instantánea. Puede fusionar incrementos pequeños bien probados durante el día; Git despliegue automático queda apagado.
- **MIKAI (#112):** evalúa mejoras de búsqueda en laboratorio sin modelos nuevos en producción ni medidas de precisión inventadas.
- **LEGAL.ia (#67/#95):** única autorización de los textos legales, Gewerbe, datos personales, registros, pagos y tratamiento de expedientes; no se deshabilitan compuertas por motivos de CI.
- **Publicación diaria:** agrupa solo funciones listas y mantiene la versión anterior si existe bloqueo.

## Prueba y recuperación
- `tests/despliegue_diario_contract.mjs`: comprueba el bloqueo de Vercel Git, el día de `Europe/Berlin`, la existencia de CI verde para el SHA exacto, cambios pendientes, y que no haya segundo intento tras un despliegue fallido.
- `scripts/verificar_despliegue_diario.mjs` es un validador local, no un sistema que inicie despliegues sin autorización.
- Para revertir **la regla** en caso de error de integración: revisión/PR que cambie `git.deploymentEnabled` a `true`, más autorización de la dirección; ello restituye publicaciones instantáneas, con riesgo de cuota. Preferible corregir manual deployment sin revertir la regla.
- Para revertir **una publicación defectuosa**, evaluar Vercel rollback o promover último despliegue READY con visto bueno de dirección, aun si hay emergencia; jamás modificar pagos/seguridad como atajo.
- Los tests en Chromium y las rutas Supabase de la CI son un filtro, pero **no reemplazan una comprobación pública externa real**.

## Estado inicial de seguridad preservado
Dominio exacto **euclidianet.com** (.com). Auth de cliente, signup, pagos, SIGNA y expedientes persistentes continúan tras compuertas legales. Impressum/Privacidad se validarán cuando LEGAL.ia apruebe los datos completos; no implicar que producción está autorizada comercialmente porque Vercel indique READY.

**Seguimiento:** [#93 Ruta Maestra](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/93), [#77 Corrector General](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/issues/77).
