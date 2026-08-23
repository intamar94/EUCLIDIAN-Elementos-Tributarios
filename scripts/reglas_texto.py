"""
EUCLIDIAN — Elementos Tributarios
Patrones y tablas del redactor

Separado de redactor_reglas.py porque cambia por razones distintas:
aqui se toca cuando la DIAN estrena una formula de redaccion o cuando
hace falta un tema nuevo. La logica de composicion no se entera.
"""

import re
from datetime import date

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
    r'[^\"]{0,20}(?:\"[^\"]{0,120}\")?',
    re.IGNORECASE)

# La DIAN escribe sus cambios de criterio con una formula fija:
#   "[Tema] - Reconsidera la doctrina del Concepto No. 05833 de abril 15
#    de 2026. Se precisa que la Tesis Juridica No. 3 del Concepto..."
# Copiar eso entero repite el mismo numero tres veces y no dice lo unico
# que importa: que la DIAN cambio de opinion y que hay que revisar los
# casos asesorados con la doctrina vieja.
RECONSIDERA = re.compile(
    r"\b(reconsidera|revoca|modifica|aclara)\b[^.]{0,60}?"
    r"\b(?:concepto|oficio|doctrina|tesis)\b",
    re.IGNORECASE)

CITADOS = re.compile(
    r"\b(?:concepto|oficio)\s+(?:general\s+)?(?:unificado\s+)?"
    r"(?:n[uú]mero\s+|no\.?\s*)?0*(\d{3,9})"
    r"(?:[^.\d]{0,40}?\b(?:de|del)\s+(?:\w+\s+\d{1,2}\s+de\s+)?((?:19|20)\d{2}))?",
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
