"""EUCLIDIAN — Revisor Fiscal final, turbo y trazable.

Reevalúa las fichas nuevas o modificadas contra el Normograma DIAN.
Publica solamente versiones verificadas que superan la puerta documental.
La aprobación automática nunca sustituye una revisión humana.
"""
from __future__ import annotations

import argparse
import os
import re
import sys
import threading
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timezone
from pathlib import Path

import requests
from supabase import create_client

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
for _p in (str(ROOT), str(SCRIPTS)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

from scripts.composicion import Composicion
from scripts.verificador_aprobacion import verify
from scripts.sintesis_literal import extraer_literal, literal_presente, PREFIJO_LITERAL, MODELO_LITERAL
from scripts.lectores_dian import Lectores
from scripts.extractor_estructura import ExtractorEstructura
from scripts.inspector_euclidian import inspect_row
from bs4 import BeautifulSoup

RULES_VERSION = "4.3"
DEFAULT_LIMIT = 1000
MAX_LIMIT = 20000
WORKERS = 16
_thread_local = threading.local()


def _texto(v):
    return str(v or "").strip()


def identidad_desde_titulo(titulo_fuente, numero):
    """El archivo oficio_*.htm puede contener un CONCEPTO: manda la fuente."""
    match = re.search(r"(?:^| - )(Concepto|Oficio|Resolución|Circular|Comunicado)\s+0*(\d+)\s+de\s+(\d{4})\b", titulo_fuente, re.I)
    ident = re.search(r"-(\d+)-(\d{4})$", numero)
    if not match or not ident or (int(match[2]),match[3]) != (int(ident[1]),ident[2]):
        return {}
    tipo = match[1].lower().replace('ó','o')
    return {"tipo_documento": tipo, "titulo": titulo_fuente[match.start():].removeprefix(' - ').strip()}


def _session():
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = requests.Session()
        s.headers.update({
            "User-Agent": "EUCLIDIAN-Fiscal-Reviewer/3.9",
            "Accept-Language": "es-CO,es;q=0.9",
            "Connection": "keep-alive",
        })
        _thread_local.session = s
    return s


def preparar_ficha(d: dict) -> dict:
    cambios = {}
    resumen = _texto(d.get("resumen_humano"))
    if not resumen:
        ficha = Composicion().componer(d)
        resumen = _texto(ficha.get("resumen"))
        if resumen:
            cambios["resumen_borrador"] = resumen[:4000]
            cambios["borrador_confianza"] = "pendiente"
            cambios["borrador_advertencias"] = list(ficha.get("advertencias") or [])
    if not _texto(d.get("materia")) and _texto(d.get("banco_datos")):
        cambios["materia"] = _texto(d["banco_datos"])[:40]
    return cambios


def evaluate(d: dict, source_verified: bool = False):
    passed, failed, reasons = [], [], []

    def rule(code, ok, reason, critical=True):
        (passed if ok else failed).append(code)
        if not ok:
            reasons.append(("CRITICAL: " if critical else "") + reason)

    official = bool(_texto(d.get("enlace_oficial")))
    content = bool(_texto(d.get("contenido") or d.get("texto_completo") or d.get("descripcion_limpia") or d.get("resumen_humano")))
    web_date = _texto(d.get("fecha_publicacion_web"))
    doc_date = _texto(d.get("fecha_publicacion"))
    date_ok = bool(web_date) or bool(doc_date)
    validity = _texto(d.get("estado_vigencia")) not in ("", "desconocido")
    classification = bool(_texto(d.get("clasificacion_obligatoriedad")))
    # En normas del índice DIAN, la descripción oficial puede explicar el
    # asunto con más precisión que una etiqueta de materia todavía vacía.
    matter = (bool(_texto(d.get("materia") or d.get("area_derecho") or d.get("banco_datos")))
              or len(_texto(d.get("descripcion_limpia"))) >= 40)
    summary = bool(_texto(d.get("resumen_humano"))) or literal_presente(d.get("texto_completo"), d.get("resumen_borrador"))
    formula = " ".join(_texto(d.get("resumen_humano") or d.get("resumen_borrador")).lower().split())
    specific = not ("doctrina dian: orienta, no obliga" in formula or
                    "te toca si trabajas con" in formula)
    audience = classification

    rule("OFICIAL", official, "Falta enlace oficial DIAN.")
    rule("FECHA_PUBLICACION", date_ok, "No hay fecha de publicación DIAN identificable.")
    rule("CONTENIDO", content, "La ficha no contiene información documental suficiente.")
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.")
    rule("CLASIFICACION", classification, "No está determinada la naturaleza/obligatoriedad del documento.")
    rule("MATERIA", matter, "No hay materia ni descripción documental suficiente.")
    rule("RESUMEN", summary, "La ficha no tiene resumen para el contador.")
    rule("SINTESIS_ESPECIFICA", specific, "La síntesis usa una plantilla temática y no explica el criterio particular de la fuente.")
    rule("A_QUIEN", audience, "No está determinada la naturaleza que permite explicar a quién afecta.")
    rule("EVIDENCIA", source_verified, "La información crítica de la ficha no pudo corroborarse íntegramente contra la fuente oficial accesible.")

    # La inspección guardada puede preceder a esta descarga. Se controlan
    # también los datos actuales antes de intentar la publicación atómica.
    criticals = [x["detalle"] for x in inspect_row(d, datetime.now(timezone.utc).date()) if x["nivel"] == "critico"]
    if criticals:
        rule("INTEGRIDAD_ACTUAL", False, " | ".join(criticals))

    result = "APPROVE" if not failed else "REVIEW"
    score = max(0, round(len(passed) / (len(passed) + len(failed)) * 100))
    return result, score, passed, failed, reasons


def _verify_one(row):
    d = dict(row)
    cambios = {}
    # La lectura actual prepara datos literales antes del contraste independiente.
    # Nunca completa resumen_humano ni revisado_por_humano.
    try:
        url = _texto(d.get("enlace_oficial"))
        from urllib.parse import urlparse
        p = urlparse(url)
        if p.scheme == "https" and p.netloc == "normograma.dian.gov.co" and p.path.startswith("/dian/compilacion/docs/"):
            response = _session().get(url, timeout=20, allow_redirects=True)
            response.raise_for_status()
            final = urlparse(response.url)
            if final.scheme != "https" or final.netloc != p.netloc or not final.path.startswith("/dian/compilacion/docs/"):
                raise ValueError("Redirección fuera de la fuente documental")
            soup = BeautifulSoup(response.content, "html.parser")
            if soup.title:
                identidad = identidad_desde_titulo(soup.title.get_text(' ', strip=True), _texto(d.get('numero_resolucion')))
                cambios.update({k:v for k,v in identidad.items() if v != d.get(k)})
            for tag in soup(["script", "style", "nav", "footer"]):
                tag.decompose()
            texto = soup.get_text("\n", strip=True)[:60000]
            if len(texto) >= 200:
                extraidos = ExtractorEstructura.extraer(Lectores(), texto) or {}
                cambios.update({k:v for k,v in extraidos.items() if v != d.get(k)})
                if texto != d.get("texto_completo"):
                    cambios["texto_completo"] = texto
                    cambios["enriquecido_en"] = datetime.now(timezone.utc).isoformat()
                cita = extraer_literal(response.content)
                if cita and not d.get("resumen_humano") and literal_presente(texto, cita):
                    cambios["resumen_borrador"] = cita
                    cambios["borrador_modelo"] = MODELO_LITERAL
                elif not d.get("resumen_humano") and _texto(d.get("resumen_borrador")).startswith(PREFIJO_LITERAL):
                    # Un extracto anterior no queda aprobado solo por seguir
                    # figurando en una nota al pie de la fuente.
                    cambios["resumen_borrador"] = None
                    cambios["borrador_modelo"] = MODELO_LITERAL
                d.update(cambios)
                if not d.get("materia") and d.get("banco_datos"):
                    cambios["materia"] = _texto(d["banco_datos"])[:40]
                # La descripción del índice ya es texto oficial, no una conclusión.
                if not d.get("descripcion_limpia") and len(_texto(d.get("contenido"))) >= 40:
                    cambios["descripcion_limpia"] = _texto(d["contenido"])[:4000]
                d.update(cambios)
    except Exception:
        # verify conserva la decisión cerrada ante una fuente no accesible.
        pass
    if not d.get("resumen_borrador"):
        cambios.update(preparar_ficha(d))
        d.update(cambios)
    try:
        source_ok, source_errors = verify(_session(), d)
    except Exception as exc:
        source_ok, source_errors = False, [f"Error verificando fuente oficial: {str(exc)[:180]}"]
    discovered = d.pop("_fuente_oficial_descubierta", None)
    if discovered and discovered != _texto(row.get("enlace_oficial")):
        cambios["enlace_oficial"] = discovered
        d["enlace_oficial"] = discovered
    return d, cambios, source_ok, source_errors


def necesita_revision(row):
    reviewed = row.get("revisado_fiscal_en")
    if not reviewed:
        return True
    def dt(v):
        return datetime.fromisoformat(str(v).replace('Z', '+00:00')) if v else None
    checked = dt(reviewed)
    return any(dt(row.get(k)) and dt(row[k]) > checked for k in (
        "enriquecido_en", "estructura_extraida_en", "clasificado_en", "borrador_generado_en"))


def _load_pending(sb, limit):
    extractos_antiguos, last_excerpt = set(), None
    while True:
        q = (sb.table("documentos_tributarios").select("id")
             .like("resumen_borrador", PREFIJO_LITERAL + "%")
             .is_("resumen_humano", "null")
             .or_(f"borrador_modelo.is.null,borrador_modelo.neq.{MODELO_LITERAL}")
             .order("id").limit(1000))
        if last_excerpt:
            q = q.gt("id", last_excerpt)
        batch = q.execute().data or []
        extractos_antiguos.update(row["id"] for row in batch)
        if len(batch) < 1000:
            break
        last_excerpt = batch[-1]["id"]
    # También recupera fichas retenidas con reglas anteriores, aunque ningún
    # extractor haya vuelto a tocarlas. Una REVIEW actual no se repite sin cambios.
    actuales, last_reviewed = set(), None
    while True:
        q = (sb.table("revisor_fiscal_euclidian_evaluaciones")
             .select("documento_id").eq("version_reglas", RULES_VERSION)
             .order("documento_id").limit(1000))
        if last_reviewed:
            q = q.gt("documento_id", last_reviewed)
        batch = q.execute().data or []
        actuales.update(row["documento_id"] for row in batch)
        if len(batch) < 1000:
            break
        last_reviewed = batch[-1]["documento_id"]
    metadata, last_id = [], None
    while True:
        q = sb.table("documentos_tributarios").select(
            "id,revisado_fiscal_en,enriquecido_en,estructura_extraida_en,clasificado_en,borrador_generado_en,fecha_publicacion_web,fecha_publicacion").order("id").limit(1000)
        if last_id:
            q = q.gt("id", last_id)
        batch = q.execute().data or []
        metadata.extend(row for row in batch if row["id"] in extractos_antiguos or row["id"] not in actuales or necesita_revision(row))
        if len(batch) < 1000:
            break
        last_id = batch[-1]["id"]
    metadata.sort(key=lambda d:(d.get("fecha_publicacion_web") or d.get("fecha_publicacion") or '',d["id"]), reverse=True)
    ids = [d["id"] for d in metadata[:limit]]
    rows = []
    for i in range(0, len(ids), 50):
        rows.extend(sb.table("documentos_tributarios").select("*").in_("id", ids[i:i+50]).execute().data or [])
    order = {ident:i for i,ident in enumerate(ids)}
    return sorted(rows, key=lambda d:order[d["id"]])


def _guardar_cambios(sb, d, cambios):
    if not cambios:
        return d.get("updated_at")
    try:
        result = (sb.table("documentos_tributarios").update(cambios)
                  .eq("id", d["id"]).eq("updated_at", d["updated_at"]).execute())
        if result.data:
            return result.data[0]["updated_at"]
        print(f"TURBO_CONFLICTO id={d.get('id')} ficha cambió durante el contraste", flush=True)
        return "CONFLICTO"
    except Exception as exc:
        print(f"TURBO_ESCRITURA_ERROR id={d.get('id')} error={str(exc)[:220]}", flush=True)
    return None


def _limpiar_motivos(items):
    out=[]
    for item in items or []:
        s=_texto(item).replace("CRITICAL: ","")
        if "404 Client Error: Not Found for url:" in s:
            s="No fue posible acceder al documento en el enlace oficial registrado. La ficha conserva los datos disponibles de la publicación DIAN, pero el contenido íntegro requiere una fuente documental accesible."
        elif s.startswith("No se pudo leer la fuente oficial:"):
            s="No fue posible acceder al documento en el enlace oficial registrado. La ficha conserva los datos disponibles de la publicación DIAN, pero se requiere una fuente documental accesible para corroborar el contenido íntegro."
        if s and s not in out: out.append(s[:1000])
    return out[:12]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=DEFAULT_LIMIT)
    ap.add_argument("--workers", type=int, default=WORKERS)
    args = ap.parse_args()
    if args.limit < 1 or args.limit > MAX_LIMIT:
        raise SystemExit(f"--limit debe estar entre 1 y {MAX_LIMIT}")
    if args.workers < 1 or args.workers > 32:
        raise SystemExit("--workers debe estar entre 1 y 32")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    sb = create_client(url, key)
    rows = _load_pending(sb, args.limit)

    print(f"TURBO_INICIO universo={len(rows)} workers={args.workers} reglas={RULES_VERSION}", flush=True)
    counts = {"APPROVE": 0, "REVIEW": 0, "ERROR": 0, "PUBLICADOS": 0, "CONFLICTOS": 0}

    with ThreadPoolExecutor(max_workers=args.workers) as pool:
        futures = {pool.submit(_verify_one, row): row for row in rows}
        for n, future in enumerate(as_completed(futures), 1):
            original = futures[future]
            try:
                d, cambios, source_ok, source_errors = future.result()
            except Exception as exc:
                counts["ERROR"] += 1
                print(f"TURBO_ERROR id={original.get('id')} error={str(exc)[:220]}", flush=True)
                continue

            version = _guardar_cambios(sb, d, cambios)
            if version == "CONFLICTO":
                counts["CONFLICTOS"] += 1
                continue
            if not version:
                counts["ERROR"] += 1
                continue

            if source_errors:
                d["borrador_advertencias"] = _limpiar_motivos(source_errors)
            result, score, passed, failed, reasons = evaluate(d, source_ok)
            if source_errors:
                reasons.extend(_limpiar_motivos(source_errors)[:5])
                if result == "APPROVE":
                    result = "REVIEW"
                    score = min(score, 90)
                    failed.append("FUENTE_OFICIAL")

            try:
                motivos = _limpiar_motivos(reasons)
                saved = sb.rpc("registrar_revision_documental", {
                    "p_documento_id": d["id"], "p_actualizado_en": version,
                    "p_evaluacion": {"resultado": result, "puntuacion": score,
                        "reglas_pasadas": passed, "reglas_fallidas": failed,
                        "motivos": motivos, "version_reglas": RULES_VERSION,
                        "fuente_verificada": source_ok},
                }).execute().data
                if not saved or saved.get("conflicto"):
                    counts["CONFLICTOS"] += 1
                    print(f"TURBO_CONFLICTO_FINAL id={d['id']}", flush=True)
                    continue
                if result == "APPROVE" and not saved.get("publicado"):
                    print(f"TURBO_PENDIENTE_INSPECCION id={d['id']}", flush=True)
                counts[result] += 1
                counts["PUBLICADOS"] += int(bool(saved.get("publicado")))
            except Exception as exc:
                counts["ERROR"] += 1
                print(f"TURBO_ESCRITURA_FINAL_ERROR id={d.get('id')} error={str(exc)[:220]}", flush=True)
                continue

            if n % 100 == 0 or n == len(rows):
                print(f"TURBO_PROGRESO {n}/{len(rows)} aprobados={counts['APPROVE']} revisiones={counts['REVIEW']} errores={counts['ERROR']}", flush=True)

    print({"evaluated": len(rows), "counts": counts, "rules_version": RULES_VERSION, "workers": args.workers}, flush=True)
    if counts["ERROR"]:
        raise SystemExit(1)


if __name__ == "__main__":
    main()
