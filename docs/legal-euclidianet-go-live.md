# EUCLIDIAN ET · implementación legal en euclidianet.com
**17 octubre 2026 — BORRADOR. No publicar ni fusionar sin la lista de aprobación.**

## Estado comprobado de infraestructura
- Dominio real **euclidianet.com**, comprado y verificado con Vercel; configurado para el proyecto euclidian-elementos-tributarios.
- **www.euclidianet.com** redirige al principal con HTTP 308, ambos asignados y verificados.
- **DNS autoritativo ahora en Cloudflare**, zona `euclidianet.com` **active** (17/10/2026); nameservers `meg.ns.cloudflare.com` y `wilson.ns.cloudflare.com`. La configuración de Vercel ha sido comprobada sin conflictos.
- **Correo configurado por Configurador web en Cloudflare Email Routing**: estado `ready`, reglas activas `contacto@euclidianet.com`, `sugerencias@euclidianet.com`, `errores@euclidianet.com` con destino Gmail verificado; MX, SPF y DKIM publicados. **No se encontró DMARC** en la zona consultada y **aún no se ha probado recepción con correo entrante real**. Cloudflare ofrece reenvío de recepción; no presupone capacidad de enviar como `@euclidianet.com`.
- Último despliegue de producción READY; ajustes de protección Vercel SSO requieren verificación independiente antes de afirmar disponibilidad pública.
- La rama principal vigente ya actualizó canonical, OG, robots y sitemap al dominio `euclidianet.com`. Este PR conserva esos cambios del corrector, modifica solamente las páginas legales y sus enlaces.

## Implementación por código (este PR)
- Cabecera y pie consistentes con EUCLIDIAN, con enlaces a Impressum y privacidad en portada y área de aplicación.
- Rutas limpias **/impressum** y **/datenschutz**, alias **/privacidad**, más versiones .html. Se entregan desde Node en Vercel: código en api/{impressum,datenschutz}.js y lib/legal-public.js con redirects/rewrite en vercel.json.
- Renderizado **en servidor**: nombre legal y domicilio se obtienen de variables de entorno *en Vercel*, no se almacenan en GitHub.
- HTML escapado y headers sin caché, CSP restrictiva; si faltan datos o aprobación responde **HTTP 503 y noindex**, NO publica un Impressum ficticio.
- Tests cierran por defecto, solo habilitan renderización con datos sintéticos, verifican enlaces, SEO, método GET/HEAD y sanitización.
- **No activar ni publicar** las páginas a producción mientras falten datos obligatorios y revisión factual/jurídica.

## Variables (Vercel project settings, target Production y si procede Preview)
| Variable | Obligatoria | Finalidad |
| --- | --- | --- |
| EUCLIDIAN_LEGAL_NAME | SÍ | Nombre real completo de la persona física titular del Gewerbe |
| EUCLIDIAN_LEGAL_ADDRESS | SÍ | Dirección notificable completa, con código postal, ciudad y país (Deutschland); usuario prefiere usar su domicilio |
| EUCLIDIAN_LEGAL_EMAIL | **CONFIGURADO** | `contacto@euclidianet.com`, Vercel `production`/`preview`, Cloudflare Email Routing activo; falta correo de prueba |
| EUCLIDIAN_LEGAL_APPROVED | **CONFIGURADO EN 0** | El servicio permanece bloqueado hasta Gewerbe, nombre/domicilio comprobados y revisión jurídica de privacidad; elevar a 1 solo tras validación |
| EUCLIDIAN_LEGAL_PHONE | Condicional | Teléfono o medio de comunicación directo si corresponde y se autoriza |
| EUCLIDIAN_LEGAL_VAT_ID | Condicional | SOLO si se dispone de USt-IdNr/W-IdNr oficial; **nunca Steuernummer personal** |

**Precaución:** estas variables pueden ocultarse del código pero se harán públicas en el HTML del Impressum al aprobar. Solicitar el consentimiento expreso de la titular para el nombre y domicilio exactos en la web. Cloudflare reenvía correo del dominio a Gmail, no crea por sí solo una bandeja de salida con ese remitente.

## Revisión legal requerida (antes de EUCLIDIAN_LEGAL_APPROVED=1)
1. Gewerbeanmeldung: la titular prevé validez desde el **lunes 19/10/2026**. Se deja preparado el campo `expected_effective_date=2026-10-19`, **sin declararlo confirmado antes de verificar justificante, titular, fecha efectiva y alcance**.
2. Verificar identificación del prestador conforme § 5 DDG; nombre legal, domicilio, correo operativos; revisar si faltan datos de registro/autoridad/ID fiscal cuando correspondan.
3. Revisar tratamiento y flujo de datos del sitio reales, incluidos Vercel, Supabase en **Brasil (sa-east-1)**, Auth, logs, tokens localStorage, fuentes Google y métodos de soporte.
4. Obtener/verificar DPA/AVV, transferencias internacionales, retención de datos por categorías y autoridad de control. La privacidad está **borrador factual** y no se puede presentar aún como evaluación final de cumplimiento.
5. Evaluar TDDDG §25: medidas de cookie/storage y funciones opcionales; no insertar banner sin inventario.
6. Mantener cobros desactivados hasta revisar condiciones de venta, impuestos Alemania/Colombia, derecho del consumidor, cancelación y derecho de desistimiento aplicables.
7. Confirmar que las páginas se muestran por HTTP 200 y enlazan desde todas las vistas, incluidas móvil, tablet y escritorio, y que los formularios de email funcionan.
8. Verificar Seguridad: hostname final, /api y login no exponen secretos; revisar Vercel Deployment Protection sin abrir administración.
9. Ejecutar en GitHub CI, aprobación humana del PR y despliegue controlado; tests externos post-release y reversión disponible.
10. Tras publicar, mantener un historial de cambios y revisión ante nuevos proveedores, legislación o funciones.

**NOTA:** Si se deja configurada la bandera de aprobación en Vercel antes del estudio jurídico y del Gewerbe, el software puede mostrar textos aún no verificados. El gate técnico es una salvaguarda, no una certificación legal automática.

## Referencias
- DDG §5: https://www.gesetze-im-internet.de/ddg/__5.html
- TDDDG §25: https://www.gesetze-im-internet.de/ttdsg/__25.html
- RGPD: https://eur-lex.europa.eu/eli/reg/2016/679/oj

## Núcleo LEGAL.ia: sincronización y dependencia
- **Fuente maestra de cumplimiento**: [expediente de EUCLIDIAN](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/blob/ops/legalia-faro-v1/LEGALIA/proyectos/euclidian.json) y [registro de la empresa](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/blob/ops/legalia-faro-v1/LEGALIA/empresa.template.json), todavía en PR #67.
- **Este proyecto**: [PR #82](https://github.com/intamar94/EUCLIDIAN-Elementos-Tributarios/pull/82). Todo cambio sobre identidad, cookies, autenticación, correo, hosting, proveedores, pagos, nombre, dominio, país o actividad debe anotarse y reevaluarse en LEGAL.ia.
- **Responsables**: Configurador web mantiene infraestructura; LEGAL.ia mantiene expediente y riesgos; titular valida datos publicables; MIKAI coordina. Un cambio de código no implica aprobación jurídica.

## Revisión de preparación del 19 de octubre de 2026

La titular pidió configurar textos claros manteniendo el acceso público bloqueado.
La solicitud firmada de Gewerbeanmeldung fue enviada al Gewerbeamt; esto acredita
el envío, no una resolución de alta recibida. No guardar el formulario, identificación,
domicilio ni otros datos personales en este repositorio.

Comprobaciones de esta revisión:
- Nombre y dirección legal configurados como variables cifradas solo en Production.
- El correo de contacto ya está configurado; recepción real todavía pendiente de prueba.
- `EUCLIDIAN_LEGAL_APPROVED=0`, `EUCLIDIAN_PUBLIC_ACCESS_ENABLED=0`,
  `EUCLIDIAN_SIGNUP_ENABLED=false` y `EUCLIDIAN_APORTES_ENABLED=0`.
- Vercel mantiene protección SSO. La visita anónima condujo al login de Vercel.
- La lectura autenticada devolvió 503 en `/impressum` y `/datenschutz`.

El cambio aclara la privacidad de la fase de preparación, servicios de correo,
bases jurídicas por finalidad, criterios de conservación sin prometer borrados
automáticos, derechos y autoridad de Hessen. Retira Google Fonts de portada,
aplicación y página de baja, usando las alternativas ya definidas en CSS.
No modifica Auth, pagos, SSO ni la compuerta de aprobación legal.

Antes de levantar esa compuerta:
1. Confirmar alcance contractual de DPA/AVV y transferencias de Vercel,
   Cloudflare, Google (incluida la modalidad de cuenta Gmail) y Supabase.
2. Verificar categorías y conservación efectivas de logs, correo y cuentas internas.
3. Probar recepción del contacto con autorización para ese envío.
4. Revisar el aviso frente al flujo real y registrar aprobación humana.
5. Obtener CI del SHA final y publicar en el lote autorizado manteniendo el cierre.

Las modificaciones de esta rama todavía deben desplegarse para estar en la web.
La configuración y las pruebas no constituyen certificación jurídica de cumplimiento.
