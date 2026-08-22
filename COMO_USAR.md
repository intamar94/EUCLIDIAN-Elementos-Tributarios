# EUCLIDIAN — Cómo correr el mapeador desde el celular

## Qué hace este script

Recorre las páginas del normograma DIAN y te dice **cómo están construidas**:
si el contenido viene en el HTML o lo pone JavaScript, cuántos documentos hay,
qué patrón siguen las URLs, si hay tablas o acordeones.

No guarda nada en la base de datos. Es puro diagnóstico. Con su reporte
construimos después el scraper de verdad, sin adivinar selectores.

## Dónde va cada archivo en el repo

```
euclidian/
├─ .github/workflows/mapeo.yml      <- el archivo mapeo.yml va acá
└─ scripts/
   ├─ mapeador.py
   └─ requirements.txt
```

Ojo: `mapeo.yml` tiene que quedar dentro de `.github/workflows/`, si no
GitHub no lo ve.

## Cómo correrlo desde el celular

1. Abrí tu repo en GitHub (app o navegador)
2. Pestaña **Actions**
3. En la lista de la izquierda: **Mapeo del normograma DIAN**
4. Botón **Run workflow** → **Run workflow**
5. Esperá ~1 minuto
6. Entrá a la ejecución que terminó y bajá hasta **Artifacts**
7. Descargá `reporte-mapeo`

Adentro vas a encontrar:

- `reporte.json` — el diagnóstico completo, estructurado
- `html/` — el HTML crudo de cada página, por si hay que mirar a mano

## Qué mirar en el reporte

Lo importante está en `resumen`:

| Campo | Qué significa |
|---|---|
| `paginas_que_necesitan_js` | Si es 0, todo el scraping va con requests. Si es >0, esas páginas necesitan Playwright |
| `documentos_unicos` | Cuántas normas encontró. Si es 0, hay que ajustar el patrón de URL |
| `tipos_encontrados` | Qué tipos existen: oficio, resolución, decreto, concepto |
| `anios_encontrados` | Qué años cubre cada listado |

Y por página, estos campos deciden cómo se escribe el scraper:

- `probable_js` — la señal de si sirve BeautifulSoup
- `acordeones` y `marcadores_anio` — si el contenido por año está oculto en
  el HTML (se puede leer igual) o se carga aparte
- `tablas` y `primera_tabla_muestra` — si los listados vienen en tabla, el
  scraping es mucho más limpio
- `clases_frecuentes` — de acá salen los selectores CSS reales

## Cuando tengas el reporte

Pasámelo y con eso escribo el scraper definitivo: ya con los selectores
correctos, no con conjeturas.

## Nota sobre cortesía

El script espera 1,5 segundos entre pedidos y se identifica con un
User-Agent normal. Son 7 páginas en total, o sea nada de carga para el
servidor de la DIAN. No lo bajes de ese valor.
