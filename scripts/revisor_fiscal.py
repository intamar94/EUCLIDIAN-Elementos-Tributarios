"""Revisor Fiscal EUCLIDIAN: triage seguro y explicable.
Nunca aprueba para email automáticamente; produce una evaluación por documento.
"""
from __future__ import annotations
import argparse, os, uuid
from supabase import create_client

CRITICAL = ["OFICIAL", "FECHA", "CONTENIDO", "VIGENCIA"]

def main():
    ap=argparse.ArgumentParser(); ap.add_argument("--limite",type=int,default=500); args=ap.parse_args()
    sb=create_client(os.environ["SUPABASE_URL"], os.environ["SUPABASE_SERVICE_KEY"])
    rows=sb.table("documentos_tributarios").select("*").eq("revisado_por_humano",False).limit(args.limite).execute().data or []
    for d in rows:
        passed=[]; failed=[]; reasons=[]
        official=bool((d.get("enlace_oficial") or "").strip())
        date_ok=bool(d.get("fecha_es_real"))
        content=bool((d.get("texto_completo") or d.get("contenido") or "").strip())
        vig=bool((d.get("estado_vigencia") or "").strip())
        checks={"OFICIAL":official,"FECHA":date_ok,"CONTENIDO":content,"VIGENCIA":vig,
                "CLASIFICACION":bool((d.get("materia") or d.get("area_derecho") or "").strip()),
                "ADVERTENCIAS":not bool(d.get("borrador_advertencias")),
                "TRAZABILIDAD":bool(d.get("hash_contenido"))}
        for code,ok in checks.items(): (passed if ok else failed).append(code)
        for code in CRITICAL:
            if not checks[code]: reasons.append(f"Falta requisito crítico: {code}")
        if any(not checks[c] for c in CRITICAL): result="BLOCK"
        elif failed: result="REVIEW"
        else: result="REVIEW"  # human approval remains mandatory
        sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({"documento_id":d["id"],"resultado":result,"puntuacion":len(passed)*100//len(checks),"reglas_pasadas":passed,"reglas_fallidas":failed,"motivos":reasons or ["Requiere aprobación humana final"],"version_reglas":"1.1"},on_conflict="documento_id").execute()
    print(f"Evaluados: {len(rows)}")
if __name__=="__main__": main()
