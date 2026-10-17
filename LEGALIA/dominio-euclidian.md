# Decisión de dominio EUCLIDIAN — colaboración Configurador web × LEGAL.ia
**Fecha de consulta:** 17 octubre 2026. **Estado:** REVIEW, sin compra/registro/cambio DNS.

## Requisito del titular
**PRIORIDAD: dominio independiente de EUCLIDIAN, NO el dominio Faro de Intamar.**
Faro de Intamar será el titular empresarial de la plataforma bajo la identificación legal que proceda. Gewerbeanmeldung prevista para el lunes 19-10-2026, todavía pendiente. Usuario prioriza mínimo gasto, evitar duplicar servicios, dirección comercial propia y mantener producción estable.

## Opciones de dominio (consulta registrar Vercel, USD; disponibilidad y precios variables)
| Nombre | ¿Disponible al consultar? | Alta | Renovación |
| --- | --- | --- | --- |
| euclidian.app | sí | 14.99/año | 15/año |
| euclidiantributario.com | sí | 11.25/año | 11.25/año |
| euclidian-tributario.com | sí | 11.25/año | 11.25/año |
| euclidian.net | sí | 13.50/año | 13.50/año |
| euclidian.com | no | — | — |
| euclidian.de | no | — | — |
| euclidian.eu | no | — | — |
| euclidian.ai | no | — | — |

**Candidato visual/branding:** euclidian.app, sujeto a preferencia explícita del titular y evaluación previa de conflicto marcario (DPMA/EUIPO). **No comprar ni reservar aún.**

## Arquitectura heredada del agente Configurador web
- GitHub: `intamar94/EUCLIDIAN-Elementos-Tributarios`; despliegue existente Vercel, último READY en producción.
- Supabase: `EUCLIDIAN — Elementos Tributarios` en región `sa-east-1`; consulta SQL read-only muestra 861 MB de `pg_database_size` (17-10-2026), superior al máximo de base de datos del plan Free (500 MB), y el agente identificó un histórico de inspección de unos 406 MB. **No borrar/archivar tablas sin copia verificada y prueba de restauración.** Ver https://supabase.com/docs/guides/platform/database-size
- Restricción Vercel Hobby: únicamente uso personal no comercial, ver https://vercel.com/legal/terms y https://vercel.com/pricing ; Pro anunciado $20 USD/mes antes de impuestos.
- Alternativa a validar: Netlify Free permite sitios comerciales dentro de límite mensual de 300 créditos; puede pausar al exceder. Ver https://www.netlify.com/pricing/ y https://www.netlify.com/blog/introducing-netlify-free-plan/
- **Migración no automática:** las funciones Vercel `/api` requieren conversión/rewrites para Netlify, pruebas de Auth/entitlement, consultas, acceso interno, sesiones, billing stub, URLs y variables seguras. Referencia https://docs.netlify.com/migrations/vercel-ai-agent-migration/
- Suprimir solicitudes externas Google Fonts, completar Datenschutzerklärung e Impressum, verificar protección de panel interno. Consultar PR LEGAL.ia #67: https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/pull/67.

## Hoja de decisión conjunta
1. **Configurador web:** elaborar matriz Vercel Pro (sin migración) vs Netlify Free (adaptación requerida), costes anuales reales, límites, riesgos de funcionalidad/seguridad, cómo revertir a Vercel sin afectar usuarios. No abrir comercialmente plan Hobby.
2. **Configurador web:** hacer despliegue Netlify *de prueba* en entorno separado sin claves sensibles públicas ni cambiar la producción; probar rutas API/auth/session/documentos, redirecciones, SEO, cookies, seguridad, TLS.
3. **LEGAl.ia:** revisión de marca EUCLIDIAN, dominio elegido, legal de Impressum (operador Faro de Intamar), RGPD para Vercel/Netlify/Supabase, Alemania→Colombia y tipología de venta.
4. **Base datos:** medir tablas grandes y respaldar/restaurar antes de limpieza; decidir si cabe Supabase Free o se requiere plan pago. **Ninguna limpieza de datos sin autorización.**
5. **Titular:** elegir nombre exacto y autorizar coste inicial y renovación. Registrar solo después.
6. **DNS:** tras registro, conectar al hosting elegido, usar registros reales del proveedor, confirmar HTTPS/canonical/www, correo sin plan pago inicial si no hace falta.
7. **Fin de obra:** verificación automatizada legal y técnica, pruebas desde fuera, dominio/renovación monitorizados y aprobación humana documentada.

**No tocar todavía** dominio `farodeintamar.com`, cobros Stripe, cuentas bancarias ni la producción actual de Euclidian para esta decisión.
