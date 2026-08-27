"""EUCLIDIAN — descubrimiento trazable desde las dos raíces DIAN autorizadas.

No descarga documentos ni los aprueba: descubre enlaces candidatos, valida que
permanezcan dentro del Normograma DIAN y conserva la raíz que los originó.
"""
from __future__ import annotations

import argparse
import json
from collections import deque
from urllib.parse import urldefrag, urljoin, urlparse

import requests
from bs4 import BeautifulSoup

from validar_fuentes_dian import FUENTES_RAIZ, HEADERS, TIMEOUT, es_contenido_dian

MAX_LINKS = 250


def descubrir(roots: dict[str, str], max_links: int = MAX_LINKS) -> list[dict]:
    session = requests.Session()
    session.headers.update(HEADERS)
    cola = deque((nombre, url) for nombre, url in roots.items())
    visitadas: set[str] = set()
    resultados: list[dict] = []

    while cola and len(visitadas) < max_links:
        raiz, url = cola.popleft()
        limpio, _ = urldefrag(url)
        if limpio in visitadas or not es_contenido_dian(limpio):
            continue
        visitadas.add(limpio)
        try:
            response = session.get(limpio, timeout=TIMEOUT, allow_redirects=True)
            response.raise_for_status()
        except requests.RequestException:
            continue
        final, _ = urldefrag(response.url)
        if not es_contenido_dian(final):
            continue
        soup = BeautifulSoup(response.text, "html.parser")
        resultados.append({"url": final, "raiz": raiz, "tipo": "pagina_dian"})
        for anchor in soup.select("a[href]"):
            destino = urldefrag(urljoin(final, anchor["href"]))[0]
            if es_contenido_dian(destino) and destino not in visitadas:
                cola.append((raiz, destino))
    return resultados


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--limite", type=int, default=MAX_LINKS)
    parser.add_argument("--salida", default="descubrimiento_fuentes.json")
    args = parser.parse_args()
    datos = descubrir(FUENTES_RAIZ, max(1, min(args.limite, 1000)))
    with open(args.salida, "w", encoding="utf-8") as archivo:
        json.dump({"fuentes_raiz": FUENTES_RAIZ, "documentos": datos}, archivo, ensure_ascii=False, indent=2)
    print(f"DESCUBRIMIENTO_OK: {len(datos)} páginas oficiales trazadas")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
