"""Gestor autónomo de la mesa de excepciones EUCLIDIAN.

No inventa contenido jurídico. Reintenta fuentes oficiales, reencola documentos
para revisión fiscal, reconcilia casos ya corregidos y escala lo interpretativo.
"""
from __future__ import annotations

import argparse
import os
from datetime import datetime, timedelta, timezone

import requests
from supabase import create_client

from verificador_aprobacion import verify

MAX_INTENTOS_FUENTE = 3
PAGE = 200


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def cliente():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    return create_client(url, key)


def cargar(db, limite):
    return (
        db.table("mesa_excepciones")
        .select("*")
        .in_("estado", ["pendiente", "reintento", "en_proceso", "escalado", "cuarentena"])
        .or_(f"proximo_intento.is.null,proximo_intento.lte.{now_iso()}")
        .order("prioridad", desc=False)
        .order("primera_deteccion", desc=False)
        .limit(limite)
        .execute()
        .data
        or []
    )


def documento(db, documento_id):
    if not documento_id:
        return None
    rows = (
        db.table("documentos_tributarios")
        .select(
            "id,numero_resolucion,titulo,numero_interno,enlace_oficial,"
            "fecha_publicacion,fecha_publicacion_web,descripcion_limpia,"
            "resumen_humano,resumen_borrador,tesis_juridica,entidad_emisora,"
            "estado_vigencia,publicado_cliente"
        )
        .eq("id", documento_id)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def actualizar_caso(db, caso_id, **campos):
    campos["updated_at"] = now_iso()
    db.table("mesa_excepciones").update(campos).eq("id", caso_id).execute()


def resolver_fuente(db, session, caso):
    doc = documento(db, caso.get("documento_id"))
    if not doc:
        actualizar_caso(
            db, caso["id"], estado="escalado",
            resolucion="Documento asociado no encontrado; requiere intervención técnica."
        )
        return "escalado"

    ok, errores = verify(session, doc)
    discovered = doc.pop("_fuente_oficial_descubierta", None)
    if discovered and discovered != doc.get("enlace_oficial"):
        db.table("documentos_tributarios").update({
            "enlace_oficial": discovered,
            "revisado_fiscal_en": None,
            "aprobado_para_email": False,
        }).eq("id", doc["id"]).execute()

    if ok:
        db.table("documentos_tributarios").update({
            "revisado_fiscal_en": None,
            "aprobado_para_email": False,
        }).eq("id", doc["id"]).execute()
        actualizar_caso(
            db, caso["id"], estado="resuelto", resuelto_en=now_iso(),
            resolucion="Fuente oficial corroborada. Documento reencolado para revisión fiscal antes de publicación.",
            evidencia={**(caso.get("evidencia") or {}), "verificacion_fuente": "ok", "fuente": discovered or doc.get("enlace_oficial")},
            proximo_intento=None,
        )
        return "resuelto"

    intentos = int(caso.get("intentos") or 0) + 1
    if intentos >= MAX_INTENTOS_FUENTE:
        db.table("documentos_tributarios").update({
            "publicado_cliente": False,
            "aprobado_para_email": False,
        }).eq("id", doc["id"]).execute()
        actualizar_caso(
            db, caso["id"], estado="cuarentena", intentos=intentos,
            resolucion="No fue posible corroborar la fuente tras reintentos. Ficha retirada de publicación hasta evidencia oficial.",
            evidencia={**(caso.get("evidencia") or {}), "ultimo_error_fuente": errores[:8]},
            proximo_intento=(datetime.now(timezone.utc) + timedelta(days=1)).isoformat(),
        )
        return "cuarentena"

    actualizar_caso(
        db, caso["id"], estado="reintento", intentos=intentos,
        evidencia={**(caso.get("evidencia") or {}), "ultimo_error_fuente": errores[:8]},
        proximo_intento=(datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
    )
    return "reintento"


def reconciliar_control(db, caso):
    if not str(caso.get("clave_origen") or "").startswith("control:"):
        return None
    cid = str(caso["clave_origen"]).split(":", 1)[1]
    rows = db.table("control_interno_casos").select("estado,detalle,evidencia").eq("id", cid).limit(1).execute().data or []
    if not rows:
        return None
    origen = rows[0]
    if origen.get("estado") == "corregido":
        actualizar_caso(
            db, caso["id"], estado="resuelto", resuelto_en=now_iso(),
            resolucion="El agente de integridad corrigió el hallazgo y dejó evidencia.",
            evidencia=origen.get("evidencia") or {},
            proximo_intento=None,
        )
        return "resuelto"
    return None


def reconciliar_revisor(db, caso):
    clave = str(caso.get("clave_origen") or "")
    if not clave.startswith("revisor:") or not caso.get("documento_id"):
        return None
    fallo = clave.rsplit(":", 1)[-1]
    rows = (
        db.table("revisor_fiscal_euclidian_evaluaciones")
        .select("resultado,reglas_fallidas,puntuacion")
        .eq("documento_id", caso["documento_id"])
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rows:
        return None
    ev = rows[0]
    fallos = ev.get("reglas_fallidas") or []
    if ev.get("resultado") == "APPROVE" or fallo not in fallos:
        actualizar_caso(
            db, caso["id"], estado="resuelto", resuelto_en=now_iso(),
            resolucion="La revisión fiscal posterior ya no reproduce este fallo.",
            evidencia={**(caso.get("evidencia") or {}), "resultado_actual": ev.get("resultado"), "puntuacion": ev.get("puntuacion")},
            proximo_intento=None,
        )
        return "resuelto"
    return None


def resolver_infraestructura(db, caso):
    posteriores = (
        db.table("logs_scraping")
        .select("id,estado,created_at")
        .eq("fuente", "automatizacion_github")
        .eq("estado", "exitoso")
        .gt("created_at", caso.get("ultima_deteccion") or caso.get("primera_deteccion"))
        .limit(1)
        .execute()
        .data
        or []
    )
    if posteriores:
        actualizar_caso(
            db, caso["id"], estado="resuelto", resuelto_en=now_iso(),
            resolucion="La automatización registró una ejecución exitosa posterior al fallo.",
            proximo_intento=None,
        )
        return "resuelto"
    actualizar_caso(
        db, caso["id"], estado="reintento",
        intentos=int(caso.get("intentos") or 0) + 1,
        proximo_intento=(datetime.now(timezone.utc) + timedelta(hours=6)).isoformat(),
    )
    return "reintento"


def run(limite):
    db = cliente()
    session = requests.Session()
    session.headers.update({
        "User-Agent": "EUCLIDIAN-Excepciones/1.0",
        "Accept-Language": "es-CO,es;q=0.9",
    })
    stats = {"resuelto": 0, "reintento": 0, "cuarentena": 0, "escalado": 0, "sin_cambio": 0}

    for caso in cargar(db, limite):
        reconciliado = reconciliar_control(db, caso) or reconciliar_revisor(db, caso)
        if reconciliado:
            stats[reconciliado] = stats.get(reconciliado, 0) + 1
            continue

        categoria = caso.get("categoria")
        if categoria == "fuente":
            estado = resolver_fuente(db, session, caso)
        elif categoria == "infraestructura":
            estado = resolver_infraestructura(db, caso)
        elif categoria == "juridico":
            actualizar_caso(
                db, caso["id"], estado="escalado",
                resolucion="Requiere interpretación jurídica o contraste material. No se corrige por inferencia automática.",
                proximo_intento=None,
            )
            estado = "escalado"
        else:
            # Integridad se resuelve por agente_control_interno; aquí solo se
            # conserva la asignación y se espera evidencia del ciclo especializado.
            estado = "sin_cambio"
        stats[estado] = stats.get(estado, 0) + 1

    print({"procesados": sum(stats.values()), "stats": stats})
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=PAGE)
    args = ap.parse_args()
    raise SystemExit(run(args.limite))
