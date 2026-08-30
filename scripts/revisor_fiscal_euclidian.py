"""EUCLIDIAN Fiscal Reviewer.

Last quality gate before approval. Missing/uncertain evidence always returns
REVIEW. APPROVE is the only path that marks a document as approved for the
next stage; REVIEW remains eligible for a later re-evaluation.
"""
from __future__ import annotations
import argparse
import os
from supabase import create_client

RULES_VERSION = "2.3"
CRITICAL = {"OFICIAL", "FECHA", "CONTENIDO", "VIGENCIA", "EVIDENCIA", "CONFIANZA", "CLASIFICACION"}


def evaluate(d):
    passed, failed, reasons = [], [], []

    def rule(code, ok, reason, critical=False):
        (passed if ok else failed).append(code)
        if not ok:
            reasons.append(("CRITICAL: " if critical else "") + reason)

    official = bool((d.get("enlace_oficial") or "").strip())
    content = bool((d.get("contenido") or "").strip())
    date_ok = d.get("fecha_es_real") is True
    validity = bool((d.get("estado_vigencia") or "").strip())
    classification = bool((d.get("materia") or d.get("area_derecho") or "").strip())
    confidence = (d.get("borrador_confianza") or "").strip().lower() == "alta"
    warnings = d.get("borrador_advertencias") or []
    evidence = official and content and date_ok and validity

    rule("OFICIAL", official, "Falta enlace oficial DIAN.", True)
    rule("FECHA", date_ok, "Fecha no verificada.", True)
    rule("CONTENIDO", content, "No hay contenido suficiente.", True)
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.", True)
    rule("CLASIFICACION", classification, "Clasificación/materia incompleta para el uso profesional.", True)
    rule("EVIDENCIA", evidence, "La evidencia trazable no reúne fuente oficial, contenido, fecha verificada y vigencia.", True)
    rule("CONFIANZA", confidence, "El borrador no tiene confianza alta.", True)
    rule("ADVERTENCIAS", not warnings, "Existen advertencias del borrador.", True)

    result = "APPROVE" if not any(code in CRITICAL for code in failed) and not warnings else "REVIEW"
    score = max(0, round(len(passed) / 8 * 100))
    return result, score, passed, failed, reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=500)
    args = ap.parse_args()
    if args.limit < 1 or args.limit > 500:
        raise SystemExit("--limit debe estar entre 1 y 500")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    sb = create_client(url, key)
    rows = (
        sb.table("documentos_tributarios")
        .select("id,enlace_oficial,fecha_es_real,contenido,estado_vigencia,materia,area_derecho,borrador_advertencias,borrador_confianza")
        .eq("aprobado_para_email", False)
        .order("id", desc=False)
        .limit(args.limit)
        .execute().data or []
    )

    counts = {"APPROVE": 0, "REVIEW": 0}
    for d in rows:
        result, score, passed, failed, reasons = evaluate(d)
        counts[result] += 1
        sb.table("revisor_fiscal_euclidian_evaluaciones").upsert(
            {"documento_id": d["id"], "resultado": result, "puntuacion": score,
             "reglas_pasadas": passed, "reglas_fallidas": failed, "motivos": reasons,
             "version_reglas": RULES_VERSION},
            on_conflict="documento_id",
        ).execute()

        # Only a fully approved document leaves the pending queue. REVIEW is
        # deliberately left pending so a later extraction/correction can retry.
        if result == "APPROVE":
            sb.table("documentos_tributarios").update({"aprobado_para_email": True}).eq("id", d["id"]).execute()

    print({"evaluated": len(rows), "counts": counts, "rules_version": RULES_VERSION})


if __name__ == "__main__":
    main()
