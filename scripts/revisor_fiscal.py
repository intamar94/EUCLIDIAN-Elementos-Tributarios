"""Revisor Fiscal EUCLIDIAN: triage seguro y explicable.
Nunca aprueba para email automáticamente; produce una evaluación por documento.

La ausencia de una fecha publicada verificable es una carencia de un campo,
no una prueba de que el documento completo sea inválido. Los campos se
clasifican individualmente para evitar que un dato no localizado invalide
información que sí tiene evidencia trazable.
"""
from __future__ import annotations
import argparse, os
from supabase import create_client

# FECHA y VIGENCIA siguen siendo revisables, pero su ausencia no bloquea por
# sí sola los datos que sí tienen evidencia oficial y trazabilidad.
CRITICAL = ["OFICIAL", "CONTENIDO", "TRAZABILIDAD"]


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=500)
    args = ap.parse_args()
    sb = create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    rows = (sb.table("documentos_tributarios").select("*")
              .eq("revisado_por_humano", False).limit(args.limite)
              .execute().data or [])

    for d in rows:
        passed, failed, reasons = [], [], []
        checks = {
            "OFICIAL": bool((d.get("enlace_oficial") or "").strip()),
            "FECHA": bool(d.get("fecha_es_real")),
            "CONTENIDO": bool((d.get("texto_completo") or d.get("contenido") or "").strip()),
            "VIGENCIA": bool((d.get("estado_vigencia") or "").strip()),
            "CLASIFICACION": bool((d.get("materia") or d.get("area_derecho") or "").strip()),
            "ADVERTENCIAS": not bool(d.get("borrador_advertencias")),
            "TRAZABILIDAD": bool(d.get("hash_contenido")),
        }
        for code, ok in checks.items():
            (passed if ok else failed).append(code)
        for code in CRITICAL:
            if not checks[code]:
                reasons.append(f"Falta requisito crítico: {code}")
        if not checks["FECHA"]:
            reasons.append("Fecha de publicación no demostrada; no se rellena por inferencia")
        if not checks["VIGENCIA"]:
            reasons.append("Vigencia no determinada; requiere revisión")

        result = "BLOCK" if any(not checks[c] for c in CRITICAL) else "REVIEW"
        sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
            "documento_id": d["id"],
            "resultado": result,
            "puntuacion": len(passed) * 100 // len(checks),
            "reglas_pasadas": passed,
            "reglas_fallidas": failed,
            "motivos": reasons or ["Requiere aprobación humana final"],
            "version_reglas": "1.2",
        }, on_conflict="documento_id").execute()
    print(f"Evaluados: {len(rows)}")


if __name__ == "__main__":
    main()
