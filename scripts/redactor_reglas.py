"""
EUCLIDIAN — Elementos Tributarios
Redactor por reglas

LA IDEA
-------
No hace falta interpretar la norma para decirle a un contador lo que
necesita saber. Basta con aplicar reglas sobre hechos que ya tenemos
verificados del documento.

    HECHO VERIFICADO                  ->  CONSECUENCIA
    es un concepto de la DIAN             no te obliga, puedes discutirlo
    es resolucion o decreto               es de obligatorio cumplimiento
    tiene anotacion de suspension         no la apliques todavia
    menciona 2023 y es de 2026            revisa declaraciones presentadas
    trae un plazo con fecha               anota esa fecha
    aplica a unos departamentos           solo si tienes clientes ahi
    es un comite interno de la DIAN       no te aplica

Ninguna de esas conclusiones inventa nada. Todas se siguen mecanicamente
de un dato que el enriquecedor leyo del documento oficial.

VENTAJA SOBRE UN MODELO
-----------------------
Una regla solo puede decir lo que esta programada a decir. No hay
posibilidad de que alucine una tarifa, una fecha o un articulo. Y no
cuesta nada correrla.

Su limite es real: no puede razonar sobre un caso nuevo. Cuando el
documento no da para concluir, lo declara con confianza baja en vez de
disimularlo.

EL LENGUAJE
-----------
La DIAN escribe "Por la cual se adiciona la Seccion 5 al Capitulo 2 del
Titulo 8 de la Parte 1 de la Resolucion 000227". Eso describe DONDE se
guarda el texto, no que dice. Este redactor se queda con lo que va entre
comillas, que suele ser el asunto de verdad, y descarta la ubicacion.

USO
---
    python redactor_reglas.py --dry-run --limite 10
    python redactor_reglas.py --anio 2026
    python redactor_reglas.py --limite 500
"""

import argparse
import logging
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timezone

from composicion import Composicion

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
class RedactorReglas(Composicion):
    def __init__(self, limite=300, anio=None, dry_run=False, rehacer=False):
        self.limite = limite
        self.anio = anio
        self.dry_run = dry_run
        self.rehacer = rehacer
        self.stats = Counter()

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ==================================================================

    def correr(self):
        log.info("=" * 64)
        log.info("EUCLIDIAN — redaccion por reglas%s",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 64)

        docs = self._cola()
        if not docs:
            log.info("No hay documentos por redactar.")
            return
        log.info("%d documentos", len(docs))
        log.info("")

        for i, d in enumerate(docs, 1):
            ficha = self.componer(d)
            self.stats[f"confianza_{ficha['confianza']}"] += 1
            if ficha["interno"]:
                self.stats["interno_descartable"] += 1

            if self.dry_run and i <= 14:
                log.info("%s  [%s]%s", d["numero_resolucion"],
                         ficha["confianza"].upper(),
                         "  (interno)" if ficha["interno"] else "")
                log.info("   %s", ficha["resumen"])
                for a in ficha["advertencias"]:
                    log.info("   ojo: %s", a)
                log.info("")

            if not self.dry_run:
                self._guardar(d, ficha)

        self._resumen()

    # ------------------------------------------------------------------

    def _cola(self):
        try:
            q = self.db.table("documentos_tributarios").select(
                "id,numero_resolucion,tipo_documento,subtipo,titulo,contenido,"
                "descripcion_limpia,fecha_publicacion,fecha_es_real,"
                "estado_vigencia,clasificacion_obligatoriedad,temas,"
                "tiene_efectos_retroactivos,anos_afectados,zonas_afectadas,"
                "plazos_mencionados,anotaciones_vigencia,fecha_entrada_vigencia,"
                "diario_oficial,resumen_humano,tesis_juridica,tesis_respuesta,"
                "problema_juridico,fuentes_formales,descriptores,"
                "numero_interno,fecha_publicacion_web,banco_datos"
            ).is_("resumen_humano", "null")
            if not self.rehacer:
                q = q.is_("resumen_borrador", "null")
            if self.anio:
                q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                     .lte("fecha_publicacion", f"{self.anio}-12-31")
            r = q.order("fecha_publicacion", desc=True).limit(self.limite).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer: %s", str(e)[:200])
            sys.exit(1)

    # ==================================================================
    # Composicion
    # ==================================================================

    def _guardar(self, d, ficha):
        try:
            campos = {
                "resumen_borrador": ficha["resumen"],
                "borrador_confianza": ficha["confianza"],
                "borrador_advertencias": ficha["advertencias"],
                "borrador_modelo": "reglas-v2",
                "borrador_generado_en": datetime.now(timezone.utc).isoformat(),
            }
            if ficha["interno"]:
                # Se marca revisado para que no estorbe en la bandeja, y
                # se corrige la obligatoriedad para que ni la bandeja ni
                # el correo digan que obliga a alguien.
                campos["revisado_por_humano"] = True
                campos["clasificacion_obligatoriedad"] = "orientativo"
                temas = [t for t in (d.get("temas") or []) if t != "interno_dian"]
                campos["temas"] = temas + ["interno_dian"]
            self.db.table("documentos_tributarios").update(campos).eq(
                "id", d["id"]).execute()
            self.stats["guardados"] += 1
        except Exception as e:
            log.error("  no se pudo guardar %s: %s",
                      d["numero_resolucion"], str(e)[:150])
            self.stats["errores"] += 1

    def _resumen(self):
        log.info("")
        log.info("=" * 64)
        log.info("RESUMEN")
        log.info("=" * 64)
        for k in sorted(self.stats):
            log.info("  %-26s %s", k, self.stats[k])
        if self.stats["interno_descartable"] and not self.dry_run:
            log.info("")
            log.info("Los %d documentos internos de la DIAN quedaron marcados",
                     self.stats["interno_descartable"])
            log.info("como revisados: no apareceran en la bandeja.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=300)
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    ap.add_argument("--rehacer", action="store_true",
                    help="Rehacer tambien los que ya tienen borrador")
    args = ap.parse_args()

    RedactorReglas(limite=args.limite, anio=args.anio,
                   dry_run=args.dry_run, rehacer=args.rehacer).correr()
