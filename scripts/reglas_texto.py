"""
EUCLIDIAN — Elementos Tributarios
Reglas de texto para redaccion determinista.

Las funciones de este modulo reciben texto ya extraido y devuelven
hechos o fragmentos que el redactor puede usar sin inventar contenido.
"""

import re


# Verbos que suelen anunciar el efecto normativo de una disposicion.
VERBOS_CAMBIO = (
    (r"\bse modifica(?:n)?\b", "modifica"),
    (r"\bse adiciona(?:n)?\b", "adiciona"),
    (r"\bse sustituye(?:n)?\b", "sustituye"),
    (r"\bse deroga(?:n)?\b", "deroga"),
    (r"\bse reglamenta(?:n)?\b", "reglamenta"),
    (r"\bse establece(?:n)?\b", "establece"),
    (r"\bse fija(?:n)?\b", "fija"),
    (r"\bse crea(?:n)?\b", "crea"),
    (r"\bse adopta(?:n)?\b", "adopta"),
    (r"\bse define(?:n)?\b", "define"),
    (r"\bse aclara(?:n)?\b", "aclara"),
)


# Materias tributarias reconocibles directamente en texto.
TEMAS = {
    "renta": re.compile(r"\brenta\b|impuesto sobre la renta", re.I),
    "iva": re.compile(r"\bIVA\b|impuesto sobre las ventas", re.I),
    "retencion": re.compile(r"retenci[oó]n(?: en la fuente)?", re.I),
    "patrimonio": re.compile(r"impuesto al patrimonio|\bpatrimonio\b", re.I),
    "gmf": re.compile(r"\bGMF\b|gravamen a los movimientos financieros", re.I),
    "simple": re.compile(r"r[eé]gimen simple|\bSIMPLE\b", re.I),
    "facturacion": re.compile(r"facturaci[oó]n electr[oó]nica|documento equivalente", re.I),
    "exogena": re.compile(r"informaci[oó]n ex[oó]gena", re.I),
    "rut": re.compile(r"\bRUT\b|registro u[nú]nico tributario", re.I),
    "aduanero": re.compile(r"aduan(?:a|ero|era|eros|eras)", re.I),
    "cambiario": re.compile(r"r[eé]gimen cambiario|cambiario", re.I),
    "sanciones": re.compile(r"sanci[oó]n(?:es)?", re.I),
    "fiscalizacion": re.compile(r"fiscalizaci[oó]n|fiscalizar", re.I),
    "cobro": re.compile(r"cobro coactivo|procedimiento de cobro", re.I),
    "precios_transferencia": re.compile(r"precios de transferencia", re.I),
    "convenios": re.compile(r"convenio(?:s)? para evitar la doble imposici[oó]n", re.I),
    "consumo": re.compile(r"impuesto nacional al consumo|\bINC\b", re.I),
    "timbre": re.compile(r"impuesto de timbre|\btimbre\b", re.I),
    "uvt": re.compile(r"\bUVT\b|unidad de valor tributario", re.I),
}


def normalizar(texto):
    """Reduce espacios y conserva el contenido sustancial."""
    if not texto:
        return ""
    return re.sub(r"\s+", " ", str(texto)).strip()


def detectar_temas(texto):
    """Devuelve los identificadores de temas que aparecen literalmente."""
    t = normalizar(texto)
    return [nombre for nombre, patron in TEMAS.items() if patron.search(t)]


def detectar_cambios(texto):
    """Devuelve los verbos normativos detectados, sin inferir consecuencias."""
    t = normalizar(texto)
    encontrados = []
    for patron, nombre in VERBOS_CAMBIO:
        if re.search(patron, t, re.I):
            encontrados.append(nombre)
    return encontrados


def tiene_fecha(texto):
    """Indica si el texto contiene una fecha en formato comun."""
    t = normalizar(texto)
    return bool(re.search(r"\b\d{1,2}\s+de\s+[A-Za-zÁÉÍÓÚáéíóúñ]+\s+de\s+\d{4}\b", t))


def tiene_plazo(texto):
    """Detecta referencias explicitas a plazos, sin calcularlos."""
    t = normalizar(texto)
    return bool(re.search(r"\bplazo\b|\bt[eé]rmino\b|dentro de los?\s+\d+\s+d[ií]as", t, re.I))


def tiene_derogacion(texto):
    """Detecta una derogacion expresamente mencionada."""
    return bool(re.search(r"\bse deroga(?:n)?\b|\bderogad[oa]s?\b", normalizar(texto), re.I))


def tiene_retroactividad(texto):
    """Detecta lenguaje explicito de retroactividad o efectos anteriores."""
    return bool(re.search(r"retroactiv|efectos retroactivos?|vigencia anterior", normalizar(texto), re.I))


def extraer_articulos(texto):
    """Extrae referencias simples a articulos sin interpretarlas."""
    t = normalizar(texto)
    encontrados = re.findall(r"art[ií]culo\s+(\d+[A-Za-z]?(?:\.\d+)*)", t, re.I)
    salida = []
    for n in encontrados:
        if n not in salida:
            salida.append(n)
    return salida


def primera_oracion(texto, limite=320):
    """Toma la primera oracion disponible, solo como material de redaccion."""
    t = normalizar(texto)
    if not t:
        return ""
    m = re.search(r"^(.{1,%d}?[.!?])(?:\s|$)" % limite, t)
    return m.group(1) if m else t[:limite].rstrip() 
