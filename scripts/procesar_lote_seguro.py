"""EUCLIDIAN — procesamiento incremental seguro del universo documental.

Revisa solo documentos todavía no aprobados. Esto permite avanzar por lotes
sin volver a descargar indefinidamente los registros ya validados.
Nunca aprueba un documento sin evidencia en el Normograma DIAN.
"""
import argparse, logging, os
import requests
from supabase import create_client
from verificador_aprobacion import validate_sources, verify, PAGE

log = logging.getLogger("euclidian.lote")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")

FIELDS = ("id,numero_resolucion,contenido,descripcion_limpia,resumen_humano,"
          "resumen_borrador,enlace_oficial,fecha_publicacion,fecha_es_real,"
          "tesis_juridica,entidad_emisora,estado_vigencia")


def iter_pending(db, limit):
    offset = 0
    while offset < limit:
        size = min(PAGE, limit - offset)
        rows = (db.table("documentos_tributarios").select(FIELDS)
                .eq("aprobado_para_email", False)
                .order("id", desc=False)
                .range(offset, offset + size - 1).execute().data or [])
        if not rows:
            break
        for row in rows:
            yield row
        offset += len(rows)
        if len(rows) < size:
            break


def main(apply=False, limit=1000):
    url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db = create_client(url, key)
    session = requests.Session()
    session.headers.update({"User-Agent":"EUCLIDIAN/1.3 (lote seguro)","Accept-Language":"es-CO,es;q=0.9"})
    validate_sources(session)
    total = good = bad = 0
    for doc in iter_pending(db, limit):
        total += 1
        ok, errors = verify(session, doc)
        if ok:
            good += 1
            if apply:
                db.table("documentos_tributarios").update({
                    "aprobado_para_email": True,
                    "borrador_confianza": "alta",
                    "borrador_advertencias": [],
                }).eq("id", doc["id"]).execute()
        else:
            bad += 1
            if apply:
                db.table("documentos_tributarios").update({
                    "aprobado_para_email": False,
                    "borrador_confianza": "no_aprobado",
                    "borrador_advertencias": errors[:12],
                }).eq("id", doc["id"]).execute()
        if total % 100 == 0:
            log.info("PROGRESO revisados=%d aptos=%d bloqueados=%d", total, good, bad)
    log.info("RESULTADO %s: revisados=%d aptos=%d bloqueados=%d", "APLICADO" if apply else "AUDITORIA", total, good, bad)
    return 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--apply", action="store_true")
    ap.add_argument("--limite", type=int, default=1000)
    args = ap.parse_args()
    raise SystemExit(main(args.apply, args.limite))
