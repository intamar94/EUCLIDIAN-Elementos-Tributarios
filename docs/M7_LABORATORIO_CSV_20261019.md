# M7 — Laboratorio estructural CSV ficticio

Entrega: módulo local útil para practicar revisión de archivos tabulares. No acredita un formato DIAN, resolución, año gravable, identidad tributaria ni cumplimiento de información exógena. La funcionalidad M7 reglamentaria continúa pendiente.

## Integración

Cargar `exogena.css` y `exogena.js`, crear `<div id="exogenaPanel"></div>`. El módulo monta automáticamente al cargar el DOM; si el contenedor aparece después, llamar a `window.EuclidianExogena.panel()`.

Invocar `window.EuclidianExogena.limpiar()` al salir de la cuenta o descartar el entorno temporal. Limpiar invalida también una lectura asíncrona de archivo pendiente. No hay cambios de Auth, base de datos ni dependencias.

## Esquema genérico explícito

| Columna | Regla exclusiva del ejercicio |
| --- | --- |
| `fila_id` | `DEMO-` y tres cifras; identificador técnico único |
| `concepto_ficticio` | Solo `DEMO_SERVICIO` o `DEMO_BIEN` |
| `importe` | No negativo; hasta 12 cifras enteras sin ceros iniciales salvo cero; punto y exactamente dos decimales |

Cabecera exacta y orden fijo, coma como separador y texto UTF-8. Se aceptan comillas CSV, comillas dobles escapadas, BOM, CRLF y celdas multilínea; la tabla identifica la línea física inicial de cada registro. Límite 200000 bytes, 1000 registros y 20 columnas como límite de lectura defensivo. La validación exige tres columnas. Máximo 100 observaciones renderizadas, con total completo indicado. Un archivo solo con encabezados es inválido.

No cargar NIT, datos de clientes ni documentos personales. La estructura rechaza identificadores y conceptos fuera del esquema ficticio; esto no constituye detección universal de datos personales.

## Privacidad y seguridad

- Revisión en memoria y ninguna llamada de red ni persistencia.
- El CSV no se conserva en estado global; solo se muestran motivos genéricos de error, sin repetir valores cargados.
- Render mediante nodos DOM y `textContent`; no interpreta HTML del CSV.
- Detecta prefijos de fórmula `=`, `+`, `@`, `-`, incluyendo espacios iniciales. No exporta contenido cargado.
- Solo descarga un ejemplo fijo, ficticio y sin fórmulas. Descarga y eliminación posterior del archivo local corresponden al usuario.
- Limpieza borra selección, resultados y lecturas pendientes. Recargar descarta el contenido de la vista.

## Accesibilidad

Controles nativos de teclado, foco visible, campos de 16 px, botones de al menos 44 px, estado con `aria-live`, tabla con encabezados/caption y región desplazable por teclado en móvil. Conserva tipografía y colores heredados.

## Evidencia

`node tests/exogena_contract.mjs`: ejemplo, BOM, encabezados, vacío, fila vacía estructural, columnas, duplicados, 9 formatos numéricos inválidos y 3 válidos, 5 prefijos de fórmulas, identificadores reales rechazados, comillas y saltos de línea, errores de sintaxis, límites de bytes/columnas/registros, límite de observaciones y ausencia de APIs de red/persistencia/HTML.

La publicación e integración de navegación corresponden al coordinador. Este módulo no habilita cobros ni usuarios y no ejecuta presentaciones ante autoridades.
