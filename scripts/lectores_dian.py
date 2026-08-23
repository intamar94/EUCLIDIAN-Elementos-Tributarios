"""
EUCLIDIAN — Elementos Tributarios
Lectores de estructura DIAN.

Separa la lectura de los bloques del documento de las reglas que deciden
que hacer con ellos.
"""

import re
from .patrones_dian import CIERRES, limpiar


def bloque(texto, encabezado, limite=3000):
    """Devuelve el contenido de un encabezado hasta el siguiente cierre."""
    if not texto:
        return ""
    t = limpiar(texto)
    patron = rf"^{encabezado}\s*\n(.{{5,{limite}}}?)(?=\n\s*(?:{CIERRES})\s*\n|\Z)"
    m = re.search(patron, t, re.DOTALL | re.IGNORECASE | re.MULTILINE)
    if not m:
        return ""
    return m.group(1).strip()


def lineas(texto):
    return [re.sub(r"\s+", " ", x).strip() for x in texto.split("\n") if x.strip()]


def leer_descriptores(texto):
    cuerpo = bloque(texto, r"Descriptores", 1500)
    salida = []
    for linea in lineas(cuerpo):
        linea = re.sub(r"^(?:Tema|Descriptores)\s*:\s*", "", linea, flags=re.I)
        for parte in re.split(r"\s+[-–]\s+|;", linea):
            parte = parte.strip(" .·-")
            if 3 < len(parte) < 120 and parte not in salida:
                salida.append(parte)
    return salida


def leer_fuentes(texto):
    cuerpo = bloque(texto, r"Fuentes Formales", 2000)
    salida = []
    for linea in lineas(cuerpo):
        if re.search(r"art[ií]culo|ley|decreto|resoluci[oó]n|estatuto|c[oó]digo|constituci[oó]n|sentencia", linea, re.I):
            if linea not in salida:
                salida.append(linea)
    return salida


def leer_problema(texto):
    cuerpo = bloque(texto, r"Problema Jur[ií]dico", 1800)
    return re.sub(r"^Problema Jur[ií]dico\s*[:.]?\s*", "", cuerpo, flags=re.I).strip()


def leer_tesis(texto):
    cuerpo = bloque(texto, r"Tesis Jur[ií]dica", 3000)
    if not cuerpo:
        return "", None
    cuerpo = re.sub(r"^Tesis Jur[ií]dica(?:\s+No\.?\s*\d+)?\s*[:.]?\s*", "", cuerpo, flags=re.I).strip()
    respuesta = None
    m = re.match(r"^(S[ií]|No)\b", cuerpo, re.I)
    if m:
        respuesta = "si" if m.group(1).lower().startswith("s") else "no"
    return cuerpo, respuesta


def leer_area(texto):
    if not texto:
        return ""
    m = re.search(r"[AÁ]rea del Derecho\s*\n\s*([A-Za-zÁÉÍÓÚáéíóúñ ]{4,60})", limpiar(texto), re.I)
    return m.group(1).strip() if m else ""


def leer_fecha(texto):
    if not texto:
        return None
    m = re.search(r"\b(\d{1,2})\s+de\s+([A-Za-zÁÉÍÓÚáéíóúñ]+)\s+de\s+(\d{4})\b", texto, re.I)
    if not m:
        return None
    from .patrones_dian import a_fecha
    return a_fecha(m.group(1), m.group(2), m.group(3))


def leer_documento(texto):
    """Lectura estructural sin interpretación."""
    return {
        "area_derecho": leer_area(texto),
        "descriptores": leer_descriptores(texto),
        "fuentes_formales": leer_fuentes(texto),
        "problema_juridico": leer_problema(texto),
        "tesis_juridica": leer_tesis(texto)[0],
        "tesis_respuesta": leer_tesis(texto)[1],
        "fecha_detectada": leer_fecha(texto),
    }
