"""EUCLIDIAN — Revisor Fiscal final, turbo y trazable.

Procesa el corpus completo por lotes grandes, verifica cada documento contra
el Normograma DIAN y mantiene todo documento visible en el catálogo.
La revisión fiscal determina confianza y aprobación, pero nunca oculta
información del catálogo por una incidencia de verificación.
"""
from __future__ import annotations

import argparse
import os
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

RULES_VERSION = "3.6"
DEFAULT_LIMIT = 20000
MAX_LIMIT = 20000
WORKERS = 16
_thread_local = threading.local()


def _texto(v):
    return str(v or "").strip()


def _session():
    s = getattr(_thread_local, "session", None)
    if s is None:
        s = requests.Session()
        s.headers.update({
            "User-Agent": "EUCLIDIAN-Fiscal-Reviewer/3.6",
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
            cambios["resumen_humano"] = resumen[:4000]
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
    content = bool(_texto(d.get("contenido") or d.get("texto_completo")))
    web_date = _texto(d.get("fecha_publicacion_web"))
    doc_date = _texto(d.get("fecha_publicacion"))
    date_ok = bool(web_date) or bool(doc_date)
    validity = bool(_texto(d.get("estado_vigencia")))
    classification = bool(_texto(d.get("clasificacion_obligatoriedad")))
    matter = bool(_texto(d.get("materia") or d.get("area_derecho") or d.get("banco_datos")))
    summary = bool(_texto(d.get("resumen_humano")))
    audience = classification

    rule("OFICIAL", official, "Falta enlace oficial DIAN.")
    rule("FECHA_PUBLICACION", date_ok, "No hay fecha de publicación DIAN identificable.")
    rule("CONTENIDO", content, "No hay contenido suficiente.")
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.")
    rule("CLASIFICACION", classification, "No está determinada la naturaleza/obligatoriedad del documento.")
    rule("MATERIA", matter, "No hay materia o área profesional identificable.")
    rule("RESUMEN", summary, "La ficha no tiene resumen para el contador.")
    rule("A_QUIEN", audience, "No está determinada la naturaleza que permite explicar a quién afecta.")
    rule("EVIDENCIA", source_verified, "El resumen y los datos críticos no han sido corroborados contra la fuente oficial.")

    result = "APPROVE" if not failed else "REVIEW"
    score = max(0, round(len(passed) / 9 * 100))
    return result, score, passed, failed, reasons


def _verify_one(row):
    d = dict(row)
    cambios = preparar_ficha(d)
    if cambios:
        d.update(cambios)
    try:
        source_ok, source_errors = verify(_session(), d)
    except Exception as exc:
        source_ok, source_errors = False, [f"Error verificando fuente oficial: {str(exc)[:180]}"]
    return d, cambios, source_ok, source_errors


def _load_pending(sb, limit):
    """Carga pendientes con paginación por clave primaria para evitar OFFSET costoso."""
    rows = []
    page_size = 1000
    last_id = None
    while len(rows) < limit:
        take = min(page_size, limit - len(rows))
        q = (sb.table("documentos_tributarios")
            .select("*")
            .is_("revisado_fiscal_en", "null")
            .order("id", desc=False)
            .limit(take))
        if last_id:
            q = q.gt("id", last_id)
        batch = q.execute().data or []
        if not batch:
            break
        rows.extend(batch)
        last_id = batch[-1].get("id")
        if len(batch) < take:
            break
    return rows


def _guardar_cambios(sb, d, cambios):
    if not cambios:
        return True
    try:
        sb.table("documentos_tributarios").update(cambios).eq("id", d["id"]).execute()
        return True
    except Exception as exc:
        print(f"TURBO_ESCRITURA_ERROR id={d.get('id')} error={str(exc)[:220]}", flush=True)
        return False


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
    counts = {"APPROVE": 0, "REVIEW": 0, "ERROR": 0}

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

            if not _guardar_cambios(sb, d, cambios):
                counts["ERROR"] += 1
                continue

            if source_errors:
                d["borrador_advertencias"] = source_errors[:12]
            result, score, passed, failed, reasons = evaluate(d, source_ok)
            if source_errors:
                reasons.extend(source_errors[:5])
                if result == "APPROVE":
                    result = "REVIEW"
                    score = min(score, 90)
                    failed.append("FUENTE_OFICIAL")

            now = datetime.now(timezone.utc).isoformat()
            try:
                if result == "APPROVE":
                    sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
                        "documento_id": d["id"],
                        "resultado": "APPROVE",
                        "puntuacion": score,
                        "reglas_pasadas": passed,
                        "reglas_fallidas": [],
                        "motivos": [],
                        "version_reglas": RULES_VERSION,
                    }, on_conflict="documento_id").execute()
                    sb.table("documentos_tributarios").update({
                        "revisado_por_humano": True,
                        "publicado_cliente": True,
                        "revisado_fiscal_en": now,
                        "observaciones_revisor": None,
                        "borrador_confianza": "alta",
                        "borrador_advertencias": [],
                    }).eq("id", d["id"]).execute()
                else:
                    motivos = reasons[:12]
                    sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
                        "documento_id": d["id"],
                        "resultado": "REVIEW",
                        "puntuacion": score,
                        "reglas_pasadas": passed,
                        "reglas_fallidas": failed,
                        "motivos": motivos,
                        "version_reglas": RULES_VERSION,
                    }, on_conflict="documento_id").execute()
                    # REVIEW ya no bloquea la visibilidad. El documento queda
                    # publicado en el catálogo, pero conserva su estado fiscal
                    # y no queda aprobado para comunicaciones que requieran
                    # alta confianza.
                    sb.table("documentos_tributarios").update({
                        "revisado_por_humano": False,
                        "publicado_cliente": True,
                        "revisado_fiscal_en": now,
                        "aprobado_para_email": False,
                        "observaciones_revisor": " | ".join(motivos)[:4000],
                        "borrador_confianza": "no_aprobado",
                        "borrador_advertencias": motivos,
                    }).eq("id", d["id"]).execute()
                counts[result] += 1
            except Exception as exc:
                counts["ERROR"] += 1
                print(f"TURBO_ESCRITURA_FINAL_ERROR id={d.get('id')} error={str(exc)[:220]}", flush=True)
                continue

            if n % 100 == 0 or n == len(rows):
                print(f"TURBO_PROGRESO {n}/{len(rows)} aprobados={counts['APPROVE']} revisiones={counts['REVIEW']} errores={counts['ERROR']}", flush=True)

    print({"evaluated": len(rows), "counts": counts, "rules_version": RULES_VERSION, "workers": args.workers}, flush=True)


if __name__ == "__main__":
    main()
