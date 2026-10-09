"""Sustituye plantillas antiguas por respuestas literales comprobadas en DIAN.

Acota el trabajo a oficios 2026 con pregunta y respuesta estructuradas.
Cada cambio queda auditado y sale de publicación hasta el nuevo contraste del
revisor fiscal. Sin --aplicar solo informa los candidatos verificables.
"""
import argparse
import os
import re
from urllib.parse import urlparse

import requests
from supabase import create_client

from verificador_aprobacion import load, norm, verify


def literal(texto):
    return re.sub(r"[^a-z0-9]", "", norm(texto))


def enlace_exacto(d):
    numero = re.fullmatch(r"DIAN-OFICIO-(\d+)-2026", d.get("numero_resolucion") or "")
    if not numero:
        return False
    ruta = urlparse(d.get("enlace_oficial") or "")
    return (ruta.scheme == "https" and ruta.netloc == "normograma.dian.gov.co"
            and ruta.path == f"/dian/compilacion/docs/oficio_dian_{int(numero.group(1))}_2026.htm")


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=25)
    ap.add_argument("--aplicar", action="store_true")
    args = ap.parse_args()
    if not 1 <= args.limite <= 100:
        raise SystemExit("--limite debe estar entre 1 y 100")
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    rows = (db.table("documentos_tributarios").select(
        "id,numero_resolucion,resumen_humano,resumen_borrador,problema_juridico,"
        "tesis_juridica,tesis_respuesta,enlace_oficial,fecha_publicacion,"
        "fecha_publicacion_web,entidad_emisora,estado_vigencia")
        .eq("anio_publicacion", 2026)
        .like("resumen_humano", "%Doctrina DIAN: orienta, no obliga%")
        .order("fecha_publicacion", desc=True).limit(1000).execute().data or [])
    session = requests.Session()
    session.headers.update({"User-Agent": "EUCLIDIAN-Documentary-Repair/1.0",
                            "Accept-Language": "es-CO,es;q=0.9"})
    checked = ready = changed = 0
    for d in rows:
        if ready >= args.limite:
            break
        tesis = (d.get("tesis_juridica") or "").strip()
        pregunta = (d.get("problema_juridico") or "").strip()
        if (not enlace_exacto(d) or not pregunta.startswith("¿")
                or d.get("tesis_respuesta") not in ("si", "no")
                or not 80 <= len(tesis) <= 900
                or not re.match(r"^(Sí|Si|No)\b", tesis, re.I)):
            continue
        checked += 1
        try:
            _, source, final = load(session, d["enlace_oficial"])
            if final != d["enlace_oficial"]:
                continue
            compact = literal(source)
            if literal(tesis) not in compact or literal(pregunta) not in compact:
                continue
            candidate = "La DIAN responde: " + tesis
            verify_doc = {**d, "resumen_humano": candidate, "resumen_borrador": None}
            ok, reasons = verify(session, verify_doc)
            if not ok:
                print(f"OMITIDO {d['numero_resolucion']} contraste={reasons[:2]}", flush=True)
                continue
            ready += 1
            print(f"COTEJADO {d['numero_resolucion']} {d['enlace_oficial']}", flush=True)
            if args.aplicar:
                result = db.rpc("reparar_sintesis_literal_dian", {
                    "p_documento_id": d["id"],
                    "p_resumen_anterior": d["resumen_humano"],
                    "p_fuente_url": d["enlace_oficial"],
                }).execute()
                if result.data is True:
                    changed += 1
                else:
                    print(f"OMITIDO {d['numero_resolucion']} cambió mientras se cotejaba", flush=True)
        except (requests.RequestException, ValueError) as exc:
            print(f"OMITIDO {d['numero_resolucion']} fuente={str(exc)[:120]}", flush=True)
    print({"candidatos_examinados": checked, "cotejados": ready,
           "modificados": changed, "modo": "aplicar" if args.aplicar else "lectura"}, flush=True)


if __name__ == "__main__":
    main()
