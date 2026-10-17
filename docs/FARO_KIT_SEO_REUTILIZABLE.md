# FARO de Intamar — Kit SEO reutilizable para todas las webs
**Versión:** 1.0 · **Fecha:** 17/10/2026 · **Estado:** preparado para reutilizar, no lanzado por este documento.
**Destinatarios:** equipo web, auditoría y futuros agentes de FARO. Copiar y adaptar con la identidad, idioma, dominio y requisitos legales de cada proyecto. No atribuir resultados medidos donde solo existe preparación técnica.

## Contrato de lanzamiento seguro
1. Una rama de preparación no es producción. No fusionar ni desplegar sin validar diseño, seguridad, contenidos y autorización.
2. Diferenciar `preparado en código`, `desplegado`, `rastreable`, `indexado` y `con tráfico orgánico medido`.
3. Indexar solo contenido **público, autorizado, útil y único**. Las cuentas, consultas personales, APIs, resultados restringidos y formularios internos necesitan bloqueo real y normalmente `noindex`. La etiqueta noindex por sí sola NO protege datos.
4. LEGAL.ia revisa privacidad, tratamiento, cookies, formularios, proveedores y publicidad antes de habilitar herramientas o datos públicos; no publicar identidad ni domicilio sin aprobación.
5. No inventar reseñas, estrellas, datos, fechas, tarifas, demanda de palabras clave ni prometer posiciones en Google.

## Ficha SEO replicable
| Campo | Valor en el nuevo proyecto |
|---|---|
| Dominio principal HTTPS | Por confirmar |
| Host canónico (www o sin www) | Por confirmar |
| Idiomas, países y público | Por confirmar |
| Páginas públicas aptas para Google | Por confirmar |
| Páginas privadas y rutas excluidas | Por confirmar |
| Objetivos y temas de búsqueda | Hipótesis, sujetos a datos |
| Contacto y revisión legal | LEGAL.ia |
| Sitemap, robots.txt y redirecciones | Por confirmar |
| Google Search Console y Analytics | Sin credenciales ni IDs inventados |
| Validación, fecha y responsable | Por confirmar |

## Implementación en código, antes de publicar
- Titles descriptivos, únicos, coherentes con cada H1; descripciones propias sin relleno; `lang` correcto, jerarquía H1-H3 y navegación semántica.
- URL canonical absoluta HTTPS y única por página; alinear OG URL, JSON-LD, sitemap, enlaces internos y redirecciones de dominio. Evitar contenido duplicado en `www` y host provisional.
- Página de inicio con propuesta de valor verificable, contenido HTML visible y llamada a la acción honesta. No afirmar capacidades no desplegadas.
- Contenido editorial original por intención de búsqueda; contrastar fuentes oficiales, explicar autoría y fecha de verificación cuando proceda. Evitar páginas vacías, contenido a escala y keyword stuffing.
- Links internos funcionales y estructura de navegación consistente en móvil/PC; enlaces externos a fuentes primarias con contexto. Página 404 útil y redirecciones sin bucles.
- Open Graph / Twitter Cards consistentes, imagen real accesible en el host canónico y texto alternativo descriptivo. Imágenes con ancho/alto, `srcset` si conviene, formatos optimizados y `loading=lazy` solo en contenido bajo el primer pliegue.
- JSON-LD de tipo adecuado (por ejemplo WebPage y BreadcrumbList en guías) acorde a contenido visible; validar la sintaxis y no fabricar precios, valoraciones ni supuestos resultados enriquecidos.
- Sitemap XML con URL absolutas canónicas y solo páginas públicas indexables que respondan 200; robots.txt apuntando al sitemap, sin rutas sensibles indexables. No incluir datos personales ni tokens.
- Páginas realmente privadas: autorización del servidor; páginas estáticas de acceso/formularios: `noindex` y `X-Robots-Tag` como defensa adicional. Para Google leer noindex, no bloquear esa página con robots.txt.
- Diseño responsive a 320, 390, 768 y 1440 px; foco visible, contraste adecuado, navegación por teclado, HTML legible con zoom 200%; revisar WCAG 2.2 AA.
- Rendimiento móvil/escritorio: LCP ≤ 2,5 s, INP ≤ 200 ms, CLS ≤ 0,1 en p75 de datos reales. A falta de tráfico medir laboratorio; no presentar una prueba de laboratorio como experiencia real.
- Revisar carga de fuentes externas con LEGAL.ia; evitar incorporar trackers/cookies por motivos meramente SEO.

## Auditoría automatizada del repositorio
- Contrato estático: metadatos, canonical, sitemap, robots, JSON-LD válido, exclusión de cuentas, enlaces internos y marcas de SIGNA; ejecución en CI de cada PR.
- Contrato en navegador: tamaños móviles y ordenador; imágenes, menús, accesibilidad, errores de consola, carga de guías, rutas 404 y redirecciones. Capturas antes y después para detectar regresiones visuales.
- Pruebas de seguridad de acceso, sesiones y estado legal; ningún endpoint o formulario debe activarse porque se haya publicado el HTML.

## Pasos reservados hasta que el dominio esté públicamente accesible
1. Aprobación humana del contenido y de LEGAL.ia, condiciones comerciales y acceso.
2. Despliegue controlado de commit aprobado; confirmar HTTPS, host canónico, robots, sitemap, metas, rutas y respuestas HTTP reales.
3. Verificar propiedad del **dominio real** en Google Search Console; enviar sitemap, revisar inspección de URL y cobertura. Google decide si indexa.
4. Medir Core Web Vitals en PageSpeed Insights y Search Console (distinguir datos reales vs laboratorio). Hacer seguimiento de páginas válidas y de errores.
5. Solo si está jurídicamente justificado y autorizado, configurar analítica con minimización de datos y revisar consentimiento/privacidad. Sin IDs inventados, sin buscar datos de cuentas ni consultas personales.
6. Revisar trimestralmente contenidos y cambios normativos, enlaces rotos, Search Console y conversiones legítimas sin seguimiento invasivo.

## EUCLIDIAN — aplicación actual
Dominio canonical: `https://euclidianet.com/`. Páginas públicas SEO candidatas: portada, fuentes DIAN, fechas y vigencia, novedades tributarias y contacto público, sujetos a verificación. `/app.html`, `/aportes.html` (SIGNA) y APIs no son destinos de indexación. La página pública `/contacto.html` podrá indexarse únicamente después de comprobar sus canales y la aprobación legal. Las páginas legales se servirán solo con datos y aprobación; LEGAL.ia conserva el control jurídico.
**SIGNA:** sección de cuenta y formulario preparados en la rama de trabajo; convocatoria temporal, precio y acceso comercial sin definir. Los aportes permanecen cerrados por defecto. No se habilitan pagos.
**Reutilización:** compartir este documento con el agente que indique la titular; primero duplicar y adaptar la ficha, no replicar el sitemap o dominio de EUCLIDIAN en otro proyecto.
