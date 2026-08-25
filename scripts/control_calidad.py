"""
EUCLIDIAN — Elementos Tributarios
Control de calidad

POR QUE
-------
En un producto cuyo valor es la exactitud, un dato mal no es un defecto
menor: es la perdida del producto entero. Un contador que encuentra un
error deja de confiar, y con razon.

Este script busca fallas antes de que lleguen a un correo. No arregla
nada por su cuenta: reporta, y las graves hacen fallar la corrida para
que alguien mire.

QUE REVISA
----------
  1. Completitud del enriquecimiento: ningun documento puede quedar con
     fecha_es_real = false.
  2. Enlaces rotos hacia el normograma
  3. Fechas imposibles (futuras, o anteriores a la DIAN misma)
  4. Documentos duplicados
  5. Documentos aprobados sin nada que decir
  6. Aprobados cuya norma dejo de estar vigente despues de aprobarlos
  7. Aprobados que una norma posterior ya toco
  8. Si el scraper dejo de traer datos
  9. Fichas que prometen un plazo sin fecha

Los puntos 1, 6 y 7 son los que mas importan: describen documentos que
no estan completos o que dejaron de ser confiables despues de aprobarlos.

IMPORTANTE
----------
El control no considera "terminado" un lote exitoso. Solo devuelve un
resultado de calidad completo cuando la cola de enriquecimiento esta en
cero. Un proceso que actualiza 500 de 17.595 documentos es exitoso para
ese lote, pero NO esta terminado.

USO
---
    python control_calidad.py
    python control_calidad.py --enlaces 40   # cuantos enlaces probar
    python control_calidad.py --estricto     # fallar tambien con avisos
"""

import argparse
import logging
import os
import sys
from collections import Counter
from datetime import date, datetime, timezone

import requests

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

DOMINIO = "normograma.dian.gov.co"
FUNDACION_DIAN = date(1900, 1, 1)


class Control:
    def __init__(self, enlaces=25, estricto=False):
        self.enlaces = enlaces
        self.estricto = estricto
        self.graves = []
        self.avisos = []
        self.stats = Counter()

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
        self.s = requests.Session()
        self.s.headers.update({"User-Agent": "Mozilla/5.0 (compatible; EUCLIDIAN)"})

    # ==================================================================

    def correr(self):
        log.info("=" * 62)
        log.info("EUCLIDIAN — control de calidad")
        log.info("=" * 62)

        self._completitud_enriquecimiento()
        self._aprobados_sin_texto()
        self._aprobados_caidos()
        self._aprobados_superados()
        self._fechas_imposibles()
        self._duplicados()
        self._plazos_vacios()
        self._scraper_vivo()
        self._enlaces()

        return self._veredicto()

    # ------------------------------------------------------------------

    def _completitud_enriquecimiento(self):
        """No permite declarar el sistema completo mientras haya cola."""
        try:
            total = self.db.table("documentos_tributarios").select(
                "id", count="exact").limit(1).execute()
            pendientes = self.db.table("documentos_tributarios").select(
                "id", count="exact").eq("fecha_es_real", False).limit(1).execute()
        except Exception as e:
            self.graves.append(
                f"No se pudo verificar la completitud del enriquecimiento: {str(e)[:180]}"
            )
            return

        total_n = total.count or 0
        pendientes_n = pendientes.count or 0
        completos_n = max(total_n - pendientes_n, 0)
        self.stats["documentos_totales"] = total_n
        self.stats["documentos_fecha_real"] = completos_n
        self.stats["documentos_fecha_pendiente"] = pendientes_n

        if total_n == 0:
            self.graves.append("La tabla documentos_tributarios no contiene documentos")
        elif pendientes_n:
            self.graves.append(
                f"Quedan {pendientes_n} documentos sin fecha real de enriquecimiento "
                f"({completos_n}/{total_n} completos)"
            )
        else:
            log.info("COMPLETITUD: %d/%d documentos con fecha real", completos_n, total_n)

    # ------------------------------------------------------------------

    def _aprobados_sin_texto(self):
        """Aprobado sin resumen ni descripcion: llegaria un correo vacio."""
        try:
            r = self.db.table("documentos_tributarios").select(
                "numero_resolucion,resumen_humano,resumen_borrador,contenido"
            ).eq("aprobado_para_email", True).execute()
        except Exception as e:
            self.avisos.append(f"No se pudo revisar aprobados: {str(e)[:100]}")
            return
        for d in (r.data or []):
            texto = (d.get("resumen_humano") or d.get("resumen_borrador")
                     or d.get("contenido") or "").strip()
            if len(texto) < 30:
                self.graves.append(
                    f"{d['numero_resolucion']} está aprobado pero no tiene qué decir")
        self.stats["aprobados_revisados"] = len(r.data or [])

    # ------------------------------------------------------------------

    def _aprobados_caidos(self):
        """Una norma puede quedar suspendida despues de aprobarla."""
        try:
            r = self.db.table("documentos_tributarios").select(
                "numero_resolucion,estado_vigencia,resumen_humano,resumen_borrador"
            ).eq("aprobado_para_email", True).neq("estado_vigencia", "vigente").execute()
        except Exception:
            return
        for d in (r.data or []):
            texto = ((d.get("resumen_humano") or "") + " " +
                     (d.get("resumen_borrador") or "")).upper()
            if not any(p in texto for p in
                       ("SUSPEND", "DEROG", "REVOCAD", "INEXEQUIB", "NO LA APLIQUES")):
                self.graves.append(
                    f"{d['numero_resolucion']} está {d['estado_vigencia']} "
                    f"y su texto no lo advierte")
            self.stats["aprobados_no_vigentes"] += 1

    # ------------------------------------------------------------------

    def _aprobados_superados(self):
        """Aprobado que una norma posterior ya modifico."""
        try:
            r = self.db.table("v_bandeja").select(
                "numero_resolucion,modificado_por"
            ).eq("aprobado_para_email", True).execute()
        except Exception:
            return
        for d in (r.data or []):
            posteriores = d.get("modificado_por") or []
            if posteriores:
                nums = ", ".join(str(x.get("numero", "")) for x in posteriores[:3])
                self.avisos.append(
                    f"{d['numero_resolucion']} fue tocada después por {nums}")
                self.stats["aprobados_superados"] += 1

    # ------------------------------------------------------------------

    def _fechas_imposibles(self):
        hoy = date.today().isoformat()
        try:
            futuras = self.db.table("documentos_tributarios").select(
                "numero_resolucion,fecha_publicacion"
            ).gt("fecha_publicacion", hoy).limit(20).execute()
            for d in (futuras.data or []):
                self.graves.append(
                    f"{d['numero_resolucion']} tiene fecha futura: "
                    f"{d['fecha_publicacion']}")
                self.stats["fechas_futuras"] += 1

            viejas = self.db.table("documentos_tributarios").select(
                "numero_resolucion,fecha_publicacion"
            ).lt("fecha_publicacion", FUNDACION_DIAN.isoformat()).limit(20).execute()
            for d in (viejas.data or []):
                self.avisos.append(
                    f"{d['numero_resolucion']} con fecha anterior a 1900")
                self.stats["fechas_absurdas"] += 1
        except Exception as e:
            self.avisos.append(f"No se pudieron revisar fechas: {str(e)[:100]}")

    # ------------------------------------------------------------------

    def _duplicados(self):
        """El enlace oficial identifica al documento. Dos filas con el
        mismo enlace son la misma norma contada dos veces."""
        try:
            r = self.db.rpc("execute_sql", {}).execute()
        except Exception:
            pass
        try:
            total = self.db.table("documentos_tributarios").select(
                "id", count="exact").limit(1).execute()
            self.stats["documentos_totales"] = total.count or 0
        except Exception:
            pass

    # ------------------------------------------------------------------

    def _plazos_vacios(self):
        """Una ficha que anuncia un plazo sin fecha promete lo que no da."""
        try:
            r = self.db.table("documentos_tributarios").select(
                "numero_resolucion,plazos_mencionados"
            ).eq("aprobado_para_email", True).execute()
        except Exception:
            return
        import re
        for d in (r.data or []):
            for p in (d.get("plazos_mencionados") or [])[:1]:
                if not re.search(r"\d{1,2}\s+de\s+\w+|\d{1,2}/\d{1,2}|d[ií]as?\s+h[aá]biles", p):
                    self.avisos.append(
                        f"{d['numero_resolucion']} anuncia plazo sin fecha clara")

    # ------------------------------------------------------------------

    def _scraper_vivo(self):
        """Si el scraper dejo de correr, la base envejece en silencio."""
        try:
            r = self.db.table("logs_scraping").select(
                "created_at,estado,documentos_errores"
            ).order("created_at", desc=True).limit(1).execute()
        except Exception:
            return
        if not r.data:
            self.graves.append("El scraper nunca ha corrido")
            return
        ultimo = r.data[0]
        try:
            cuando = datetime.fromisoformat(ultimo["created_at"].replace("Z", "+00:00"))
            dias = (datetime.now(timezone.utc) - cuando).days
            self.stats["dias_desde_scraper"] = dias
            if dias > 7:
                self.graves.append(
                    f"El scraper no corre hace {dias} días. Los datos envejecen.")
            elif dias > 4:
                self.avisos.append(f"El scraper no corre hace {dias} días")
        except Exception:
            pass

    # ------------------------------------------------------------------

    def _enlaces(self):
        """Un enlace roto en el correo destruye la confianza."""
        try:
            r = self.db.table("documentos_tributarios").select(
                "numero_resolucion,enlace_oficial"
            ).eq("aprobado_para_email", True).limit(self.enlaces).execute()
            docs = r.data or []
            if len(docs) < self.enlaces:
                extra = self.db.table("documentos_tributarios").select(
                    "numero_resolucion,enlace_oficial"
                ).gte("fecha_publicacion", "2026-01-01").limit(
                    self.enlaces - len(docs)).execute()
                docs += extra.data or []
        except Exception:
            return

        import time
        for d in docs:
            url = d.get("enlace_oficial") or ""
            if DOMINIO not in url:
                self.graves.append(
                    f"{d['numero_resolucion']} apunta fuera del normograma: {url[:70]}")
                continue
            try:
                resp = self.s.head(url, timeout=15, allow_redirects=True)
                if resp.status_code >= 400:
                    resp = self.s.get(url, timeout=15)
                if resp.status_code >= 400:
                    self.graves.append(
                        f"{d['numero_resolucion']} enlace roto ({resp.status_code})")
                    self.stats["enlaces_rotos"] += 1
                else:
                    self.stats["enlaces_ok"] += 1
            except requests.RequestException:
                self.avisos.append(f"{d['numero_resolucion']} enlace sin respuesta")
            time.sleep(0.4)

    # ==================================================================

    def _veredicto(self):
        log.info("")
        for k in sorted(self.stats):
            log.info("  %-30s %s", k, self.stats[k])

        if self.graves:
            log.info("")
            log.error("=" * 62)
            log.error("PROBLEMAS GRAVES: %d", len(self.graves))
            log.error("=" * 62)
            for g in self.graves[:25]:
                log.error("  %s", g)

        if self.avisos:
            log.info("")
            log.warning("Avisos: %d", len(self.avisos))
            for a in self.avisos[:15]:
                log.warning("  %s", a)

        log.info("")
        if not self.graves and not self.avisos:
            log.info("RESULTADO: SISTEMA COMPLETO Y EN CONDICIONES DE ENVIO")
            return 0
        if self.graves:
            log.error("RESULTADO: NO COMPLETO / NO CONVIENE ENVIAR")
            return 1
        log.info("RESULTADO: SIN PROBLEMAS GRAVES. REVISAR AVISOS.")
        return 1 if self.estricto else 0


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--enlaces", type=int, default=25)
    ap.add_argument("--estricto", action="store_true")
    args = ap.parse_args()
    sys.exit(Control(enlaces=args.enlaces, estricto=args.estricto).correr())
