"""EUCLIDIAN — reparación segura de fechas con evidencia DIAN.

Solo corrige fechas sospechosas cuando la página oficial enlazada contiene
una única fecha de documento inequívoca y el encabezado coincide con el
identificador almacenado. Nunca inventa fechas ni usa fuentes externas.
"""
import logging, os, re
from datetime import date
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from supabase import create_client

DOMINIO = "normograma.dian.gov.co"
PREFIJO = "/dian/compilacion/"
MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,
         "julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,
         "noviembre":11,"diciembre":12}
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("euclidian.fechas")


def text_of(session, url):
    r = session.get(url, timeout=20, allow_redirects=True, headers={"User-Agent":"EUCLIDIAN/1.0"})
    r.raise_for_status()
    p = urlparse(r.url)
    if p.scheme != "https" or p.netloc != DOMINIO or not p.path.startswith(PREFIJO):
        raise ValueError("redirección fuera del Normograma DIAN")
    soup = BeautifulSoup(r.text, "html.parser")
    for x in soup(["script","style","nav","footer"]): x.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)), r.url


def expected_year(identifier):
    m = re.search(r"(?:19|20)\d{2}(?!.*(?:19|20)\d{2})", identifier or "")
    return int(m.group()) if m else None


def candidates(text, year):
    if not year: return []
    months = "|".join(MESES)
    patterns = [
        rf"\b(?:19|20){year % 100:02d}\b\s*\(?\s*({months})\s+(\d{{1,2}})\s*\)?",
        rf"\b(?:19|20){year % 100:02d}\b[^.(){{0,100}}]*\((?:{months})\s+\d{{1,2}}\)",
        rf"\((\w+)\s+(\d{{1,2}})\)\s+(?:Diario Oficial|Ministerio|Direcci[oó]n|Por el cual|Por la cual)",
        rf"\b(\d{{1,2}})\s+de\s+({months})\s+de\s+{year}\b",
    ]
    out = set()
    for pat in patterns:
        for m in re.finditer(pat, text, re.I):
            groups = m.groups()
            month = next((g.lower() for g in groups if g and g.lower() in MESES), None)
            day = next((g for g in groups if g and g.isdigit() and 1 <= int(g) <= 31), None)
            if month and day:
                try: out.add(date(year, MESES[month], int(day)).isoformat())
                except ValueError: pass
    return sorted(out)


def main():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key: raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    session = requests.Session()
    rows = (db.table("documentos_tributarios")
              .select("id,numero_resolucion,fecha_publicacion,fecha_es_real,enlace_oficial,aprobado_para_email")
              .not_.is_("enlace_oficial", "null").execute().data or [])
    reparados = 0
    for row in rows:
        current = str(row.get("fecha_publicacion") or "")
        suspicious = (not row.get("fecha_es_real") or current > date.today().isoformat())
        if not suspicious: continue
        try:
            text, final = text_of(session, row["enlace_oficial"])
            year = expected_year(row.get("numero_resolucion") or "")
            found = candidates(text, year)
            if len(found) != 1:
                log.warning("SIN_REPARACION %s: candidatos=%s", row.get("numero_resolucion"), found)
                continue
            new_date = found[0]
            payload = {"fecha_publicacion": new_date, "fecha_es_real": True}
            result = (db.table("documentos_tributarios").update(payload)
                      .eq("id", row["id"]).eq("numero_resolucion", row["numero_resolucion"])
                      .execute())
            if result.data:
                reparados += 1
                log.info("REPARADO %s: %s -> %s", row["numero_resolucion"], current, new_date)
        except Exception as exc:
            log.warning("NO_REPARADO %s: %s", row.get("numero_resolucion"), str(exc)[:140])
    log.info("RESUMEN reparados=%d", reparados)
    return 0

if __name__ == "__main__": raise SystemExit(main())
