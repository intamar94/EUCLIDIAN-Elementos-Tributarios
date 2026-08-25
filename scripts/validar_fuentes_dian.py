"""EUCLIDIAN — Validación de fuentes oficiales DIAN.

La ingesta tributaria solo se considera válida si parte de estas dos páginas
raíz oficiales de la DIAN y si esas páginas siguen enlazando los cuatro
índices que usa el scraper.
"""

import re
import sys
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

BASE = "https://normograma.dian.gov.co/dian/compilacion/"
FUENTES_RAIZ = {
    "novedades": "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html",
    "tributario": "https://normograma.dian.gov.co/dian/compilacion/tributario.html?q=TRIBUTARIO",
}
INDICES_ESPERADOS = {
    "nyb_novedades_derecho_tributario.html": "novedades",
    "t_1_normativa_tributaria.html": "tributario",
    "t_2_doctrina_tributaria.html": "tributario",
    "t_3_jurisprudencia_tributaria.html": "tributario",
}

TIMEOUT = 30


def cargar(url):
    r = requests.get(url, timeout=TIMEOUT, headers={
        "User-Agent": "EUCLIDIAN/1.0 (validador fuentes DIAN)",
        "Accept-Language": "es-CO,es;q=0.9",
    })
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text


def enlaces(html, base):
    soup = BeautifulSoup(html, "html.parser")
    return {urljoin(base, a.get("href")) for a in soup.find_all("a", href=True)}


def main():
    print("Validando fuentes oficiales DIAN...")
    encontrados = {}

    for nombre, raiz in FUENTES_RAIZ.items():
        html = cargar(raiz)
        urls = enlaces(html, BASE)
        print(f"  OK raíz {nombre}: {raiz}")
        for url in urls:
            path = urlparse(url).path
            archivo = path.rsplit("/", 1)[-1]
            if archivo in INDICES_ESPERADOS:
                encontrados[archivo] = (url, INDICES_ESPERADOS[archivo])

    faltantes = set(INDICES_ESPERADOS) - set(encontrados)
    if faltantes:
        raise RuntimeError(
            "La DIAN cambió la estructura de las páginas raíz. "
            f"No se encontraron: {sorted(faltantes)}"
        )

    # Verifica también que los índices descubiertos sigan siendo documentos
    # de la Compilación Jurídica DIAN antes de permitir que continúe el scraper.
    for archivo, (url, raiz) in sorted(encontrados.items()):
        parsed = urlparse(url)
        if parsed.netloc != "normograma.dian.gov.co" or not parsed.path.startswith("/dian/compilacion/"):
            raise RuntimeError(f"Fuente fuera del Normograma DIAN: {url}")
        html = cargar(url)
        if "Compilación Jurídica DIAN" not in BeautifulSoup(html, "html.parser").get_text(" ", strip=True):
            raise RuntimeError(f"El índice no parece ser el Normograma DIAN: {url}")
        print(f"  OK índice {archivo} ← {raiz}")

    print("FUENTES_DIÁN_OK")
    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FUENTES_DIÁN_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
