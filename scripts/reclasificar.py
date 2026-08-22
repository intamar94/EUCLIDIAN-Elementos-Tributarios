"""
EUCLIDIAN — Elementos Tributarios
Reclasificador

Los 17.595 documentos se cargaron con el clasificador viejo, que tenia
dos defectos:

  - Etiquetaba por el nombre de la resolucion madre. La Resolucion 8 de
    2026, que trata de retencion sobre transporte de carga, quedo como
    "aduanero" y "cambiario" porque su descripcion menciona la
    "Resolucion unica en Materia Tributaria, Aduanera y Cambiaria".
  - Se perdian simbolos al extraer el HTML. "0.1porciento" en vez de
    "0.1 %".

Este script pasa el clasificador nuevo sobre todo lo que ya esta en la
base. No vuelve a la DIAN: trabaja sobre el texto guardado. Se puede
correr las veces que haga falta.

USO
---
    python reclasificar.py --dry-run      # muestra el antes y el despues
    python reclasificar.py                # aplica
    python reclasificar.py --anio 2026
"""

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import datetime, timezone

from clasificador import clasificar, etiqueta, extraer_materia, limpiar_texto

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

LOTE = 500


class Reclasificador:
    def __init__(self, anio=None, dry_run=False, limite=None):
        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.anio = anio
        self.dry_run = dry_run
        self.limite = limite
        self.stats = Counter()
        self.temas_antes = Counter()
        self.temas_despues = Counter()

    # ------------------------------------------------------------------

    def correr(self):
        log.info("=" * 62)
        log.info("EUCLIDIAN — reclasificacion%s",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 62)

        desplazamiento = 0
        while True:
            lote = self._leer(desplazamiento)
            if not lote:
                break
            self._procesar(lote)
            desplazamiento += len(lote)
            log.info("  %d documentos procesados", desplazamiento)
            if self.limite and desplazamiento >= self.limite:
                break
            if len(lote) < LOTE:
                break

        self._resumen()

    # ------------------------------------------------------------------

    def _leer(self, desplazamiento):
        q = self.db.table("documentos_tributarios").select(
            "id,numero_resolucion,titulo,contenido,temas,texto_completo"
        )
        if self.anio:
            q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                 .lte("fecha_publicacion", f"{self.anio}-12-31")
        try:
            r = q.order("numero_resolucion").range(
                desplazamiento, desplazamiento + LOTE - 1).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer: %s", str(e)[:200])
            sys.exit(1)

    # ------------------------------------------------------------------

    def _procesar(self, lote):
        cambios = []
        for d in lote:
            antes = [t for t in (d.get("temas") or []) if not t.startswith("dian:")]
            for t in antes:
                self.temas_antes[t] += 1

            materia, limpia = extraer_materia(d.get("contenido"))
            titulo = limpiar_texto(d.get("titulo"))
            temas = clasificar(
                titulo=titulo,
                descripcion=limpia,
                texto_completo=d.get("texto_completo") or "",
                materia=materia,
            )
            for t in temas:
                self.temas_despues[t] += 1

            # Conservar la clasificacion propia del arbol de la DIAN
            arbol = [t for t in (d.get("temas") or []) if t.startswith("dian:")]
            if "boletin_mensual" in (d.get("temas") or []):
                arbol.append("boletin_mensual")

            if set(antes) != set(temas):
                self.stats["temas_cambiados"] += 1
                if self.dry_run and self.stats["temas_cambiados"] <= 12:
                    log.info("  %s", d["numero_resolucion"])
                    log.info("     antes : %s", [etiqueta(t) for t in antes] or "—")
                    log.info("     ahora : %s", [etiqueta(t) for t in temas] or "—")

            if materia:
                self.stats[f"materia_{materia}"] += 1

            if limpia != (d.get("contenido") or "").strip():
                self.stats["texto_reparado"] += 1

            cambios.append({
                "id": d["id"],
                "materia": materia,
                "descripcion_limpia": limpia[:10000],
                "titulo": titulo[:500],
                "temas": list(dict.fromkeys(temas + arbol))[:25],
                "clasificado_en": datetime.now(timezone.utc).isoformat(),
            })

        if self.dry_run:
            return

        for i in range(0, len(cambios), 100):
            trozo = cambios[i:i + 100]
            for c in trozo:
                try:
                    fila = dict(c)
                    ident = fila.pop("id")
                    self.db.table("documentos_tributarios").update(fila).eq(
                        "id", ident).execute()
                    self.stats["actualizados"] += 1
                except Exception as e:
                    log.error("  fallo %s: %s", ident, str(e)[:140])
                    self.stats["errores"] += 1

    # ------------------------------------------------------------------

    def _resumen(self):
        log.info("")
        log.info("=" * 62)
        log.info("RESUMEN")
        log.info("=" * 62)
        for k in sorted(self.stats):
            log.info("  %-24s %s", k, self.stats[k])

        log.info("")
        log.info("TEMAS — antes / ahora")
        claves = sorted(set(self.temas_antes) | set(self.temas_despues),
                        key=lambda k: -self.temas_despues.get(k, 0))
        for k in claves[:28]:
            a = self.temas_antes.get(k, 0)
            b = self.temas_despues.get(k, 0)
            marca = ""
            if a and not b:
                marca = "  <- eliminado"
            elif b and not a:
                marca = "  <- nuevo"
            log.info("  %-28s %6d  ->  %6d%s", etiqueta(k), a, b, marca)


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--limite", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    Reclasificador(anio=args.anio, dry_run=args.dry_run,
                   limite=args.limite).correr()
