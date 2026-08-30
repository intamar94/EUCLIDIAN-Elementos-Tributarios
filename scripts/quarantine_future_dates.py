"""EUCLIDIAN — cuarentena de fechas de publicación imposibles.

Una fecha de publicación futura no se puede considerar dato validado. Este
script no inventa una fecha: elimina únicamente el valor futuro, marca la
fecha como no real y retira la aprobación para envío. La reparación posterior
requiere evidencia oficial DIAN inequívoca.
"""
import logging
import os
from datetime import date
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
log = logging.getLogger("euclidian.quarantine")


def main():
    url = os.getenv("SUPABASE_URL")
    key = os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key:
        raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")

    db = create_client(url, key)
    hoy = date.today().isoformat()
    rows = (
        db.table("documentos_tributarios")
        .select("id,numero_resolucion,fecha_publicacion,fecha_es_real,aprobado_para_email")
        .gt("fecha_publicacion", hoy)
        .execute()
        .data
        or []
    )

    if not rows:
        log.info("CUARENTENA_FUTURAS: ninguna fecha futura")
        return 0

    for row in rows:
        result = (
            db.table("documentos_tributarios")
            .update({
                "fecha_publicacion": None,
                "fecha_es_real": False,
                "aprobado_para_email": False,
            })
            .eq("id", row["id"])
            .eq("numero_resolucion", row["numero_resolucion"])
            .execute()
        )
        if not result.data:
            raise RuntimeError(f"No se pudo poner en cuarentena {row['numero_resolucion']}")
        log.warning(
            "CUARENTENA %s: fecha futura %s eliminada; requiere evidencia DIAN",
            row["numero_resolucion"],
            row["fecha_publicacion"],
        )

    log.info("CUARENTENA_FUTURAS: %d registros", len(rows))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
