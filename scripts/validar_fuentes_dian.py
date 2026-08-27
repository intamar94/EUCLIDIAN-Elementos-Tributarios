"""EUCLIDIAN — Validación estricta de las dos fuentes raíz DIAN.

Las únicas entradas autorizadas de recopilación son:
1. Novedades y boletines.
2. Tributario.

No se incorpora ninguna web externa. El contenido DIAN enlazado desde estas
entradas se considera contenido derivado de las mismas fuentes oficiales.
"""
import sys
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup

DOMINIO = "normograma.dian.gov.co"
PREFIJO = "/dian/compilacion/"
FUENTES_RAIZ = {
    "novedades_boletines": "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html",
    "tributario": "https://normograma.dian.gov.co/dian/compilacion/tributario.html?q=TRIBUTARIO",
}
TIMEOUT = 30
HEADERS = {
    "User-Agent": "EUCLIDIAN/1.0 (validador fuentes DIAN)",
    "Accept-Language": "es-CO,es;q=0.9",
}

def cargar(session, url):
    r = session.get(url, timeout=TIMEOUT, headers=HEADERS, allow_redirects=True)
    r.raise_for_status()
    r.encoding = r.apparent_encoding or "utf-8"
    return r.text, r.url

def es_contenido_dian(url):
    p = urlparse(url)
    return p.scheme == "https" and p.netloc == DOMINIO and p.path.startswith(PREFIJO)

def main():
    print("Validando exactamente las 2 fuentes raíz oficiales DIAN...")
    s = requests.Session()
    s.headers.update(HEADERS)
    for nombre, raiz in FUENTES_RAIZ.items():
        html, final = cargar(s, raiz)
        if not es_contenido_dian(final):
            raise RuntimeError(f"Redirección fuera del Normograma DIAN: {final}")
        texto = BeautifulSoup(html, "html.parser").get_text(" ", strip=True).lower()
        if "compilación jurídica dian" not in texto and "compilacion juridica dian" not in texto:
            raise RuntimeError(f"La raíz no se identifica como Compilación Jurídica DIAN: {raiz}")
        print(f"  OK fuente raíz {nombre}: {raiz}")
    print("FUENTES_DIAN_OK: 2 fuentes raíz autorizadas")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FUENTES_DIAN_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
