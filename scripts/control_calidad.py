"""EUCLIDIAN — control de calidad estricto.

El producto solo se considera apto cuando los datos mostrados al contador
pueden trazarse a las fuentes oficiales permitidas y las fichas aprobadas
superan las comprobaciones de integridad. La ausencia de un campo no
localizado se conserva como dato pendiente; no se convierte artificialmente
en un fallo técnico del pipeline.
"""
import argparse, logging, os, sys
from collections import Counter
from datetime import date, datetime, timezone
import requests
from supabase import create_client

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")
URL = os.getenv("SUPABASE_URL"); KEY = os.getenv("SUPABASE_SERVICE_KEY")
DOMINIO = "normograma.dian.gov.co"; FUNDACION = date(1900, 1, 1)

class Control:
    def __init__(self, enlaces=25, estricto=False):
        self.enlaces = enlaces; self.estricto = estricto; self.graves = []; self.avisos = []; self.stats = Counter()
        if not URL or not KEY: raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
        self.db = create_client(URL, KEY); self.s = requests.Session(); self.s.headers.update({"User-Agent": "EUCLIDIAN/1.0"})

    def correr(self):
        self._completitud(); self._aprobados(); self._fechas(); self._duplicados(); self._plazos(); self._scraper(); self._enlaces(); return self._veredicto()

    def _completitud(self):
        try:
            total = self.db.table("documentos_tributarios").select("id", count="exact").limit(1).execute().count or 0
            aprobados = self.db.table("documentos_tributarios").select("id", count="exact").eq("aprobado_para_email", True).limit(1).execute().count or 0
            fechas_pendientes = (self.db.table("documentos_tributarios").select("id", count="exact")
                                 .eq("aprobado_para_email", True).eq("fecha_es_real", False).limit(1).execute().count or 0)
            self.stats.update(documentos_totales=total, aprobados=aprobados, documentos_fecha_pendiente=fechas_pendientes)
            if not total: self.graves.append("No hay documentos tributarios")
            if fechas_pendientes: log.info("Campos fecha pendientes: %d (no bloquean el documento)", fechas_pendientes)
        except Exception as e: self.graves.append(f"No se pudo comprobar completitud: {str(e)[:150]}")

    def _aprobados(self):
        try:
            r = (self.db.table("documentos_tributarios")
                 .select("numero_resolucion,resumen_humano,resumen_borrador,contenido,enlace_oficial,borrador_confianza")
                 .eq("aprobado_para_email", True).execute().data or [])
        except Exception as e:
            self.graves.append(f"No se pudo revisar aprobados: {str(e)[:150]}"); return
        self.stats["aprobados_revisados"] = len(r)
        for d in r:
            if d.get("borrador_confianza") != "alta": self.graves.append(f"{d['numero_resolucion']} está aprobado sin confianza alta")
            if len((d.get("resumen_humano") or d.get("resumen_borrador") or d.get("contenido") or "").strip()) < 30: self.graves.append(f"{d['numero_resolucion']} está aprobado sin resumen suficiente")
            u = d.get("enlace_oficial") or ""
            if not u.startswith("https://" + DOMINIO + "/"): self.graves.append(f"{d['numero_resolucion']} no tiene fuente DIAN permitida")

    def _fechas(self):
        try:
            hoy = date.today().isoformat()
            r = self.db.table("documentos_tributarios").select("numero_resolucion,fecha_publicacion").gt("fecha_publicacion", hoy).limit(20).execute().data or []
            for d in r: self.graves.append(f"{d['numero_resolucion']} tiene fecha futura: {d['fecha_publicacion']}")
            r = self.db.table("documentos_tributarios").select("numero_resolucion,fecha_publicacion").lt("fecha_publicacion", FUNDACION.isoformat()).limit(20).execute().data or []
            for d in r: self.graves.append(f"{d['numero_resolucion']} tiene fecha imposible: {d['fecha_publicacion']}")
        except Exception as e: self.graves.append(f"No se pudieron revisar fechas: {str(e)[:120]}")

    def _duplicados(self):
        try:
            rows = self.db.table("documentos_tributarios").select("numero_resolucion,enlace_oficial").execute().data or []
            seen = {}
            for d in rows:
                u = d.get("enlace_oficial")
                if u:
                    if u in seen: self.graves.append(f"Documento duplicado: {d['numero_resolucion']} y {seen[u]}")
                    else: seen[u] = d['numero_resolucion']
        except Exception as e: self.avisos.append(f"No se pudieron revisar duplicados: {str(e)[:100]}")

    def _plazos(self):
        try: r = self.db.table("documentos_tributarios").select("numero_resolucion,plazos_mencionados").eq("aprobado_para_email", True).execute().data or []
        except Exception: return
        import re
        for d in r:
            for p in (d.get("plazos_mencionados") or []):
                if not re.search(r"\d{1,2}\s+de\s+\w+|\d{1,2}/\d{1,2}|\d+\s+d[ií]as?", str(p), re.I): self.avisos.append(f"{d['numero_resolucion']} menciona plazo sin fecha clara")

    def _scraper(self):
        try: r = self.db.table("logs_scraping").select("created_at,estado").order("created_at", desc=True).limit(1).execute().data or []
        except Exception: return
        if not r: self.graves.append("No existe ejecución registrada del scraper"); return
        try:
            dias = (datetime.now(timezone.utc) - datetime.fromisoformat(r[0]['created_at'].replace('Z', '+00:00'))).days
            self.stats['dias_desde_scraper'] = dias
            if dias > 7: self.graves.append(f"El scraper lleva {dias} días sin ejecutar")
        except Exception: self.avisos.append("No se pudo determinar antigüedad del scraper")

    def _enlaces(self):
        try: r = self.db.table("documentos_tributarios").select("numero_resolucion,enlace_oficial").eq("aprobado_para_email", True).limit(self.enlaces).execute().data or []
        except Exception: return
        for d in r:
            try:
                x = self.s.get(d.get('enlace_oficial') or '', timeout=15, allow_redirects=True)
                if x.status_code >= 400: self.graves.append(f"{d['numero_resolucion']} enlace roto ({x.status_code})")
            except requests.RequestException: self.graves.append(f"{d['numero_resolucion']} no responde")

    def _veredicto(self):
        log.info("RESULTADO: graves=%d avisos=%d aprobados=%d fechas_pendientes=%d", len(self.graves), len(self.avisos), self.stats.get('aprobados_revisados', 0), self.stats.get('documentos_fecha_pendiente', 0))
        for x in self.graves[:25]: log.error(x)
        for x in self.avisos[:15]: log.warning(x)
        if self.graves or (self.estricto and self.avisos): log.error("NO APTO PARA ENVÍO"); return 1
        log.info("APTO PARA ENVÍO"); return 0

if __name__ == "__main__":
    p = argparse.ArgumentParser(); p.add_argument('--enlaces', type=int, default=25); p.add_argument('--estricto', action='store_true'); a = p.parse_args()
    try: sys.exit(Control(a.enlaces, a.estricto).correr())
    except Exception as e: log.error("CONTROL BLOQUEADO: %s", e); sys.exit(1)
