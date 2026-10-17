# LEGAL.ia · FARO de Intamar — paquete compartido para todas las webs y aplicaciones

**Kit reutilizable preparado en rama de revisión. No es una certificación jurídica ni una autorización de publicación comercial.**

## Registro único que se actualiza con cada cambio

**[REGISTRO-MAESTRO.json](REGISTRO-MAESTRO.json)** reúne dominio, correo, Gewerbe previsto, hitos, PRs y política de sincronización entre Configurador web, LEGAL.ia y los proyectos. Es el núcleo operativo; las evidencias personales permanecen en Drive privado. **El registro previsto para el lunes no es un registro confirmado.**

## Empezar aquí

1. [Cartera de proyectos](PORTAFOLIO.md): expedientes iniciales EUCLIDIAN, FARO-01, FABRICABLE, ZweiTierras, Mundo de Papel, BienvenidoQR, MercadoQR y PflegeDeutsch Pocket.
2. [Manual para agentes y responsable](OPERACION.md): qué hace MIKAI, LEGAL.ia, Configurador web y qué decisiones se reservan a la titular.
3. [Reglas condicionales](catalogo-riesgos.json): SaaS, tiendas, mercados, servicios, IA, menores, datos sensibles, pagos y fondos ajenos.
4. [Plantillas editables](plantillas/): Impressum, Datenschutzerklärung genérica/específica, SaaS, tienda, desistimiento, cancelación, almacenamiento/cookies, pie de página.
5. [Protección de datos privados](PRIVACIDAD-Y-EVIDENCIAS.md), [proveedores](MATRIZ-PROVEEDORES.md) y [fuentes oficiales](FUENTES-Y-CAMBIOS.md).
6. [Procedimiento técnico para dominios](dominio-y-correo.md) y [coordinación dominio EUCLIDIAN](dominio-euclidian.md).

### Un proyecto nuevo

```bash
node scripts/legal-ia-new-project.mjs nombre-corto "Nombre comercial" --type digital_product --markets DE,CO --risks user_accounts
node scripts/legal-ia-gate.mjs --mode audit --project nombre-corto --json
node scripts/legal-ia-gate.mjs --mode audit --all --json
```

No requiere instalar servicios adicionales ni pagar una suscripción. Para integrar el bloqueo comercial en **otro repositorio**, copiar/adaptar el job legal y el árbol LEGALIA; esta rama de EUCLIDIAN no gobierna automáticamente los despliegues de otras plataformas.

El motor es **fail-closed** y requiere evidencia; los documentos jurídicos siguen siendo borradores hasta completar empresa, actividad, contenido, base jurídica, terceros, permisos, consentimiento y aprobaciones. El Gewerbe sigue pendiente para el 19/10/2026. No registrar datos personales en el GitHub público.

---

## Arquitectura y procedimiento detallado

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

Se integra una auditoría de LEGAL.ia dentro del workflow existente `control_calidad.yml`; una comprobación de salida estricta para PR bloquea hasta aprobar. La plantilla `LEGALIA/plantillas/legalia-compliance.yml` queda **inactiva** para respetar el contrato de cuatro workflows de EUCLIDIAN. **Hacer obligatorio el estado de GitHub Actions en las reglas de la rama principal** para que bloquee merges. Un resultado aprobado significa únicamente que las evidencias definidas están marcadas y que hay enlaces locales; no garantiza validez jurídica. Esta rama por sí sola NO cambia producción, compra dominio ni concede aprobaciones.

## Referencias
- [GewO §14](https://www.gesetze-im-internet.de/gewo/__14.html)
- [DDG §5](https://www.gesetze-im-internet.de/ddg/__5.html)
- [TDDDG §25](https://www.gesetze-im-internet.de/ttdsg/__25.html)
- [RGPD arts. 13, 28, 32](https://eur-lex.europa.eu/eli/reg/2016/679/oj)
- [BGB §312j](https://www.gesetze-im-internet.de/bgb/__312j.html), [§312k](https://www.gesetze-im-internet.de/bgb/__312k.html), [§356a](https://www.gesetze-im-internet.de/bgb/__356a.html)
- [BaFin](https://www.bafin.de/ref/19629832), [BFSG](https://www.bundesfachstelle-barrierefreiheit.de/DE/Barrierefreiheitsstaerkungsgesetz/barrierefreiheitsstaerkungsgesetz)

## Expedientes reutilizables
- Cada nuevo proyecto: `node scripts/legal-ia-new-project.mjs mi-proyecto "Mi proyecto"`. Genera **solamente** un archivo JSON con estados REVIEW y datos no sensibles.
- Completar país de actividad, proveedores y funcionalidad real; revisar `LEGALIA/dominio-y-correo.md`, `LEGALIA/ventas-y-suscripciones.md` y `LEGALIA/inventario-tecnico-euclidian.md` como ejemplos.
- La evaluación técnica específica de EUCLIDIAN se realiza con `node scripts/legal-ia-static-audit.mjs --json`; su código no debe copiarse ciegamente a una tienda o marketplace.
- Plantillas jurídicas de trabajo: `LEGALIA/plantillas/IMPRESSUM.de.muster.md` y `LEGALIA/plantillas/DATENSCHUTZ.de.muster.md`. No son documentos legales aprobados y **no aparecen aún en la web**.
- El workflow existente `control_calidad.yml` ejecuta el inventario y test de regresión. El control estricto de publicación es un **job independiente dentro del mismo workflow**, para permitir que las pruebas funcionales sigan ejecutándose aunque la autorización legal quede pendiente.
- No usar el resultado CI como autorización de lanzamiento hasta configurar las reglas de protección de rama y el circuito que conecta despliegue Vercel con gate legal; Vercel puede desplegar independientemente del check.
