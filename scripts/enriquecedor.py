"""EUCLIDIAN — Elementos Tributarios
Enriquecedor de documentos

POR QUE EXISTE
--------------
El scraper toma los listados del normograma, que solo traen el anio en la
URL. Por eso los 17.595 documentos quedaron con fecha 1 de enero. Sin dia
y mes reales no hay boletin semanal: no se puede saber que cambio esta
semana.

La fecha real esta dentro de cada documento. Y ahi tambien esta lo demas
que faltaba:

    DECRETO <LEGISLATIVO> 0173 DE 2026
    (febrero 24)                          <- fecha real
    Diario Oficial No. 53.409 de 24 de febrero de 2026
    MINISTERIO DE HACIENDA Y CREDITO PUBLICO   <- entidad
    ...
    <Ver SUSPENSION parcial por el Auto A-533-26>   <- la Corte lo suspendio
    <Numeral modificado por el articulo 17 del Decreto 240 de 2026>
    ARTICULO 8o. VIGENCIA. ...

Esas marcas entre < > son anotaciones del normograma. Declaran
suspensiones, modificaciones y derogatorias en el cuerpo mismo de la
norma. Es la fuente mas confiable que tenemos para el estado de vigencia,
porque la escribe el compilador juridico, no nosotros.

QUE HACE
--------
1. Toma documentos sin fecha real, empezando por los mas recientes.
2. Abre el documento oficial.
3. Extrae fecha, Diario Oficial, entidad, vigencia, plazos y anotaciones.
4. Detecta retroactividad y zonas de emergencia.
5. Crea alertas cuando encuentra algo que un contador no puede pasar por
   alto: suspension por la Corte, cambio de calendario, efecto retroactivo.
6. Guarda el texto completo, que es la materia prima del correo.

QUE NO HACE
-----------
No interpreta ni resume. Copia lo que dice la norma y lo deja marcado
para que tú lo leas. aprobado_para_email no se toca nunca aqui.

USO
---
    python enriquecedor.py                 # 150 mas recientes
    python enriquecedor.py --limite 400
    python enriquecedor.py --anio 2026
    python enriquecedor.py --dry-run
"""

import argparse
import logging
import os
import re
import sys
import time
from collections import Counter
from datetime import date, datetime, timezone

import requests

from alertas import Alertas
from patrones_dian import a_fecha
from lector_documento import LectorDocumento
from bs4 import BeautifulSoup

try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase")
    sys.exit(1)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-7s %(message)s",
    datefmt="%H:%M:%S",
)
log = logging.getLogger("euclidian")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

TIMEOUT = 30
PAUSA = 0.8




class Enriquecedor(LectorDocumento, Alertas):
    def __init__(self, limite=150, anio=None, dry_run=False, minutos=0):
        # Tope de reloj. GitHub corta a las 6 horas, y quedarse a medias
        # sin cerrar bien deja la corrida sin resumen y sin saber donde
        # quedo. Con un tope propio el proceso para solo, informa cuanto
        # avanzo y cuanto falta, y la siguiente corrida sigue desde ahi.
        self.minutos = minutos
        self.inicio = time.monotonic()
        self.limite = limite
        self.anio = anio
        self.dry_run = dry_run
        self.stats = Counter()

        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            ),
            "Accept-Language": "es-CO,es;q=0.9",
        })

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ==================================================================

    def correr(self):
        log.info("=" * 60)
        log.info("EUCLIDIAN — enriquecedor de documentos")
        log.info("limite: %d%s%s%s", self.limite,
                 f"  anio: {self.anio}" if self.anio else "",
                 f"  tope: {self.minutos} min" if self.minutos else "",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 60)

        pendientes = self._pendientes()
        if not pendientes:
            log.info("No hay documentos por enriquecer.")
            self._faltantes()
            return
        log.info("%d documentos por abrir", len(pendientes))

        cortado = False
        for i, doc in enumerate(pendientes, 1):
            if self._sin_tiempo():
                log.info("")
                log.info("Tope de %d minutos alcanzado en el documento %d.",
                         self.minutos, i - 1)
                log.info("Lo procesado queda guardado; la proxima corrida "
                         "sigue desde aqui.")
                cortado = True
                break
            time.sleep(PAUSA)
            self._enriquecer(doc, i, len(pendientes))

        self._resumen()
        self._faltantes()
        if cortado:
            log.info("")
            log.info("Corrida detenida a tiempo, no por error.")

    # ------------------------------------------------------------------

    def _faltantes(self):
        """
        Cuantos quedan por abrir. Sin este dato no hay forma de saber si
        una corrida termino el trabajo o solo avanzo un tramo.
        """
        try:
            q = self.db.table("documentos_tributarios").select(
                "id", count="exact").eq("fecha_es_real", False)
            if self.anio:
                q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                     .lte("fecha_publicacion", f"{self.anio}-12-31")
            r = q.limit(1).execute()
            quedan = r.count or 0
        except Exception:
            return
        log.info("")
        if quedan:
            vueltas = -(-quedan // max(self.limite, 1))
            log.info("Quedan %d documentos por enriquecer%s.", quedan,
                     f" de {self.anio}" if self.anio else "")
            log.info("A este ritmo son unas %d corridas mas.", vueltas)
        else:
            log.info("No queda ninguno por enriquecer%s.",
                     f" de {self.anio}" if self.anio else "")

    def _sin_tiempo(self):
        if not self.minutos:
            return False
        return (time.monotonic() - self.inicio) > self.minutos * 60

    def _pendientes(self):
        q = self.db.table("documentos_tributarios").select(
            "id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas"
        ).eq("fecha_es_real", False)

        if self.anio:
            q = q.gte("fecha_publicacion", f"{self.anio}-01-01") \
                 .lte("fecha_publicacion", f"{self.anio}-12-31")

        try:
            r = q.order("fecha_publicacion", desc=True) \
                 .order("numero_resolucion", desc=True) \
                 .limit(self.limite).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer la lista: %s", str(e)[:200])
            sys.exit(1)

    # ------------------------------------------------------------------

    def _enriquecer(self, doc, i, total):
        url = doc["enlace_oficial"]
        try:
            r = self.s.get(url, timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            log.warning("[%d/%d] %s  red: %s", i, total,
                        doc["numero_resolucion"], str(e)[:70])
            self.stats["error_red"] += 1
            return

        if r.status_code != 200:
            log.warning("[%d/%d] %s  HTTP %s", i, total,
                        doc["numero_resolucion"], r.status_code)
            self.stats["http_error"] += 1
            return

        soup = BeautifulSoup(r.text, "html.parser")
        for basura in soup(["script", "style", "nav", "footer"]):
            basura.decompose()
        texto = re.sub(r"[ \t]+", " ", soup.get_text("\n"))
        texto = re.sub(r"\n{3,}", "\n\n", texto).strip()

        campos = {
            "texto_completo": texto[:60000],
            "enriquecido_en": datetime.now(timezone.utc).isoformat(),
        }

        fecha = self._fecha(texto)
        if fecha:
            campos["fecha_publicacion"] = fecha.isoformat()
            campos["fecha_es_real"] = True
            self.stats["fecha_hallada"] += 1
        else:
            self.stats["fecha_no_hallada"] += 1

        diario = self._diario_oficial(texto)
        if diario:
            campos["diario_oficial"] = diario[:120]
            self.stats["con_diario_oficial"] += 1

        entidad = self._entidad(texto)
        if entidad:
            campos["entidad_emisora"] = entidad[:200]

        vig = self._vigencia(texto)
        if vig:
            campos["fecha_entrada_vigencia"] = vig.isoformat()

        anotaciones = self._anotaciones(r.text, texto)
        if anotaciones:
            campos["anotaciones_vigencia"] = anotaciones[:25]

        retro, anios = self._retroactividad(texto)
        if retro:
            campos["tiene_efectos_retroactivos"] = True
            campos["anos_afectados"] = anios
            self.stats["retroactivos"] += 1

        zonas = self._zonas(texto)
        if zonas:
            campos["zonas_afectadas"] = zonas
            self.stats["con_zonas"] += 1

        plazos = self._plazos(texto)
        if plazos:
            campos["plazos_mencionados"] = plazos[:12]
            self.stats["con_plazos"] += 1

        # Estado de vigencia segun las anotaciones del compilador
        estado, motivo = self._estado(anotaciones)
        if estado:
            campos["estado_vigencia"] = estado
            campos["motivo_cambio_estado"] = motivo[:500]
            self.stats[f"estado_{estado}"] += 1

        if self.dry_run:
            log.info("[%d/%d] %s  fecha=%s  DO=%s  anot=%d  retro=%s  zonas=%d",
                     i, total, doc["numero_resolucion"],
                     fecha or "-", "si" if diario else "-",
                     len(anotaciones), retro, len(zonas))
            return

        try:
            self.db.table("documentos_tributarios").update(campos).eq(
                "id", doc["id"]).execute()
            self.stats["actualizados"] += 1
        except Exception as e:
            log.error("  no se pudo guardar %s: %s",
                      doc["numero_resolucion"], str(e)[:160])
            self.stats["error_guardado"] += 1
            return

        self._alertas(doc, campos, anotaciones, retro, zonas)

        log.info("[%d/%d] %s  %s  %s",
                 i, total, doc["numero_resolucion"],
                 fecha or "sin fecha",
                 " ".join(filter(None, [
                     "DO" if diario else "",
                     f"{len(anotaciones)}anot" if anotaciones else "",
                     "RETRO" if retro else "",
                     f"{len(zonas)}zonas" if zonas else "",
                     estado.upper() if estado else "",
                 ])))

    # ==================================================================
    # Extractores
    # ==================================================================
    def _resumen(self):
        log.info("")
        log.info("=" * 60)
        log.info("RESUMEN")
        log.info("=" * 60)
        for k in sorted(self.stats):
            log.info("  %-24s %s", k, self.stats[k])
        if not self.dry_run:
            log.info("")
            log.info("Las alertas entran sin aprobar. Revísalas en la bandeja.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--limite", type=int, default=150)
    ap.add_argument("--minutos", type=int, default=0,
                    help="Tope de reloj. 0 = sin tope.")
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    Enriquecedor(limite=args.limite, anio=args.anio, minutos=args.minutos,
                 dry_run=args.dry_run).correr()
