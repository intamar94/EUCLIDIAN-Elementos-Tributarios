"""
EUCLIDIAN — Elementos Tributarios
Enriquecedor de documentos

Abre cada documento oficial del Normograma DIAN, extrae sus datos y guarda
cada documento de forma independiente. La base funciona como checkpoint:
si una ejecucion se interrumpe, la siguiente continua con los pendientes.
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
from bs4 import BeautifulSoup

try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase")
    sys.exit(1)

logging.basicConfig(level=logging.INFO, format="%(asctime)s  %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
TIMEOUT = 30
PAUSA = 0.15
MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}
DEPARTAMENTOS = [
    "Amazonas", "Antioquia", "Arauca", "Atlantico", "Atlántico", "Bolivar", "Bolívar",
    "Boyaca", "Boyacá", "Caldas", "Caqueta", "Caquetá", "Casanare", "Cauca", "Cesar",
    "Choco", "Chocó", "Cordoba", "Córdoba", "Cundinamarca", "Guainia", "Guainía",
    "Guaviare", "Huila", "La Guajira", "Magdalena", "Meta", "Narino", "Nariño",
    "Norte de Santander", "Putumayo", "Quindio", "Quindío", "Risaralda", "San Andres",
    "San Andrés", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupes", "Vaupés",
    "Vichada", "Bogota", "Bogotá",
]

def a_fecha(dia, mes_txt, anio):
    mes = MESES.get(mes_txt.lower().strip())
    if not mes:
        return None
    try:
        return date(int(anio), mes, int(dia))
    except ValueError:
        return None

class Enriquecedor:
    def __init__(self, limite=150, anio=None, dry_run=False):
        self.limite = limite
        self.anio = anio
        self.dry_run = dry_run
        self.stats = Counter()
        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": "EUCLIDIAN/1.0 (Normograma DIAN; enriquecimiento)",
            "Accept-Language": "es-CO,es;q=0.9",
        })
        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

    def correr(self):
        pendientes = self._pendientes()
        if not pendientes:
            log.info("No hay documentos por enriquecer.")
            return
        log.info("%d documentos por abrir", len(pendientes))
        for i, doc in enumerate(pendientes, 1):
            if PAUSA:
                time.sleep(PAUSA)
            self._enriquecer(doc, i, len(pendientes))
        self._resumen()

    def _pendientes(self):
        q = self.db.table("documentos_tributarios").select(
            "id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas"
        ).eq("fecha_es_real", False)
        if self.anio:
            q = q.gte("fecha_publicacion", f"{self.anio}-01-01").lte("fecha_publicacion", f"{self.anio}-12-31")
        try:
            r = q.order("fecha_publicacion", desc=True).order("numero_resolucion", desc=True).limit(self.limite).execute()
            return r.data or []
        except Exception as e:
            log.error("No se pudo leer la lista: %s", str(e)[:200])
            sys.exit(1)

    def _enriquecer(self, doc, i, total):
        url = doc.get("enlace_oficial") or ""
        try:
            r = self.s.get(url, timeout=TIMEOUT)
            if r.status_code == 429:
                time.sleep(2)
                r = self.s.get(url, timeout=TIMEOUT)
            r.raise_for_status()
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            log.warning("[%d/%d] %s red: %s", i, total, doc.get("numero_resolucion"), str(e)[:100])
            self.stats["error_red"] += 1
            return

        soup = BeautifulSoup(r.text, "html.parser")
        for basura in soup(["script", "style", "nav", "footer"]):
            basura.decompose()
        texto = re.sub(r"[ \t]+", " ", soup.get_text("\n"))
        texto = re.sub(r"\n{3,}", "\n\n", texto).strip()
        campos = {"texto_completo": texto[:60000], "enriquecido_en": datetime.now(timezone.utc).isoformat()}

        fecha = self._fecha(texto)
        if fecha:
            campos["fecha_publicacion"] = fecha.isoformat()
            campos["fecha_es_real"] = True
            self.stats["fecha_hallada"] += 1
        else:
            # Nunca convertimos la fecha de expedicion en publicacion.
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
        estado, motivo = self._estado(anotaciones)
        if estado:
            campos["estado_vigencia"] = estado
            campos["motivo_cambio_estado"] = motivo[:500]
            self.stats[f"estado_{estado}"] += 1

        if self.dry_run:
            log.info("[%d/%d] %s fecha_publicacion=%s DO=%s", i, total, doc.get("numero_resolucion"), fecha or "NO VERIFICADA", "si" if diario else "-")
            return
        try:
            self.db.table("documentos_tributarios").update(campos).eq("id", doc["id"]).execute()
            self.stats["actualizados"] += 1
        except Exception as e:
            log.error("No se pudo guardar %s: %s", doc.get("numero_resolucion"), str(e)[:160])
            self.stats["error_guardado"] += 1
            return
        self._alertas(doc, campos, anotaciones, retro, zonas)
        log.info("[%d/%d] %s fecha=%s %s", i, total, doc.get("numero_resolucion"), fecha or "NO VERIFICADA", "DO" if diario else "")

    def _fecha(self, texto):
        """Base conservadora; V2 sobrescribe con evidencia de publicacion."""
        m = re.search(r"Diario Oficial[^\n]{0,100}?de\s+(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})", texto[:5000], re.IGNORECASE)
        if m:
            return a_fecha(m.group(1), m.group(2), m.group(3))
        return None
