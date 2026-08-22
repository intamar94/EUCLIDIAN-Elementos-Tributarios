"""
EUCLIDIAN — Elementos Tributarios
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
para que vos lo leas. aprobado_para_email no se toca nunca aca.

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

MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

DEPARTAMENTOS = [
    "Amazonas", "Antioquia", "Arauca", "Atlantico", "Atlántico", "Bolivar",
    "Bolívar", "Boyaca", "Boyacá", "Caldas", "Caqueta", "Caquetá", "Casanare",
    "Cauca", "Cesar", "Choco", "Chocó", "Cordoba", "Córdoba", "Cundinamarca",
    "Guainia", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
    "Meta", "Narino", "Nariño", "Norte de Santander", "Putumayo", "Quindio",
    "Quindío", "Risaralda", "San Andres", "San Andrés", "Santander", "Sucre",
    "Tolima", "Valle del Cauca", "Vaupes", "Vaupés", "Vichada", "Bogota", "Bogotá",
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
        log.info("limite: %d%s%s", self.limite,
                 f"  anio: {self.anio}" if self.anio else "",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 60)

        pendientes = self._pendientes()
        if not pendientes:
            log.info("No hay documentos por enriquecer.")
            return
        log.info("%d documentos por abrir", len(pendientes))

        for i, doc in enumerate(pendientes, 1):
            time.sleep(PAUSA)
            self._enriquecer(doc, i, len(pendientes))

        self._resumen()

    # ------------------------------------------------------------------

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

    def _fecha(self, texto):
        """
        Formatos que usa el normograma, en orden de confianza:
          (febrero 24)
          Diario Oficial No. 53.409 de 24 de febrero de 2026
          Dado a 24 de febrero de 2026
        """
        anio = None
        m_anio = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:600])
        if m_anio:
            anio = m_anio.group(1)

        # (febrero 24)  o  (24 de febrero)
        m = re.search(r"\(\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(\d{1,2})\s*\)", texto[:1500])
        if m and anio:
            f = a_fecha(m.group(2), m.group(1), anio)
            if f:
                return f
        m = re.search(r"\(\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*\)", texto[:1500])
        if m and anio:
            f = a_fecha(m.group(1), m.group(2), anio)
            if f:
                return f

        # Diario Oficial No. X de DD de MMMM de YYYY
        m = re.search(
            r"Diario Oficial[^\n]{0,60}?de\s+(\d{1,2})\s+de\s+"
            r"([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto[:2500], re.IGNORECASE)
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f

        # Dado a / Dada en Bogota a los ...
        m = re.search(
            r"Dad[oa][^\n]{0,60}?(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)"
            r"\s+de\s+((?:19|20)\d{2})",
            texto, re.IGNORECASE)
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f
        return None

    def _diario_oficial(self, texto):
        m = re.search(
            r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)"
            r"[^\n]{0,70}?((?:19|20)\d{2})",
            texto[:2500], re.IGNORECASE)
        if m:
            return f"No. {m.group(1)} de {m.group(2)}"
        return None

    def _entidad(self, texto):
        candidatos = re.findall(
            r"^\s*((?:MINISTERIO|DIRECCI[OÓ]N|UNIDAD|DEPARTAMENTO|"
            r"SUPERINTENDENCIA|CONSEJO|CORTE|PRESIDENCIA)[^\n]{4,120})$",
            texto[:4000], re.MULTILINE)
        return candidatos[0].strip() if candidatos else None

    def _vigencia(self, texto):
        m = re.search(
            r"(?:rige|regir[aá]|entrar[aá] en vigencia|vigencia)[^.\n]{0,120}?"
            r"(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto, re.IGNORECASE)
        if m:
            return a_fecha(m.group(1), m.group(2), m.group(3))
        return None

    def _anotaciones(self, html, texto=""):
        """
        El normograma inserta anotaciones del compilador entre < >:
            <Ver SUSPENSION parcial por el Auto A-533-26>
            <Numeral modificado por el articulo 17 del Decreto 240 de 2026>
            <Articulo derogado por el articulo 5 de la Ley 2277 de 2022>
        Son la fuente mas confiable del estado de vigencia porque las
        escribe el compilador juridico, no nosotros.

        El truco esta en separarlas de las etiquetas HTML de verdad. Se
        descarta lo que tenga sintaxis de atributo (href=") y lo que
        empiece con un nombre de etiqueta conocido.
        """
        ETIQUETAS = re.compile(
            r"^/?(?:a|p|br|hr|div|span|img|td|tr|th|table|tbody|thead|li|ul|ol|"
            r"b|i|u|em|strong|font|small|sup|sub|h[1-6]|meta|link|input|form|"
            r"script|style|html|head|body|nav|footer|header|section|article|"
            r"button|label|select|option|iframe|svg|path|g|!)\b",
            re.IGNORECASE)

        crudas = []
        crudas += re.findall(r"&lt;([^&<>]{12,240}?)&gt;", html)
        crudas += re.findall(r"<([^<>]{12,240}?)>", html)
        if texto:
            crudas += re.findall(r"<([^<>]{12,240}?)>", texto)

        clave = re.compile(
            r"suspensi|suspend|derogad|deroga|modificad|adicionad|"
            r"inexequib|revocad|sustituid|anulad|"
            r"Ver\s+(?:SUSPENSI|Sentencia|Auto|INEXEQUIB)",
            re.IGNORECASE)

        utiles = []
        for c in crudas:
            c = re.sub(r"\s+", " ", c).strip()
            if not c or len(c) < 12:
                continue
            if re.search(r"=[\"']", c):        # atributo HTML
                continue
            if ETIQUETAS.match(c):             # etiqueta conocida
                continue
            if not clave.search(c):
                continue
            if c not in utiles:
                utiles.append(c)
        return utiles

    def _estado(self, anotaciones):
        """Traduce las anotaciones a un estado de vigencia."""
        texto = " | ".join(anotaciones).lower()
        if re.search(r"inexequib", texto):
            return "inexequible", f"Declarado inexequible. Anotación: {anotaciones[0][:200]}"
        if re.search(r"suspensi[oó]n|suspendid", texto):
            nota = next((a for a in anotaciones
                         if re.search(r"suspensi|suspendid", a, re.I)), "")
            return "suspendido", f"Suspendido. Anotación del normograma: {nota[:200]}"
        if re.search(r"\bderogad[oa]\s+(?:total|por)", texto):
            nota = next((a for a in anotaciones if re.search(r"derogad", a, re.I)), "")
            return "derogado", f"Derogado. Anotación del normograma: {nota[:200]}"
        return None, None

    def _retroactividad(self, texto):
        anios = set()
        patrones = [
            r"a[ñn]o\s+gravable\s+((?:19|20)\d{2})",
            r"aplicable\s+(?:a\s+partir\s+del?\s+)?(?:a[ñn]o\s+)?((?:19|20)\d{2})",
            r"retroactiv\w*[^.\n]{0,80}?((?:19|20)\d{2})",
            r"per[ií]odos?\s+gravables?\s+((?:19|20)\d{2})",
            r"desde\s+el\s+a[ñn]o\s+((?:19|20)\d{2})",
        ]
        for p in patrones:
            for m in re.finditer(p, texto, re.IGNORECASE):
                anios.add(int(m.group(1)))

        hay_palabra = bool(re.search(
            r"retroactiv|efectos?\s+hacia\s+atr[aá]s|per[ií]odos?\s+anteriores",
            texto, re.IGNORECASE))

        anio_doc = None
        m = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:600])
        if m:
            anio_doc = int(m.group(1))

        # Retroactivo de verdad: menciona anios anteriores al del documento
        anteriores = sorted(a for a in anios if anio_doc and a < anio_doc)
        return (bool(anteriores) or hay_palabra), anteriores[:8]

    def _zonas(self, texto):
        halladas = []
        ventana = texto[:12000]
        for d in DEPARTAMENTOS:
            if re.search(rf"\b{re.escape(d)}\b", ventana):
                base = d.replace("á", "a").replace("é", "e").replace("í", "i") \
                        .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
                if base not in [z.replace("á", "a") for z in halladas]:
                    halladas.append(d)
        # Solo tiene sentido marcarlas si el documento habla de una situacion territorial
        if len(halladas) >= 2 and re.search(
                r"emergencia|calamidad|desastre|afectad|damnificad|zona",
                ventana, re.IGNORECASE):
            return halladas[:15]
        return []

    def _plazos(self, texto):
        plazos = []
        for m in re.finditer(
            r"([^\.\n]{0,110}?(?:declaren?|declarar|pagar[aá]n?|pago|cuota|"
            r"vencimiento|plazo|hasta el|a m[aá]s tardar)[^\.\n]{0,110}?"
            r"\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+(?:19|20)\d{2}[^\.\n]{0,40})",
            texto, re.IGNORECASE
        ):
            frase = re.sub(r"\s+", " ", m.group(1)).strip()
            if 25 < len(frase) < 260 and frase not in plazos:
                plazos.append(frase)
        return plazos

    # ==================================================================

    def _alertas(self, doc, campos, anotaciones, retro, zonas):
        """
        Crea alertas solo cuando hay algo que un contador no puede pasar
        por alto. Cada alerta nace sin aprobar: la revisas vos.
        """
        alertas = []

        if campos.get("estado_vigencia") == "suspendido":
            alertas.append(("critica", "doctrina_revocada",
                            campos.get("motivo_cambio_estado", "Suspendido")))
        elif campos.get("estado_vigencia") == "inexequible":
            alertas.append(("critica", "doctrina_revocada",
                            campos.get("motivo_cambio_estado", "Inexequible")))

        if retro and campos.get("anos_afectados"):
            anios = ", ".join(str(a) for a in campos["anos_afectados"])
            alertas.append(("alta", "efecto_retroactivo",
                            f"Menciona años anteriores ({anios}). "
                            f"Puede afectar declaraciones ya presentadas."))

        if zonas:
            alertas.append(("alta", "desastre_natural",
                            f"Medida territorial. Zonas: {', '.join(zonas[:6])}"))

        if campos.get("plazos_mencionados"):
            texto_plazos = " ".join(campos["plazos_mencionados"]).lower()
            if re.search(r"cuota|declaren|vencimiento|a m[aá]s tardar", texto_plazos):
                alertas.append(("media", "plazo_proximo",
                                campos["plazos_mencionados"][0][:400]))

        for nivel, tipo, descripcion in alertas:
            try:
                self.db.table("alertas_urgentes").upsert({
                    "documento_id": doc["id"],
                    "nivel_urgencia": nivel,
                    "tipo_alerta": tipo,
                    "descripcion": descripcion[:1000],
                    "zonas_afectadas": zonas[:15] if zonas else [],
                    "aprobada_por_humano": False,
                    "enviada": False,
                }, on_conflict="documento_id,tipo_alerta").execute()
                self.stats[f"alerta_{nivel}"] += 1
            except Exception as e:
                log.debug("alerta no creada: %s", str(e)[:120])

    # ------------------------------------------------------------------

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
    ap.add_argument("--anio", type=int, default=None)
    ap.add_argument("--dry-run", action="store_true")
    args = ap.parse_args()

    Enriquecedor(limite=args.limite, anio=args.anio,
                 dry_run=args.dry_run).correr()
