"""
EUCLIDIAN — Elementos Tributarios
Mapeador v2: caza de la API

CONTEXTO (lo que aprendimos con el v1):
  - Las paginas del normograma son HTML estatico, pero el arbol de
    documentos NO esta en el HTML. Los paneles por anio vienen vacios
    y se llenan al hacer clic.
  - Cada pagina carga una app Angular: inline/polyfills/main_compilacion.js
  - Una app Angular consulta una API. Si la encontramos, no hay que
    scrapear HTML: pedimos datos estructurados y ya.

QUE HACE ESTE SCRIPT:
  1. Descarga los bundles de JS y extrae de ahi toda URL o ruta que
     parezca un endpoint.
  2. Descarga los JS del arbol (openClosePanelArbolOpcion y compania)
     para ver de donde saca el contenido de cada panel.
  3. Prueba los candidatos mas probables y reporta cuales responden.
  4. Si algo devuelve JSON, guarda una muestra.

USO:
  python mapeador_api.py
"""

import json
import re
import time
from collections import OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests

BASE = "https://normograma.dian.gov.co/dian/compilacion/"
TIMEOUT = 25
PAUSA = 1.2
SALIDA = Path("reporte_api")

# Bundles de Angular (de ahi sale la URL base de la API)
BUNDLES = [
    "js/main_compilacion.js",
    "js/inline_compilacion.js",
    "js/polyfills_compilacion.js",
]

# JS que construye el arbol y abre los paneles por anio
JS_ARBOL = [
    "js/openClosePanelArbolOpcion_aux.js?v=2.0",
    "js/onLoadPaginaArbol_aux.js?v=2.0",
    "js/loadCorte.js?v=2.0",
    "js/verMas_AddListenerArbol.js?v=2.0",
    "js/navegacionFunction.js?v=2.0",
    "js/agregaBotonesNavegacion_aux.js?v=2.0",
    "js/main_compilacion.js",
]

# Patrones para reconocer endpoints dentro del JS minificado
PATRONES_ENDPOINT = [
    # URLs absolutas
    (r'https?://[a-zA-Z0-9._-]+(?:\:\d+)?/[a-zA-Z0-9._~:/?#\[\]@!$&()*+,;=%-]{2,120}', "url_absoluta"),
    # rutas de api
    (r'["\'`](/?(?:api|rest|servicio|servicios|ws|backend|data|datos)/[a-zA-Z0-9._/-]{2,100})["\'`]', "ruta_api"),
    # archivos json
    (r'["\'`]([a-zA-Z0-9._/-]{2,100}\.json)["\'`]', "archivo_json"),
    # variables tipo apiUrl / baseUrl / endpoint
    (r'(?:apiUrl|baseUrl|urlBase|endpoint|urlApi|API_URL|SERVER_URL)\s*[:=]\s*["\'`]([^"\'`]{2,150})["\'`]', "variable_url"),
    # llamadas http de angular
    (r'\.(?:get|post)\s*\(\s*["\'`]([^"\'`]{2,150})["\'`]', "llamada_http"),
    # fragmentos .htm/.html referenciados dinamicamente
    (r'["\'`]([a-zA-Z0-9._/-]{2,100}\.html?)["\'`]', "fragmento_html"),
]

RUIDO = re.compile(
    r"(w3\.org|schema\.org|googletagmanager|google-analytics|gstatic|"
    r"fonts\.googleapis|cloudflare|jquery|facebook|twitter|instagram|"
    r"youtube|linkedin|\.svg|\.png|\.jpg|\.css|angular\.io|github\.io)",
    re.I,
)


class CazadorDeAPI:
    def __init__(self):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            ),
            "Accept-Language": "es-CO,es;q=0.9",
            "Referer": BASE + "tributario.html",
        })
        self.reporte = {
            "generado": datetime.now(timezone.utc).isoformat(),
            "bundles": {},
            "js_arbol": {},
            "candidatos": OrderedDict(),
            "pruebas": [],
            "veredicto": {},
        }
        SALIDA.mkdir(exist_ok=True)
        (SALIDA / "js").mkdir(exist_ok=True)
        (SALIDA / "muestras").mkdir(exist_ok=True)

    # ------------------------------------------------------------------

    def correr(self):
        print("=" * 66)
        print("EUCLIDIAN — Mapeador v2: caza de la API del normograma")
        print("=" * 66)

        print("\n[1] Bundles de Angular")
        for b in BUNDLES:
            self._analizar_js(b, destino="bundles")
            time.sleep(PAUSA)

        print("\n[2] JS del arbol de navegacion")
        for j in JS_ARBOL:
            if j in BUNDLES:
                continue
            self._analizar_js(j, destino="js_arbol")
            time.sleep(PAUSA)

        print("\n[3] Probando candidatos")
        self._probar_candidatos()

        print("\n[4] Sondas directas")
        self._sondas_directas()

        self._veredicto()
        self._guardar()

    # ------------------------------------------------------------------

    def _analizar_js(self, ruta, destino):
        url = urljoin(BASE, ruta)
        nombre = ruta.split("/")[-1].split("?")[0]
        try:
            r = self.s.get(url, timeout=TIMEOUT)
        except requests.RequestException as e:
            print(f"  {nombre:42} ERROR {e}")
            self.reporte[destino][nombre] = {"error": str(e)}
            return

        if r.status_code != 200:
            print(f"  {nombre:42} HTTP {r.status_code}")
            self.reporte[destino][nombre] = {"http": r.status_code}
            return

        js = r.text
        (SALIDA / "js" / nombre).write_text(js, encoding="utf-8")

        hallazgos = {}
        total = 0
        for patron, etiqueta in PATRONES_ENDPOINT:
            encontrados = set()
            for m in re.finditer(patron, js):
                valor = m.group(1) if m.groups() else m.group(0)
                valor = valor.strip()
                if not valor or RUIDO.search(valor):
                    continue
                if len(valor) < 3:
                    continue
                encontrados.add(valor)
            if encontrados:
                hallazgos[etiqueta] = sorted(encontrados)[:40]
                total += len(encontrados)
                for v in encontrados:
                    self.reporte["candidatos"].setdefault(v, []).append(
                        f"{nombre}:{etiqueta}"
                    )

        self.reporte[destino][nombre] = {
            "bytes": len(js),
            "hallazgos": hallazgos,
        }
        print(f"  {nombre:42} {len(js):>9,}b  candidatos={total}")
        for etiqueta, vals in hallazgos.items():
            for v in vals[:6]:
                print(f"      [{etiqueta}] {v[:95]}")

    # ------------------------------------------------------------------

    def _probar_candidatos(self):
        # Priorizar los que huelen a API o a datos
        prioritarios = [
            c for c in self.reporte["candidatos"]
            if re.search(r"(api|rest|servicio|ws|json|datos|data|buscar|consulta)", c, re.I)
        ]
        if not prioritarios:
            print("  Ningun candidato con pinta de API en los bundles.")
            return

        print(f"  {len(prioritarios)} candidatos prioritarios")
        for c in prioritarios[:25]:
            url = c if c.startswith("http") else urljoin(BASE, c.lstrip("/"))
            self._probar_url(url, origen="bundle")
            time.sleep(PAUSA)

    # ------------------------------------------------------------------

    def _sondas_directas(self):
        """Rutas que un normograma de Avance Juridico suele exponer."""
        sondas = [
            # posibles APIs del buscador
            "api/busqueda",
            "api/documentos",
            "api/arbol",
            "rest/busqueda",
            "servicios/busqueda",
            # fragmentos del arbol por anio (el patron mas probable)
            "arbol/nyb_novedades_derecho_tributario_2026.html",
            "nyb_novedades_derecho_tributario_2026.html",
            "nyb_novedades_derecho_tributario_a2026.html",
            # indices por tipo
            "t_2_doctrina_tributaria_2026.html",
            "t_1_normativa_tributaria_2026.html",
            # datos estaticos
            "datos/arbol.json",
            "json/arbol.json",
            "assets/arbol.json",
            # sitemap: la via mas limpia si existe
            "sitemap.xml",
            "../sitemap.xml",
            "docs/",
        ]
        for s in sondas:
            self._probar_url(urljoin(BASE, s), origen="sonda")
            time.sleep(PAUSA)

    # ------------------------------------------------------------------

    def _probar_url(self, url, origen):
        try:
            r = self.s.get(url, timeout=TIMEOUT)
        except requests.RequestException as e:
            self.reporte["pruebas"].append(
                {"url": url, "origen": origen, "error": str(e)[:120]}
            )
            return

        ctype = r.headers.get("content-type", "")
        resultado = {
            "url": url,
            "origen": origen,
            "http": r.status_code,
            "content_type": ctype,
            "bytes": len(r.content),
        }

        marca = "  "
        if r.status_code == 200 and len(r.content) > 40:
            # Es JSON?
            if "json" in ctype.lower():
                marca = "OK"
                resultado["tipo"] = "json"
                try:
                    resultado["muestra"] = json.loads(r.text)
                    nombre = re.sub(r"\W+", "_", url)[-70:] + ".json"
                    (SALIDA / "muestras" / nombre).write_text(
                        r.text[:200000], encoding="utf-8"
                    )
                except Exception:
                    resultado["muestra"] = r.text[:500]
            elif "xml" in ctype.lower():
                marca = "OK"
                resultado["tipo"] = "xml"
                resultado["muestra"] = r.text[:800]
            else:
                # HTML: sirve si trae enlaces a documentos
                docs = re.findall(
                    r'href="([^"]*docs/[a-z_]+_(?:dian_)?\d+_\d{4}\.html?)"', r.text
                )
                resultado["documentos_en_respuesta"] = len(set(docs))
                resultado["muestra_docs"] = sorted(set(docs))[:8]
                if docs:
                    marca = "OK"
                    resultado["tipo"] = "html_con_documentos"
                    nombre = re.sub(r"\W+", "_", url)[-70:] + ".html"
                    (SALIDA / "muestras" / nombre).write_text(
                        r.text[:400000], encoding="utf-8"
                    )
                else:
                    resultado["tipo"] = "html_sin_documentos"

        self.reporte["pruebas"].append(resultado)

        extra = ""
        if resultado.get("documentos_en_respuesta"):
            extra = f"  <-- {resultado['documentos_en_respuesta']} DOCUMENTOS"
        elif resultado.get("tipo") == "json":
            extra = "  <-- JSON"
        print(f"  {marca} {r.status_code}  {url[-78:]}{extra}")

    # ------------------------------------------------------------------

    def _veredicto(self):
        exitosas = [
            p for p in self.reporte["pruebas"]
            if p.get("tipo") in ("json", "xml", "html_con_documentos")
        ]
        docs_total = sum(
            p.get("documentos_en_respuesta", 0) for p in self.reporte["pruebas"]
        )
        self.reporte["veredicto"] = {
            "candidatos_extraidos": len(self.reporte["candidatos"]),
            "urls_probadas": len(self.reporte["pruebas"]),
            "urls_utiles": len(exitosas),
            "documentos_alcanzados": docs_total,
            "urls_utiles_detalle": [
                {"url": p["url"], "tipo": p.get("tipo")} for p in exitosas
            ],
        }

        print("\n" + "=" * 66)
        print("VEREDICTO")
        print("=" * 66)
        v = self.reporte["veredicto"]
        print(f"Candidatos extraidos de los JS : {v['candidatos_extraidos']}")
        print(f"URLs probadas                  : {v['urls_probadas']}")
        print(f"URLs utiles                    : {v['urls_utiles']}")
        print(f"Documentos alcanzados          : {v['documentos_alcanzados']}")

        if exitosas:
            print("\nFuentes utiles encontradas:")
            for e in exitosas:
                print(f"  [{e.get('tipo')}] {e['url']}")
            print("\n>> Con esto se puede construir el scraper sin navegador.")
        else:
            print("\n>> Ninguna ruta directa sirvio.")
            print("   Plan B: Playwright. Abre la pagina, hace clic en el")
            print("   acordeon del anio y lee el panel ya cargado.")
            print("   Es mas lento pero funciona seguro.")

    # ------------------------------------------------------------------

    def _guardar(self):
        destino = SALIDA / "reporte_api.json"
        destino.write_text(
            json.dumps(self.reporte, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"\nReporte: {destino}")
        print(f"JS descargado: {SALIDA / 'js'}/")
        print(f"Muestras: {SALIDA / 'muestras'}/")


if __name__ == "__main__":
    CazadorDeAPI().correr()
