# LEGAL.ia · Faro de Intamar — cadena legal y técnica

**Estado: BORRADOR / REVIEW.** Arquitectura recuperada de LEGAL.ia → APPROVED / REVIEW / REJECTED; MIKAI orquesta, LEGAL.ia verifica y un humano autorizado aprueba. Primer módulo instalado en una **rama aislada de Euclidian** para evitar cambios en producción; será trasladable a los demás proyectos.

## Cadena por proyecto

1. **Empresa:** validar Gewerbeanmeldung (planeada para el 19/10/2026, aún PENDING), forma jurídica, titular, nombre comercial, actividades y fiscalidad. No asumir registro.
2. **Inventario:** detectar GitHub, Vercel, Supabase, servicios, cookies, pagos, IA, fotos, DNS, países destinatarios y usuarios.
3. **Clasificación:** landing, SaaS, suscripción B2C, marketplace, ecommerce, contenidos, servicios regulados.
4. **LEGAL.ia:** generar expediente con obligaciones, fuentes primarias, pruebas, fechas, responsable y estado REVIEW.
5. **Textos:** borrador de Impressum/DDG, Datenschutz/DSGVO, contacto, consentimiento/cookies TDDDG; aprobación humana antes de usar.
6. **Proveedores:** comprobar contrato de encargo (DPA), región, transferencias, backup, fuentes externas, analytics, retención, derechos y seguridad.
7. **Venta:** comprobar jurisdicción/IVA, AGB, checkout (§312j BGB), Kündigungsbutton (§312k BGB) y Widerrufsbutton (§356a BGB), cuando proceda.
8. **Marca/dominio:** investigar marca y dominio, comparar oferta y titular registral; **nunca comprar sin presupuesto y autorización**.
9. **Web:** asignar dominio a Vercel, DNS, TLS, canonical, redirecciones, SEO, acceso público sin abrir administración.
10. **Email:** buzón corporativo, SPF, DKIM, DMARC, seguridad y prueba de correo de soporte/privacidad.
11. **Gate:** ejecutar script y pruebas de navegación, accesibilidad, link legal, cookies, suscripción y seguridad. **No publicar pagos hasta APPROVED humano.**
12. **Vigilancia:** revisar semanalmente enlaces legales, HTTPS, dominio, disponibilidad, avisos normativos, contratos de proveedor y cambios del sitio. Si cambia el modelo, volver a REVIEW.

## Política de privacidad operativa
El repositorio Euclidian es público: **nunca subir dirección doméstica, nombres completos no autorizados, identificaciones, recibos del Gewerbe, números fiscales ni secretos**. La titular debe aceptar conscientemente qué dirección física notificable y nombre legal aparecerán en el **Impressum público**. Guardar expedientes sensibles en almacenamiento privado con permisos mínimos.

## Reglas por producto
- **Euclidian:** plataforma de información DIAN desde Alemania hacia Colombia. Revisar servicio fiscal, términos y transferencia internacional, atribución de fuentes y responsabilidad. Actualmente la portada no enlaza Impressum ni Datenschutzerklärung, hay fuentes web externas y SSO de Vercel en despliegues. Esos riesgos quedan en REVIEW.
- **FARO-01:** si se retiene/recarga saldo de clientes, requiere evaluación legal de **BaFin/ZAG** y diseño con PSP adecuado antes de activar. Revisar contratación, estatus legal y seguros de Helfer, protección de mayores, privacidad y cancelaciones.
- **Web comercial:** DDG, DSGVO y TDDDG; requisitos de comercio electrónico según actividad. Revisar BFSG/accesibilidad y excepciones aplicables.
- **IA/fotos:** titularidad/licencias y datos de personas, consentimiento, menores y envío a proveedores.

## Ejecución
`node scripts/legal-ia-gate.mjs --mode audit` — diagnóstico sin bloquear.
`node scripts/legal-ia-gate.mjs --mode release` — salida 1 si hay revisiones pendientes.
`node scripts/legal-ia-gate.mjs --mode release --json` — informe automatizable.

El workflow GitHub Actions realiza el gate en PR y semanalmente al estar en rama principal. **Hacer obligatorio el estado de GitHub Actions en las reglas de la rama principal** para que bloquee merges. Un resultado aprobado significa únicamente que las evidencias definidas están marcadas y que hay enlaces locales; no garantiza validez jurídica. Esta rama por sí sola NO cambia producción, compra dominio ni concede aprobaciones.

## Referencias
- [GewO §14](https://www.gesetze-im-internet.de/gewo/__14.html)
- [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html)
- [TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [RGPD arts. 13, 28, 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [BGB §312j](https://www.gesetze-im-internet.de/bgb/__312j.html), [§312k](https://www.gesetze-im-internet.de/bgb/__312k.html), [§356a](https://www.gesetze-im-internet.de/bgb/__356a.html)
- [BaFin](https://www.bafin.de/ref/19629832), [BFSG](https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/barrierefreiheitsstaerkungsgesetz)
