"""EUCLIDIAN Fiscal Reviewer: deterministic pre-review, no automatic approval.
Evaluates batches and records auditable decisions. It never changes
aprobado_para_email; a human approval remains an explicit action.
"""
from __future__ import annotations
import argparse, os, uuid
from supabase import create_client

RULES_VERSION = "1.1"

def evaluate(d):
    passed, failed, reasons = [], [], []
    def rule(code, ok, reason, critical=False):
        (passed if ok else failed).append(code)
        if not ok: reasons.append(("CRITICAL: " if critical else "") + reason)
    official = bool((d.get("enlace_oficial") or "").strip())
    content = bool((d.get("texto_completo") or d.get("contenido") or "").strip())
    date_ok = d.get("fecha_es_real") is True
    validity = bool((d.get("estado_vigencia") or "").strip())
    classification = bool((d.get("clasificacion_obligatoriedad") or d.get("materia") or d.get("area_derecho") or "").strip())
    warnings = d.get("borrador_advertencias") or []
    rule("OFICIAL", official, "Falta enlace oficial.", True)
    rule("FECHA", date_ok, "Fecha no verificada.", True)
    rule("CONTENIDO", content, "No hay contenido suficiente.", True)
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.", True)
    rule("CLASIFICACION", classification, "Clasificación/materia incompleta.")
    rule("ADVERTENCIAS", not warnings, "Existen advertencias del borrador.", True)
    if failed and any(x in {"OFICIAL","FECHA","CONTENIDO","VIGENCIA","ADVERTENCIAS"} for x in failed):
        result="BLOCK"
    else:
        result="REVIEW"
    score=max(0, round(len(passed)/7*100))
    return result, score, passed, failed, reasons

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--limit",type=int,default=500); args=ap.parse_args()
    url=os.environ.get("SUPABASE_URL"); key=os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key: raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")
    sb=create_client(url,key)
    rows=sb.table("documentos_tributarios").select("id,enlace_oficial,fecha_es_real,texto_completo,contenido,estado_vigencia,clasificacion_obligatoriedad,materia,area_derecho,borrador_advertencias").eq("aprobado_para_email",False).limit(args.limit).execute().data or []
    counts={"APPROVE":0,"REVIEW":0,"BLOCK":0}
    for d in rows:
        result,score,passed,failed,reasons=evaluate(d); counts[result]+=1
        sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({"documento_id":d["id"],"resultado":result,"puntuacion":score,"reglas_pasadas":passed,"reglas_fallidas":failed,"motivos":reasons,"version_reglas":RULES_VERSION}).execute()
    print({"evaluated":len(rows),"counts":counts,"rules_version":RULES_VERSION})

if __name__=="__main__": main()
