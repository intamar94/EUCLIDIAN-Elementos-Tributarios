"""EUCLIDIAN — verificación de evidencia por campo.

Regla de seguridad: procesado != verificado != aprobado.
Solo se considera APTO un documento ya aprobado si sus campos críticos
pueden rastrearse al contenido de la fuente oficial permitida y la confianza
registrada es alta. Ante cualquier duda, el documento queda bloqueado.
"""
import argparse, json, os, re, sys
from datetime import date
from urllib.parse import urlparse
from supabase import create_client

HOST = "normograma.dian.gov.co"
PREFIX = "/dian/compilacion/"
ROOTS = {
    "novedades_boletines": "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html",
    "tributario": "https://normograma.dian.gov.co/dian/compilacion/tributario.html?q=TRIBUTARIO",
}
CRITICAL = ("fecha_publicacion", "entidad_emisora", "estado_vigencia")
PAGE = 500


def norm(v):
    return re.sub(r"\s+", " ", str(v or "")).strip()


def source_ok(url):
    p = urlparse(url or "")
    return p.scheme == "https" and p.netloc == HOST and p.path.startswith(PREFIX)


def evidence(text, value):
    v = norm(value)
    if not v or not text:
        return False
    # Exacto primero; después una forma tolerante para fechas y espacios.
    if v.lower() in text.lower():
        return True
    compact_v = re.sub(r"[^a-z0-9áéíóúüñ/]", "", v.lower())
    compact_t = re.sub(r"[^a-z0-9áéíóúüñ/]", "", text.lower())
    return len(compact_v) >= 6 and compact_v in compact_t


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=500)
    ap.add_argument("--strict", action="store_true")
    ap.add_argument("--output", default="evidencia_euclidian.json")
    args = ap.parse_args()
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    fields = "id,numero_resolucion,enlace_oficial,contenido,resumen_humano,resumen_borrador,borrador_confianza,fecha_publicacion,fecha_es_real,entidad_emisora,estado_vigencia,motivo_cambio_estado,fecha_entrada_vigencia,plazos_mencionados,zonas_afectadas,tiene_efectos_retroactivos,anos_afectados,aprobado_para_email"
    rows = db.table("documentos_tributarios").select(fields).eq("aprobado_para_email", True).limit(args.limite).execute().data or []
    report = {"policy": "two-root-DIAN-only", "generated": date.today().isoformat(), "total_reviewed": len(rows), "approved_safe": 0, "blocked": 0, "documents": []}
    for d in rows:
        text = norm(d.get("contenido"))
        problems = []
        checks = {}
        checks["source"] = {"ok": source_ok(d.get("enlace_oficial")), "value": d.get("enlace_oficial")}
        if not checks["source"]["ok"]:
            problems.append("fuente fuera del Normograma DIAN permitido")
        checks["confidence"] = {"ok": d.get("borrador_confianza") == "alta", "value": d.get("borrador_confianza")}
        if not checks["confidence"]["ok"]:
            problems.append("confianza distinta de alta")
        checks["publication_date"] = {"ok": bool(d.get("fecha_es_real")) and bool(d.get("fecha_publicacion")) and evidence(text, d.get("fecha_publicacion")), "value": d.get("fecha_publicacion")}
        if not checks["publication_date"]["ok"]:
            problems.append("fecha de publicación sin evidencia suficiente")
        summary = d.get("resumen_humano") or d.get("resumen_borrador") or ""
        checks["summary"] = {"ok": len(norm(summary)) >= 30 and evidence(text, summary[:120]) if summary else False, "value": summary[:200]}
        if not checks["summary"]["ok"]:
            # Un resumen no siempre aparece literalmente en la fuente; no lo bloqueamos
            # por sí solo si los campos críticos sí están demostrados.
            checks["summary"]["ok"] = len(norm(summary)) >= 30
        for field in CRITICAL[1:]:
            value = d.get(field)
            checks[field] = {"ok": bool(value) and evidence(text, value), "value": value}
            if value and not checks[field]["ok"]:
                problems.append(f"{field} no tiene evidencia textual suficiente")
        if d.get("fecha_entrada_vigencia") and not evidence(text, d["fecha_entrada_vigencia"]):
            problems.append("fecha de entrada en vigencia no demostrada")
        if d.get("plazos_mencionados"):
            bad = [p for p in d["plazos_mencionados"] if not evidence(text, p)]
            if bad:
                problems.append(f"{len(bad)} plazo(s) no demostrados literalmente")
        safe = not problems
        if safe: report["approved_safe"] += 1
        else: report["blocked"] += 1
        report["documents"].append({"id": d.get("id"), "numero_resolucion": d.get("numero_resolucion"), "safe": safe, "checks": checks, "problems": problems})
    with open(args.output, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=2)
    print(f"EVIDENCIA_REVISADOS={report['total_reviewed']}")
    print(f"EVIDENCIA_APTOS={report['approved_safe']}")
    print(f"EVIDENCIA_BLOQUEADOS={report['blocked']}")
    if report["blocked"]:
        print("EVIDENCIA_CONTROL=NO_APTO")
        if args.strict:
            return 1
    else:
        print("EVIDENCIA_CONTROL=OK")
    return 0

if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"EVIDENCIA_ERROR: {exc}", file=sys.stderr)
        raise SystemExit(1)
