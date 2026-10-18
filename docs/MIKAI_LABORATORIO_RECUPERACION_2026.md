# MIKAI × EUCLIDIAN — laboratorio de recuperación documental

**18/10/2026.** Incremento de evaluación, sin cambios en la búsqueda pública, el esquema Supabase o el acceso. Punto de partida: `main` posterior a PR #111 (`9c9b576`). Este documento no certifica respuestas jurídicas.

## Inventario y dependencias

| Elemento | Estado comprobado | Decisión |
| --- | --- | --- |
| Biblioteca DIAN, búsqueda exacta y de siglas | 17.788 filas publicadas en `v_bandeja` al 18/10; PR #107 añadió prefiltro trigrama para IVA/UVT y conservó FTS | Baseline obligatorio; #97 mantiene pendiente p50/p95 en carga real |
| Fichas, evidencias, cotejo SHA-256, comparador | PR #108 y anteriores en `main`; comparación textual no prueba cambio jurídico | Mantener fuente, incertidumbre y revisión humana |
| Expediente | PR #109 en memoria; PR #111 preparó SQL/API persistente **bloqueado**, sin migración aplicada | No guardar notas de clientes ni activar el backend |
| SEO/contacto/aportes | PR #110 en producción; páginas privadas noindex y aportes cerrados | Mantener sin apertura comercial |
| Biblioteca MIKAI / Configurador web | Propuestas de prueba, observabilidad, copias, seguridad y modelos | Reutilizar CI/infraestructura; verificar restauración y costes antes de automatizar |

La Ruta Maestra del Contador exige primero estabilidad y pasajes acreditados (M0/M1), luego comparación y expedientes (M2/M3); la matriz de 50 mejoras trata la búsqueda por preguntas como hipótesis P0, no como función aprobada. Issues #97, #88 y #102 siguen abiertos.

## Opciones técnicas bajo examen

| Opción | Capacidad / licencia comprobada | Límite para EUCLIDIAN |
| --- | --- | --- |
| BGE-M3 | Embeddings multilingües densos, dispersos y multivector; 1.024 dimensiones, hasta 8.192 tokens; MIT ([ficha](https://huggingface.co/BAAI/bge-m3)) | Requiere ejecución e indexación medidas; no reemplaza número exacto ni cotejo DIAN |
| Qwen3 Embedding 0.6B | Multilingüe, 32k de contexto, dimensiones configurables hasta 1.024; Apache 2.0 ([ficha](https://huggingface.co/Qwen/Qwen3-Embedding-0.6B)) | 0,6B parámetros: carga y memoria a medir; no enviar al móvil sin presupuesto de descarga |
| BGE Reranker v2 M3 | Puntúa parejas pregunta/pasaje; Apache 2.0 ([ficha](https://huggingface.co/BAAI/bge-reranker-v2-m3)) | Solo después de recuperar candidatos; medir ganancia de orden y latencia incremental |
| Docling | PDF con estructura de página y tablas; código MIT, licencias de modelos independientes ([proyecto](https://github.com/docling-project/docling), [modelos](https://huggingface.co/docling-project/docling-models)) | Ensayo fuera del pipeline de publicación; cotejar tablas, páginas, versión, URL y hashes contra PDF oficial |
| Transformers.js | Inferencia en navegador por WASM/WebGPU, código Apache 2.0 ([documentación](https://huggingface.co/docs/transformers.js/en/index), [paquete](https://github.com/huggingface/transformers.js/blob/main/package.json)) | Solo tarea pequeña y modelo compatible con peso medido; nunca descarga silenciosa grande |
| Híbrida en Supabase | `tsvector` + `pgvector` y fusión de rangos ([guía oficial](https://supabase.com/docs/guides/ai/hybrid-search)) | `pg_trgm` 1.6 está instalado; **`vector` no está instalado**. Requiere diseño de fragmentos, índice, aislamiento, presupuesto y migración revisada |

Las licencias del código y de cada peso/modelo deben conservarse por separado. No se instaló dependencia ni se contrataron inferencias. El coste incremental **medido** de este PR para inferencia y vectores es cero porque no se ejecutan; el coste de operar candidatos sigue sin determinarse. Como cota mínima de datos brutos, una matriz de un vector float32 de 1.024 dimensiones para 17.788 documentos ocuparía ~69,5 MiB; fragmentar textos, índices, metadatos, versiones y copias eleva ese valor. Esta cifra no es presupuesto ni estimación de factura.

## Banco reproducible

`tests/fixtures/mikai_consultas.json` fija ocho casos: dos identificadores, dos siglas, dos temas, una pregunta coloquial y una ausencia. Los identificadores se observaron en el catálogo publicado el 18/10; el resto **no tiene juicios de relevancia aún**. No se atribuye relevancia jurídica por mera coincidencia de término.

El evaluador `scripts/evaluar_busqueda_mikai.mjs` recibe salidas del buscador actual, BGE-M3, Qwen3 o reranker con los mismos IDs y versión congelada del corpus. Reporta recall@5, MRR@10, nDCG@10, posición exacta, falsos positivos de consultas sin respuesta, fuente DIAN, errores y p50/p95. Rechaza cohortes incompatibles; las consultas sin juicio humano quedan fuera de las métricas de precisión.

Para recolectar en un entorno autorizado, con `SUPABASE_URL`, `SUPABASE_SERVICE_KEY`, `EUCLIDIAN_CLAVE` y `EUCLIDIAN_CORPUS_VERSION` ya configuradas:

```sh
node scripts/evaluar_busqueda_mikai.mjs collect tests/fixtures/mikai_consultas.json > /tmp/euclidian-actual.json
node scripts/evaluar_busqueda_mikai.mjs evaluate /ruta/juicios-revisados.json /tmp/euclidian-actual.json /ruta/bge-m3.json /ruta/qwen3.json
```

Las salidas candidatas deben tener `{system, corpus_version, results:[{query_id,latency_ms,candidates:[{id,source_url}]}]}`; `measured_cost_usd` solo si procede de factura/medición real. Los juicios deben incluir `{corpus_version,queries:[{id,text,relevant:[ids],exact_id?}]}` y pueden usar `relevant:null` mientras estén pendientes. La consulta negativa lleva `relevant:[]` **solo después de verificarla**. No subir tokens, resultados privados o textos de clientes a un proveedor de modelos.

El prototipo opcional `scripts/prototipo_semantico_mikai.py` acepta un JSON local `{corpus_version,documents:[{id,text,source_url}]}` con un máximo de 2.000 fragmentos **aprobados para el ensayo**, junto con las consultas fijas. Requiere `sentence-transformers` instalado aparte y pesos previamente descargados y verificados en carpetas locales; configura `local_files_only=True` y `trust_remote_code=False`. Puede ejecutar BGE-M3 o Qwen3 Embedding, y opcionalmente BGE Reranker sobre los primeros 50 candidatos. La coincidencia literal de ID conserva el primer lugar. No toca Vercel ni Supabase, no descarga modelos, no escribe datos de cliente y no presenta resultados como evidencia jurídica. Ejemplo después de obtener los pesos y la muestra autorizada:

```sh
python3 scripts/prototipo_semantico_mikai.py --corpus /ruta/muestra.json --queries tests/fixtures/mikai_consultas.json --model /ruta/pesos/bge-m3 --system bge-m3 > /tmp/bge-m3.json
python3 scripts/prototipo_semantico_mikai.py --corpus /ruta/muestra.json --queries tests/fixtures/mikai_consultas.json --model /ruta/pesos/qwen3-embedding-0.6b --reranker /ruta/pesos/bge-reranker-v2-m3 --system qwen3-rerank > /tmp/qwen3-rerank.json
```

Su `latency_ms` mide la consulta una vez cargado el índice denso en memoria; **excluye** carga del modelo y generación inicial de embeddings. No es comparable directamente con la latencia extremo a extremo de la API. Hay que registrar tiempo de carga, memoria, hardware, almacenamiento y latencia total antes de decidir. Las salidas no son evaluaciones observadas hasta ejecutar el protocolo sobre el mismo corpus y juicios revisados.

### Puerta de adopción

1. Congelar una muestra representativa de documentos publicados, versiones y URLs oficiales; contador revisa relevancia y ausencias para preguntas situacionales, siglas, negaciones y referencias exactas.
2. Ejecutar baseline y candidatos sobre el mismo corpus con resultados guardados, hardware y coste anotados. No promover si se pierden identificadores exactos, fuentes, aprobaciones, aislamiento o si aumenta falsos positivos jurídicos.
3. Probar PDF oficial en laboratorio: estructura/tablas/páginas frente al original, huella SHA-256 y fallos de OCR. La extracción automática queda marcada como tal.
4. Solo con ganancia medida, diseñar índice/servicio opcional con fallback al buscador actual, RLS y revisión LEGAL.ia para datos enviados a terceros. Probar rollback y restauración antes de activar.

## Mantenimiento existente y pendientes

GitHub Actions ya ejecuta contratos, navegador Chromium, handler real y pruebas de permisos; Vercel conserva SSO y el dominio. No hay aún prueba documentada de restauración de backup, medición periódica p75 de Core Web Vitals, verificación de Search Console ni comparación Firefox/WebKit. El sitemap incluye solo las cuatro páginas públicas informativas; cuentas y expedientes permanecen noindex. Prioridad siguiente: recolectar baseline con p50/p95 sin saturar la base, adjudicar juicios con un contador y después ensayar modelos fuera de producción. No se ha demostrado mejora de precisión, velocidad ni coste de una alternativa semántica.
