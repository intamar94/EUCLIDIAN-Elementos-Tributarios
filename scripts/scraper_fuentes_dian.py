"""Entrada segura del scraper DIAN usando las dos fuentes raíz oficiales.

No mantiene una lista fija de URLs de índices. Primero ejecuta la validación
oficial y después descubre los enlaces reales publicados por las dos páginas
raíz indicadas por EUCLIDIAN. Esos nombres se inyectan en scraper.py antes de
crear la instancia, por lo que el scraper usa exactamente los índices que la
DIAN publica actualmente.
"""

import argparse
import os
import sys
from urllib.parse import urljoin, urlparse

import requests
from bs4 import BeautifulSoup

import scraper
from validar_fuentes_dian import FUENTES_RAIZ, INDICES_ESPERADOS, BASE, TIMEOUT, main as validar_fuentes


HEADERS = {
    "User-Agent": "EUCLIDIAN/1.0 (scraper fuentes DIAN)",
    "Accept-Language": "es-CO,es;q=0.9",
}


def descubrir_indices():
    """Devuelve los cuatro índices reales enlazados desde las dos raíces."""
    encontrados = {}
    session = requests.Session()
    session.headers.update(HEADERS)

    for raiz_nombre, raiz_url in FUENTES_RAIZ.items():
        r = session.get(raiz_url, timeout=TIMEOUT)
        r.raise_for_status()
        soup = BeautifulSoup(r.text, "html.parser")
        for a in soup.find_all("a", href=True):
            url = urljoin(raiz_url, a["href"])
            parsed = urlparse(url)
            if parsed.netloc != "normograma.dian.gov.co":
                continue
            if not parsed.path.startswith("/dian/compilacion/"):
                continue
            archivo = parsed.path.rsplit("/", 1)[-1]
            if archivo in INDICES_ESPERADOS:
                esperado = INDICES_ESPERADOS[archivo]
                if esperado != raiz_nombre:
                    raise RuntimeError(
                        f"Índice {archivo} enlazado desde raíz incorrecta: "
                        f"{raiz_nombre}, esperado {esperado}"
                    )
                encontrados[archivo] = url

    faltantes = set(INDICES_ESPERADOS) - set(encontrados)
    if faltantes:
        raise RuntimeError(
            "No se pudieron descubrir desde las fuentes raíz: "
            + ", ".join(sorted(faltantes))
        )

    resultado = []
    for archivo, categoria_raiz in INDICES_ESPERADOS.items():
        url = encontrados[archivo]
        # El scraper necesita el nombre base del índice para localizar sus
        # paneles _parte_NN.html en el mismo directorio oficial.
        stem = archivo[:-5] if archivo.endswith(".html") else archivo
        categoria = {
            "nyb_novedades_derecho_tributario.html": "boletin",
            "t_1_normativa_tributaria.html": "normativa",
            "t_2_doctrina_tributaria.html": "doctrina",
            "t_3_jurisprudencia_tributaria.html": "jurisprudencia",
        }[archivo]
        resultado.append((stem, categoria))
        print(f"  FUENTE REAL: {url} -> {categoria}")

    return resultado


def main():
    # 1) Misma barrera de seguridad que usa el workflow.
    if validar_fuentes() != 0:
        return 1

    # 2) Descubrir las URLs reales y usar sus nombres, no una lista manual.
    scraper.INDICES = descubrir_indices()
    print("ÍNDICES_DIÁN_DESCUBIERTOS_OK")

    ap = argparse.ArgumentParser()
    ap.add_argument("--historico", action="store_true")
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--anios", type=int, default=3)
    args = ap.parse_args()

    s = scraper.Scraper(
        historico=args.historico,
        dry_run=args.dry_run,
        anios_recientes=args.anios,
    )
    s.correr()
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
