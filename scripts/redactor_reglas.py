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
from datetime import datetime, timezone

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

MESES = ["", "enero", "febrero", "marzo", "abril", "mayo", "junio", "julio",
         "agosto", "septiembre", "octubre", "noviembre", "diciembre"]

# ----------------------------------------------------------------------
# Documentos que no le generan obligaciones a ningun contribuyente.
# Detectarlos es lo que baja la bandeja de 400 fichas a 20.
# ----------------------------------------------------------------------
INTERNO = re.compile(
    r"comit[eé] (?:t[eé]cnico|interno|directivo|de)|"
    r"manual de pol[ií]ticas|"
    r"grupo interno de trabajo|"
    r"planta de personal|distribuci[oó]n de cargos|"
    r"nombra(?:miento|se)\b|encarga(?:r|se)\b de las funciones|"
    r"delega(?:ci[oó]n|r|nse)? (?:de )?(?:unas )?funciones|"
    r"comisi[oó]n de servicios|"
    r"se conforma el equipo|"
    r"reglamento interno|estructura (?:org[aá]nica|interna)|"
    r"traslado presupuestal|vacaciones",
    re.IGNORECASE)

# Verbos con que la DIAN abre sus descripciones, y su version simple
VERBOS = [
    (r"^por (?:la|el) cual(?:es)? se modifica(?:n)? parcialmente\b", "Cambió en parte"),
    (r"^por (?:la|el) cual(?:es)? se modifica(?:n)?\b", "Cambió"),
    (r"^por (?:la|el) cual(?:es)? se adiciona(?:n)?\b", "Se agregó"),
    (r"^por (?:la|el) cual(?:es)? se sustituye(?:n)?\b", "Se reemplazó"),
    (r"^por (?:la|el) cual(?:es)? se deroga(?:n)?\b", "Se eliminó"),
    (r"^por (?:la|el) cual(?:es)? se reglamenta(?:n)?\b", "Se reglamentó"),
    (r"^por (?:la|el) cual(?:es)? se establece(?:n)?\b", "Se estableció"),
    (r"^por (?:la|el) cual(?:es)? se prescribe(?:n)?\b", "Se definió"),
    (r"^por (?:la|el) cual(?:es)? se fija(?:n)?\b", "Se fijó"),
    (r"^por (?:la|el) cual(?:es)? se crea(?:n)?\b", "Se creó"),
    (r"^por (?:la|el) cual(?:es)? se dicta(?:n)?\b", "Se dictaron"),
    (r"^por (?:la|el) cual(?:es)? se define(?:n)?\b", "Se definió"),
    (r"^por (?:la|el) cual(?:es)? se ajusta(?:n)?\b", "Se ajustó"),
    (r"^por (?:la|el) cual(?:es)? se aclara(?:n)?\b", "Se aclaró"),
    (r"^por medio de (?:la|el) cual(?:es)? se sustituye(?:n)?\b", "Se reemplazó"),
    (r"^por medio de (?:la|el) cual(?:es)? se modifica(?:n)?\b", "Cambió"),
    (r"^por medio de (?:la|el) cual(?:es)? se adopta(?:n)?\b", "Se adoptó"),
    (r"^por medio de (?:la|el) cual(?:es)?\s+se\s+\w+\b", "Se dispuso sobre"),
    (r"^por (?:la|el) cual(?:es)?\s+se\s+\w+\b", "Se dispuso sobre"),
]

# Ubicacion normativa: describe donde va el texto, no que dice
UBICACION = re.compile(
    r"\s*(?:al|del|de la|en el|en la)?\s*"
    r"(?:art[ií]culo|numeral|par[aá]grafo|literal|inciso|secci[oó]n|cap[ií]tulo|"
    r"t[ií]tulo|parte|libro)\s*[\d.\-]*[\w\s.]{0,25}?"
    r"(?=\s+(?:al|del|de la|y|,|$))",
    re.IGNORECASE)

RESOLUCION_MADRE = re.compile(
    # Se usan comillas simples a proposito: el patron contiene comillas
    # dobles, y escaparlas hace que el archivo se rompa si se pierde una
    # barra invertida al copiarlo. Asi no hay nada que escapar.
    r'\s*(?:al|de la|del)?\s*(?:Cap[ií]tulo|T[ií]tulo|Parte|Secci[oó]n)[^,;]{0,120}?'
    r'Resoluci[oó]n\s+(?:n[uú]mero\s+)?[\d.]+\s+del?\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}'
    r'[^"]{0,20}(?:"[^"]{0,120}")?',
    re.IGNORECASE)

ETIQUETAS_TEMA = {
    "renta": "renta", "iva": "IVA", "retencion": "retención en la fuente",
    "retencion_iva": "reteIVA", "patrimonio": "impuesto al patrimonio",
    "timbre": "timbre", "gmf": "GMF", "simple": "régimen SIMPLE",
    "facturacion": "facturación electrónica", "nomina_electronica": "nómina electrónica",
    "exogena": "información exógena", "rut": "RUT",
    "devoluciones": "devoluciones y saldos a favor",
    "firmeza": "firmeza y prescripción", "sanciones": "sanciones",
    "fiscalizacion": "fiscalización", "cobro": "cobro y acuerdos de pago",
    "beneficios": "beneficios y conciliación", "recursos": "recursos",
    "precios_transferencia": "precios de transferencia",
    "convenios": "convenios de doble imposición",
    "aduanero": "temas aduaneros", "cambiario": "régimen cambiario",
    "comercio_exterior": "comercio exterior", "transporte": "transporte de carga",
    "zonas_francas": "zonas francas", "esal": "ESAL y donaciones",
    "criptoactivos": "criptoactivos", "financiero": "sector financiero",
    "plasticos": "plásticos de un solo uso", "carbono": "impuesto al carbono",
    "consumo": "impuesto al consumo", "ganancia_ocasional": "ganancia ocasional",
    "formularios": "formularios de la DIAN", "calendario": "plazos tributarios",
    "uvt": "UVT", "salud": "sector salud", "agropecuario": "sector agropecuario",
    "turismo": "turismo", "contabilidad": "NIIF", "rub": "beneficiario final",
    "normalizacion": "normalización tributaria", "ece": "entidades del exterior",
    "notificaciones": "notificaciones", "licores_tabaco": "licores y tabaco",
    "saludables": "impuestos saludables", "economia_naranja": "economía naranja",
}


def fecha_simple(f):
    if not f:
        return None
    try:
        d = datetime.fromisoformat(str(f)[:10]).date()
        return f"{d.day} de {MESES[d.month]} de {d.year}"
    except Exception:
        return None


class RedactorReglas:
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
                "diario_oficial,resumen_humano"
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

    def componer(self, d):
        desc = (d.get("descripcion_limpia") or d.get("contenido") or "").strip()
        interno = bool(INTERNO.search(desc + " " + (d.get("titulo") or "")))

        asunto = self._asunto(desc)
        frases = []
        advertencias = []
        puntos = 0

        # ---- 1. QUE ----
        if interno:
            frases.append("Es organización interna de la DIAN: "
                          + (asunto[0].lower() + asunto[1:] if asunto else "un asunto administrativo")
                          + ".")
            frases.append("No genera obligaciones para contribuyentes.")
            # La clasificacion por tipo de documento dice que toda
            # resolucion obliga al contribuyente. Para un comite interno
            # eso es falso, y decirle a un contador que algo lo obliga
            # cuando no es asi es peor que no decirle nada. Aqui se
            # corrige: el contenido manda sobre el tipo.
            return {"resumen": " ".join(frases)[:900], "confianza": "alta",
                    "advertencias": [], "interno": True,
                    "obligatoriedad": "orientativo"}

        if asunto:
            frases.append(asunto.rstrip(".") + ".")
            puntos += 1
        else:
            advertencias.append("La descripción de la DIAN solo dice a qué norma "
                                "remite, no qué cambia")

        # ---- 2. A QUIEN ----
        quien = self._a_quien(d)
        if quien:
            frases.append(quien)
            puntos += 1

        # ---- 3. QUE HACER ----
        hacer, mas_puntos, mas_avisos = self._que_hacer(d)
        frases.extend(hacer)
        puntos += mas_puntos
        advertencias.extend(mas_avisos)

        # Antes se anadia "Abre el documento para ver el detalle". No
        # aportaba: el enlace ya esta ahi y el lector sabe que puede
        # abrirlo. Cuando no hay nada que senalar, es mejor callar.

        # ---- confianza ----
        if puntos >= 3:
            confianza = "alta"
        elif puntos == 2:
            confianza = "media"
        else:
            confianza = "baja"

        if not d.get("fecha_es_real"):
            advertencias.append("Falta la fecha exacta: aún no se ha abierto el "
                                "documento oficial")
            if confianza == "alta":
                confianza = "media"

        return {"resumen": " ".join(frases)[:900], "confianza": confianza,
                "advertencias": advertencias[:5], "interno": False,
                "obligatoriedad": None}

    # ------------------------------------------------------------------

    def _asunto(self, desc):
        """
        Se queda con el asunto y descarta la ubicacion normativa.

        "Por la cual se adiciona la Seccion 5 'Procedimiento para el
        recaudo de la tarifa del 0.1 % sobre transporte de carga' al
        Capitulo 2 del Titulo 8 de la Parte 1 de la Resolucion 000227"
                              |
                              v
        "Se agregó el procedimiento para el recaudo de la tarifa del
         0.1 % sobre transporte de carga"
        """
        if not desc:
            return ""
        t = desc.strip()

        # Lo entrecomillado suele ser el asunto real
        entrecomillado = re.findall(r'"([^"]{25,300})"', t)
        titulos = [c for c in entrecomillado
                   if not re.search(r"[uú]nica en materia|decreto [uú]nico|"
                                    r"estatuto tributario", c, re.IGNORECASE)]

        verbo = None
        for patron, simple in VERBOS:
            m = re.match(patron, t, re.IGNORECASE)
            if m:
                verbo = simple
                t = t[m.end():].strip()
                break

        if titulos:
            asunto = titulos[0].strip()
            asunto = asunto[0].lower() + asunto[1:] if len(asunto) > 1 else asunto
            return f"{verbo or 'Se dispuso sobre'} {asunto}"

        # Sin comillas: limpiar la ubicacion normativa
        t = RESOLUCION_MADRE.sub("", t)
        t = re.sub(r"\s*(?:de|del|de la)\s+la\s+Resoluci[oó]n\s+n[uú]mero\s+[\d.]+"
                   r"\s+del?\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}", "", t,
                   flags=re.IGNORECASE)
        # La resolucion madre deja rastros de varias formas
        t = re.sub(r"\s*,?\s*Resoluci[oó]n\s+[UÚ]nica\s+en\s+Materia[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*[UÚ]nica\s+en\s+[Mm]ateria[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*(?:Tributaria,?\s*)?Aduanera\s+y\s+Cambiaria\b", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*Decreto\s+[UÚ]nico\s+Reglamentario[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s{2,}", " ", t).strip(' ,;."')

        # Si lo que queda es solo referencias a articulos, no dice nada
        sin_refs = UBICACION.sub("", t).strip(" ,;.y")
        if len(sin_refs) < 22:
            return ""

        if len(t) > 240:
            corte = t[:240].rsplit(" ", 1)[0]
            t = corte + "…"
        if not verbo:
            return t[0].upper() + t[1:] if t else ""
        return f"{verbo} {t[0].lower() + t[1:]}" if t else ""

    # ------------------------------------------------------------------

    def _a_quien(self, d):
        partes = []
        oblig = d.get("clasificacion_obligatoriedad")

        # Frases cortas a proposito: estas lineas se repiten en cientos de
        # fichas. Si son largas, el ojo las salta y deja de leerlas.
        if oblig == "obligatorio_dian_y_contribuyentes":
            partes.append("Obligatorio")
        elif oblig == "obligatorio_dian_solo":
            partes.append("Doctrina DIAN: orienta, no obliga")
        elif oblig == "vinculante_jurisprudencia":
            partes.append("Jurisprudencia vinculante")

        temas = [ETIQUETAS_TEMA.get(t, t.replace("_", " "))
                 for t in (d.get("temas") or [])
                 if not t.startswith("dian:") and t != "boletin_mensual"]
        if temas:
            partes.append("te toca si trabajas con " + self._enumerar(temas[:3]))

        zonas = d.get("zonas_afectadas") or []
        if zonas:
            partes.append("solo aplica en " + self._enumerar(zonas[:4]))

        if not partes:
            return ""
        if len(partes) == 1:
            return partes[0] + "."
        # El primer elemento es la naturaleza (obligatorio / doctrina); el
        # resto son condiciones de aplicacion. Se separan con dos puntos,
        # salvo que la naturaleza ya traiga los suyos: entonces raya, para
        # no encadenar "Doctrina DIAN: orienta, no obliga: te toca...".
        sep = " — " if ":" in partes[0] else ": "
        return partes[0] + sep + self._enumerar(partes[1:]) + "."

    @staticmethod
    def _enumerar(lista):
        if len(lista) == 1:
            return lista[0]
        return ", ".join(lista[:-1]) + " y " + lista[-1]

    # ------------------------------------------------------------------

    def _que_hacer(self, d):
        frases, avisos = [], []
        puntos = 0
        estado = d.get("estado_vigencia")

        if estado == "suspendido":
            frases.append("Está SUSPENDIDA: no la apliques hasta verificar el "
                          "alcance de la suspensión.")
            puntos += 2
        elif estado == "inexequible":
            frases.append("Fue declarada INEXEQUIBLE: no la apliques.")
            puntos += 2
        elif estado in ("derogado", "revocado"):
            frases.append(f"Ya no está vigente ({estado}). Si la citaste antes, "
                          f"revisa esos casos.")
            puntos += 2

        anot = d.get("anotaciones_vigencia") or []
        if anot and estado == "vigente":
            frases.append("El compilador anotó cambios en su texto: "
                          + anot[0][:150] + ".")
            puntos += 1

        if d.get("tiene_efectos_retroactivos") and d.get("anos_afectados"):
            anios = ", ".join(str(a) for a in d["anos_afectados"][:4])
            frases.append(f"Menciona años anteriores ({anios}): revisa si afecta "
                          f"declaraciones ya presentadas.")
            puntos += 2

        plazos = d.get("plazos_mencionados") or []
        if plazos:
            p = re.sub(r"\s+", " ", plazos[0]).strip()
            frases.append(f"Anota este plazo: {p[:190]}.")
            puntos += 2

        vig = fecha_simple(d.get("fecha_entrada_vigencia"))
        pub = fecha_simple(d.get("fecha_publicacion"))
        if vig and d.get("fecha_es_real") and vig != pub:
            frases.append(f"Rige desde el {vig}.")
            puntos += 1

        return frases, puntos, avisos

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
