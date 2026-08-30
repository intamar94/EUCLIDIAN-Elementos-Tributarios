"""EUCLIDIAN — reparación segura de fechas con evidencia DIAN.

Solo corrige fechas sospechosas cuando la página oficial enlazada contiene
una fecha de documento inequívoca para el año del identificador. Nunca usa
fuentes externas ni inventa fechas.
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
    for x in soup(["script", "style", "nav", "footer"]):
        x.decompose()
    return re.sub(r"\s+", " ", soup.get_text(" ", strip=True)), r.url


def expected_year(identifier):
    years = re.findall(r"(?:19|20)\d{2}", identifier or "")
    return int(years[-1]) if years else None


def candidates(text, year):
    """Find document dates in common DIAN header/date syntaxes.

    The search is intentionally limited to the beginning of the official page,
    where the document heading and date are located. This avoids accidentally
    selecting dates mentioned later in the legal text.
    """
    if not year:
        return []
    head = text[:3500]
    months = "|".join(MESES)
    patterns = [
        rf"\b{year}\b\s*\(?\s*({months})\s+(\d{{1,2}})\s*\)?",
        rf"\b({months})\s+(\d{{1,2}})\s+(?:de\s+)?{year}\b",
        rf"\b(\d{{1,2}})\s+de\s+({months})\s+de\s+{year}\b",
        rf"\b(\d{{1,2}})\s+({months})\s+{year}\b",
        rf"\(({months})\s+(\d{{1,2}})\s*(?:de\s+)?{year}\)?\)",
    ]
    out = set()
    for pat in patterns:
        for m in re.finditer(pat, head, re.I):
            groups = m.groups()
            month = next((g.lower() for g in groups if g and g.lower() in MESES), None)
            day = next((g for g in groups if g and g.isdigit() and 1 <= int(g) <= 31), None)
            if month and day:
                try:
                    out.add(date(year, MESES[month], int(day)).isoformat())
                except ValueError:
                    pass
    return sorted(out)


def main():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    session = requests.Session()
    rows = (db.table("documentos_tributarios")
              .select("id,numero_resolucion,fecha_publicacion,fecha_es_real,enlace_oficial")
              .not_.is_("enlace_oficial", "null").execute().data or [])
    reparados = 0
    for row in rows:
        current = str(row.get("fecha_publicacion") or "")
        suspicious = (not row.get("fecha_es_real") or current > date.today().isoformat())
        if not suspicious:
            continue
        try:
            text, _ = text_of(session, row["enlace_oficial"])
            year = expected_year(row.get("numero_resolucion") or "")
            found = candidates(text, year)
            if len(found) != 1:
                log.warning("SIN_REPARACION %s: candidatos=%s", row.get("numero_resolucion"), found)
                continue
            new_date = found[0]
            result = (db.table("documentos_tributarios")
                      .update({"fecha_publicacion": new_date, "fecha_es_real": True})
                      .eq("id", row["id"])
                      .eq("numero_resolucion", row["numero_resolucion"])
                      .execute())
            if result.data:
                reparados += 1
                log.info("REPARADO %s: %s -> %s", row["numero_resolucion"], current, new_date)
        except Exception as exc:
            log.warning("NO_REPARADO %s: %s", row.get("numero_resolucion"), str(exc)[:140])
    log.info("RESUMEN reparados=%d", reparados)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
