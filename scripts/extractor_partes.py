"""
EUCLIDIAN — Elementos Tributarios
Extractor de partes del normograma DIAN

HALLAZGO QUE HACE POSIBLE ESTE SCRIPT
-------------------------------------
El archivo openClosePanelArbolOpcion_aux.js (sin minificar, con comentarios
en espanol) revela como carga el sitio cada panel del acordeon:

    fileNamePage = location.pathname.split("/").slice(-1)
    fileToLoad   = fileNamePage.replace(".html", "")
    numeroParte  = window.value + 1          <- indice del acordeon, base 1
    sufijo       = "_parte_01" .. "_parte_NN"   <- rellenado a 2 digitos
    loadParte(fileToLoad + sufijo + ".html")    <- XMLHttpRequest GET

O sea: cada panel es un archivo HTML plano en el servidor, con URL
predecible, sin token ni autenticacion. Se piden con requests. No hace
falta navegador.

    t_1_normativa_tributaria.html
      -> t_1_normativa_tributaria_parte_01.html   (Ano 2026)
      -> t_1_normativa_tributaria_parte_02.html   (Ano 2025)
      -> ...

QUE HACE
--------
1. Lee cada pagina indice y cuenta sus acordeones (.opcion-nueva),
   guardando el titulo de cada uno (normalmente "Ano 20XX").
2. Pide cada _parte_NN.html correspondiente.
3. Extrae los documentos de cada parte.
4. Si una parte trae mas acordeones anidados, lo reporta para que
   sepamos si hay que bajar otro nivel.
5. Escribe un reporte y un CSV con todos los documentos hallados.

No toca la base de datos todavia. Primero confirmamos que cosecha bien.

USO
---
    python extractor_partes.py
    python extractor_partes.py --max-partes 20
"""

import argparse
import csv
import json
import re
import time
from collections import Counter, OrderedDict
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup

BASE = "https://normograma.dian.gov.co/dian/compilacion/"

# Paginas indice que tienen acordeones
INDICES = [
    "nyb_novedades_derecho_tributario.html",
    "t_1_normativa_tributaria.html",
    "t_2_doctrina_tributaria.html",
    "t_3_jurisprudencia_tributaria.html",
    "novedades_boletines.html",
    "tributario.html",
]

# Patron de documento confirmado en el sitio:
#   docs/oficio_dian_7021_2026.htm
#   docs/resolucion_dian_0227_2025.htm
#   docs/decreto_1742_2020.htm
#   docs/decreto_0173_2026.htm
PATRON_DOC = re.compile(
    r"docs/(?P<tipo>[a-z_]+?)_(?:dian_)?(?P<numero>\d+)_(?P<anio>\d{4})\.html?",
    re.IGNORECASE,
)

TIMEOUT = 25
PAUSA = 1.0
SALIDA = Path("reporte_partes")


def sufijo_parte(n: int) -> str:
    """Replica exacta de la logica del JS: 1 -> _parte_01, 10 -> _parte_10"""
    s = str(n)
    return f"_parte_0{s}" if len(s) == 1 else f"_parte_{s}"


class ExtractorPartes:
    def __init__(self, max_partes=15):
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            ),
            "Accept-Language": "es-CO,es;q=0.9",
            "X-Requested-With": "XMLHttpRequest",  # el sitio los pide asi
        })
        self.max_partes = max_partes
        self.documentos = OrderedDict()  # url -> datos
        self.reporte = {
            "generado": datetime.now(timezone.utc).isoformat(),
            "patron_descubierto": "{indice}_parte_{NN}.html",
            "indices": {},
            "resumen": {},
        }
        SALIDA.mkdir(exist_ok=True)
        (SALIDA / "partes").mkdir(exist_ok=True)

    # ------------------------------------------------------------------

    def correr(self):
        print("=" * 68)
        print("EUCLIDIAN — Extractor de partes del normograma")
        print("=" * 68)
        print(f"Patron: {{indice}}_parte_NN.html\n")

        for indice in INDICES:
            self._procesar_indice(indice)

        self._resumir()
        self._guardar()

    # ------------------------------------------------------------------

    def _procesar_indice(self, indice):
        nombre = indice.replace(".html", "")
        print(f"\n[{nombre}]")

        # 1. Leer el indice y contar acordeones
        try:
            r = self.s.get(urljoin(BASE, indice), timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            print(f"  ERROR: {e}")
            self.reporte["indices"][nombre] = {"error": str(e)}
            return

        if r.status_code != 200:
            print(f"  HTTP {r.status_code}")
            self.reporte["indices"][nombre] = {"http": r.status_code}
            return

        soup = BeautifulSoup(r.text, "html.parser")
        opciones = soup.select(".opcion-nueva")
        titulos = [
            (o.select_one(".titulo-opcion-nueva").get_text(" ", strip=True)
             if o.select_one(".titulo-opcion-nueva") else f"opcion_{i+1}")
            for i, o in enumerate(opciones)
        ]

        print(f"  Acordeones: {len(opciones)}")
        for i, t in enumerate(titulos, 1):
            print(f"    {sufijo_parte(i)} -> {t}")

        info_indice = {
            "acordeones": len(opciones),
            "titulos": titulos,
            "partes": {},
        }

        # 2. Pedir cada parte
        total = max(len(opciones), 1)
        limite = min(total + 3, self.max_partes)  # +3 por si hay mas de las visibles

        for n in range(1, limite + 1):
            time.sleep(PAUSA)
            url_parte = urljoin(BASE, f"{nombre}{sufijo_parte(n)}.html")
            titulo = titulos[n - 1] if n <= len(titulos) else "(fuera de indice)"
            resultado = self._pedir_parte(url_parte, indice_origen=nombre,
                                          titulo_acordeon=titulo)
            info_indice["partes"][sufijo_parte(n)] = resultado

            # Si dos partes seguidas dan 404 mas alla de los acordeones, parar
            if resultado.get("http") == 404 and n > len(opciones):
                break

        self.reporte["indices"][nombre] = info_indice

    # ------------------------------------------------------------------

    def _pedir_parte(self, url, indice_origen, titulo_acordeon):
        try:
            r = self.s.get(url, timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            print(f"    ERROR {url.split('/')[-1]}: {e}")
            return {"error": str(e)[:100]}

        nombre_archivo = url.split("/")[-1]

        if r.status_code != 200:
            print(f"    {r.status_code}  {nombre_archivo}")
            return {"http": r.status_code}

        html = r.text
        (SALIDA / "partes" / nombre_archivo).write_text(html, encoding="utf-8")

        soup = BeautifulSoup(html, "html.parser")

        # Documentos en esta parte
        hallados = []
        for a in soup.find_all("a", href=True):
            m = PATRON_DOC.search(a["href"])
            if not m:
                continue
            url_doc = urljoin(BASE, a["href"])
            datos = {
                "tipo": m.group("tipo").lower(),
                "numero": m.group("numero").lstrip("0") or "0",
                "anio": m.group("anio"),
                "titulo": a.get_text(" ", strip=True)[:300],
                "url": url_doc,
                "indice_origen": indice_origen,
                "acordeon": titulo_acordeon,
                "parte": nombre_archivo,
            }
            hallados.append(datos)
            self.documentos.setdefault(url_doc, datos)

        # Acordeones anidados: hay otro nivel?
        anidados = soup.select(".opcion-nueva")

        # PDFs sueltos (los boletines suelen ser PDF)
        pdfs = [
            urljoin(BASE, a["href"])
            for a in soup.find_all("a", href=True)
            if a["href"].lower().endswith(".pdf")
        ]

        resultado = {
            "http": 200,
            "bytes": len(html),
            "documentos": len(hallados),
            "documentos_unicos_nuevos": len({h["url"] for h in hallados}),
            "acordeones_anidados": len(anidados),
            "pdfs": len(pdfs),
            "muestra": [f"{h['tipo']} {h['numero']}/{h['anio']}" for h in hallados[:4]],
            "muestra_pdfs": pdfs[:3],
        }

        marca = "OK" if hallados or anidados or pdfs else "  "
        extra = ""
        if hallados:
            extra += f"  {len(hallados)} DOCS"
        if anidados:
            extra += f"  {len(anidados)} subniveles"
        if pdfs:
            extra += f"  {len(pdfs)} pdfs"
        print(f"    {marca} 200  {nombre_archivo:<58}{extra}")
        for m in resultado["muestra"]:
            print(f"           - {m}")

        return resultado

    # ------------------------------------------------------------------

    def _resumir(self):
        docs = list(self.documentos.values())
        partes_ok = sum(
            1
            for i in self.reporte["indices"].values()
            for p in i.get("partes", {}).values()
            if p.get("http") == 200
        )
        anidados = sum(
            p.get("acordeones_anidados", 0)
            for i in self.reporte["indices"].values()
            for p in i.get("partes", {}).values()
        )

        self.reporte["resumen"] = {
            "partes_encontradas": partes_ok,
            "documentos_unicos": len(docs),
            "tipos": dict(Counter(d["tipo"] for d in docs).most_common()),
            "anios": dict(sorted(Counter(d["anio"] for d in docs).items(), reverse=True)),
            "acordeones_anidados_totales": anidados,
        }

        print("\n" + "=" * 68)
        print("RESUMEN")
        print("=" * 68)
        r = self.reporte["resumen"]
        print(f"Partes que respondieron 200 : {r['partes_encontradas']}")
        print(f"Documentos unicos           : {r['documentos_unicos']}")
        print(f"Subniveles detectados       : {r['acordeones_anidados_totales']}")
        if r["tipos"]:
            print(f"Tipos                       : {r['tipos']}")
        if r["anios"]:
            print(f"Anios                       : {r['anios']}")

        if r["documentos_unicos"] > 0:
            print("\n>> CONFIRMADO: el patron _parte_NN.html funciona.")
            print("   El scraper va con requests, sin navegador.")
        elif r["partes_encontradas"] > 0:
            print("\n>> Las partes existen pero no traen documentos directos.")
            print("   Probablemente hay otro nivel de acordeon. Revisa")
            print("   reporte_partes/partes/ para ver como siguen.")
        else:
            print("\n>> Ninguna parte respondio. Hay que revisar el sufijo.")

    # ------------------------------------------------------------------

    def _guardar(self):
        (SALIDA / "reporte_partes.json").write_text(
            json.dumps(self.reporte, indent=2, ensure_ascii=False), encoding="utf-8"
        )

        if self.documentos:
            with open(SALIDA / "documentos.csv", "w", newline="", encoding="utf-8") as f:
                w = csv.DictWriter(
                    f,
                    fieldnames=["tipo", "numero", "anio", "titulo", "url",
                                "indice_origen", "acordeon", "parte"],
                )
                w.writeheader()
                w.writerows(self.documentos.values())
            print(f"\nCSV con {len(self.documentos)} documentos: {SALIDA}/documentos.csv")

        print(f"Reporte: {SALIDA}/reporte_partes.json")
        print(f"HTML de las partes: {SALIDA}/partes/")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-partes", type=int, default=15)
    args = ap.parse_args()
    ExtractorPartes(max_partes=args.max_partes).correr()
