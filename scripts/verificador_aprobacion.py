"""EUCLIDIAN — filtro automático de aprobación de alta confianza.

Solo aprueba información demostrable desde las dos entradas oficiales DIAN y
sus subpáginas tributarias oficiales. Ante cualquier duda, NO APRUEBA.
"""
import argparse
import logging
import os
import re
import unicodedata
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client
from validar_fuentes_dian import FUENTES_RAIZ, INDICES_ESPERADOS, TIMEOUT

log = logging.getLogger("euclidian.aprobacion")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
DOMINIO = "normograma.dian.gov.co"
STOP = {"para","como","desde","entre","sobre","esta","este","debe","puede","segun","cuando","donde","hace","solo","tambien","una","uno","los","las","del","por","con","que","sus"}

def norm(s):
    s = unicodedata.normalize("NFKD", str(s or "")).encode("ascii", "ignore").decode().lower()
    return re.sub(r"\s+", " ", s).strip()

def words(s):
    return {x for x in re.findall(r"[a-z0-9]{4,}", norm(s)) if x not in STOP}

def load(session, url):
    r = session.get(url, timeout=TIMEOUT, allow_redirects=True)
    r.raise_for_status()
    soup = BeautifulSoup(r.text, "html.parser")
    return soup, norm(soup.get_text(" ", strip=True)), r.url

def validate_sources(session):
    """Validate the two roots and only their current official subpages."""
    for name, url in FUENTES_RAIZ.items():
        _, text, final = load(session, url)
        p = urlparse(final)
        if p.netloc != DOMINIO or not p.path.startswith("/dian/compilacion/"):
            raise RuntimeError(f"Fuente raíz fuera del Normograma: {final}")
        if "normograma" not in text and "compilacion juridica dian" not in text:
            raise RuntimeError(f"La fuente raíz no se identifica como DIAN: {url}")
        log.info("Fuente raíz OK: %s", name)
    for filename, (root, url) in INDICES_ESPERADOS.items():
        _, text, final = load(session, url)
        p = urlparse(final)
        if p.netloc != DOMINIO or not p.path.startswith("/dian/compilacion/"):
            raise RuntimeError(f"Subfuente fuera del Normograma: {final}")
        if "normograma" not in text and "compilacion juridica dian" not in text:
            raise RuntimeError(f"Subfuente no identificada como DIAN: {url}")
        log.info("Subfuente OK: %s <- %s", filename, root)
    return True

def check_summary(source_text, summary):
    """Extractive evidence gate; no semantic inference."""
    src = norm(source_text)
    sentences = [x.strip() for x in re.split(r"[.!?;]\s+", str(summary or "")) if len(x.strip()) >= 20]
    if not sentences:
        return False, ["No hay afirmaciones verificables en el resumen."]
    errors = []
    for i, sentence in enumerate(sentences, 1):
        ws = words(sentence)
        if ws:
            ratio = sum(1 for w in ws if w in src) / len(ws)
            if ratio < 0.60:
                errors.append(f"Afirmación {i}: evidencia textual insuficiente ({ratio:.0%}).")
        for number in re.findall(r"\b\d+(?:[.,]\d+)?%?|\b(?:19|20)\d{2}\b", norm(sentence)):
            if number not in src:
                errors.append(f"Afirmación {i}: el dato '{number}' no aparece en la fuente.")
    return not errors, errors

def verify(session, doc):
    errors = []
    url = str(doc.get("enlace_oficial") or "")
    parsed = urlparse(url)
    if parsed.netloc != DOMINIO or not parsed.path.startswith("/dian/compilacion/"):
        return False, ["Enlace fuera de la fuente oficial permitida."]
    try:
        _, source, final = load(session, url)
    except Exception as exc:
        return False, [f"No se pudo leer la fuente oficial: {str(exc)[:150]}"]
    if urlparse(final).netloc != DOMINIO or not urlparse(final).path.startswith("/dian/compilacion/"):
        return False, ["La fuente redirige fuera del Normograma DIAN."]
    if "normograma" not in source and "compilacion juridica dian" not in source:
        errors.append("La página no se identifica como Normograma DIAN.")
    number = norm(doc.get("numero_resolucion"))
    digits = re.findall(r"\d{3,9}", number)
    if digits and not any(n in source for n in digits):
        errors.append("El número del documento no aparece en la fuente.")
    if not doc.get("fecha_es_real"):
        errors.append("La fecha todavía no tiene validación fuerte.")
    summary = doc.get("resumen_humano") or doc.get("resumen_borrador") or doc.get("descripcion_limpia") or ""
    ok, ev = check_summary(source, summary)
    errors.extend(ev)
    thesis = str(doc.get("tesis_juridica") or "").strip()
    if thesis and len(thesis) >= 25:
        tw = words(thesis)
        if not tw or len(tw.intersection(words(source))) / len(tw) < 0.60:
            errors.append("La tesis jurídica no tiene suficiente respaldo textual.")
    return not errors and ok, errors

def main(auto=False, limit=300):
    supa_url = os.getenv("SUPABASE_URL")
    supa_key = os.getenv("SUPABASE_SERVICE_KEY")
    if not supa_url or not supa_key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(supa_url, supa_key)
    session = requests.Session()
    session.headers.update({"User-Agent":"EUCLIDIAN/1.0 (verificador de alta confianza)","Accept-Language":"es-CO,es;q=0.9"})
    log.info("Validando las dos fuentes raíz...")
    validate_sources(session)
    rows = db.table("documentos_tributarios").select("id,numero_resolucion,contenido,descripcion_limpia,resumen_humano,resumen_borrador,enlace_oficial,fecha_publicacion,fecha_es_real,tesis_juridica").not_.is_("resumen_borrador","null").order("fecha_publicacion", desc=True).limit(limit).execute().data or []
    good = bad = 0
    for doc in rows:
        ok, errors = verify(session, doc)
        if ok:
            good += 1
            if auto:
                db.table("documentos_tributarios").update({"aprobado_para_email":True,"borrador_confianza":"alta","borrador_advertencias":[]}).eq("id",doc["id"]).execute()
            log.info("APROBADO %s", doc.get("numero_resolucion"))
        else:
            bad += 1
            db.table("documentos_tributarios").update({"aprobado_para_email":False,"borrador_confianza":"no_aprobado","borrador_advertencias":errors[:12]}).eq("id",doc["id"]).execute()
            log.warning("NO APROBADO %s: %s", doc.get("numero_resolucion"), " | ".join(errors[:3]))
    log.info("RESULTADO: aprobados=%d rechazados=%d", good, bad)
    return 0 if bad == 0 else 1

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--auto-aprobar", action="store_true")
    ap.add_argument("--limite", type=int, default=300)
    args = ap.parse_args()
    try:
        raise SystemExit(main(args.auto_aprobar, args.limite))
    except Exception as exc:
        log.error("VERIFICADOR BLOQUEADO: %s", exc)
        raise SystemExit(1)
