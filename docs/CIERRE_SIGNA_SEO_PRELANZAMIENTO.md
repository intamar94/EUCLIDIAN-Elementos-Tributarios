# EUCLIDIAN — Estado de preparación de SIGNA, SEO y diseño
Fecha: 17 de octubre de 2026. Alcance: rama `feature/signa-seo-diseno-prelanzamiento-20261017`, basada en `release/euclidianet-prepublicacion-20261017`. **No equivale a una versión publicada**.

## Preparado en código
- SIGNA integrada en **Cuenta** como sección identificable, con enlace al formulario específico existente `/aportes.html`. Vista pública del formulario sin envío habilitado por defecto. No se fija precio ni se realiza cobro.
- API `/api/aportes` existente de la rama de lanzamiento: habilitación con tres autorizaciones simultáneas (aportaciones, acceso público y validación legal), fechas civiles de Colombia, sesión real, perfil de usuario autorizado, límites de contenido y escritura exclusiva en backend. SQL de aportes disponible pero **no ejecutado** desde este trabajo.
- Cinco páginas públicas candidatas a indexación: portada, fuentes DIAN, fechas y vigencia, novedades tributarias y contacto. Metadatos, canonical, Open Graph, Twitter Cards, JSON-LD, enlaces internos y sitemap actualizados al dominio `euclidianet.com`.
- Rutas `/app.html`, `/aportes.html` y `/api/*` excluidas de indexación mediante defensas apropiadas. No se copian fichas privadas a Google.
- Diseño coherente con los estilos existentes y fix concreto de navegación móvil de las guías y SIGNA. No se tocan héroes ni GIF aprobados.
- Test `tests/seo_integral_contract.mjs` incorporado al workflow existente, sin crear un quinto flujo de GitHub Actions.
- `docs/FARO_KIT_SEO_REUTILIZABLE.md` preparado para otros proyectos o para el agente designado en el futuro.
- Auditoría estática de esta rama: enlaces locales directos y assets resuelven a archivos del repositorio o rewrites; sitemap y canonical congruentes; datos JSON-LD parseados; **no es una prueba visual de navegador ni certificación SEO**.

## Bloqueado por diseño o decisión — NO activar todavía
1. **LEGAL.ia**: verificar Gewerbe, datos y aprobación del Impressum y Datenschutz; no publicar nombre y domicilio sin revisión y aprobación humana. Aportaciones SIGNA requieren definir finalidades, base jurídica, plazos de retención y derechos antes de tratar datos.
2. **SIGNA comercial**: falta el precio exacto aprobado, moneda, impuestos, fechas y condiciones, elegibilidad y alcance del pago. Implementar y probar la autorización económica del lado del servidor antes de abrir SIGNA si el acceso se cobra. La API de aportes **no contiene aún un comprobante de pago SIGNA**; por eso no basta con cambiar banderas para lanzar el producto de pago.
3. **Datos**: revisar y ejecutar manualmente `sql/aportes_usuario_euclidian.sql` tras aprobación legal, seguridad y capacidad de Supabase; nunca migrar por la mera publicación del frontend.
4. **Seguridad**: confirmar en Vercel y Supabase los cierres reales de altas y accesos públicos y evitar rutas alternativas. No habilitar Stripe ni nuevas cuentas.
5. **QA visual**: ejecutar CI real del pull request, pruebas móviles 320/390 px, tableta 768 px y escritorio 1440 px, compatibilidad en navegadores, foco/lector de pantalla, pruebas de SIGNA cerrada y simulaciones de error; revisión humana de capturas antes de fusionar.
6. **SEO vivo**: tras publicar legalmente, medir códigos HTTP, HTTPS, redirecciones, rendimiento e indexabilidad con Google Search Console y herramientas de Google; enviar el sitemap únicamente cuando las páginas sean realmente visibles. Google decide si indexa.
7. **Contacto**: probar recepción real de correos y revisar el estado jurídico antes de poner `/contacto.html` a disposición pública de Google.

## Procedimiento de publicación cuando Vercel esté disponible
- Rebasar o fusionar las ramas en el orden acordado; revisar conflictos y comprobar que no se han perdido cambios de LEGAL.ia, de seguridad, imágenes y SIGNA.
- Ejecutar pruebas y completar aprobaciones; mantener cuentas/cobros/SIGNA cerrados incluso si el contenido institucional se publica primero.
- Fusionar solo el commit validado y desplegar de manera controlada. Comprobar el despliegue y el dominio público, con reversión disponible.
- Registrar la verificación de Search Console sin prometer indexación inmediata ni tráfico.

**Resumen:** la implementación de interfaz y SEO está en GitHub; todavía **no** está en producción y no puede considerarse lista para abrir todos los servicios sin las dependencias anteriores.
