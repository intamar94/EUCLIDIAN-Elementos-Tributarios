# LEGAL.ia → MIKAI → Configurador web
## Objetivo
Una **única empresa operadora FARO de Intamar** con identidad/comprobantes empresariales en almacenamiento privado, y un **expediente de cumplimiento por cada producto, dominio y país**. Sistema reutilizable para proyectos existentes y futuros.

## Roles
- **MIKAI (orquestación):** añade proyecto, distribuye inventario y recopila reportes. No convierte automáticamente REVIEW en APPROVED.
- **LEGAL.ia (validación):** detecta obligaciones, prepara borradores, controla evidencias y bloqueos. No afirma haber realizado una revisión jurídica profesional si no existe.
- **Configurador web (infraestructura):** dominio, DNS, hosting, correo, HTTPS, redirect, SEO, seguridad, entorno de pruebas y vuelta atrás. La compra requiere autorización expresa.
- **Titular y profesionales:** confirmar negocio, comprobantes, firma/publicación de datos propios, contratos, actividad regulada, impuestos y decisiones de pago.

## Procedimiento de incorporación de proyecto (10 minutos + revisión)
1. Crear el expediente usando `node scripts/legal-ia-new-project.mjs`; crear **un expediente por producto, no por URL** si varias páginas forman el mismo servicio. Diferenciar subproductos que vendan/recaben datos de forma distinta.
2. Listar tipo de producto, países, idiomas, público, proveedores, cookies, pagos, menores, datos personales, IA, productos físicos, almacenamiento de fondos, colaboradores. **Confirmar que están completos**.
3. Registrar el `web_root` y dominio de prueba; no adjudicar estado definitivo al solo tener una página que responde.
4. Generar borrador Impressum, Datenschutzerklärung, AGB/contrato, Widerruf/Kündigung, Consent y avisos de IA/marketplace según las funciones reales. Revisión profesional según riesgo.
5. Acreditar revisión legal de la actividad (incluida la necesidad de modificar la Gewerbeanmeldung por ampliación) y fiscalidad territorial.
6. Contratos proveedores: procesadores, transferencias, medidas, retención, recuperación, backup.
7. Revisar la accesibilidad/BFSG y excepciones legalmente sustentadas, no aplicar exención por suposición.
8. Pruebas técnicas externas de navegación, idioma, DNS/TLS, política de cookies y derechos del consumidor; links legales disponibles en cada página.
9. Obtener confirmación expresa del contenido público del Impressum (incluido domicilio de la titular) **por canal privado**; no guardar esa dirección en GitHub hasta decidir deliberadamente su publicación.
10. Auditoría: `node scripts/legal-ia-gate.mjs --mode audit --project slug --json`; si faltan controles, sigue REVIEW. La salida comercial requiere evidencia humana.
11. Para CI estricto: `node scripts/legal-ia-gate.mjs --mode release --project slug` (exit 1 si REVIEW/REJECTED). La conexión efectiva al hosting/restricciones de ramas **debe hacerse por cada repositorio**, no basta tener este archivo en EUCLIDIAN.
12. Cada cambio de modelo, proveedor, país, dominio, IA, cookies, cobro o datos procesados devuelve el expediente a revisión. Revisión periódica recomendada de seguridad y ley; disparar por cambios, no inferir cumplimiento solo por calendario.

## Estados
- `REVIEW`: información, verificación o revisión humana pendiente.
- `REJECTED`: requisito revisado y marcado como rechazado; no liberar.
- `APPROVED`: **afirmación documentada de un control específico**, con referencia no sensible a una evidencia en almacenamiento privado.
- `NOT_APPLICABLE`: solo válido con motivo, revisor y referencia a prueba en `exceptions[control]`.
- `READY_FOR_HUMAN_RELEASE_DECISION`: expediente pasa comprobaciones declaradas; **no es certificación legal**, ni activa compras/despliegues sin decisión humana.

## Evidencias y privacidad
Ejemplo de prueba referenciada, sin información sensible en GitHub:
`"controls":{"privacy_mapping":"APPROVED"},"evidence":{"privacy_mapping":"FARO-PRIV-2026-001"}`.
El documento real queda en Drive privado/almacén seguro con acceso restringido; auditoría usa la referencia, no lo lee.
Cualquier modificación de `controls` a APPROVED necesita revisión del responsable y archivo auditable. **No afirmar auditoría profesional externa inexistente.**

## No reutilizar sin adaptación
- EUCLIDIAN: servicio SaaS con fuentes DIAN, público Colombia, tratamiento en proveedores internacionales.
- FARO-01: plataforma de ayudantes y riesgo regulatorio financiero/laboral.
- ZweiTierras: actividad de alimentos, etiquetado, alérgenos, requisitos de cocina/producción, ventas por país.
- Tiendas/marketplaces: garantías, cambios, devoluciones, derecho de desistimiento, productos/usuarios, contratos.
- Contenido infantil/IA: privacidad de menores, licencias, transparencia y riesgos específicos.

## Aprobaciones y compras
- No comprar dominio, servicios, licencias, cuentas de pago o publicidad sin autorización concreta.
- No habilitar pagos ni mover a producción hasta revisión de responsable empresarial, derecho comercial y cumplimiento.
- LEGAL.ia, MIKAI y Configurador web tienen tareas separadas; un informe compartido no es prueba de que agentes hayan interactuado entre sí.

## Calendario de vida
- **Antes del Gewerbe (previsto 19-10-2026):** crear expedientes, borradores y controles; no afirmar inscripción.
- **Tras comprobar Gewerbe:** confirmar titular/alcance, documentos privados, fiscalidad y publicación consciente de Impressum.
- **Cuando el sitio esté listo:** evidencia de DNS/HTTPS, seguridad, páginas legales y derechos consumidor; autorización humana.
- **Tras lanzamiento:** alertas por expiración dominio, cambios legales relevantes y control de nuevos proveedores/productos.
