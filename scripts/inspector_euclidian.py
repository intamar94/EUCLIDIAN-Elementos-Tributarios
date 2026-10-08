"""Inspector periódico: universo completo, resultados por registro y casos DIAN.

El barrido estructural cubre cada fila. La comprobación HTTP de enlaces se
distribuye por días para no sobrecargar el Normograma; los casos centinela y
las publicaciones recientes se consultan en cada ejecución.
"""
import argparse
import logging
import os
import re
import sys
import unicodedata
from collections import Counter, defaultdict
from concurrent.futures import ThreadPoolExecutor
from datetime import date, datetime, timedelta, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client

LOG = logging.getLogger("inspector")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
PAGE = 400
OFFICIAL_HOST = "normograma.dian.gov.co"
OFFICIAL_PATH = "/dian/compilacion/"
FIELDS = "id,numero_resolucion,tipo_documento,titulo,descripcion_limpia,resumen_humano,resumen_borrador,enlace_oficial,fecha_publicacion,fecha_publicacion_web,fecha_es_real,anio_publicacion,publicado_cliente,problema_juridico,tesis_juridica,fuentes_formales,plazos_mencionados,tiene_efectos_retroactivos,anos_afectados,zonas_afectadas,estado_vigencia,created_at,notas_verificacion"
CASES = (
    ("IVA: cambio de responsable", "oficio_dian_15660_2026.htm", True),
    ("SIMPLE: varias actividades", "oficio_dian_15659_2026.htm", True),
    ("Firma de correcciones", "oficio_dian_15661_2026.htm", True),
    ("Emergencia: alcance y plazos", "decreto_1419_2026.htm", False),
    ("MAP: documento reciente", "oficio_dian_16346_2026.htm", False),
)
MONTHS = {"enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
          "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
          "noviembre": 11, "diciembre": 12}


def norm(value):
    return unicodedata.normalize("NFKD", str(value or "")).encode("ascii", "ignore").decode().lower()


def official_url(value):
    p = urlparse(str(value or ""))
    return p.scheme == "https" and p.netloc == OFFICIAL_HOST and p.path.startswith(OFFICIAL_PATH)


def trusted_bulletin(row):
    url = str(row.get("enlace_oficial") or "")
    p = urlparse(url)
    notes = str(row.get("notas_verificacion") or "")
    return (row.get("tipo_documento") == "boletin" and p.scheme == "https"
            and p.netloc == "www.dian.gov.co"
            and p.path.startswith("/normatividad/Publicaciones-Juridicas/")
            and p.path.lower().endswith(".pdf")
            and "raiz: https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html" in notes
            and f"URL verificada: {url}" in notes)


def trusted_source(row):
    return official_url(row.get("enlace_oficial")) or trusted_bulletin(row)


def issue(code, severity, detail):
    return {"codigo": code, "nivel": severity, "detalle": detail}


def doc_year(value):
    years = re.findall(r"(?:19|20)\d{2}", str(value or ""))
    return int(years[-1]) if years else None


def canonical_identity(row):
    p = urlparse(row.get("enlace_oficial") or "")
    name = p.path.rsplit("/", 1)[-1].lower()
    m = re.fullmatch(r"([a-z_]+)_(\d+)_(\d{4})\.htm", name)
    if m:
        return (m.group(1), int(m.group(2)), int(m.group(3)))
    return None


def inspect_row(row, today):
    found = []
    number = row.get("numero_resolucion") or ""
    if not number or not row.get("titulo"):
        found.append(issue("identificacion", "critico", "Falta número o título."))
    url = row.get("enlace_oficial") or ""
    if not trusted_source(row):
        found.append(issue("fuente", "critico", "Falta una fuente DIAN permitida o su trazabilidad desde novedades."))
    doc_date = row.get("fecha_publicacion")
    web_date = row.get("fecha_publicacion_web")
    if row.get("fecha_es_real") and not doc_date:
        found.append(issue("fecha_sin_valor", "critico", "Fecha marcada como exacta sin valor."))
    for label, value in (("documento", doc_date), ("publicación web", web_date)):
        if value and (str(value) < "1900-01-01" or str(value) > today.isoformat()):
            found.append(issue("fecha_imposible", "critico", f"Fecha futura o imposible de {label}: {value}."))
    if doc_date and web_date and str(web_date) < str(doc_date):
        found.append(issue("orden_fechas", "critico", "La publicación web precede la fecha del documento."))
    identifier_year = doc_year(number)
    if row.get("fecha_es_real") and doc_date and identifier_year and abs(identifier_year - int(str(doc_date)[:4])) > 1:
        found.append(issue("anio_incoherente", "aviso", "El año de la fecha difiere del identificador."))
    if row.get("publicado_cliente"):
        summary = row.get("resumen_humano") or row.get("resumen_borrador") or row.get("descripcion_limpia") or ""
        if len(summary.strip()) < 80:
            found.append(issue("ficha_escasa", "aviso", "La síntesis visible no explica suficientemente el documento."))
        if not row.get("fecha_es_real") and not web_date:
            found.append(issue("fecha_no_verificada", "aviso", "No hay fecha exacta comprobada."))
    if row.get("tiene_efectos_retroactivos") and not row.get("anos_afectados"):
        found.append(issue("retroactividad_sin_periodo", "aviso", "La alerta no identifica el período afectado."))
    # Estos campos se reinspeccionan incluso durante la cuarentena: ocultar
    # temporalmente una ficha no puede hacer desaparecer el motivo del control.
    for deadline in row.get("plazos_mencionados") or []:
        text = str(deadline).strip()
        if text and (len(text) >= 95 and not re.search(r"[.!?]$", text) or re.search(r"\b(?:de|del|el|la|los|las|para|por|podr)\s*$", norm(text))):
            found.append(issue("plazo_cortado", "critico", "Un plazo parece estar truncado."))
            break
    for source in row.get("fuentes_formales") or []:
        if len(str(source).strip()) < 5 or norm(source).strip() in ("articulo", "articulos"):
            found.append(issue("cita_incompleta", "aviso", "Hay una fuente jurídica incompleta."))
            break
    return found


def source_text(session, url):
    response = session.get(url, timeout=20, allow_redirects=True)
    response.raise_for_status()
    if not official_url(response.url):
        raise ValueError("La fuente redirigió fuera del Normograma DIAN")
    soup = BeautifulSoup(response.content, "html.parser")
    for tag in soup(["script", "style", "nav", "footer"]):
        tag.decompose()
    return " ".join(soup.get_text(" ", strip=True).split())


def check_link(doc):
    try:
        if trusted_bulletin(doc):
            with requests.get(doc["enlace_oficial"], timeout=20, allow_redirects=True, stream=True) as response:
                response.raise_for_status()
                p = urlparse(response.url)
                response.raw.decode_content = True
                if p.scheme != "https" or p.netloc != "www.dian.gov.co" or response.raw.read(4) != b"%PDF":
                    raise ValueError("El boletín no devuelve un PDF del dominio DIAN")
        else:
            text = source_text(requests, doc["enlace_oficial"])
            if "compilacion juridica" not in norm(text[:500]):
                raise ValueError("La página no se identifica como Compilación Jurídica DIAN")
        return doc, None
    except Exception as exc:
        return doc, str(exc)[:120]


def quarantine_published(db, rows, ids):
    """Retira hallazgos bloqueantes antes de que termine la inspección."""
    published = {row["id"] for row in rows if row.get("publicado_cliente")}
    targets = sorted(set(ids) & published)
    for start in range(0, len(targets), PAGE):
        db.table("documentos_tributarios").update({
            "publicado_cliente": False,
            "aprobado_para_email": False,
            "revisado_fiscal_en": None,
        }).in_("id", targets[start:start + PAGE]).execute()
    if targets:
        LOG.warning("Cuarentena inmediata: %s fichas publicadas con hallazgo bloqueante", len(targets))
    return len(targets)


def source_dates(text):
    normal = norm(text[:1800])
    result = {}
    document = re.search(r"\((?:\w+\s+)?([a-z]+)\s+(\d{1,2})\)\s*<fuente", normal)
    if document:
        month = MONTHS.get(document.group(1))
        year = re.search(r"\b(?:19|20)\d{2}\b", normal[:document.start()])
        if month and year:
            result["documento"] = f"{year.group()}-{month:02d}-{int(document.group(2)):02d}"
    published = re.search(r"publicado en la pagina web de la dian:\s*(\d{1,2}) de ([a-z]+) de ((?:19|20)\d{2})", normal)
    if published and MONTHS.get(published.group(2)):
        result["web"] = f"{published.group(3)}-{MONTHS[published.group(2)]:02d}-{int(published.group(1)):02d}"
    return result


def inspect_case(session, label, suffix, expects_thesis, rows):
    identity = canonical_identity({"enlace_oficial": OFFICIAL_PATH + "docs/" + suffix})
    matches = [d for d in rows if canonical_identity(d) == identity]
    case = {"nombre": label, "documentos": len(matches), "hallazgos": [], "codigos": []}
    if not matches:
        case["hallazgos"].append("No se encontró la ficha en la biblioteca.")
        case["codigos"].append("registro_centinal")
        case["estado"] = "fallo"
        return case
    if len(matches) > 1:
        case["hallazgos"].append("El documento aparece duplicado.")
        case["codigos"].append("duplicado")
    canonical = next((d for d in matches if (d.get("enlace_oficial") or "").endswith(suffix)), matches[0])
    case["documento_id"] = canonical["id"]
    case["fuente"] = canonical.get("enlace_oficial")
    try:
        text = source_text(session, canonical["enlace_oficial"])
    except Exception as exc:
        case["hallazgos"].append(f"No se pudo leer la fuente: {str(exc)[:120]}")
        case["codigos"].append("fuente_centinal")
        case["estado"] = "fallo"
        return case
    dates = source_dates(text)
    if dates.get("documento") and str(canonical.get("fecha_publicacion") or "") != dates["documento"]:
        case["hallazgos"].append(f"Fecha del documento: ficha {canonical.get('fecha_publicacion')}; DIAN {dates['documento']}.")
        case["codigos"].append("fecha_centinal")
    if dates.get("web") and str(canonical.get("fecha_publicacion_web") or "") != dates["web"]:
        case["hallazgos"].append(f"Fecha web: ficha {canonical.get('fecha_publicacion_web')}; DIAN {dates['web']}.")
        case["codigos"].append("fecha_web_centinal")
    if expects_thesis and (not canonical.get("tesis_juridica") or not canonical.get("problema_juridico")):
        case["hallazgos"].append("La pregunta o la respuesta central no están estructuradas en la ficha.")
        case["codigos"].append("pregunta_respuesta_centinal")
    if suffix.startswith("oficio_dian_15659"):
        formal = " ".join(canonical.get("fuentes_formales") or [])
        source_section = norm(text.split("Fuentes Formales", 1)[-1].split("Extracto", 1)[0])
        missing = [n for n in ("903", "904", "907", "908", "910")
                   if re.search(rf"\b{n}\b", source_section) and not re.search(rf"\b{n}\b", norm(formal))]
        if missing:
            case["hallazgos"].append("Faltan artículos de las fuentes formales DIAN: " + ", ".join(missing) + ".")
            case["codigos"].append("cita_centinal")
    if suffix.startswith("decreto_1419"):
        if "valle del cauca" in norm(text) and "valle del cauca" not in norm(" ".join(canonical.get("zonas_afectadas") or [])):
            case["hallazgos"].append("Falta Valle del Cauca en las zonas mencionadas por la fuente DIAN.")
            case["codigos"].append("zona_centinal")
        if len(canonical.get("zonas_afectadas") or []) < 10:
            case["hallazgos"].append("El ámbito territorial necesita revisión por artículo y municipio.")
            case["codigos"].append("ambito_centinal")
        if any(len(str(p)) >= 95 for p in canonical.get("plazos_mencionados") or []):
            case["hallazgos"].append("Hay plazos recortados que requieren contexto y artículo.")
            case["codigos"].append("plazo_centinal")
    case["codigos"] = sorted(set(case["codigos"]))
    case["estado"] = "fallo" if case["hallazgos"] else "correcto"
    return case


def run(link_sample=500, persist=True):
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    session = requests.Session()
    session.headers.update({"User-Agent": "EUCLIDIAN-Inspector/1.0", "Accept-Language": "es-CO,es;q=0.9"})
    run_id = None
    now = datetime.now(timezone.utc)
    if persist:
        created = db.table("inspector_ejecuciones").insert({"estado": "en_curso", "iniciado_en": now.isoformat()}).execute().data
        run_id = created[0]["id"]
    try:
        expected = db.table("documentos_tributarios").select("id", count="exact").limit(1).execute().count
        if expected is None:
            raise RuntimeError("No se pudo obtener el tamaño del universo")
        all_rows, count, reasons = [], Counter(), Counter()
        offset = 0
        today = date.today()
        while offset < expected:
            rows = db.table("documentos_tributarios").select(FIELDS).order("id").range(offset, offset + PAGE - 1).execute().data or []
            if not rows:
                raise RuntimeError(f"Paginación incompleta en el registro {offset} de {expected}")
            all_rows.extend(rows)
            offset += len(rows)
            if len(all_rows) % 2000 < PAGE:
                LOG.info("Barrido estructural: %s/%s", len(all_rows), expected)
        if len(all_rows) != expected or len({d["id"] for d in all_rows}) != expected:
            raise RuntimeError(f"Cobertura incompleta: {len(all_rows)} filas de {expected}")
        by_identity = defaultdict(list)
        for row in all_rows:
            identity = canonical_identity(row)
            if identity:
                by_identity[identity].append(row["id"])
        results = []
        for row in all_rows:
            issues = inspect_row(row, today)
            identity = canonical_identity(row)
            if identity and len(by_identity[identity]) > 1:
                issues.append(issue("duplicado", "critico", "Hay otro registro con el mismo tipo, número y año."))
            for item in issues:
                reasons[item["codigo"]] += 1
            level = "critico" if any(x["nivel"] == "critico" for x in issues) else "aviso" if issues else "correcto"
            count[level] += 1
            results.append({"documento_id": row["id"], "ejecucion_id": run_id, "estado": level, "hallazgos": issues,
                            "verificado_en": now.isoformat()})
        for start in range(0, len(results), PAGE):
            if persist:
                db.table("inspector_resultados").upsert(results[start:start + PAGE], on_conflict="ejecucion_id,documento_id").execute()
        quarantined = set()
        critical = {row["id"] for row, result in zip(all_rows, results)
                    if row.get("publicado_cliente") and result["estado"] == "critico"}
        if persist and critical:
            quarantine_published(db, all_rows, critical)
            quarantined.update(critical)
        cases = [inspect_case(session, *definition, all_rows) for definition in CASES]
        sentinel_failures = {case["documento_id"] for case in cases
                             if case.get("estado") == "fallo" and case.get("documento_id")}
        if persist and sentinel_failures:
            quarantine_published(db, all_rows, sentinel_failures - quarantined)
            quarantined.update(sentinel_failures)
        # La red se muestrea por rotación; nunca se presenta como validación HTTP total.
        candidates = [d for d in all_rows if trusted_source(d)]
        candidates.sort(key=lambda d: d["id"])
        sample_size = min(max(0, link_sample), len(candidates))
        start = (today.toordinal() * max(sample_size, 1)) % max(len(candidates), 1)
        network = {"revisados": 0, "rotos": 0, "muestra": [], "fallidos": []}
        selected = [candidates[(start + index) % len(candidates)] for index in range(sample_size)]
        recent_cutoff = (today - timedelta(days=14)).isoformat()
        recent = [d for d in candidates if max(str(d.get("fecha_publicacion_web") or ""),
                                                  str(d.get("fecha_publicacion") or ""),
                                                  str(d.get("created_at") or "")[:10]) >= recent_cutoff]
        # Novedades: prioridad diaria. Históricos: rotación de todo el archivo.
        by_id = {d["id"]: d for d in selected}
        by_id.update({d["id"]: d for d in recent})
        selected = list(by_id.values())
        with ThreadPoolExecutor(max_workers=4) as pool:
          for doc, error in pool.map(check_link, selected):
            if error:
                network["rotos"] += 1
                failure = {"id": doc["id"], "numero": doc.get("numero_resolucion"), "motivo": error}
                network["fallidos"].append(failure)
                if len(network["muestra"]) < 30:
                    network["muestra"].append(failure)
            network["revisados"] += 1
        broken_ids = {item["id"] for item in network["fallidos"]}
        if persist and broken_ids:
            quarantine_published(db, all_rows, broken_ids - quarantined)
        status = "alerta" if count["critico"] or any(c["estado"] == "fallo" for c in cases) or network["rotos"] else "correcto"
        payload = {"estado": status, "finalizado_en": datetime.now(timezone.utc).isoformat(), "total": expected,
                   "revisados": len(all_rows), "criticos": count["critico"], "avisos": count["aviso"],
                   "correctos": count["correcto"], "motivos": dict(reasons), "casos": cases, "enlaces": network}
        if persist:
            db.table("inspector_ejecuciones").update(payload).eq("id", run_id).execute()
        LOG.info("Inspector %s: %s/%s registros, %s críticos, %s avisos, %s enlaces revisados, %s rotos",
                 status, len(all_rows), expected, count["critico"], count["aviso"], network["revisados"], network["rotos"])
        return payload
    except Exception as exc:
        if persist and run_id:
            db.table("inspector_ejecuciones").update({"estado": "fallo", "finalizado_en": datetime.now(timezone.utc).isoformat(),
                                                        "error": str(exc)[:500]}).eq("id", run_id).execute()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--enlaces", type=int, default=500)
    parser.add_argument("--sin-guardar", action="store_true")
    args = parser.parse_args()
    try:
        result = run(args.enlaces, not args.sin_guardar)
        # Hallazgos documentales son trabajo para el ciclo de control, no un
        # fallo técnico de cobertura. El estado alerta queda en la base.
        sys.exit(0)
    except Exception as exc:
        LOG.error("Inspector bloqueado: %s", exc)
        sys.exit(2)
