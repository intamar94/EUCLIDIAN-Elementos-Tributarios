# EUCLIDIAN · Oportunidades de experiencia frente al mercado

Fecha de consulta: **19 de octubre de 2026**. Base revisada: `ef8c519`. Alcance: páginas públicas oficiales de productos y documentación de uso; no se compraron suscripciones, no se probaron cuentas competidoras ni se midió su rendimiento. Este documento complementa la [matriz de 50 oportunidades](MATRIZ_COMPETITIVA_50_MEJORAS_2026.md) y la [ruta maestra](RUTA_MAESTRA_CONTADOR_DIA_A_DIA_2026.md).

## Decisión de producto

Concentrar el trabajo inmediato en **investigar con claridad y conservar un borrador con sus fuentes**. Competir por menos pasos, estado comprensible y un resultado revisable. No competir inicialmente en ERP, calendario general o chat genérico. El beneficio y la disposición a pagar todavía requieren piloto con contadores.

Supabase permanece pendiente por decisión de dirección. Las mejoras de esta entrega deben funcionar con las capacidades actuales y no crear falsa sincronización, alertas automáticas ni expedientes en la nube.

## Qué está comprobado en las ofertas públicas

| Producto y fuente primaria | Funciones publicitadas/documentadas | Lo que esta revisión NO demuestra |
|---|---|---|
| [Actualícese Planner](https://actualicese.com/actualicese-planner-2026/), secciones «Los 7 módulos» y agente IA | Calendario filtrable por cliente/NIT/obligación, gestión de clientes, materiales asociados, sincronización con calendarios externos y agente de IA para consultas y gestión. | No verifica precisión jurídica, usabilidad real, trazabilidad completa ni ausencia de expedientes profesionales. |
| [Alegra Espacio Contador: calendario](https://docs.alegra.com/manuales/espacio-contador/calendario.html), manual de uso | Vistas anual/mensual/semanal, obligaciones nacionales y municipales, filtros, detalle lateral, finalización de tareas y configuración de correos de aviso. | No prueba cobertura completa de municipios, cumplimiento de cada caso ni calidad de todas las notificaciones. |
| [Legis Xperta: Régimen del Impuesto a la Renta](https://www.legis.com.co/regimen-de-impuesto-a-la-renta-y-complementarios-xperta/p), descripción del producto | Buscador semántico, IA SylvIA, normativa acompañada de doctrina DIAN, jurisprudencia y notas editoriales, incluidas derogatorias. | No demuestra el flujo concreto de revisión del usuario, alcance de exportación ni ausencia de seguimiento de cambios. |
| [Siigo: descripción oficial](https://www.siigo.com/blog/emprendimiento/que-es-siigo/), «¿Qué es Siigo?» | Operación contable y administrativa en la nube, acceso móvil y funciones de IA, incluido Agente IA Actualícese. | No confirma que sustituya investigación jurídica documentada ni permite evaluar toda su experiencia móvil. |

**Distinción obligatoria:** que una página no mencione una capacidad no prueba que el proveedor carezca de ella. Las siguientes oportunidades son hipótesis de valor para EUCLIDIAN; no son defectos competitivos certificados. No usar «único», «el primero» o «los demás no lo hacen» en la web.

## Cinco oportunidades accionables

### 1. Entrar por la tarea, con una búsqueda protagonista — P0

**Motivo:** los proveedores cubren muchas funciones; copiar esa amplitud dispersaría el esfuerzo de EUCLIDIAN. La hipótesis es que el contador valora llegar rápidamente a un documento pertinente.

**Cambio:** en el escritorio conservar una acción principal «Buscar documentos DIAN» y el campo de búsqueda por número, título o tema. Ofrecer dos o tres ejemplos que introduzcan una consulta real, sin simular una respuesta conversacional. Mantener filtros avanzados plegables y mostrar los filtros activos con eliminación individual y «Limpiar filtros».

**Aceptación:** una consulta por número y otra por tema se completan con teclado y en móvil; limpiar filtros conserva la consulta salvo acción explícita; no hay llamadas de IA ni datos de clientes. No afirmar que una pregunta en lenguaje natural recibe una respuesta jurídica si el sistema solo busca coincidencias.

**Referencia de matriz:** #1, #2, #43; M0.

### 2. Explicar qué sabemos de cada resultado — P0

**Motivo:** Legis ya publicita relaciones editoriales; la oportunidad no es reclamar exclusividad, sino hacer comprensibles las evidencias de EUCLIDIAN.

**Cambio:** jerarquía consistente en tarjetas y fichas: título/identificación; autoridad y fecha del acto; publicación web por separado; estado de evidencia con frase breve y detalle expandible; botón «Abrir fuente oficial». Cuando no haya fecha o evidencia, declararlo. Mostrar revisión y relación como dimensiones distintas.

**Aceptación:** una fecha reciente nunca genera por sí sola etiqueta «Vigente». Estados sin evidencia permanecen pendientes; una huella técnica verificada no aparece como revisión jurídica. Las etiquetas usan texto además del color y los detalles se abren con teclado. El enlace externo tiene nombre comprensible.

**Referencia de matriz:** #11, #47; M1.

### 3. Volver a los resultados sin perder el trabajo — P0

**Motivo:** navegar una biblioteca suele exigir alternar lista y ficha; medir este recorrido ofrece una mejora concreta sin ampliar infraestructura. No se afirma que los competidores pierdan el contexto.

**Cambio:** conservar consulta, filtros, página y posición al abrir/cerrar un documento; ofrecer retorno visible y un estado recuperable en errores o consultas lentas. No confundir «sin resultados» con «servidor no disponible». Mantener la consulta al reintentar y evitar envío simultáneo de peticiones duplicadas.

**Aceptación:** desde el tercer resultado se abre una ficha, se vuelve y permanece el contexto; la recuperación funciona con teclado y móvil. Un timeout muestra explicación y reintento sin vaciar la consulta. Prueba negativa de búsqueda nueva para no mostrar resultados anteriores como si fueran actuales.

**Referencia de matriz:** #1, #32; M0.

### 4. Convertir fuentes en un borrador profesional, con límites visibles — P0 en local; P1 en nube

**Motivo:** un calendario y un asistente ya están presentes en el mercado. La hipótesis más específica es reducir el trabajo entre localizar una referencia y documentar el criterio del contador.

**Cambio:** desde la ficha, acción secundaria «Añadir a expediente». Confirmar qué fuente se añadió y permitir ir al expediente. Mantener pregunta, hechos sin datos personales, hipótesis, salvedades y conclusión propuesta. Exponer «Borrador guardado en este navegador», exportar y eliminar. No presentar el almacenamiento local como respaldo o sincronización.

**Aceptación:** crear borrador con dos referencias distintas y exportarlo con identificación, enlaces y fecha de corte; impedir o explicar duplicados; indicar si el navegador no puede guardar. Las conclusiones se identifican como propuestas no aprobadas. Ningún envío automático al cliente, ningún dato sintético presentado como expediente real. Persistencia en nube y colaboración esperan aislamiento y auditoría posteriores.

**Referencia de matriz:** #16, #17, #30, #32, #34, #41, #49; M3–M4.

### 5. Accesibilidad y ayuda en el momento de actuar — P0

**Motivo:** Siigo documenta acceso móvil; la compatibilidad móvil es requisito básico, no diferenciador demostrado. EUCLIDIAN puede validar su propia sencillez con tareas medibles.

**Cambio:** navegación por nombres de tareas («Consultar», «Novedades», «Guardados», «Expedientes»), controles táctiles cómodos, foco visible, lectura a 320 px sin desplazamiento horizontal general y mensajes próximos a cada error. Explicar «relación», «publicación web» y «revisión pendiente» junto a su uso. El texto técnico del sistema queda fuera del recorrido normal.

**Aceptación:** completar búsqueda → fuente → expediente → exportación con teclado y en pantalla pequeña; tabulación lógica, menú que cierra con Escape y devuelve el foco cuando corresponda, formulario con etiquetas, errores anunciados y ampliación de texto sin recortes. No exigir leer un manual para la primera consulta.

**Referencia de matriz:** #43; D2–D3.

## Orden para los agentes de interfaz

1. Búsqueda principal, estados vacío/error y retorno que conserva contexto.
2. Fuente, fechas y evidencia con el mismo orden visual en lista y ficha.
3. Añadir fuente al expediente con confirmación y aviso de almacenamiento local.
4. Verificación móvil/teclado del recorrido completo y ajuste de navegación.

Conservar identidad editorial EUCLIDIAN, contraste y densidad útil. No añadir pestañas para módulos futuros ni botones que abran funciones inexistentes. No mover DNS, habilitar registro, activar pagos o cambiar Supabase como parte de esta mejora de interfaz.

## Validación antes de prometer ventaja

Piloto sugerido: cinco contadores, tres tareas representativas, mismos documentos de referencia y registro de tiempo/errores/ayuda requerida. Comparar contra su método habitual con consentimiento; no concluir superioridad frente a productos que no se han probado. Registrar como pendiente lo que no llegue a probarse.

Métricas iniciales: éxito sin ayuda en cada tarea; tiempo hasta abrir una fuente; continuidad al volver de la ficha; capacidad de explicar la diferencia entre publicación y vigencia; exportación con referencias completas. Son criterios de prueba futuros, no resultados obtenidos.

## Fuentes y límites temporales

Las cuatro páginas se consultaron el 19/10/2026. No se comprobó fecha editorial de actualización de todas ellas; la fecha de rastreo del buscador no equivale a publicación. Los precios/promociones no se compararon y no deben inferirse de este documento. El acceso directo a `https://www.legis.co/legis-xperta` falló; se usó la descripción comercial oficial accesible citada arriba. Las referencias externas describen ofertas y manuales, no constituyen una evaluación independiente ni asesoramiento tributario.
