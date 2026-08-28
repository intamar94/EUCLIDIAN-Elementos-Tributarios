"""Reparaciones puntuales basadas exclusivamente en evidencia oficial DIAN.

Este script es deliberadamente fail-closed: solo modifica un registro cuando
la página oficial autorizada contiene una fecha inequívoca y coincide con el
documento esperado. No infiere fechas ni corrige lotes completos.
"""
import logging
import os
import re
from datetime import date
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("euclidian.reparacion")
DOMINIO = "normograma.dian.gov.co"
PREFIJO = "/dian/compilacion/"
TARGET = "DIAN-DECRETO-2044-2007"
OFFICIAL_URL = "https://normograma.dian.gov.co/dian/compilacion/docs/decreto_2044_2007.htm"
EXPECTED = date(2007, 6, 5)


def load_source():
    r = requests.get(OFFICIAL_URL, timeout=20, allow_redirects=True,
                     headers={"User-Agent": "EUCLIDIAN/1.0"})
    r.raise_for_status()
    final = urlparse(r.url)
    if final.scheme != "https" or final.netloc != DOMINIO or not final.path.startswith(PREFIJO):
        raise RuntimeError(f"Fuente redirige fuera del Normograma DIAN: {r.url}")
    soup = BeautifulSoup(r.text, "html.parser")
    for x in soup(["script", "style", "nav", "footer"]):
        x.decompose()
    text = re.sub(r"\s+", " ", soup.get_text(" ", strip=True)).lower()
    return text


def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")

    source = load_source()
    required = ["decreto 2044 de 2007", "junio 5", "5 de junio de 2007", "diario oficial no. 46.650"]
    missing = [x for x in required if x not in source]
    if missing:
        raise RuntimeError(f"La fuente oficial no contiene evidencia esperada: {missing}")

    db = create_client(url, key)
    rows = (db.table("documentos_tributarios")
              .select("id,numero_resolucion,fecha_publicacion,fecha_es_real,enlace_oficial")
              .eq("numero_resolucion", TARGET)
              .limit(2).execute().data or [])
    if len(rows) != 1:
        raise RuntimeError(f"Se esperaba exactamente 1 registro para {TARGET}; encontrados={len(rows)}")

    row = rows[0]
    link = row.get("enlace_oficial") or ""
    if link != OFFICIAL_URL:
        raise RuntimeError(f"No se modifica: enlace oficial del registro no coincide exactamente: {link}")

    current = row.get("fecha_publicacion")
    expected = EXPECTED.isoformat()
    if current == expected and row.get("fecha_es_real") is True:
        log.info("YA_CORRECTO %s fecha=%s", TARGET, expected)
        return 0

    result = (db.table("documentos_tributarios")
                .update({"fecha_publicacion": expected, "fecha_es_real": True})
                .eq("id", row["id"])
                .eq("numero_resolucion", TARGET)
                .execute())
    if not result.data:
        raise RuntimeError("La actualización no devolvió el registro modificado")

    updated = result.data[0]
    if updated.get("fecha_publicacion") != expected or updated.get("fecha_es_real") is not True:
        raise RuntimeError("Verificación posterior a la actualización falló")
    log.info("REPARADO %s: %s -> %s; fecha_es_real=true", TARGET, current, expected)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
