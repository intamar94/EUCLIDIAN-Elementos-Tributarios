"""EUCLIDIAN Fiscal Reviewer.

This is the last quality gate before approval. It NEVER blocks the
pipeline: a failed rule produces REVIEW, records the exact reason and
returns the document to the correction/reprocessing queue. Approval is
possible only when all critical evidence rules pass and the fiscal review
has no unresolved warnings.
"""
from __future__ import annotations
import argparse, os
from supabase import create_client

RULES_VERSION = "2.0"
CRITICAL = {"OFICIAL", "FECHA", "CONTENIDO", "VIGENCIA", "EVIDENCIA"}


def evaluate(d):
    passed, failed, reasons = [], [], []

    def rule(code, ok, reason, critical=False):
        (passed if ok else failed).append(code)
        if not ok:
            reasons.append(("CRITICAL: " if critical else "") + reason)

    official = bool((d.get("enlace_oficial") or "").strip())
    content = bool((d.get("texto_completo") or d.get("contenido") or "").strip())
    date_ok = d.get("fecha_es_real") is True
    validity = bool((d.get("estado_vigencia") or "").strip())
    classification = bool((d.get("clasificacion_obligatoriedad") or d.get("materia") or d.get("area_derecho") or "").strip())
    evidence = bool(d.get("evidencia") or d.get("evidencias") or d.get("fuentes_formales"))
    warnings = d.get("borrador_advertencias") or []

    rule("OFICIAL", official, "Falta enlace oficial.", True)
    rule("FECHA", date_ok, "Fecha no verificada.", True)
    rule("CONTENIDO", content, "No hay contenido suficiente.", True)
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.", True)
    rule("CLASIFICACION", classification, "Clasificación/materia incompleta.")
    rule("EVIDENCIA", evidence, "No existe evidencia estructurada suficiente para las afirmaciones.", True)
    rule("ADVERTENCIAS", not warnings, "Existen advertencias del borrador.", True)

    unresolved_critical = any(code in CRITICAL for code in failed)
    result = "APPROVE" if not unresolved_critical and not warnings else "REVIEW"
    score = max(0, round(len(passed) / 7 * 100))
    return result, score, passed, failed, reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=500)
    args = ap.parse_args()

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    sb = create_client(url, key)
    rows = (
        sb.table("documentos_tributarios")
        .select("id,enlace_oficial,fecha_es_real,texto_completo,contenido,estado_vigencia,clasificacion_obligatoriedad,materia,area_derecho,borrador_advertencias,evidencia,evidencias,fuentes_formales")
        .eq("aprobado_para_email", False)
        .limit(args.limit)
        .execute().data or []
    )

    counts = {"APPROVE": 0, "REVIEW": 0}
    for d in rows:
        result, score, passed, failed, reasons = evaluate(d)
        counts[result] += 1
        sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
            "documento_id": d["id"],
            "resultado": result,
            "puntuacion": score,
            "reglas_pasadas": passed,
            "reglas_fallidas": failed,
            "motivos": reasons,
            "version_reglas": RULES_VERSION,
        }).execute()

    print({"evaluated": len(rows), "counts": counts, "rules_version": RULES_VERSION})


if __name__ == "__main__":
    main()
