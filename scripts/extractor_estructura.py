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


class ExtractorEstructura(Lectores):
    def __init__(self, limite=500, anio=None, dry_run=False, rehacer=False):
        self.limite = limite
        self.rehacer = rehacer
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
            # Sin esto cada corrida volvia sobre los mismos documentos y
            # el archivo no avanzaba nunca.
            if not self.rehacer:
                q = q.is_("estructura_extraida_en", "null")
            if self.anio:
                q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                     .lte("fecha_publicacion", f"{self.anio}-12-31")
            # Supabase corta las consultas en 1.000 filas y no avisa: se
            # pedian 5.000 y devolvia 1.000, asi que cada corrida
            # avanzaba lo mismo y el archivo no terminaba nunca. Se pide
            # por tandas hasta juntar el limite.
            filas, desde, TANDA = [], 0, 1000
            while len(filas) < self.limite:
                falta = min(TANDA, self.limite - len(filas))
                r = q.order("fecha_publicacion", desc=True) \
                      .range(desde, desde + falta - 1).execute()
                lote = r.data or []
                filas.extend(lote)
                if len(lote) < falta:
                    break
                desde += falta
            return filas[:self.limite]
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

        interno = self._numero_interno(t)
        if interno:
            campos["numero_interno"] = interno[:20]

        fweb = self._fecha_web(t)
        if fweb:
            campos["fecha_publicacion_web"] = fweb.isoformat()

        banco = self._banco_datos(t)
        if banco:
            campos["banco_datos"] = banco[:200]

        dep = self._dependencia(t)
        if dep:
            campos["dependencia_emisora"] = dep[:160]

        citada = self._doctrina_citada(t, campos.get("numero_interno"))
        if citada:
            campos["doctrina_citada"] = citada[:20]

        juris = self._jurisprudencia(t)
        if juris:
            campos["jurisprudencia_citada"] = juris[:15]

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
    ap.add_argument("--rehacer", action="store_true",
                    help="Volver sobre los ya procesados")
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    ExtractorEstructura(limite=args.limite, anio=args.anio, rehacer=args.rehacer,
                        dry_run=args.dry_run).correr()
