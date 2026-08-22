"""
EUCLIDIAN — Elementos Tributarios
Scraper de produccion del normograma DIAN

BASADO EN LO QUE CONFIRMAMOS
----------------------------
- Cada panel del acordeon es un HTML plano: {indice}_parte_NN.html
- Estructura del arbol:
      span.clasificacion-especial   -> tema (taxonomia de la DIAN)
      span.year-arbol               -> anio
      li.documento-arbol            -> documento
        span.id-documento           -> "Concepto 11166 de 2026 DIAN"
        p                           -> descripcion escrita por la DIAN
- La DIAN marca ella misma el estado al inicio de la descripcion:
      "Derogado (Tributario) ..."  /  "Revocado (Tributario) ..."
- Y declara las cadenas de doctrina en el texto:
      "Adicion al Concepto No. 004532 del 26 de marzo de 2026"
      "Modificacion del Concepto General Unificado No. 481"

PRINCIPIO DE VERACIDAD
----------------------
Este script NO interpreta ni resume. Solo extrae lo que la DIAN publica,
tal cual, y lo guarda con su enlace oficial. El campo resumen_humano
queda vacio a proposito: lo escribis vos. Y aprobado_para_email queda
en false: nada sale al correo sin tu revision.

USO
---
    python scraper.py                 # incremental: solo anios recientes
    python scraper.py --historico     # todo el archivo (17k+ documentos)
    python scraper.py --dry-run       # no escribe en la base
"""

import argparse
import hashlib
import logging
import os
import re
import sys
import time
from collections import Counter
from datetime import datetime, timezone
from urllib.parse import urljoin

import requests
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

BASE = "https://normograma.dian.gov.co/dian/compilacion/"
TIMEOUT = 30
PAUSA = 1.0

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")

# Indices a recorrer. El orden importa: novedades primero porque es
# lo que alimenta el email semanal.
INDICES = [
    ("nyb_novedades_derecho_tributario", "boletin"),
    ("t_2_doctrina_tributaria", "doctrina"),
    ("t_1_normativa_tributaria", "normativa"),
    ("t_3_jurisprudencia_tributaria", "jurisprudencia"),
]

PATRON_DOC = re.compile(
    r"docs/(?P<tipo>[a-z_]+?)_(?:dian_)?(?P<numero>\d+)_(?P<anio>\d{4})\.html?",
    re.IGNORECASE,
)

# La DIAN antepone el estado a la descripcion
PATRON_ESTADO = re.compile(
    r"^\s*(Derogado|Revocado|Modificado|Suspendido|Inexequible|Adicionado)\b",
    re.IGNORECASE,
)

ESTADO_MAP = {
    "derogado": "derogado",
    "revocado": "revocado",
    "suspendido": "suspendido",
    "inexequible": "inexequible",
    "modificado": "vigente",   # sigue vigente pero modificado
    "adicionado": "vigente",
}

# Cadenas de doctrina declaradas en el texto
PATRON_REFERENCIA = re.compile(
    r"(?P<accion>Adici[oó]n|Modificaci[oó]n|Reconsideraci[oó]n|Revocatoria|Deroga(?:toria|ci[oó]n)|Aclaraci[oó]n)"
    r"\s+(?:al|del|de la|de|a)\s+"
    r"(?P<objeto>Concepto|Oficio|Resoluci[oó]n|Circular|Decreto)"
    r"[^\d]{0,60}?(?P<numero>\d{2,7})",
    re.IGNORECASE,
)

ACCION_MAP = {
    "adicion": "aclaracion",
    "adición": "aclaracion",
    "modificacion": "modificacion",
    "modificación": "modificacion",
    "reconsideracion": "reconsideracion",
    "reconsideración": "reconsideracion",
    "revocatoria": "revocacion",
    "derogatoria": "revocacion",
    "derogacion": "revocacion",
    "derogación": "revocacion",
    "aclaracion": "aclaracion",
    "aclaración": "aclaracion",
}

# Mapeo del tipo en la URL al tipo permitido por el CHECK de la tabla
TIPO_MAP = {
    "oficio": "oficio",
    "concepto": "concepto",
    "concepto_tributario": "concepto",
    "concepto_aduanero": "concepto",
    "concepto_mincultura": "concepto",
    "decreto": "decreto",
    "resolucion": "resolucion",
    "ley": "ley",
    "circular": "circular",
    "memorando": "circular",
    "orden_administrativa": "circular",
    "of": "oficio",
}

# Temas de interes para clasificar (se cruzan contra tema + descripcion)
TEMAS_CLAVE = {
    "iva": r"\bIVA\b|impuesto sobre las ventas",
    "renta": r"impuesto sobre la renta|\brenta\b",
    "retencion": r"retenci[oó]n en la fuente|autorretenci[oó]n",
    "facturacion": r"factura(?:ci[oó]n)? electr[oó]nica|documento soporte|n[oó]mina electr[oó]nica",
    "timbre": r"impuesto de timbre",
    "patrimonio": r"impuesto al patrimonio",
    "calendario": r"calendario tributario|plazo(?:s)? para declarar|vencimiento",
    "sanciones": r"sanci[oó]n|sancionatori",
    "rut": r"\bRUT\b|registro [uú]nico tributario",
    "simple": r"r[eé]gimen simple|\bSIMPLE\b",
    "aduanero": r"aduaner|importaci[oó]n|exportaci[oó]n",
    "cambiario": r"cambiari|r[eé]gimen de cambios",
    "criptoactivos": r"criptoactivo|criptomoneda",
    "esal": r"sin [aá]nimo de lucro|\bESAL\b",
    "precios_transferencia": r"precios de transferencia",
    "uvt": r"\bUVT\b|unidad de valor tributario",
}


def sufijo_parte(n: int) -> str:
    s = str(n)
    return f"_parte_0{s}" if len(s) == 1 else f"_parte_{s}"


class Scraper:
    def __init__(self, historico=False, dry_run=False, anios_recientes=3):
        self.historico = historico
        self.dry_run = dry_run
        self.anio_corte = datetime.now().year - anios_recientes

        self.s = requests.Session()
        self.s.headers.update({
            "User-Agent": (
                "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
                "AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0 Safari/537.36"
            ),
            "Accept-Language": "es-CO,es;q=0.9",
            "X-Requested-With": "XMLHttpRequest",
        })

        self.db = None
        if not dry_run:
            if not SUPABASE_URL or not SUPABASE_KEY:
                log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
                sys.exit(1)
            self.db = create_client(SUPABASE_URL, SUPABASE_KEY)
            self._verificar_escritura()

        self.documentos = {}        # numero_resolucion -> registro
        self.referencias = []       # cadenas de doctrina detectadas
        self.stats = Counter()

    # ==================================================================

    def _verificar_escritura(self):
        """
        Prueba escribir ANTES de recorrer todo el sitio.
        Sin esto, el scraper trabaja 3 minutos para descubrir al final
        que no tenia permisos.
        """
        try:
            self.db.table("logs_scraping").insert({
                "fuente": "verificacion_permisos",
                "url_objetivo": "test",
                "estado": "exitoso",
            }).execute()
            log.info("Permisos de escritura: OK")
        except Exception as e:
            msg = str(e)
            log.error("=" * 60)
            log.error("SIN PERMISO DE ESCRITURA EN SUPABASE")
            log.error("=" * 60)
            if "401" in msg or "JWT" in msg or "policy" in msg.lower():
                log.error("La clave puede leer pero no escribir.")
                log.error("Estas usando la clave 'anon'. Necesitas la")
                log.error("'service_role', que esta debajo de la anon en")
                log.error("Supabase > Settings > API Keys > pestana Legacy.")
            else:
                log.error("Detalle: %s", msg[:300])
            log.error("")
            log.error("No sigo: seria trabajar 3 minutos para nada.")
            sys.exit(1)

    # ------------------------------------------------------------------

    def correr(self):
        inicio = datetime.now(timezone.utc)
        log.info("=" * 60)
        log.info("EUCLIDIAN — scraper del normograma DIAN")
        log.info("modo: %s%s", "historico" if self.historico else f"reciente (>={self.anio_corte})",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 60)

        for indice, categoria in INDICES:
            self._procesar_indice(indice, categoria)

        log.info("")
        log.info("Documentos recolectados: %d", len(self.documentos))
        log.info("Referencias entre normas: %d", len(self.referencias))

        if not self.dry_run:
            self._guardar_documentos()
            self._guardar_referencias()

        self._registrar_corrida(inicio)
        self._resumen()

        # Salir con error si la escritura fallo. Un fallo silencioso en
        # verde es peor que un fallo ruidoso en rojo: hace creer que hay
        # datos cuando no los hay.
        if not self.dry_run:
            guardados = self.stats["documentos_guardados"]
            fallidos = self.stats["lotes_fallidos"]
            if guardados == 0 and self.documentos:
                log.error("")
                log.error("NO SE GUARDO NINGUN DOCUMENTO.")
                log.error("Se recolectaron %d pero la base rechazo todo.",
                          len(self.documentos))
                log.error("Causa mas probable: SUPABASE_SERVICE_KEY es la")
                log.error("clave 'anon' en vez de 'service_role'. Con RLS")
                log.error("activo, anon puede leer pero no escribir (401).")
                sys.exit(1)
            if fallidos:
                log.error("")
                log.error("%d lotes fallaron al guardar.", fallidos)
                sys.exit(1)

    # ==================================================================

    def _procesar_indice(self, indice, categoria):
        log.info("")
        log.info("[%s]", indice)

        url_indice = urljoin(BASE, f"{indice}.html")
        try:
            r = self.s.get(url_indice, timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            log.error("  no se pudo leer el indice: %s", e)
            self.stats["indices_fallidos"] += 1
            return

        if r.status_code != 200:
            log.error("  HTTP %s en el indice", r.status_code)
            self.stats["indices_fallidos"] += 1
            return

        soup = BeautifulSoup(r.text, "html.parser")
        opciones = soup.select(".opcion-nueva")
        titulos = []
        for i, o in enumerate(opciones):
            t = o.select_one(".titulo-opcion-nueva")
            titulos.append(t.get_text(" ", strip=True) if t else f"opcion_{i+1}")

        log.info("  %d acordeones", len(opciones))

        for n, titulo in enumerate(titulos, 1):
            # En modo incremental, saltar acordeones de anios viejos
            if not self.historico:
                m = re.search(r"(19|20)\d{2}", titulo)
                if m and int(m.group(0)) < self.anio_corte:
                    self.stats["partes_saltadas"] += 1
                    continue

            time.sleep(PAUSA)
            self._procesar_parte(indice, n, titulo, categoria)

    # ------------------------------------------------------------------

    def _procesar_parte(self, indice, n, titulo_acordeon, categoria):
        nombre = f"{indice}{sufijo_parte(n)}.html"
        url = urljoin(BASE, nombre)

        try:
            r = self.s.get(url, timeout=TIMEOUT)
            r.encoding = r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            log.warning("    %s -> error de red: %s", nombre, e)
            self.stats["partes_error"] += 1
            return

        if r.status_code != 200:
            log.info("    %s -> HTTP %s", nombre, r.status_code)
            self.stats["partes_404"] += 1
            return

        html = r.text
        hash_parte = hashlib.sha256(html.encode("utf-8", "ignore")).hexdigest()

        soup = BeautifulSoup(html, "html.parser")
        items = soup.select("li.documento-arbol")

        nuevos = 0
        for li in items:
            reg = self._extraer_documento(li, categoria, titulo_acordeon)
            if reg:
                clave = reg["numero_resolucion"]
                if clave not in self.documentos:
                    self.documentos[clave] = reg
                    nuevos += 1
                else:
                    # conservar el que tenga descripcion mas larga
                    if len(reg.get("contenido") or "") > len(
                        self.documentos[clave].get("contenido") or ""
                    ):
                        self.documentos[clave] = reg

        self.stats["partes_ok"] += 1
        self.stats["documentos_vistos"] += len(items)
        log.info("    %-52s %3d docs (%d nuevos)  %s",
                 titulo_acordeon[:52], len(items), nuevos, hash_parte[:8])

        self._registrar_log_parte(url, hash_parte, len(items), nuevos)

    # ------------------------------------------------------------------

    def _extraer_documento(self, li, categoria, titulo_acordeon):
        a = li.find("a", href=True)
        if not a:
            return None
        m = PATRON_DOC.search(a["href"])
        if not m:
            return None

        tipo_url = m.group("tipo").lower()
        numero = m.group("numero").lstrip("0") or "0"
        anio = m.group("anio")
        url_doc = urljoin(BASE, a["href"])

        span_id = li.select_one(".id-documento")
        identificador = span_id.get_text(" ", strip=True) if span_id else ""

        p = li.find("p")
        descripcion = p.get_text(" ", strip=True) if p else ""

        tema, anio_arbol = self._contexto(li)

        # Estado declarado por la DIAN al inicio de la descripcion
        estado = "vigente"
        motivo = None
        me = PATRON_ESTADO.match(descripcion)
        if me:
            palabra = me.group(1).lower()
            estado = ESTADO_MAP.get(palabra, "vigente")
            motivo = f"La DIAN marca este documento como: {me.group(1)}"
            self.stats[f"estado_{estado}"] += 1

        # Referencias a otras normas
        for mr in PATRON_REFERENCIA.finditer(descripcion):
            accion = mr.group("accion").lower()
            self.referencias.append({
                "origen": f"DIAN {tipo_url} {numero} de {anio}",
                "origen_numero": numero,
                "origen_anio": anio,
                "accion": ACCION_MAP.get(accion, "modificacion"),
                "objeto_tipo": mr.group("objeto").lower(),
                "objeto_numero": mr.group("numero").lstrip("0") or "0",
                "texto": descripcion[:400],
            })
            self.stats["referencias_detectadas"] += 1

        temas = self._clasificar_temas(f"{tema or ''} {identificador} {descripcion}")
        if categoria == "boletin":
            temas.append("boletin_mensual")
        if tema:
            temas.append(f"dian:{tema[:80]}")

        titulo = identificador or descripcion[:200] or f"{tipo_url} {numero} de {anio}"

        registro = {
            "numero_resolucion": f"DIAN-{tipo_url.upper()}-{numero}-{anio}",
            "tipo_documento": TIPO_MAP.get(tipo_url, "concepto"),
            "subtipo": tipo_url,
            "titulo": titulo[:500],
            "contenido": descripcion[:10000],
            "enlace_oficial": url_doc[:1000],
            "fecha_publicacion": f"{anio}-01-01",
            "estado_vigencia": estado,
            "motivo_cambio_estado": motivo,
            "clasificacion_obligatoriedad": self._obligatoriedad(tipo_url),
            "temas": list(dict.fromkeys(temas))[:20],
            "hash_contenido": hashlib.sha256(
                (identificador + descripcion).encode("utf-8", "ignore")
            ).hexdigest(),
            "revisado_por_humano": False,
            "aprobado_para_email": False,
            "notas_verificacion": f"Extraido de {titulo_acordeon[:120]}",
            "fecha_scraped": datetime.now(timezone.utc).isoformat(),
        }
        return registro

    # ------------------------------------------------------------------

    @staticmethod
    def _contexto(li):
        """Sube por los ancestros hasta hallar tema y anio."""
        tema = anio = None
        for anc in li.parents:
            if anc.name != "li":
                continue
            if anio is None:
                y = anc.find("span", class_="year-arbol", recursive=False)
                if y:
                    anio = y.get_text(strip=True)
            if tema is None:
                c = anc.find("span", class_="clasificacion-especial", recursive=False)
                if c:
                    tema = c.get_text(" ", strip=True)
            if tema and anio:
                break
        return tema, anio

    @staticmethod
    def _clasificar_temas(texto):
        return [k for k, patron in TEMAS_CLAVE.items()
                if re.search(patron, texto, re.IGNORECASE)]

    @staticmethod
    def _obligatoriedad(tipo_url):
        if tipo_url in ("ley", "decreto", "resolucion"):
            return "obligatorio_dian_y_contribuyentes"
        if tipo_url.startswith("concepto") or tipo_url in ("oficio", "of"):
            return "obligatorio_dian_solo"
        return "orientativo"

    # ==================================================================

    def _guardar_documentos(self):
        registros = list(self.documentos.values())
        if not registros:
            log.warning("Nada que guardar")
            return

        log.info("")
        log.info("Guardando %d documentos en Supabase...", len(registros))
        lote = 200
        guardados = 0
        for i in range(0, len(registros), lote):
            trozo = registros[i:i + lote]
            try:
                self.db.table("documentos_tributarios").upsert(
                    trozo, on_conflict="numero_resolucion"
                ).execute()
                guardados += len(trozo)
                log.info("  %d/%d", guardados, len(registros))
            except Exception as e:
                log.error("  fallo el lote %d: %s", i // lote, str(e)[:200])
                self.stats["lotes_fallidos"] += 1
        self.stats["documentos_guardados"] = guardados

    # ------------------------------------------------------------------

    def _guardar_referencias(self):
        """Enlaza documentos que modifican o reconsideran a otros."""
        if not self.referencias:
            return
        log.info("Resolviendo %d referencias entre normas...", len(self.referencias))

        enlazadas = 0
        for ref in self.referencias:
            try:
                nuevo = self.db.table("documentos_tributarios").select("id").eq(
                    "numero_resolucion",
                    f"DIAN-{ref['origen'].split()[1].upper()}-{ref['origen_numero']}-{ref['origen_anio']}",
                ).limit(1).execute()
                if not nuevo.data:
                    continue

                anterior = self.db.table("documentos_tributarios").select(
                    "id"
                ).ilike(
                    "numero_resolucion", f"%-{ref['objeto_numero']}-%"
                ).limit(1).execute()
                if not anterior.data:
                    continue

                if nuevo.data[0]["id"] == anterior.data[0]["id"]:
                    continue

                self.db.table("reconsideraciones").upsert({
                    "documento_nuevo_id": nuevo.data[0]["id"],
                    "documento_anterior_id": anterior.data[0]["id"],
                    "tipo_revision": ref["accion"],
                    "razon_cambio": ref["texto"][:400],
                    "cambio_significativo": ref["accion"] in ("reconsideracion", "revocacion"),
                    "verificado_por_humano": False,
                }, on_conflict="documento_nuevo_id,documento_anterior_id").execute()
                enlazadas += 1
            except Exception as e:
                log.debug("  referencia sin resolver: %s", str(e)[:120])
                continue

        self.stats["referencias_enlazadas"] = enlazadas
        log.info("  %d referencias enlazadas", enlazadas)

    # ------------------------------------------------------------------

    def _registrar_log_parte(self, url, hash_parte, encontrados, nuevos):
        if self.dry_run:
            return
        try:
            previo = self.db.table("logs_scraping").select("hash_pagina").eq(
                "url_objetivo", url
            ).order("created_at", desc=True).limit(1).execute()
            cambio = not previo.data or previo.data[0]["hash_pagina"] != hash_parte

            self.db.table("logs_scraping").insert({
                "fuente": "normograma_dian",
                "url_objetivo": url,
                "documentos_encontrados": encontrados,
                "documentos_nuevos": nuevos,
                "hash_pagina": hash_parte,
                "hubo_cambio": cambio,
                "timestamp_inicio": datetime.now(timezone.utc).isoformat(),
                "timestamp_fin": datetime.now(timezone.utc).isoformat(),
                "estado": "exitoso",
            }).execute()
            if cambio:
                self.stats["partes_con_cambio"] += 1
        except Exception as e:
            log.debug("no se pudo registrar log: %s", str(e)[:120])

    # ------------------------------------------------------------------

    def _registrar_corrida(self, inicio):
        if self.dry_run:
            return
        try:
            self.db.table("logs_scraping").insert({
                "fuente": "normograma_dian:corrida_completa",
                "url_objetivo": BASE,
                "documentos_encontrados": self.stats["documentos_vistos"],
                "documentos_nuevos": len(self.documentos),
                "documentos_errores": self.stats["partes_error"],
                "timestamp_inicio": inicio.isoformat(),
                "timestamp_fin": datetime.now(timezone.utc).isoformat(),
                "tiempo_total_segundos": int(
                    (datetime.now(timezone.utc) - inicio).total_seconds()
                ),
                "estado": "exitoso" if not self.stats["partes_error"] else "parcial",
            }).execute()
        except Exception as e:
            log.debug("no se pudo registrar la corrida: %s", str(e)[:120])

    # ------------------------------------------------------------------

    def _resumen(self):
        log.info("")
        log.info("=" * 60)
        log.info("RESUMEN")
        log.info("=" * 60)
        for k in sorted(self.stats):
            log.info("  %-28s %s", k, self.stats[k])

        tipos = Counter(d["tipo_documento"] for d in self.documentos.values())
        log.info("  tipos: %s", dict(tipos))

        if not self.dry_run:
            log.info("")
            log.info("Todo entra con aprobado_para_email = false.")
            log.info("Nada sale al correo sin tu revision.")


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--historico", action="store_true",
                    help="Recorrer todo el archivo, no solo anios recientes")
    ap.add_argument("--dry-run", action="store_true",
                    help="No escribir en la base de datos")
    ap.add_argument("--anios", type=int, default=3,
                    help="Cuantos anios hacia atras en modo incremental")
    args = ap.parse_args()

    Scraper(historico=args.historico, dry_run=args.dry_run,
            anios_recientes=args.anios).correr()
