"""EUCLIDIAN — Reparador de fechas, seguro y reanudable.

Reglas de integridad:
- fecha_publicacion solo se escribe cuando el documento oficial contiene
  evidencia de publicacion/Diario Oficial.
- La fecha del acto NO se usa como fecha de publicacion.
- Un 01-01 artificial nunca se considera una fecha verificada.
- Cada documento se guarda individualmente: si GitHub interrumpe la corrida,
  la siguiente ejecucion continua con los pendientes.
"""

import argparse
import re
import sys
import time
from datetime import datetime
from urllib.parse import urlparse

from enriquecedor_fechas import EnriquecedorFechas, OFFICIAL_HOST, OFFICIAL_PREFIX, a_fecha


class EnriquecedorFechasV2(EnriquecedorFechas):
    def _pendientes(self):
        campos = "id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas"
        encontrados = {}

        try:
            r = self.db.table("documentos_tributarios").select(campos) \
                .eq("fecha_es_real", False) \
                .order("fecha_publicacion", desc=True) \
                .order("numero_resolucion", desc=True) \
                .limit(self.limite).execute()
            for d in r.data or []:
                encontrados[d["id"]] = d

            # Reparar registros antiguos que quedaron marcados como reales
            # pero conservan la fecha artificial 1 de enero. No recorremos
            # 1900-2027: solo los años razonablemente presentes en la base.
            anio_inicio = 1950
            anio_fin = datetime.now().year + 1
            for anio in range(anio_inicio, anio_fin + 1):
                r = self.db.table("documentos_tributarios").select(campos) \
                    .eq("fecha_publicacion", f"{anio}-01-01") \
                    .limit(self.limite).execute()
                for d in r.data or []:
                    encontrados[d["id"]] = d
        except Exception as e:
            print(f"No se pudo leer la cola de fechas: {str(e)[:300]}", file=sys.stderr)
            raise SystemExit(1)

        return list(encontrados.values())[: self.limite]

    def _enriquecer(self, doc, i, total):
        url = doc.get("enlace_oficial") or ""
        p = urlparse(url)
        if p.netloc != OFFICIAL_HOST or not p.path.startswith(OFFICIAL_PREFIX):
            self.stats["url_no_oficial"] += 1
            print(f"[{i}/{total}] {doc.get('numero_resolucion')} OMITIDO: URL no oficial: {url}")
            return
        super()._enriquecer(doc, i, total)

    def _fecha(self, texto):
        """Devuelve SOLO una fecha de publicacion verificable."""
        patrones_diario = [
            r"Diario Oficial[^\n]{0,140}?de\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"Diario Oficial[^\n]{0,140}?del\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_diario:
            m = re.search(patron, texto[:12000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        patrones_publicacion = [
            r"publicad[ao][^\n]{0,160}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"publicaci[oó]n[^\n]{0,160}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_publicacion:
            m = re.search(patron, texto[:20000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        # Sin evidencia de publicacion: NO inventamos ni reutilizamos la
        # fecha de expedicion. El documento permanece pendiente para control.
        return None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=250)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    EnriquecedorFechasV2(
        limite=args.limite,
        anio=args.anio,
        dry_run=args.dry_run,
    ).correr()
