"""
EUCLIDIAN — Elementos Tributarios
Clasificador y limpiador de texto

POR QUE SE REESCRIBIO
---------------------
La Resolucion 8 de 2026 quedo etiquetada como "aduanero" y "cambiario"
cuando en realidad trata de una retencion en la fuente sobre transporte
de carga. El error tenia una causa clara: la descripcion menciona la
resolucion madre, que se llama

    "Resolucion unica en Materia Tributaria, Aduanera y Cambiaria"

y mi regex encontro ahi las palabras "aduanera" y "cambiaria". Estaba
clasificando por el nombre del archivo donde se guarda el texto, no por
lo que el texto dice.

La solucion tiene dos partes:

1. MATERIA: no la inferimos. La DIAN ya la escribe al inicio de cada
   descripcion, entre parentesis:
       "(Tributario) (Int 1621) Concepto Unificado sobre Criptoactivos"
   Se lee de ahi y punto. Cero falsos positivos.

2. TEMAS: antes de aplicar patrones, se borran las frases de formulario
   que aparecen en miles de documentos y no dicen nada del contenido.

TAXONOMIA
---------
Pensada para el trabajo diario de un contador colombiano, no para una
biblioteca. Cada tema responde a "¿esto le toca a alguno de mis clientes?".
Por eso hay temas sectoriales (transporte, salud, agro) y procedimentales
(firmeza, devoluciones, fiscalizacion), no solo impuestos.
"""

import re
import unicodedata

# ======================================================================
# LIMPIEZA
# ======================================================================

# Frases de formulario que aparecen en miles de documentos. Nombran el
# continente, no el contenido. Si no se borran, contaminan todo.
RUIDO = [
    r"Resoluci[oó]n\s+[uú]nica\s+en\s+[Mm]ateria\s+Tributaria,?\s*"
    r"Aduanera\s+y\s+Cambiaria",
    r"al\s+Cap[ií]tulo\s+\d+\s+del\s+T[ií]tulo\s+\d+\s+de\s+la\s+Parte\s+\d+"
    r"\s+de\s+la\s+Resoluci[oó]n\s+n[uú]mero\s+[\d.]+\s+del?\s+"
    r"\d{1,2}\s+de\s+\w+\s+de\s+\d{4}",
    r"Decreto\s+[uú]nico\s+[Rr]eglamentario\s+(?:del\s+[Ss]ector\s+)?[\w\s]{0,30}",
    r"Estatuto\s+Tributario\s*[-–]\s*Decreto\s+624\s+de\s+1989",
    r"Direcci[oó]n\s+de\s+Impuestos\s+y\s+Aduanas\s+Nacionales(?:\s*[-–]\s*DIAN)?",
    r"Unidad\s+Administrativa\s+Especial",
]
RUIDO_RE = [re.compile(p, re.IGNORECASE) for p in RUIDO]

# Prefijos con que la DIAN abre sus descripciones
MATERIA_RE = re.compile(
    r"^\s*\(\s*(Tributario|Aduanero|Cambiario|Tributaria|Aduanera|Cambiaria)\s*\)",
    re.IGNORECASE)
INTERNO_RE = re.compile(r"\(\s*Int\.?\s*\d+\s*\)", re.IGNORECASE)


def limpiar_texto(texto):
    """
    Repara lo que se rompio al extraer el HTML y normaliza espacios.

    El caso que lo motivo: "tarifa del 0.1porciento". El simbolo % se
    perdio en la extraccion y quedo pegado a la palabra. Eso saldria asi
    en el correo de un contador, que es justamente donde no puede pasar.
    """
    if not texto:
        return ""
    t = str(texto)

    # El % perdido: "0.1porciento" -> "0.1 %"
    t = re.sub(r"(\d[\d.,]*)\s*porciento\b", r"\1 %", t, flags=re.IGNORECASE)
    t = re.sub(r"(\d[\d.,]*)\s*por\s*ciento\b", r"\1 %", t, flags=re.IGNORECASE)
    # Numero y simbolo pegados sin espacio
    t = re.sub(r"(\d)\s*%", r"\1 %", t)

    # Entidades HTML que sobrevivieron
    for a, b in [("&nbsp;", " "), ("&amp;", "&"), ("&quot;", '"'),
                 ("&#39;", "'"), ("&lt;", "<"), ("&gt;", ">"),
                 ("&aacute;", "á"), ("&eacute;", "é"), ("&iacute;", "í"),
                 ("&oacute;", "ó"), ("&uacute;", "ú"), ("&ntilde;", "ñ")]:
        t = t.replace(a, b)

    # Comillas y guiones tipograficos rotos
    t = t.replace("\u201c", '"').replace("\u201d", '"')
    t = t.replace("\u2018", "'").replace("\u2019", "'")

    # Espacios
    t = re.sub(r"[ \t\xa0]+", " ", t)
    t = re.sub(r"\s+([,.;:)])", r"\1", t)
    t = re.sub(r"\(\s+", "(", t)
    t = re.sub(r"\n{3,}", "\n\n", t)
    return t.strip()


def extraer_materia(descripcion):
    """
    Lee la materia que la propia DIAN escribio. No la infiere.
    Devuelve (materia, descripcion_sin_prefijos).
    """
    if not descripcion:
        return None, ""
    t = limpiar_texto(descripcion)

    materia = None
    m = MATERIA_RE.match(t)
    if m:
        bruto = m.group(1).lower()
        materia = {"tributaria": "tributario", "aduanera": "aduanero",
                   "cambiaria": "cambiario"}.get(bruto, bruto)
        t = MATERIA_RE.sub("", t, count=1)

    t = INTERNO_RE.sub("", t, count=1)
    t = re.sub(r"^[\s\-–—:]+", "", t)
    return materia, t.strip()


def _sin_ruido(texto):
    t = texto or ""
    for r in RUIDO_RE:
        t = r.sub(" ", t)
    return re.sub(r"\s+", " ", t)


def _plano(texto):
    """Sin tildes y en minusculas, para que los patrones no fallen por acentos."""
    t = unicodedata.normalize("NFD", texto or "")
    t = "".join(c for c in t if unicodedata.category(c) != "Mn")
    return t.lower()


# ======================================================================
# TAXONOMIA
# ======================================================================
# Cada entrada: clave -> (etiqueta legible, patron)
# Los patrones se aplican sobre el texto SIN tildes y en minusculas.

TAXONOMIA = {
    # ---- Impuestos ----
    "renta": ("Renta",
        r"impuesto sobre la renta|impuesto de renta|\brenta liquida\b|"
        r"renta presuntiva|declaracion de renta|renta y complementarios"),
    "ganancia_ocasional": ("Ganancia ocasional",
        r"ganancia(?:s)? ocasional(?:es)?"),
    "iva": ("IVA",
        r"\biva\b|impuesto sobre las ventas|bienes exentos|bienes excluidos|"
        r"responsable de iva"),
    "consumo": ("Impuesto al consumo",
        r"impuesto nacional al consumo|\binc\b(?! ?[a-z])|impoconsumo"),
    "timbre": ("Timbre", r"impuesto de timbre|timbre nacional"),
    "patrimonio": ("Patrimonio",
        r"impuesto al patrimonio|patrimonio liquido|patrimonio bruto"),
    "gmf": ("GMF (4x1000)",
        r"gravamen a los movimientos financieros|\bgmf\b|cuatro por mil|4x1000"),
    "simple": ("Régimen SIMPLE",
        r"regimen simple de tributacion|\bsimple\b(?! ?mente)|\bropu\b"),
    "carbono": ("Impuesto al carbono", r"impuesto (?:nacional )?al carbono"),
    "plasticos": ("Plásticos de un solo uso",
        r"plastico(?:s)? de un solo uso|\bipusui\b"),
    "saludables": ("Impuestos saludables",
        r"bebidas (?:ultraprocesadas|azucaradas)|productos comestibles "
        r"ultraprocesados|impuestos saludables"),
    "licores_tabaco": ("Licores y tabaco",
        r"impuesto al consumo de (?:licores|cigarrillos|tabaco)|"
        r"licores, vinos|cigarrillo(?:s)? y tabaco"),
    "normalizacion": ("Normalización tributaria",
        r"normalizacion tributaria|activos omitidos|pasivos inexistentes"),

    # ---- Retenciones ----
    "retencion": ("Retención en la fuente",
        r"retencion en la fuente|autorretencion|agente(?:s)? de retencion|"
        r"practicar (?:la )?retencion|tarifa de retencion|retefuente|"
        r"recaudo y pago de la tarifa"),
    "retencion_iva": ("ReteIVA", r"retencion de iva|reteiva|retencion en iva"),

    # ---- Obligaciones formales ----
    "facturacion": ("Facturación electrónica",
        r"factura(?:cion)? electronica|documento soporte|documento equivalente|"
        r"\bradian\b|pos electronic|nota (?:credito|debito) electronica"),
    "nomina_electronica": ("Nómina electrónica",
        r"nomina electronica|documento soporte de pago de nomina"),
    "exogena": ("Información exógena",
        r"informacion exogena|medios magneticos|reporte de informacion|"
        r"informacion tributaria en medios"),
    "rut": ("RUT", r"\brut\b|registro unico tributario"),
    "rub": ("Beneficiario final",
        r"beneficiario(?:s)? final(?:es)?|registro unico de beneficiarios|\brub\b"),
    "contabilidad": ("Contabilidad y NIIF",
        r"\bniif\b|normas internacionales de informacion financiera|"
        r"estados financieros|marco tecnico normativo contable"),

    # ---- Procedimiento ----
    "devoluciones": ("Devoluciones y compensaciones",
        r"devolucion(?:es)?|compensacion(?:es)?|saldo(?:s)? a favor"),
    "firmeza": ("Firmeza y prescripción",
        r"\bfirmeza\b|prescripcion|caducidad|termino(?:s)? de revision"),
    "sanciones": ("Sanciones",
        r"sancion(?:es|atorio|atoria)?|\bmulta(?:s)?\b|intereses moratorios|"
        r"extemporaneidad"),
    "fiscalizacion": ("Fiscalización",
        r"requerimiento especial|liquidacion oficial|inspeccion tributaria|"
        r"emplazamiento|pliego de cargos|auto de (?:apertura|verificacion)"),
    "cobro": ("Cobro y acuerdos de pago",
        r"cobro coactivo|acuerdo(?:s)? de pago|facilidad(?:es)? de pago|"
        r"mandamiento de pago|remate"),
    "beneficios": ("Beneficios y conciliación",
        r"conciliacion contencios|terminacion por mutuo acuerdo|"
        r"principio de favorabilidad|reduccion de sancion|amnistia"),
    "recursos": ("Recursos y defensa",
        r"recurso de reconsideracion|revocatoria directa|"
        r"silencio administrativo|nulidad y restablecimiento"),
    "notificaciones": ("Notificaciones",
        r"notificacion(?:es)? (?:electronica|por correo|personal)|"
        r"buzon electronico"),

    # ---- Internacional ----
    "precios_transferencia": ("Precios de transferencia",
        r"precios de transferencia|vinculado(?:s)? economico|"
        r"documentacion comprobatoria|informe (?:maestro|local)"),
    "convenios": ("Convenios de doble imposición",
        r"doble (?:imposicion|tributacion)|convenio(?:s)? para evitar|\bcdi\b"),
    "ece": ("Entidades del exterior",
        r"entidad(?:es)? controlada(?:s)? del exterior|\bece\b|"
        r"jurisdiccion(?:es)? no cooperante"),

    # ---- Sectorial ----
    "aduanero": ("Aduanero",
        r"declaracion(?:es)? aduanera|regimen aduanero|usuario(?:s)? aduanero|"
        r"deposito(?:s)? habilitado|arancel(?:es)?|mercancia(?:s)? importada|"
        r"levante de mercancia|operador economico autorizado|\boea\b"),
    "cambiario": ("Cambiario",
        r"regimen (?:de )?cambiari|declaracion de cambio|inversion extranjera|"
        r"endeudamiento externo|mercado cambiario|divisas"),
    "comercio_exterior": ("Comercio exterior",
        r"importacion(?:es)?|exportacion(?:es)?|tratado de libre comercio|"
        r"certificado de origen"),
    "transporte": ("Transporte de carga",
        r"transporte terrestre de carga|manifiesto de carga|parque automotor|"
        r"empresa(?:s)? transportadora|servicio publico (?:intermunicipal|de carga)"),
    "zonas_francas": ("Zonas francas", r"zona(?:s)? franca(?:s)?"),
    "esal": ("ESAL y donaciones",
        r"sin animo de lucro|\besal\b|regimen tributario especial|donacion(?:es)?"),
    "salud": ("Salud", r"\beps\b|\bips\b|servicios de salud|sector salud"),
    "agropecuario": ("Agropecuario",
        r"agropecuari|agroindustri|productor(?:es)? agricola"),
    "turismo": ("Turismo", r"turismo|hotelero|prestador(?:es)? de servicios turisticos"),
    "criptoactivos": ("Criptoactivos", r"criptoactivo|criptomoneda|activo(?:s)? virtual"),
    "financiero": ("Sector financiero",
        r"entidad(?:es)? financiera|establecimiento(?:s)? de credito|"
        r"sector financiero|fiduciari"),
    "economia_naranja": ("Economía naranja", r"economia naranja"),

    # ---- Calendario, formularios y valores ----
    "formularios": ("Formularios y recibos",
        r"formulario\s*n?o?\.?\s*\d{2,4}|recibo oficial de pago|"
        r"prescrib(?:e|ir|ese) el formulario|instructivo del|"
        r"formato\s*\d{3,4}|prescripcion del formulario"),
    "calendario": ("Calendario tributario",
        r"calendario tributario|plazo(?:s)? para (?:declarar|presentar|pagar)|"
        r"vencimiento(?:s)?|dias habiles siguientes|a mas tardar el"),
    "uvt": ("UVT", r"\buvt\b|unidad de valor tributario"),
}

TAXONOMIA_RE = {k: (etq, re.compile(pat)) for k, (etq, pat) in TAXONOMIA.items()}

ETIQUETAS = {k: etq for k, (etq, _) in TAXONOMIA.items()}


def clasificar(titulo="", descripcion="", texto_completo="", materia=None):
    """
    Devuelve la lista de temas. Se aplica sobre el texto limpio, sin las
    frases de formulario, y sin tildes para que los patrones no fallen.

    El texto completo pesa igual que la descripcion: una resolucion puede
    tratar de retencion sin que la palabra aparezca en su titulo. Ese era
    justamente el caso de la Resolucion 8 de 2026.
    """
    base = " ".join(filter(None, [titulo, descripcion, (texto_completo or "")[:20000]]))
    base = _plano(_sin_ruido(base))

    temas = [k for k, (_, rx) in TAXONOMIA_RE.items() if rx.search(base)]

    # La materia que declara la DIAN se respeta siempre, aunque el texto
    # no la mencione. Es su clasificacion, no la nuestra.
    if materia in ("aduanero", "cambiario") and materia not in temas:
        temas.append(materia)

    return temas


def etiqueta(clave):
    """Nombre legible de un tema, para mostrar al contador."""
    return ETIQUETAS.get(clave, clave.replace("_", " "))


# ======================================================================
# Prueba rapida: python clasificador.py
# ======================================================================

if __name__ == "__main__":
    casos = [
        ("Resolución 8 de 2026 DIAN",
         '(Tributario) Por la cual se adiciona la Sección 5 "Procedimiento '
         'para el recaudo y pago de la tarifa del 0.1porciento establecida en '
         'el artículo 21 de la Ley 2251 de 2022 sobre operaciones de '
         'transporte terrestre de carga" al Capítulo 2 del Título 8 de la '
         'Parte 1 de la Resolución número 000227 del 23 de septiembre de 2025 '
         '"Resolución única en Materia Tributaria, Aduanera y Cambiaria"'),
        ("Concepto 11166 de 2026 DIAN",
         "(Tributario) (Int 1201) Efectos jurídicos y fiscales de la "
         "Sentencia C-079 de 2026 respecto del Impuesto al Patrimonio"),
        ("Concepto 18075 de 2023 DIAN",
         "(Tributario) (Int 1621) Concepto Unificado sobre Criptoactivos"),
        ("Resolución 9 de 2026 DIAN",
         "(Tributario) Por la cual se modifica el instructivo del Recibo "
         "Oficial de Pago Impuestos Nacionales - Formulario 490"),
    ]
    for titulo, desc in casos:
        mat, limpia = extraer_materia(desc)
        temas = clasificar(titulo, limpia, materia=mat)
        print(f"\n{titulo}")
        print(f"  materia : {mat}")
        print(f"  limpia  : {limpia[:110]}")
        print(f"  temas   : {[etiqueta(t) for t in temas]}")
