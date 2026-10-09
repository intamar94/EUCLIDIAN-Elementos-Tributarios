"""EUCLIDIAN — reparación segura de fechas con evidencia DIAN.

Solo corrige fechas sospechosas cuando la página oficial enlazada contiene
una fecha de documento inequívoca para el año del identificador. Nunca usa
fuentes externas ni inventa fechas.
"""
import argparse, logging, os, re, unicodedata
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
    """Only the act heading can establish the document date.

    The Diario Oficial date and dates in legal citations may also occur near
    the beginning of a page; a loose search there misdated historical acts.
    """
    if not year:
        return []
    head = unicodedata.normalize("NFKD", text[:1500]).encode("ascii", "ignore").decode().lower()
    months = "|".join(MESES)
    pat = (rf"\b(?:resolucion|concepto|oficio|circular|decreto|ley)\s+"
           rf"[^()]{{0,110}}?\bde\s+{year}\s*"
           rf"\(\s*({months})\s+(\d{{1,2}})\s*\)")
    out = set()
    for m in re.finditer(pat, head):
        try:
            out.add(date(year, MESES[m.group(1)], int(m.group(2))).isoformat())
        except ValueError:
            pass
    return sorted(out)


def iter_rows(db):
    """Read every row; PostgREST silently caps an unpaged request at 1000."""
    last_id = None
    while True:
        q = (db.table("documentos_tributarios")
             .select("id,numero_resolucion,fecha_publicacion,fecha_es_real,enlace_oficial,notas_verificacion")
             .order("id").limit(1000))
        if last_id:
            q = q.gt("id", last_id)
        batch = q.execute().data or []
        if not batch:
            return
        yield from batch
        last_id = batch[-1]["id"]
        if len(batch) < 1000:
            return


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=250)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()
    if not 1 <= args.limite <= 1000:
        raise SystemExit("--limite debe estar entre 1 y 1000")
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    session = requests.Session()
    rows = [r for r in iter_rows(db) if r.get("enlace_oficial") and
            (not r.get("fecha_es_real") or
             str(r.get("fecha_publicacion") or "") > date.today().isoformat() or
             str(r.get("fecha_publicacion") or "").endswith("-01-01"))]
    # Rotación diaria: los enlaces difíciles no impiden llegar al resto.
    start = date.today().toordinal() * args.limite % len(rows) if rows else 0
    work = (rows[start:] + rows[:start])[:args.limite]
    reparados = sin_cabecera = cotejados = 0
    for row in work:
        current = str(row.get("fecha_publicacion") or "")
        try:
            text, _ = text_of(session, row["enlace_oficial"])
            year = expected_year(row.get("numero_resolucion") or "")
            found = candidates(text, year)
            if len(found) != 1:
                log.warning("SIN_REPARACION %s: candidatos=%s", row.get("numero_resolucion"), found)
                sin_cabecera += 1
                continue
            new_date = found[0]
            if new_date == current and row.get("fecha_es_real") is True:
                continue
            cotejados += 1
            if args.dry_run:
                log.info("CANDIDATO %s: %s -> %s", row["numero_resolucion"], current, new_date)
                continue
            note = (f"Fecha del acto cotejada en encabezado DIAN: {current or 'sin fecha'}"
                    f" -> {new_date}; {row['enlace_oficial']} | "
                    + (row.get("notas_verificacion") or ""))
            update = (db.table("documentos_tributarios")
                      .update({"fecha_publicacion": new_date, "fecha_es_real": True,
                               "notas_verificacion": note[:4000],
                               "publicado_cliente": False,
                               "aprobado_para_email": False,
                               "revisado_fiscal_en": None})
                      .eq("id", row["id"])
                      .eq("numero_resolucion", row["numero_resolucion"]))
            update = (update.eq("fecha_publicacion", current) if current else
                      update.is_("fecha_publicacion", "null"))
            result = update.execute()
            if result.data:
                reparados += 1
                log.info("REPARADO %s: %s -> %s", row["numero_resolucion"], current, new_date)
        except Exception as exc:
            log.warning("NO_REPARADO %s: %s", row.get("numero_resolucion"), str(exc)[:140])
    log.info("RESUMEN universo_sospechoso=%d examinados=%d cotejados=%d reparados=%d sin_cabecera_unica=%d modo=%s",
             len(rows), len(work), cotejados, reparados, sin_cabecera,
             "lectura" if args.dry_run else "aplicar")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
