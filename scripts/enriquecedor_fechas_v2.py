"""EUCLIDIAN — Reparador robusto de fechas.

Correccion de dos problemas del primer reparador:
1. PostgreSQL no permite usar LIKE directamente sobre una columna DATE.
2. El encabezado puede tener (mes dia) o (dia de mes), por lo que el
   extractor debe tratar ambos formatos por separado.

La fecha_publicacion se obtiene, en este orden, de:
- Diario Oficial No. X de DD de MES de AAAA.
- una frase explicita de publicacion.
- la fecha del acto como ultimo respaldo real.

El documento siempre se abre desde una URL del Normograma DIAN.
"""

import argparse
import re
import sys
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

            # PostgreSQL DATE no admite LIKE. Buscamos exactamente el 1 de
            # enero de cada año posible para reparar las fechas artificiales.
            for anio in range(1900, datetime.now().year + 2):
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
        """Devuelve la fecha de publicacion verificable o un fallback real."""
        # 1. Publicacion en Diario Oficial: maxima prioridad.
        patrones_diario = [
            r"Diario Oficial[^\n]{0,120}?de\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"Diario Oficial[^\n]{0,120}?del\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_diario:
            m = re.search(patron, texto[:6000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        # 2. Fecha de publicacion expresamente indicada.
        patrones_publicacion = [
            r"publicad[ao][^\n]{0,120}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"publicaci[oó]n[^\n]{0,120}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_publicacion:
            m = re.search(patron, texto[:12000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        # 3. Fallback: fecha del acto, que sigue siendo una fecha real,
        # pero no se presenta como fecha de publicacion cuando falta DO.
        m_anio = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:1000])
        anio = m_anio.group(1) if m_anio else None

        m = re.search(
            r"\(\s*([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{1,2})\s*\)",
            texto[:2200], re.IGNORECASE,
        )
        if m and anio:
            f = a_fecha(m.group(2), m.group(1), anio)
            if f:
                return f

        m = re.search(
            r"\(\s*(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s*\)",
            texto[:2200], re.IGNORECASE,
        )
        if m and anio:
            f = a_fecha(m.group(1), m.group(2), anio)
            if f:
                return f

        m = re.search(
            r"Dad[oa][^\n]{0,100}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto[:15000], re.IGNORECASE,
        )
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f

        return None


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=500)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    EnriquecedorFechasV2(
        limite=args.limite,
        anio=args.anio,
        dry_run=args.dry_run,
    ).correr()
