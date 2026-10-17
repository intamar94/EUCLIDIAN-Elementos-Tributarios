# EUCLIDIAN ET · implementación legal en euclidianet.com
**17 octubre 2026 — BORRADOR. No publicar ni fusionar sin la lista de aprobación.**

## Estado comprobado de infraestructura
- Dominio real **euclidianet.com**, comprado y verificado con Vercel; configurado para el proyecto euclidian-elementos-tributarios.
- **www.euclidianet.com** redirige al principal con HTTP 308, ambos asignados y verificados.
- Nameservers **ns1.vercel-dns.com** y **ns2.vercel-dns.com**, configuración A válida.
- Al momento de la consulta, la zona tenía ALIAS y CAA, **sin MX/SPF/DKIM/DMARC**; no hay correo @euclidianet.com acreditado.
- Último despliegue de producción READY; ajustes de protección Vercel SSO requieren verificación independiente antes de afirmar disponibilidad pública.
- La página de inicio enlazaba canonical a un subdominio Vercel antiguo; este PR cambia canonical, OG, robots y sitemap al dominio comprado.

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
| EUCLIDIAN_LEGAL_EMAIL | SÍ | Correo **que realmente recibe mensajes**, idealmente @euclidianet.com tras crear MX y buzón |
| EUCLIDIAN_LEGAL_APPROVED | SÍ, igual a 1 solo tras revisión | Bandera de autorización de contenido legal conforme a hechos, datos, privacidad y regulación |
| EUCLIDIAN_LEGAL_PHONE | Condicional | Teléfono o medio de comunicación directo si corresponde y se autoriza |
| EUCLIDIAN_LEGAL_VAT_ID | Condicional | SOLO si se dispone de USt-IdNr/W-IdNr oficial; **nunca Steuernummer personal** |

**Precaución:** estas variables pueden ocultarse del código pero se harán públicas en el HTML del Impressum al aprobar. Solicitar el consentimiento expreso de la titular para el nombre y domicilio exactos en la web. No confundir Gmail personal y correo propio del dominio.

## Revisión legal requerida (antes de EUCLIDIAN_LEGAL_APPROVED=1)
1. Gewerbeanmeldung prevista 19/10: verificar efectivamente envío/recepción y alcance comercial. Validar condición de empresa individual.
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
