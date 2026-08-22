"""
EUCLIDIAN — Elementos Tributarios
Mapeador del normograma DIAN

QUE HACE:
  Recorre las paginas del normograma y REPORTA lo que encuentra.
  No asume selectores: los descubre y te dice cuales sirven.

QUE NO HACE:
  No guarda nada en la base de datos. Es solo diagnostico.
  Corrélo una vez, lee el reporte, y con eso construimos el scraper real.

USO:
  python mapeador.py
  python mapeador.py --guardar-html    # guarda el HTML crudo para inspeccion
"""

import argparse
import hashlib
import json
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://normograma.dian.gov.co/dian/compilacion/"

# Paginas semilla. Confirmadas manualmente como existentes.
SEMILLAS = {
    "novedades_indice": "novedades_boletines.html",
    "novedades_tributario": "nyb_novedades_derecho_tributario.html",
    "tributario_indice": "tributario.html",
    "normativa_tributaria": "t_1_normativa_tributaria.html",
    "doctrina_tributaria": "t_2_doctrina_tributaria.html",
    "jurisprudencia_tributaria": "t_3_jurisprudencia_tributaria.html",
    "busqueda_avanzada": "herramientas_busqueda.html",
}

# Patron de URL de documento individual descubierto en el sitio:
#   docs/oficio_dian_7021_2026.htm
#   docs/resolucion_dian_0227_2025.htm
#   docs/decreto_1742_2020.htm
PATRON_DOCUMENTO = re.compile(
    r"docs/(?P<tipo>[a-z_]+?)_(?:dian_)?(?P<numero>\d+)_(?P<anio>\d{4})\.html?",
    re.IGNORECASE,
)

TIMEOUT = 20
PAUSA_ENTRE_PEDIDOS = 1.5  # cortesia: no golpear el servidor
SALIDA = Path("reporte_mapeo")


class Mapeador:
    def __init__(self, guardar_html=False):
        self.session = requests.Session()
        self.session.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            ),
            "Accept-Language": "es-CO,es;q=0.9",
        })
        self.guardar_html = guardar_html
        self.reporte = {
            "generado": datetime.now(timezone.utc).isoformat(),
            "base": BASE,
            "paginas": {},
            "documentos_descubiertos": [],
            "resumen": {},
        }
        SALIDA.mkdir(exist_ok=True)
        if guardar_html:
            (SALIDA / "html").mkdir(exist_ok=True)

    # ------------------------------------------------------------------

    def correr(self):
        print("=" * 64)
        print("EUCLIDIAN — Mapeo del normograma DIAN")
        print("=" * 64)

        for nombre, ruta in SEMILLAS.items():
            url = urljoin(BASE, ruta)
            print(f"\n[{nombre}]")
            print(f"  {url}")
            self._analizar_pagina(nombre, url)
            time.sleep(PAUSA_ENTRE_PEDIDOS)

        self._resumir()
        self._escribir_reporte()

    # ------------------------------------------------------------------

    def _analizar_pagina(self, nombre, url):
        try:
            r = self.session.get(url, timeout=TIMEOUT)
        except requests.RequestException as e:
            print(f"  ERROR de red: {e}")
            self.reporte["paginas"][nombre] = {"url": url, "error": str(e)}
            return

        if r.status_code != 200:
            print(f"  HTTP {r.status_code} — pagina no disponible")
            self.reporte["paginas"][nombre] = {"url": url, "http": r.status_code}
            return

        r.encoding = r.apparent_encoding or "utf-8"
        html = r.text
        soup = BeautifulSoup(html, "html.parser")

        if self.guardar_html:
            (SALIDA / "html" / f"{nombre}.html").write_text(html, encoding="utf-8")

        info = {
            "url": url,
            "http": r.status_code,
            "bytes": len(html),
            "hash": hashlib.sha256(html.encode("utf-8", "ignore")).hexdigest(),
            "titulo": soup.title.get_text(strip=True) if soup.title else None,
        }

        # --- Diagnostico 1: el contenido esta en el HTML o lo pone JS?
        texto_visible = soup.get_text(" ", strip=True)
        info["caracteres_texto"] = len(texto_visible)
        info["scripts"] = len(soup.find_all("script"))
        info["probable_js"] = len(texto_visible) < 600 and info["scripts"] > 3

        # --- Diagnostico 2: inventario de enlaces
        enlaces = []
        for a in soup.find_all("a", href=True):
            href = a["href"].strip()
            if not href or href.startswith(("#", "javascript:", "mailto:", "tel:")):
                continue
            absoluta = urljoin(url, href)
            enlaces.append({
                "texto": a.get_text(" ", strip=True)[:120],
                "href": href,
                "absoluta": absoluta,
                "clases": " ".join(a.get("class", [])),
                "en_dominio": urlparse(absoluta).netloc == urlparse(BASE).netloc,
            })
        info["total_enlaces"] = len(enlaces)

        # --- Diagnostico 3: cuales enlaces son documentos normativos
        documentos = []
        for e in enlaces:
            m = PATRON_DOCUMENTO.search(e["absoluta"])
            if m:
                doc = {
                    "tipo": m.group("tipo").lower(),
                    "numero": m.group("numero"),
                    "anio": m.group("anio"),
                    "url": e["absoluta"],
                    "titulo": e["texto"],
                    "hallado_en": nombre,
                }
                documentos.append(doc)
                self.reporte["documentos_descubiertos"].append(doc)
        info["documentos_en_pagina"] = len(documentos)
        info["muestra_documentos"] = documentos[:5]

        # --- Diagnostico 4: enlaces a PDF
        info["pdfs"] = sum(1 for e in enlaces if e["absoluta"].lower().endswith(".pdf"))

        # --- Diagnostico 5: acordeones / contenido colapsado
        # El sitio usa "Ver Mas" con acordeones por anio. Hay que saber si el
        # contenido esta en el HTML (aunque oculto) o si se carga aparte.
        acordeones = soup.find_all(
            attrs={"class": re.compile(r"accordion|collaps|desplegable|acorde", re.I)}
        )
        info["acordeones"] = len(acordeones)
        info["muestra_acordeon"] = (
            str(acordeones[0])[:800] if acordeones else None
        )

        # Buscar el texto "Año 20XX" para ver si hay contenido asociado
        anios = soup.find_all(string=re.compile(r"A[nñ]o\s+20\d{2}"))
        info["marcadores_anio"] = len(anios)

        # --- Diagnostico 6: contenedores estructurales mas frecuentes
        clases = Counter()
        for tag in soup.find_all(attrs={"class": True}):
            for c in tag.get("class", []):
                clases[c] += 1
        info["clases_frecuentes"] = clases.most_common(15)

        # --- Diagnostico 7: tablas (los listados suelen venir en tabla)
        tablas = soup.find_all("table")
        info["tablas"] = len(tablas)
        if tablas:
            filas = tablas[0].find_all("tr")
            info["primera_tabla_filas"] = len(filas)
            info["primera_tabla_muestra"] = [
                [c.get_text(" ", strip=True)[:60] for c in fila.find_all(["td", "th"])]
                for fila in filas[:3]
            ]

        # --- Diagnostico 8: fecha de ultima actualizacion
        m_fecha = re.search(
            r"[Úú]ltima actualizaci[oó]n[:\s]*([0-9]{1,2}[^\n<]{0,40}20\d{2})",
            texto_visible,
        )
        info["ultima_actualizacion"] = m_fecha.group(1).strip() if m_fecha else None

        self.reporte["paginas"][nombre] = info
        self._imprimir_pagina(info)

    # ------------------------------------------------------------------

    def _imprimir_pagina(self, info):
        print(f"  HTTP {info['http']}  |  {info['bytes']:,} bytes  |  "
              f"{info['caracteres_texto']:,} chars de texto")
        if info["probable_js"]:
            print("  !! Contenido probablemente cargado por JavaScript")
            print("     -> esta pagina necesitaria Playwright")
        else:
            print("  OK HTML estatico: BeautifulSoup sirve")
        print(f"  Enlaces: {info['total_enlaces']}  |  "
              f"Documentos normativos: {info['documentos_en_pagina']}  |  "
              f"PDFs: {info['pdfs']}")
        if info["acordeones"]:
            print(f"  Acordeones detectados: {info['acordeones']} "
                  f"(marcadores de anio: {info['marcadores_anio']})")
        if info["tablas"]:
            print(f"  Tablas: {info['tablas']} "
                  f"(la primera con {info.get('primera_tabla_filas', 0)} filas)")
        if info["ultima_actualizacion"]:
            print(f"  Ultima actualizacion del sitio: {info['ultima_actualizacion']}")
        for d in info["muestra_documentos"]:
            print(f"    - {d['tipo']} {d['numero']}/{d['anio']}")

    # ------------------------------------------------------------------

    def _resumir(self):
        docs = self.reporte["documentos_descubiertos"]
        paginas_ok = [
            p for p in self.reporte["paginas"].values() if p.get("http") == 200
        ]
        paginas_js = [p for p in paginas_ok if p.get("probable_js")]

        self.reporte["resumen"] = {
            "paginas_analizadas": len(self.reporte["paginas"]),
            "paginas_ok": len(paginas_ok),
            "paginas_que_necesitan_js": len(paginas_js),
            "documentos_totales": len(docs),
            "documentos_unicos": len({d["url"] for d in docs}),
            "tipos_encontrados": dict(Counter(d["tipo"] for d in docs)),
            "anios_encontrados": dict(sorted(Counter(d["anio"] for d in docs).items())),
        }

        print("\n" + "=" * 64)
        print("RESUMEN")
        print("=" * 64)
        r = self.reporte["resumen"]
        print(f"Paginas OK: {r['paginas_ok']}/{r['paginas_analizadas']}")
        print(f"Paginas que necesitarian Playwright: {r['paginas_que_necesitan_js']}")
        print(f"Documentos descubiertos: {r['documentos_unicos']} unicos")
        if r["tipos_encontrados"]:
            print(f"Tipos: {r['tipos_encontrados']}")
        if r["anios_encontrados"]:
            print(f"Anios: {r['anios_encontrados']}")

        if r["documentos_unicos"] == 0:
            print("\n>> NINGUN documento encontrado con el patron esperado.")
            print("   Revisa reporte_mapeo/html/ para ver como estan los enlaces")
            print("   y ajustamos PATRON_DOCUMENTO.")

    # ------------------------------------------------------------------

    def _escribir_reporte(self):
        destino = SALIDA / "reporte.json"
        destino.write_text(
            json.dumps(self.reporte, indent=2, ensure_ascii=False), encoding="utf-8"
        )
        print(f"\nReporte completo: {destino}")
        if self.guardar_html:
            print(f"HTML crudo: {SALIDA / 'html'}/")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument(
        "--guardar-html",
        action="store_true",
        help="Guarda el HTML crudo de cada pagina para inspeccion manual",
    )
    args = ap.parse_args()

    m = Mapeador(guardar_html=args.guardar_html)
    try:
        m.correr()
    except KeyboardInterrupt:
        print("\nInterrumpido.")
        sys.exit(1)


if __name__ == "__main__":
    main()
