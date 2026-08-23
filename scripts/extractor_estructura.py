"""
EUCLIDIAN — Elementos Tributarios
Extractor de estructura

EL HALLAZGO
-----------
Los conceptos de la DIAN no son prosa suelta: tienen una estructura fija
que estaba en texto_completo sin que nadie la leyera.

    Área del Derecho
    Tributario
    Banco de Datos
    Gravamen a los Movimientos Financieros
    Descriptores
    Tema: Gravamen a los movimientos financieros - GMF
    Descriptores: Traslados
    Fuentes Formales
    Artículo 879 del Estatuto Tributario
    Problema Jurídico
    ¿Se causa el GMF en los traslados entre cuentas...?
    Tesis Jurídica
    No. El traslado entre cuentas de un mismo titular...
    Fundamentación

La TESIS JURÍDICA es lo que importa: empieza con "Si" o "No" y responde
la pregunta. Es la conclusion, no el tema.

Hasta ahora la ficha decia de que trataba el concepto. Con la tesis dice
que concluyo la DIAN, que es lo unico que un contador necesita saber.

Y las FUENTES FORMALES dicen que articulos del Estatuto interpreta. Eso
permite que un contador busque "todo lo que toca el articulo 879".

PRINCIPIO
---------
Nada de esto se redacta ni se resume. Se copia literal del documento y
se guarda con su origen. Si el patron no calza con certeza, se deja
vacio: un campo en blanco es honesto, uno mal extraido no.

USO
---
    python extractor_estructura.py --dry-run --limite 10
    python extractor_estructura.py --anio 2026
"""

import argparse
import logging
import os
import re
import sys
from collections import Counter
from datetime import datetime, timezone

from lectores_dian import Lectores
from patrones_dian import limpiar

try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase")
    sys.exit(1)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Encabezados que cierran una seccion. Sirven de tope para no arrastrar
# texto de la seccion siguiente.
CIERRES = (
    r"Fundamentaci[oó]n|Fuentes Formales|Descriptores|Problema Jur[ií]dico|"
    r"Tesis Jur[ií]dica|Extracto|Banco de Datos|[AÁ]rea del Derecho|"
    r"Atentamente|Cordialmente|Proyect[oó]|Aprob[oó]|"
    r"En los anteriores t[eé]rminos"
)


def limpiar(t):
    """El HTML del normograma parte los numeros en lineas propias porque
    son enlaces. Hay que volver a unirlos antes de leer."""
    if not t:
        return ""
    t = re.sub(r"[ \t\xa0]+", " ", t)
    t = re.sub(r"\n(?=\s*\d{1,4}\s*\n)", " ", t)   # numero suelto
    t = re.sub(r"\n(?=\s*(?:del|de la|de|y)\s)", " ", t)
    t = re.sub(r"\s*\n\s*", "\n", t)
    return t.strip()


class ExtractorEstructura(Lectores):
    def __init__(self, limite=500, anio=None, dry_run=False):
        self.limite = limite
        self.anio = anio
        self.dry_run = dry_run
        self.stats = Counter()

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ==================================================================

    def correr(self):
        log.info("=" * 62)
        log.info("EUCLIDIAN — extraccion de estructura%s",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 62)

        docs = self._cola()
        if not docs:
            log.info("No hay documentos con texto por procesar.")
            return
        log.info("%d documentos", len(docs))
        log.info("")

        mostrados = 0
        for d in docs:
            campos = self.extraer(d.get("texto_completo"))
            if not campos:
                self.stats["sin_estructura"] += 1
                continue

            if campos.get("tesis_juridica"):
                self.stats["con_tesis"] += 1
            if campos.get("fuentes_formales"):
                self.stats["con_fuentes"] += 1
            if campos.get("descriptores"):
                self.stats["con_descriptores"] += 1
            if campos.get("problema_juridico"):
                self.stats["con_problema"] += 1

            if self.dry_run and mostrados < 8 and campos.get("tesis_juridica"):
                mostrados += 1
                log.info("%s", d["numero_resolucion"])
                if campos.get("problema_juridico"):
                    log.info("   PREGUNTA: %s", campos["problema_juridico"][:130])
                log.info("   RESPUESTA [%s]: %s",
                         campos.get("tesis_respuesta", "?"),
                         campos["tesis_juridica"][:170])
                if campos.get("fuentes_formales"):
                    log.info("   FUENTES: %s", " · ".join(campos["fuentes_formales"][:3]))
                log.info("")

            if not self.dry_run:
                self._guardar(d["id"], campos)

        self._resumen()

    # ------------------------------------------------------------------

    def _cola(self):
        try:
            q = self.db.table("documentos_tributarios").select(
                "id,numero_resolucion,texto_completo"
            ).not_.is_("texto_completo", "null")
            if self.anio:
                q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                     .lte("fecha_publicacion", f"{self.anio}-12-31")
            r = q.order("fecha_publicacion", desc=True).limit(self.limite).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer: %s", str(e)[:200])
            sys.exit(1)

    # ==================================================================
    # Extraccion
    # ==================================================================

    def extraer(self, texto):
        if not texto:
            return None
        t = limpiar(texto)
        campos = {}

        area = self._area(t)
        if area:
            campos["area_derecho"] = area[:60]

        desc = self._descriptores(t)
        if desc:
            campos["descriptores"] = desc[:12]

        fuentes = self._fuentes(t)
        if fuentes:
            campos["fuentes_formales"] = fuentes[:15]

        problema = self._problema(t)
        if problema:
            campos["problema_juridico"] = problema[:1200]

        tesis, respuesta = self._tesis(t)
        if tesis:
            campos["tesis_juridica"] = tesis[:2500]
            if respuesta:
                campos["tesis_respuesta"] = respuesta

        return campos or None

    # ------------------------------------------------------------------

    def _area(self, t):
        m = re.search(r"[AÁ]rea del Derecho\s*\n\s*([A-Za-zÁÉÍÓÚáéíóúñ ]{4,40})", t)
        return m.group(1).strip() if m else None

    def _bloque(self, t, encabezado):
        """
        Devuelve las lineas de una seccion, SIN aplanarlas. Aplanar fue el
        primer error: los saltos de linea son lo que separa una fuente de
        la siguiente, y al quitarlos quedaban pegadas.
        """
        m = re.search(rf"^{encabezado}\s*\n(.{{5,1200}}?)(?=\n\s*(?:{CIERRES})\s*\n)",
                      t, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if not m:
            m = re.search(rf"^{encabezado}\s*\n(.{{5,1200}}?)(?=\n\s*\n)",
                          t, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if not m:
            return []
        return [re.sub(r"\s+", " ", l).strip(" .,;·-")
                for l in m.group(1).split("\n") if l.strip()]

    def _descriptores(self, t):
        """
        Vienen de dos formas segun el concepto:
            Descriptores          |  Descriptores
            Tema: GMF             |  Empresas de transporte
            Descriptores: Traslados  Agente de retencion
        """
        salida = []
        for linea in self._bloque(t, r"Descriptores"):
            linea = re.sub(r"^(?:Tema|Descriptores)\s*:\s*", "", linea,
                           flags=re.IGNORECASE)
            for parte in re.split(r"\s+[-–]\s+|;", linea):
                parte = parte.strip(" .·")
                if 3 < len(parte) < 90 and parte not in salida:
                    salida.append(parte)
        # Formato antiguo, con la etiqueta en la misma linea
        for etiqueta in ("Tema", "Descriptores"):
            for m in re.finditer(rf"^{etiqueta}\s*:\s*(.+)$", t, re.MULTILINE):
                for parte in re.split(r"\s+[-–]\s+|;", m.group(1)):
                    parte = parte.strip(" .·")
                    if 3 < len(parte) < 90 and parte not in salida:
                        salida.append(parte)
        return salida

    def _fuentes(self, t):
        """
        Los articulos que el documento interpreta, uno por linea.
        Permite despues buscar "todo lo que toca el articulo 911".
        """
        salida = []
        for linea in self._bloque(t, r"Fuentes Formales"):
            if len(linea) < 6 or len(linea) > 160:
                continue
            if not re.search(r"art[ií]culo|ley|decreto|resoluci[oó]n|"
                             r"estatuto|c[oó]digo|constituci[oó]n|sentencia",
                             linea, re.IGNORECASE):
                continue
            if linea not in salida:
                salida.append(linea)
        return salida

    def _problema(self, t):
        m = re.search(rf"Problema Jur[ií]dico\s*\n(.{{15,1400}}?)(?=\n(?:{CIERRES}))",
                      t, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        p = re.sub(r"\s+", " ", m.group(1)).strip()
        p = re.sub(r"^(?:PROBLEMA JUR[IÍ]DICO\s*(?:No\.?\s*\d+)?\s*[:.]?\s*)", "", p,
                   flags=re.IGNORECASE)
        return p if len(p) > 15 else None

    def _tesis(self, t):
        """
        La conclusion. Suele empezar con Si o No, a veces precedida de
        "TESIS JURIDICA No. 1" cuando el concepto responde varias cosas.
        """
        m = re.search(rf"Tesis Jur[ií]dica\s*\n(.{{15,2600}}?)(?=\n(?:{CIERRES}))",
                      t, re.DOTALL | re.IGNORECASE)
        if not m:
            return None, None

        cuerpo = re.sub(r"\s+", " ", m.group(1)).strip()
        cuerpo = re.sub(r"^(?:TESIS JUR[IÍ]DICA\s*(?:No\.?\s*\d+)?\s*[:.]?\s*)", "",
                        cuerpo, flags=re.IGNORECASE).strip()

        respuesta = None
        mr = re.match(r"^(S[ií]|No)\b.?,?\s*", cuerpo, re.IGNORECASE)
        if mr:
            crudo = mr.group(1).lower()
            respuesta = "si" if crudo.startswith("s") else "no"
        elif re.match(r"^(Depende|En principio|Parcialmente|Solo|S[oó]lo)\b",
                      cuerpo, re.IGNORECASE):
            respuesta = "matizada"

        return (cuerpo, respuesta) if len(cuerpo) > 15 else (None, None)

    # ==================================================================

    def _guardar(self, ident, campos):
        campos = dict(campos)
        campos["estructura_extraida_en"] = datetime.now(timezone.utc).isoformat()
        try:
            self.db.table("documentos_tributarios").update(campos).eq(
                "id", ident).execute()
            self.stats["guardados"] += 1
        except Exception as e:
            log.error("  no se pudo guardar %s: %s", ident, str(e)[:140])
            self.stats["errores"] += 1

    def _resumen(self):
        log.info("")
        log.info("=" * 62)
        log.info("RESUMEN")
        log.info("=" * 62)
        for k in sorted(self.stats):
            log.info("  %-22s %s", k, self.stats[k])
        if self.stats["con_tesis"]:
            log.info("")
            log.info("La tesis juridica es la conclusion literal del documento.")
            log.info("Con ella la ficha dice que respondio la DIAN, no de que trata.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=500)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    ExtractorEstructura(limite=args.limite, anio=args.anio,
                        dry_run=args.dry_run).correr()
