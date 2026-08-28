"""EUCLIDIAN — verificador de alta confianza, paginado y con evidencia.

Principios:
- Solo Normograma DIAN y solo las dos fuentes raíz autorizadas.
- Procesa todo el conjunto por páginas; nunca asume que 300 registros son el universo.
- Nunca convierte una fecha sintética en fecha real.
- La evidencia tolera formatos equivalentes (p. ej. 2026-08-15 / 15 de agosto de 2026)
  pero siempre exige que el dato sea demostrable en la fuente oficial.
- Por defecto es AUDITORÍA. Para escribir en Supabase hay que pasar --apply.
"""
import argparse, logging, os, re, unicodedata
from datetime import date
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from validar_fuentes_dian import FUENTES_RAIZ, TIMEOUT

log = logging.getLogger("euclidian.aprobacion")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
DOMINIO = "normograma.dian.gov.co"
PREFIJO = "/dian/compilacion/"
PAGE = 500
MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
STOP = {"para","como","desde","entre","sobre","esta","este","debe","puede","segun","cuando","donde","hace","solo","tambien","una","uno","los","las","del","por","con","que","sus"}


def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()


def words(s):
    return {x for x in re.findall(r"[a-z0-9]{4,}", norm(s)) if x not in STOP}


def date_candidates(value):
    """Representaciones equivalentes de una fecha sin inferir una fecha nueva."""
    s = str(value or "").strip()
    if not s:
        return set()
    out = {norm(s)}
    m = re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})", s)
    if m:
        y, mo, d = map(int, m.groups())
        meses = list(MESES)
        if 1 <= mo <= 12:
            out.add(norm(f"{d} de {meses[mo-1]} de {y}"))
            out.add(norm(f"{d}/{mo:02d}/{y}"))
            out.add(norm(f"{d:02d}/{mo:02d}/{y}"))
    return out


def evidence(source_text, value):
    """True solo cuando el valor, o una representación exacta equivalente, aparece."""
    src = norm(source_text)
    if not src or value in (None, "", []):
        return False
    candidates = date_candidates(value)
    if not candidates:
        candidates = {norm(value)}
    for candidate in candidates:
        if candidate and candidate in src:
            return True
    # Para valores textuales: coincidencia completa; no usamos similitud difusa.
    compact_src = re.sub(r"[^a-z0-9/]", "", src)
    for candidate in candidates:
        compact = re.sub(r"[^a-z0-9/]", "", candidate)
        if len(compact) >= 6 and compact in compact_src:
            return True
    return False


def load(session, url):
    r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    for x in soup(["script", "style", "nav", "footer"]):
        x.decompose()
    return soup, norm(soup.get_text(" ", strip=True)), r.url


def validate_sources(session):
    for name, url in FUENTES_RAIZ.items():
        _, text, final = load(session, url)
        p = urlparse(final)
        if p.netloc != DOMINIO or not p.path.startswith(PREFIJO):
            raise RuntimeError(f"Fuente raíz fuera del Normograma: {final}")
        if "normograma" not in text and "compilacion juridica dian" not in text:
            raise RuntimeError(f"La fuente raíz no se identifica como DIAN: {url}")
        log.info("Fuente raíz OK: %s", name)


def check_summary(source_text, summary):
    sentences = [x.strip() for x in re.split(r"[.!?;]\s+", str(summary or "")) if len(x.strip()) >= 20]
    if not sentences:
        return False, ["No hay afirmaciones verificables en el resumen."]
    src = norm(source_text)
    errors = []
    for i, sentence in enumerate(sentences, 1):
        ws = words(sentence)
        if ws:
            ratio = len(ws.intersection(words(src))) / len(ws)
            if ratio < 0.60:
                errors.append(f"Afirmación {i}: evidencia textual insuficiente ({ratio:.0%}).")
        # Los números se comparan también con formatos de fecha equivalentes.
        for number in re.findall(r"\b\d+(?:[.,]\d+)?%?|\b(?:19|20)\d{2}\b", norm(sentence)):
            if number not in src:
                errors.append(f"Afirmación {i}: el dato '{number}' no aparece en la fuente.")
    return not errors, errors


def verify(session, doc):
    errors = []
    url = str(doc.get("enlace_oficial") or "")
    parsed = urlparse(url)
    if parsed.scheme != "https" or parsed.netloc != DOMINIO or not parsed.path.startswith(PREFIJO):
        return False, ["Enlace fuera de la fuente oficial permitida."]
    try:
        _, source, final = load(session, url)
    except Exception as exc:
        return False, [f"No se pudo leer la fuente oficial: {str(exc)[:150]}"]
    fp = urlparse(final)
    if fp.scheme != "https" or fp.netloc != DOMINIO or not fp.path.startswith(PREFIJO):
        return False, ["La fuente redirige fuera del Normograma DIAN."]
    if "normograma" not in source and "compilacion juridica dian" not in source:
        errors.append("La página no se identifica como Normograma DIAN.")

    number = norm(doc.get("numero_resolucion"))
    digits = re.findall(r"\d{3,9}", number)
    if digits and not any(n in source for n in digits):
        errors.append("El número del documento no aparece en la fuente.")

    if not doc.get("fecha_es_real") or str(doc.get("fecha_publicacion") or "").endswith("-01-01") and not evidence(source, doc.get("fecha_publicacion")):
        errors.append("La fecha de publicación no tiene evidencia fuerte.")
    elif not evidence(source, doc.get("fecha_publicacion")):
        errors.append("La fecha de publicación no aparece en formato demostrable.")

    summary = doc.get("resumen_humano") or doc.get("resumen_borrador") or doc.get("descripcion_limpia") or ""
    ok, ev = check_summary(source, summary)
    errors.extend(ev)

    thesis = str(doc.get("tesis_juridica") or "").strip()
    if thesis and len(thesis) >= 25:
        tw = words(thesis)
        if not tw or len(tw.intersection(words(source))) / len(tw) < 0.60:
            errors.append("La tesis jurídica no tiene suficiente respaldo textual.")

    # Campos críticos solo se aceptan cuando están presentes y demostrados.
    for label, value in (("entidad emisora", doc.get("entidad_emisora")),
                         ("estado de vigencia", doc.get("estado_vigencia"))):
        if value and not evidence(source, value):
            errors.append(f"El campo {label} no tiene evidencia textual suficiente.")
    return not errors and ok, errors


def iter_docs(db, limit=None):
    """Paginación determinista. limit=None significa TODO el universo."""
    offset = 0
    seen = set()
    while True:
        size = PAGE if limit is None else min(PAGE, max(0, limit - offset))
        if size <= 0:
            return
        rows = (db.table("documentos_tributarios")
                  .select("id,numero_resolucion,contenido,descripcion_limpia,resumen_humano,resumen_borrador,enlace_oficial,fecha_publicacion,fecha_es_real,tesis_juridica,entidad_emisora,estado_vigencia")
                  .not_.is_("resumen_borrador", "null")
                  .order("id", desc=False)
                  .range(offset, offset + size - 1).execute().data or [])
        if not rows:
            return
        for row in rows:
            rid = row.get("id")
            if rid in seen:
                continue
            seen.add(rid)
            yield row
        if len(rows) < size:
            return
        offset += len(rows)


def main(apply=False, limit=None):
    supa_url, supa_key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not supa_url or not supa_key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(supa_url, supa_key)
    session = requests.Session()
    session.headers.update({"User-Agent":"EUCLIDIAN/1.2 (verificador de alta confianza)","Accept-Language":"es-CO,es;q=0.9"})
    validate_sources(session)

    total = good = bad = 0
    reasons = {}
    for doc in iter_docs(db, limit):
        total += 1
        ok, errors = verify(session, doc)
        if ok:
            good += 1
            if apply:
                db.table("documentos_tributarios").update({"aprobado_para_email":True,"borrador_confianza":"alta","borrador_advertencias":[]}).eq("id",doc["id"]).execute()
        else:
            bad += 1
            for e in errors[:5]: reasons[e] = reasons.get(e, 0) + 1
            if apply:
                db.table("documentos_tributarios").update({"aprobado_para_email":False,"borrador_confianza":"no_aprobado","borrador_advertencias":errors[:12]}).eq("id",doc["id"]).execute()
        if total % 100 == 0:
            log.info("PROGRESO revisados=%d aptos=%d bloqueados=%d", total, good, bad)

    mode = "APLICADO" if apply else "AUDITORIA"
    log.info("RESULTADO %s: universo_revisado=%d aptos=%d bloqueados=%d", mode, total, good, bad)
    if reasons:
        log.info("PRINCIPALES_MOTIVOS: %s", sorted(reasons.items(), key=lambda x: -x[1])[:10])
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true", help="Escribe aprobaciones/bloqueos en Supabase. Sin esto solo audita.")
    ap.add_argument("--limite", type=int, default=None, help="Límite opcional para pruebas; por defecto procesa todo.")
    args = ap.parse_args()
    try:
        raise SystemExit(main(args.apply, args.limite))
    except Exception as exc:
        log.error("VERIFICADOR BLOQUEADO: %s", exc)
        raise SystemExit(1)
