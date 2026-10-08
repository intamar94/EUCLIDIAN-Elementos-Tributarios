"""EUCLIDIAN — cuarentena de fechas de publicación imposibles.

Una fecha de publicación futura no se puede considerar dato validado. Este
script no inventa una fecha: elimina únicamente el valor futuro, marca la
fecha como no real y retira la aprobación para envío. La reparación posterior
requiere evidencia oficial DIAN inequívoca.
"""
import logging
import os
import re
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

    # Un 1 de enero marcado como no verificado solo representa el año. Si el
    # catálogo lo vuelve a introducir, retirarlo antes de servirlo al cliente.
    ultimo_id = None
    retiradas = 0
    sospechosas = 0
    while True:
        q = (db.table("documentos_tributarios")
             .select("id,numero_resolucion,fecha_publicacion,anio_publicacion,notas_verificacion")
             .eq("fecha_es_real", False)
             .gte("fecha_publicacion", "1900-01-01"))
        if ultimo_id:
            q = q.gt("id", ultimo_id)
        lote = q.order("id").limit(500).execute().data or []
        if not lote:
            break
        for row in lote:
            fecha = str(row.get("fecha_publicacion") or "")
            anio = re.search(r"-((?:19|20)\d{2})$", str(row.get("numero_resolucion") or ""))
            if not fecha.endswith("-01-01"):
                continue
            if not anio or fecha[:4] != anio.group(1):
                sospechosas += 1
                log.error("MARCADOR_INCOHERENTE %s: %s", row["numero_resolucion"], fecha)
                continue
            nota = "fecha_marcador_retirada: " + fecha + "; año conservado desde identificador DIAN"
            anterior = str(row.get("notas_verificacion") or "").strip()
            campos = {
                "fecha_publicacion": None,
                "anio_publicacion": row.get("anio_publicacion") or int(anio.group(1)),
                "aprobado_para_email": False,
                "notas_verificacion": (anterior + " | " if anterior else "") + nota,
            }
            result = (db.table("documentos_tributarios").update(campos)
                      .eq("id", row["id"]).eq("fecha_publicacion", fecha)
                      .eq("fecha_es_real", False).execute())
            if not result.data:
                raise RuntimeError(f"No se pudo retirar el marcador de {row['numero_resolucion']}")
            retiradas += 1
        ultimo_id = lote[-1]["id"]
        if len(lote) < 500:
            break
    log.info("CUARENTENA_ENERO_NO_VERIFICADO: %d registros", retiradas)
    if sospechosas:
        raise RuntimeError(f"Hay {sospechosas} fechas 1 de enero no verificadas que requieren contraste individual")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
