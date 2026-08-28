"""Generate a machine-readable progress snapshot for EUCLIDIAN.
Uses the existing Supabase progress view and never mutates application data."""
import json, os
from datetime import datetime, timezone
from supabase import create_client

url=os.environ.get("SUPABASE_URL")
key=os.environ.get("SUPABASE_SERVICE_KEY")
if not url or not key:
    raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

sb=create_client(url,key)
r=sb.table("v_progreso_euclidian").select("*").single().execute()
if not r.data:
    raise SystemExit("Progress view returned no data")

d=r.data
total=int(d.get("total_documentos") or 0)
enr=int(d.get("enriquecidos") or 0)
pend=int(d.get("pendientes_enriquecimiento") or max(total-enr,0))
progress=round((enr/total*100),2) if total else 0.0
snapshot={
    "generated_at":datetime.now(timezone.utc).isoformat(),
    "total_documentos":total,
    "enriquecidos":enr,
    "pendientes_enriquecimiento":pend,
    "porcentaje_enriquecimiento":progress,
    "fechas_verificadas":d.get("fechas_verificadas"),
    "fechas_no_verificadas":d.get("fechas_no_verificadas"),
    "clasificados":d.get("clasificados"),
    "borradores":d.get("borradores"),
    "estructura_extraida":d.get("estructura_extraida"),
    "revisados_humanos":d.get("revisados_humanos"),
    "aprobados_para_email":d.get("aprobados_para_email"),
    "con_diario_oficial":d.get("con_diario_oficial"),
    "con_estado_vigencia":d.get("con_estado_vigencia"),
    "retroactivos":d.get("retroactivos"),
    "con_zonas":d.get("con_zonas"),
    "con_plazos":d.get("con_plazos")
}
with open("progreso_euclidian.json","w",encoding="utf-8") as f:
    json.dump(snapshot,f,ensure_ascii=False,indent=2)
print(json.dumps(snapshot,ensure_ascii=False))
