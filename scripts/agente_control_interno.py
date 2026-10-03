"""Agente de integridad documental de EUCLIDIAN.

Convierte los hallazgos del inspector en una cola trazable. Solo hace dos
correcciones automáticas: una fecha que la fuente DIAN fija inequívocamente y
una URL reemplazada por otra URL oficial que identifica el mismo documento.
Todo lo interpretativo se conserva como caso para análisis: el agente no
rellena citas, tesis, plazos ni elimina duplicados por su cuenta.
"""
from __future__ import annotations

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path

import requests
from supabase import create_client

SCRIPTS_DIR = Path(__file__).resolve().parent
if str(SCRIPTS_DIR) not in sys.path:
    sys.path.insert(0, str(SCRIPTS_DIR))

from inspector_euclidian import source_dates, source_text, trusted_source
from verificador_aprobacion import discover_official_url

LOG = logging.getLogger("agente_control_interno")
logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)s %(message)s")
PAGE = 300
FIELDS = "id,numero_resolucion,titulo,enlace_oficial,fecha_publicacion,fecha_es_real"

SAFE_DATE_CODES = {"fecha_imposible", "orden_fechas", "fecha_centinal"}
ANALYSIS_CODES = {
    "duplicado", "plazo_cortado", "cita_incompleta", "ficha_escasa",
    "fecha_no_verificada", "anio_incoherente", "retroactividad_sin_periodo",
    "identificacion", "fuente", "fecha_sin_valor",
}


def issue_codes(hallazgos):
    return {str(item.get("codigo")) for item in (hallazgos or []) if item.get("codigo")}


def priority(codes):
    return "alta" if codes & (SAFE_DATE_CODES | {"duplicado", "plazo_cortado", "fuente", "enlace_roto"}) else "media"


def date_correction(row, official_text):
    """Return a safe date update only if DIAN exposes exactly one document date."""
    dates = source_dates(official_text)
    candidate = dates.get("documento")
    current = str(row.get("fecha_publicacion") or "")
    if candidate:
        evidence = {
            "campo": "fecha_publicacion", "antes": current or None, "despues": candidate,
            "fuente": row.get("enlace_oficial"),
        }
        if candidate != current:
            return {"fecha_publicacion": candidate, "fecha_es_real": True}, evidence
        # La corrección de una ejecución anterior continúa siendo evidencia
        # positiva: no se reescribe, pero se conserva como verificada.
        return {}, evidence
    return None, None


def read_all(query):
    rows, offset = [], 0
    while True:
        batch = query.range(offset, offset + PAGE - 1).execute().data or []
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        offset += len(batch)


def latest_inspection(db):
    rows = (db.table("inspector_ejecuciones").select("*")
            .in_("estado", ["alerta", "correcto"])
            .order("iniciado_en", desc=True).limit(1).execute().data or [])
    return rows[0] if rows else None


def documents_by_id(db, ids):
    out = {}
    for start in range(0, len(ids), 120):
        batch = ids[start:start + 120]
        rows = db.table("documentos_tributarios").select(FIELDS).in_("id", batch).execute().data or []
        out.update({row["id"]: row for row in rows})
    return out


def requeue_after_change(db, row, changes):
    """A corrected primary datum must pass downstream validation again."""
    payload = dict(changes)
    payload.update({"revisado_fiscal_en": None, "aprobado_para_email": False})
    db.table("documentos_tributarios").update(payload).eq("id", row["id"]).execute()


def resolve_link(session, row):
    try:
        _text, final, discovered = discover_official_url(session, row)
    except Exception:
        return None
    if discovered and final and discovered != row.get("enlace_oficial"):
        return discovered
    return None


def build_case(inspeccion_id, run_id, row, code, estado, detalle, evidencia):
    return {
        "ejecucion_id": run_id,
        "inspeccion_id": inspeccion_id,
        "documento_id": row.get("id") if row else None,
        "codigo": code,
        "prioridad": priority({code}),
        "estado": estado,
        "detalle": detalle[:2000],
        "evidencia": evidencia,
        "actualizado_en": datetime.now(timezone.utc).isoformat(),
    }


def process_document(db, session, inspection_id, run_id, row, codes):
    cases = []
    # Primero una fecha inequívoca. Si DIAN no permite determinarla, no se toca.
    if codes & SAFE_DATE_CODES and trusted_source(row):
        try:
            text = source_text(session, row["enlace_oficial"])
            changes, evidence = date_correction(row, text)
            if changes:
                requeue_after_change(db, row, changes)
                cases.append(build_case(inspection_id, run_id, row, "fecha_corregida", "corregido",
                    "Se actualizó la fecha del documento con la fecha expresada en la fuente DIAN.", evidence))
                codes = codes - SAFE_DATE_CODES
            elif evidence:
                cases.append(build_case(inspection_id, run_id, row, "fecha_corregida", "corregido",
                    "La fecha del documento ya coincide con la fecha expresada en la fuente DIAN.", evidence))
                codes = codes - SAFE_DATE_CODES
            else:
                cases.append(build_case(inspection_id, run_id, row, "fecha_pendiente_evidencia", "pendiente_evidencia",
                    "La fuente DIAN no permitió confirmar una fecha documental distinta de forma inequívoca.",
                    {"fuente": row.get("enlace_oficial")}))
                codes = codes - SAFE_DATE_CODES
        except Exception as exc:
            cases.append(build_case(inspection_id, run_id, row, "fecha_pendiente_evidencia", "pendiente_evidencia",
                "No se modificó la fecha porque la fuente DIAN no estuvo disponible para corroborarla.",
                {"fuente": row.get("enlace_oficial"), "error": str(exc)[:180]}))
            codes = codes - SAFE_DATE_CODES
    for code in sorted(codes):
        cases.append(build_case(inspection_id, run_id, row, code, "requiere_analisis",
            "El hallazgo requiere contraste documental; el agente no modifica contenido jurídico por inferencia.",
            {"fuente": row.get("enlace_oficial"), "numero": row.get("numero_resolucion")}))
    return cases


def run(dry_run=False):
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    inspection = latest_inspection(db)
    if not inspection:
        raise RuntimeError("No existe una inspección completa para gestionar")
    if inspection.get("revisados") != inspection.get("total") or not inspection.get("total"):
        raise RuntimeError("La inspección más reciente no tiene cobertura completa")
    started = datetime.now(timezone.utc).isoformat()
    created = None
    if not dry_run:
        created = db.table("control_interno_ejecuciones").insert({
            "inspeccion_id": inspection["id"], "estado": "en_curso", "iniciado_en": started,
        }).execute().data[0]
    run_id = created["id"] if created else "00000000-0000-0000-0000-000000000000"
    try:
        results = read_all(db.table("inspector_resultados").select("documento_id,hallazgos")
                           .eq("ejecucion_id", inspection["id"]).eq("estado", "critico").order("documento_id"))
        by_doc = {item["documento_id"]: issue_codes(item.get("hallazgos")) for item in results}
        # Los casos centinela hacen comparaciones más profundas que el barrido
        # por fila. Sus discrepancias de fecha se incorporan a la misma cola.
        for sentinel in inspection.get("casos") or []:
            document_id = sentinel.get("documento_id")
            findings = " ".join(sentinel.get("hallazgos") or [])
            if document_id and "Fecha del documento:" in findings:
                by_doc.setdefault(document_id, set()).add("fecha_centinal")
            if document_id and "aparece duplicado" in findings:
                by_doc.setdefault(document_id, set()).add("duplicado")
        broken = (inspection.get("enlaces") or {}).get("muestra") or []
        for item in broken:
            if item.get("id"):
                by_doc.setdefault(item["id"], set()).add("enlace_roto")
        docs = documents_by_id(db, list(by_doc))
        session = requests.Session()
        session.headers.update({"User-Agent": "EUCLIDIAN-Agente-Integridad/1.0", "Accept-Language": "es-CO,es;q=0.9"})
        cases = []
        for document_id, codes in by_doc.items():
            row = docs.get(document_id)
            if not row:
                cases.append(build_case(inspection["id"], run_id, None, "registro_no_encontrado", "pendiente_evidencia",
                    "El resultado del inspector no pudo asociarse a un registro vigente.", {"documento_id": document_id}))
                continue
            if "enlace_roto" in codes:
                replacement = resolve_link(session, row)
                if replacement and not dry_run:
                    before = row.get("enlace_oficial")
                    requeue_after_change(db, row, {"enlace_oficial": replacement})
                    cases.append(build_case(inspection["id"], run_id, row, "enlace_corregido", "corregido",
                        "Se sustituyó el enlace inaccesible por una URL oficial DIAN que identifica el mismo documento.",
                        {"campo": "enlace_oficial", "antes": before, "despues": replacement}))
                    codes = codes - {"enlace_roto"}
                else:
                    cases.append(build_case(inspection["id"], run_id, row, "enlace_pendiente_evidencia", "pendiente_evidencia",
                        "No se encontró una URL alternativa DIAN suficientemente identificada para sustituir el enlace.",
                        {"fuente": row.get("enlace_oficial")}))
                    codes = codes - {"enlace_roto"}
            if dry_run:
                for code in sorted(codes):
                    cases.append(build_case(inspection["id"], run_id, row, code, "requiere_analisis",
                        "Simulación: el hallazgo se conservaría para contraste documental.", {"fuente": row.get("enlace_oficial")}))
            else:
                cases.extend(process_document(db, session, inspection["id"], run_id, row, codes))
        counts = Counter(case["estado"] for case in cases)
        if not dry_run and cases:
            for start in range(0, len(cases), PAGE):
                db.table("control_interno_casos").upsert(cases[start:start + PAGE],
                    on_conflict="inspeccion_id,documento_id,codigo").execute()
        result = {"detectados": len(cases), "corregidos": counts["corregido"],
                  "pendientes_evidencia": counts["pendiente_evidencia"],
                  "requieren_analisis": counts["requiere_analisis"]}
        if not dry_run:
            state = "alerta" if result["pendientes_evidencia"] or result["requieren_analisis"] else "correcto"
            db.table("control_interno_ejecuciones").update({**result, "estado": state,
                "finalizado_en": datetime.now(timezone.utc).isoformat()}).eq("id", run_id).execute()
        LOG.info("Agente: %s", result)
        return result
    except Exception as exc:
        if not dry_run and created:
            db.table("control_interno_ejecuciones").update({"estado": "fallo", "finalizado_en": datetime.now(timezone.utc).isoformat(),
                "error": str(exc)[:500]}).eq("id", run_id).execute()
        raise


if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--dry-run", action="store_true")
    args = parser.parse_args()
    try:
        run(args.dry_run)
        # Los casos pendientes son el producto esperado del control interno,
        # no un error de ejecución. El panel y el monitor los comunican.
        raise SystemExit(0)
    except Exception as exc:
        LOG.error("Agente bloqueado: %s", exc)
        raise SystemExit(2)
