"""EUCLIDIAN — Validación de las dos fuentes oficiales DIAN.

Las dos páginas raíz son los únicos puntos de entrada autorizados. Desde ellas
se usan únicamente las cuatro páginas tributarias oficiales de la Compilación
Jurídica DIAN. No se acepta ningún dominio externo ni URL fuera de
/dian/compilacion/.
"""
import sys
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

BASE = "https://normograma.dian.gov.co/dian/compilacion/"
DOMINIO = "normograma.dian.gov.co"
FUENTES_RAIZ = {
    "novedades": "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html",
    "tributario": "https://normograma.dian.gov.co/dian/compilacion/tributario.html?q=TRIBUTARIO",
}
INDICES_ESPERADOS = {
    "nyb_novedades_derecho_tributario.html": ("novedades", "https://normograma.dian.gov.co/dian/compilacion/nyb_novedades_derecho_tributario.html"),
    "t_1_normativa_tributaria.html": ("tributario", "https://normograma.dian.gov.co/dian/compilacion/t_1_normativa_tributaria.html"),
    "t_2_doctrina_tributaria.html": ("tributario", "https://normograma.dian.gov.co/dian/compilacion/t_2_doctrina_tributaria.html"),
    "t_3_jurisprudencia_tributaria.html": ("tributario", "https://normograma.dian.gov.co/dian/compilacion/t_3_jurisprudencia_tributaria.html"),
}
TIMEOUT = 30
HEADERS = {"User-Agent": "EUCLIDIAN/1.0 (validador fuentes DIAN)", "Accept-Language": "es-CO,es;q=0.9"}

def cargar(session, url):
    r = session.get(url, timeout=TIMEOUT, headers=HEADERS, allow_redirects=True)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text, r.url

def es_oficial(url):
    p = urlparse(url)
    return p.netloc == DOMINIO and p.path.startswith("/dian/compilacion/")

def main():
    print("Validando las 2 fuentes raíz oficiales DIAN...")
    s = requests.Session()
    s.headers.update(HEADERS)
    for nombre, raiz in FUENTES_RAIZ.items():
        html, final = cargar(s, raiz)
        if not es_oficial(final):
            raise RuntimeError(f"Redirección fuera de fuente oficial: {final}")
        texto = BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()
        if "compilación jurídica dian" not in texto and "compilacion juridica dian" not in texto:
            raise RuntimeError(f"La raíz no se identifica como Compilación Jurídica DIAN: {raiz}")
        print(f"  OK raíz {nombre}: {raiz}")

    # La DIAN usa controles dinámicos para algunos enlaces. Por eso no
    # dependemos de encontrar los href en una descarga HTTP simple: validamos
    # directamente las subpáginas oficiales que forman parte de esas dos
    # entradas, sin añadir ninguna fuente externa.
    for archivo, (raiz, url) in INDICES_ESPERADOS.items():
        if not es_oficial(url):
            raise RuntimeError(f"Fuente fuera del Normograma DIAN: {url}")
        html, final = cargar(s, url)
        if not es_oficial(final):
            raise RuntimeError(f"Índice redirige fuera del Normograma: {url} -> {final}")
        texto = BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()
        if "compilación jurídica dian" not in texto and "compilacion juridica dian" not in texto:
            raise RuntimeError(f"El índice no parece ser el Normograma DIAN: {url}")
        print(f"  OK índice {archivo} ← {raiz}")

    print("FUENTES_DIAN_OK")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FUENTES_DIAN_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
