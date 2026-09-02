"""EUCLIDIAN — Revisor Fiscal final.

El revisor no es un simple detector de campos. Prepara la ficha para contador,
comprueba que los datos críticos existan, contrasta el resumen con la fuente
oficial DIAN y solo entonces publica el documento en la biblioteca.

La bandera de email NO participa en la publicación de la biblioteca.
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timezone

import requests
from supabase import create_client

try:
    from scripts.composicion import Composicion
    from scripts.verificador_aprobacion import verify
except ImportError:
    from composicion import Composicion
    from verificador_aprobacion import verify

RULES_VERSION = "3.1"
PAGE = 500


def _texto(v):
    return str(v or "").strip()


def preparar_ficha(d: dict) -> dict:
    cambios = {}
    resumen = _texto(d.get("resumen_humano"))
    if not resumen:
        ficha = Composicion().componer(d)
        resumen = _texto(ficha.get("resumen"))
        if resumen:
            cambios["resumen_humano"] = resumen[:4000]
            cambios["resumen_borrador"] = resumen[:4000]
            cambios["borrador_confianza"] = "pendiente_verificacion"
            cambios["borrador_advertencias"] = list(ficha.get("advertencias") or [])
    if not _texto(d.get("materia")) and _texto(d.get("banco_datos")):
        cambios["materia"] = _texto(d["banco_datos"])[:250]
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
    date_ok = bool(web_date) or bool(d.get("fecha_es_real") is True and doc_date)
    validity = bool(_texto(d.get("estado_vigencia")))
    classification = bool(_texto(d.get("clasificacion_obligatoriedad")))
    matter = bool(_texto(d.get("materia") or d.get("area_derecho") or d.get("banco_datos")))
    summary = bool(_texto(d.get("resumen_humano")))
    audience = classification
    warnings = d.get("borrador_advertencias") or []

    rule("OFICIAL", official, "Falta enlace oficial DIAN.")
    rule("FECHA_PUBLICACION", date_ok, "No hay fecha de publicación DIAN identificable.")
    rule("CONTENIDO", content, "No hay contenido suficiente.")
    rule("VIGENCIA", validity, "Estado de vigencia no determinado.")
    rule("CLASIFICACION", classification, "No está determinada la naturaleza/obligatoriedad del documento.")
    rule("MATERIA", matter, "No hay materia o área profesional identificable.")
    rule("RESUMEN", summary, "La ficha no tiene resumen para el contador.")
    rule("A_QUIEN", audience, "No está determinada la naturaleza que permite explicar a quién afecta.")
    rule("EVIDENCIA", source_verified, "El resumen y los datos críticos no han sido corroborados contra la fuente oficial.")
    rule("ADVERTENCIAS", not warnings, "Persisten advertencias de contenido que deben resolverse.")

    result = "APPROVE" if not failed else "REVIEW"
    score = max(0, round(len(passed) / 10 * 100))
    return result, score, passed, failed, reasons


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limit", type=int, default=PAGE)
    args = ap.parse_args()
    if args.limit < 1 or args.limit > 500:
        raise SystemExit("--limit debe estar entre 1 y 500")

    url = os.environ.get("SUPABASE_URL")
    key = os.environ.get("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Missing SUPABASE_URL or SUPABASE_SERVICE_KEY")

    sb = create_client(url, key)
    session = requests.Session()
    session.headers.update({"User-Agent":"EUCLIDIAN-Fiscal-Reviewer/3.1","Accept-Language":"es-CO,es;q=0.9"})

    # revisado_por_humano representa la aprobación final para el cliente.
    # revisado_fiscal_en representa que el revisor ya procesó el documento,
    # incluso si quedó bloqueado en REVIEW. Esto evita que los mismos REVIEW
    # ocupen el primer lote indefinidamente y permite recorrer todo el corpus.
    rows = (
        sb.table("documentos_tributarios")
        .select("*")
        .is_("revisado_fiscal_en", "null")
        .order("fecha_scraped", desc=False)
        .limit(args.limit)
        .execute().data or []
    )

    counts = {"APPROVE":0,"REVIEW":0}
    for original in rows:
        d = dict(original)
        cambios = preparar_ficha(d)
        if cambios:
            sb.table("documentos_tributarios").update(cambios).eq("id", d["id"]).execute()
            d.update(cambios)

        try:
            source_ok, source_errors = verify(session, d)
        except Exception as exc:
            source_ok, source_errors = False, [f"Error verificando fuente oficial: {str(exc)[:180]}"]
        if source_errors:
            d["borrador_advertencias"] = source_errors[:12]
        result, score, passed, failed, reasons = evaluate(d, source_ok)
        if source_errors:
            reasons.extend(source_errors[:5])
            if result == "APPROVE":
                result = "REVIEW"
                score = min(score, 90)
                failed.append("FUENTE_OFICIAL")

        counts[result] += 1
        now = datetime.now(timezone.utc).isoformat()
        if result == "APPROVE":
            sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
                "documento_id":d["id"],"resultado":"APPROVE","puntuacion":score,
                "reglas_pasadas":passed,"reglas_fallidas":[],"motivos":[],
                "version_reglas":RULES_VERSION
            },on_conflict="documento_id").execute()
            sb.table("documentos_tributarios").update({
                "revisado_por_humano":True,
                "publicado_cliente":True,
                "revisado_fiscal_en":now,
                "observaciones_revisor":None,
                "borrador_confianza":"alta",
                "borrador_advertencias":[],
            }).eq("id",d["id"]).execute()
        else:
            motivos = reasons[:12]
            sb.table("revisor_fiscal_euclidian_evaluaciones").upsert({
                "documento_id":d["id"],"resultado":"REVIEW","puntuacion":score,
                "reglas_pasadas":passed,"reglas_fallidas":failed,
                "motivos":motivos,"version_reglas":RULES_VERSION
            },on_conflict="documento_id").execute()
            sb.table("documentos_tributarios").update({
                "revisado_por_humano":False,
                "publicado_cliente":False,
                "revisado_fiscal_en":now,
                "aprobado_para_email":False,
                "observaciones_revisor":" | ".join(motivos)[:4000],
                "borrador_confianza":"no_aprobado",
                "borrador_advertencias":motivos,
            }).eq("id",d["id"]).execute()

    print({"evaluated":len(rows),"counts":counts,"rules_version":RULES_VERSION})


if __name__ == "__main__":
    main()
