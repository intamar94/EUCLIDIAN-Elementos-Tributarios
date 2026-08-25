"""EUCLIDIAN — Corrección robusta de fechas.

Reutiliza toda la lógica de enriquecedor.py, pero corrige el punto que
provocaba fechas artificiales: la fecha entre paréntesis del encabezado es
la fecha del acto, mientras que cuando existe Diario Oficial la fecha de
publicación debe salir de esa referencia.

Regla:
1. Diario Oficial + fecha explícita -> fecha_publicacion.
2. Publicación explícita -> fecha_publicacion.
3. Fecha del acto (encabezado) -> fallback solo cuando no existe una fecha
   de publicación verificable.
4. Nunca se considera "fecha real" el 1 de enero artificial creado por el
   scraper si el documento oficial permite encontrar otra fecha.
"""

import re
import sys
from urllib.parse import urlparse

from enriquecedor import Enriquecedor as EnriquecedorBase, a_fecha

SOURCE_ROOTS = (
    "https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html",
    "https://normograma.dian.gov.co/dian/compilacion/tributario.html?q=TRIBUTARIO",
)
OFFICIAL_HOST = "normograma.dian.gov.co"
OFFICIAL_PREFIX = "/dian/compilacion/"


class EnriquecedorFechas(EnriquecedorBase):
    def _pendientes(self):
        """Toma tanto fechas artificiales como documentos nunca enriquecidos."""
        campos = "id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas"
        encontrados = {}

        def aplicar_filtro(q):
            if self.anio:
                return q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                    .lte("fecha_publicacion", f"{self.anio}-12-31")
            return q

        try:
            q = self.db.table("documentos_tributarios").select(campos) \
                .eq("fecha_es_real", False)
            r = aplicar_filtro(q).order("fecha_publicacion", desc=True) \
                .order("numero_resolucion", desc=True).limit(self.limite).execute()
            for d in r.data or []:
                encontrados[d["id"]] = d

            # El scraper inicial puso muchos documentos exactamente en 1 enero.
            # También reparamos esos aunque fecha_es_real haya quedado True.
            q = self.db.table("documentos_tributarios").select(campos) \
                .like("fecha_publicacion", "%-01-01")
            r = aplicar_filtro(q).order("fecha_publicacion", desc=True) \
                .order("numero_resolucion", desc=True).limit(self.limite).execute()
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
        """Extrae una fecha exacta, priorizando publicación sobre expedición."""
        # 1) Diario Oficial: evidencia directa de publicación.
        patrones_diario = [
            r"Diario Oficial[^\n]{0,100}?de\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"Diario Oficial[^\n]{0,100}?del\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_diario:
            m = re.search(patron, texto[:5000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        # 2) Frases explícitas de publicación.
        patrones_publicacion = [
            r"publicad[ao][^\n]{0,100}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"publicaci[oó]n[^\n]{0,100}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        for patron in patrones_publicacion:
            m = re.search(patron, texto[:10000], re.IGNORECASE)
            if m:
                f = a_fecha(m.group(1), m.group(2), m.group(3))
                if f:
                    return f

        # 3) Fallback: fecha del acto en el encabezado. Es real, pero no se
        # presenta como fecha de publicación cuando no hay evidencia de ella.
        anio = None
        m_anio = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:800])
        if m_anio:
            anio = m_anio.group(1)

        m = re.search(
            r"\(\s*([A-Za-záéíóúÁÉÍÓÚ]+)\s+(\d{1,2})\s*\)",
            texto[:1800], re.IGNORECASE,
        )
        if m and anio:
            f = a_fecha(m.group(2), m.group(1), anio)
            if f:
                return f

        m = re.search(
            r"\(\s*(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s*\)",
            texto[:1800], re.IGNORECASE,
        )
        if m and anio:
            f = a_fecha(m.group(1), m.group(2), anio)
            if f:
                return f

        m = re.search(
            r"Dad[oa][^\n]{0,80}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto[:12000], re.IGNORECASE,
        )
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f

        return None


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=150)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    EnriquecedorFechas(
        limite=args.limite,
        anio=args.anio,
        dry_run=args.dry_run,
    ).correr()
