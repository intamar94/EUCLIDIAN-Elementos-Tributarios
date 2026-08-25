"""EUCLIDIAN — Control final de confianza.

La confianza alta solo se permite cuando la ficha tiene evidencia directa
extraida del documento oficial. Tener muchos metadatos no basta.

Reglas:
- alta: tesis/respuesta juridica suficiente, o reconsideracion/revocatoria
  explicitamente identificada, y fecha real verificada.
- media: hay datos verificables, pero la frase principal proviene solo de
  descripcion, temas, obligatoriedad, plazos u otros metadatos.
- baja: falta evidencia suficiente para sostener una conclusion.

Este control no inventa texto ni modifica el borrador; solo limita su nivel
de confianza para evitar que una regla de puntuacion convierta una
inferencia en certeza.
"""

import argparse
import os
import re
import sys
from collections import Counter

from supabase import create_client

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")


def evidencia_directa(d):
    tesis = (d.get("tesis_juridica") or "").strip()
    desc = (d.get("descripcion_limpia") or d.get("contenido") or "").strip()
    recon = bool(re.search(
        r"\b(reconsidera|reconsideraci[oó]n|revoca|revocatoria|modifica|aclara)\b",
        desc, re.IGNORECASE))
    return len(tesis) >= 25 or recon


def nivel(d):
    if d.get("interno_dian"):
        return "alta"

    fecha_real = bool(d.get("fecha_es_real"))
    directa = evidencia_directa(d)

    if fecha_real and directa:
        return "alta"

    datos = any([
        d.get("estado_vigencia"),
        d.get("plazos_mencionados"),
        d.get("zonas_afectadas"),
        d.get("temas"),
        d.get("clasificacion_obligatoriedad"),
    ])
    if fecha_real and datos:
        return "media"
    return "baja"


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=1000)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    if not SUPABASE_URL or not SUPABASE_KEY:
        print("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY", file=sys.stderr)
        return 1

    db = create_client(SUPABASE_URL, SUPABASE_KEY)
    r = db.table("documentos_tributarios").select(
        "id,numero_resolucion,resumen_borrador,borrador_confianza,"
        "fecha_es_real,tesis_juridica,descripcion_limpia,contenido,"
        "estado_vigencia,plazos_mencionados,zonas_afectadas,temas,"
        "clasificacion_obligatoriedad,anotaciones_vigencia"
    ).not_.is_("resumen_borrador", "null").limit(args.limite).execute()

    stats = Counter()
    for d in r.data or []:
        nuevo = nivel(d)
        anterior = d.get("borrador_confianza")
        stats[f"{anterior or 'sin_confianza'}_a_{nuevo}"] += 1

        if args.dry_run:
            continue

        if nuevo != anterior:
            db.table("documentos_tributarios").update({
                "borrador_confianza": nuevo,
            }).eq("id", d["id"]).execute()

    print("CONTROL DE CONFIANZA")
    for k in sorted(stats):
        print(f"  {k}: {stats[k]}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
