"""Auditoría de fechas que se muestran en la consulta de EUCLIDIAN.

No corrige datos. Señala filas que deben contrastarse con el documento de la
DIAN: una fecha jurídica no se infiere desde el identificador ni se reemplaza
en lote. Las reglas distinguen fecha del documento, fecha de publicación web
y fecha de vigencia.
"""
import os
import re
import sys
from collections import Counter
from datetime import date

from supabase import create_client

PAGE = 1000
ISO = re.compile(r"^\d{4}-\d{2}-\d{2}$")
YEAR_IN_IDENTIFIER = re.compile(r"(?:^|-)((?:19|20)\d{2})$")


def as_date(value):
    if not value or not ISO.match(str(value)[:10]):
        return None
    try:
        return date.fromisoformat(str(value)[:10])
    except ValueError:
        return None


def identifier_year(value):
    found = YEAR_IN_IDENTIFIER.search(str(value or ""))
    return int(found.group(1)) if found else None


def findings(document, today=None):
    """Return conservative, reviewable date findings for one document."""
    today = today or date.today()
    out = []
    doc_date = as_date(document.get("fecha_publicacion"))
    web_date = as_date(document.get("fecha_publicacion_web"))
    effective_date = as_date(document.get("fecha_entrada_vigencia"))
    exact = document.get("fecha_es_real") is True
    year = identifier_year(document.get("numero_resolucion"))

    if document.get("fecha_publicacion") and not doc_date:
        out.append("FECHA_DOCUMENTO_FORMATO_INVALIDO")
    if exact and not doc_date:
        out.append("FECHA_DOCUMENTO_EXACTA_AUSENTE")
    if doc_date and doc_date > today:
        out.append("FECHA_DOCUMENTO_FUTURA")
    if web_date and web_date > today:
        out.append("FECHA_WEB_FUTURA")
    if effective_date and effective_date > date(today.year + 20, 12, 31):
        out.append("VIGENCIA_DEMASIADO_LEJANA")
    if exact and doc_date and doc_date.month == 1 and doc_date.day == 1:
        out.append("FECHA_1_ENERO_A_CONFIRMAR")
    if exact and doc_date and year and doc_date.year != year:
        out.append("ANIO_IDENTIFICADOR_NO_COINCIDE")
    return out


def main():
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    fields = "id,numero_resolucion,tipo_documento,fecha_publicacion,fecha_es_real,fecha_publicacion_web,fecha_entrada_vigencia,enlace_oficial"
    total = db.table("documentos_tributarios").select("id", count="exact").limit(1).execute().count or 0
    counts, samples = Counter(), {}
    for start in range(0, total, PAGE):
        rows = db.table("documentos_tributarios").select(fields).order("id").range(start, start + PAGE - 1).execute().data or []
        for row in rows:
            for finding in findings(row):
                counts[finding] += 1
                samples.setdefault(finding, []).append(row.get("numero_resolucion"))
    print(f"DOCUMENTOS_AUDITADOS={total}")
    if not counts:
        print("AUDITORIA_FECHAS=OK")
        return 0
    for kind, amount in sorted(counts.items()):
        print(f"{kind}={amount} EJEMPLOS={', '.join(samples[kind][:5])}")
    return 1


if __name__ == "__main__":
    sys.exit(main())
