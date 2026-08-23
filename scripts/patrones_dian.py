"""
EUCLIDIAN — Elementos Tributarios
Patrones de lectura de documentos DIAN

Los encabezados, meses y funciones de limpieza que usa el extractor.
Aparte porque cambian cuando la DIAN cambia el formato de sus
documentos, no cuando cambia lo que queremos sacar de ellos.
"""

import re

CIERRES = (
    r"Fundamentaci[oó]n|Fuentes Formales|Descriptores|Problema Jur[ií]dico|"
    r"Tesis Jur[ií]dica|Extracto|Banco de Datos|[AÁ]rea del Derecho|"
    r"Atentamente|Cordialmente|Proyect[oó]|Aprob[oó]|"
    r"En los anteriores t[eé]rminos"
)


MESES_NUM = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}


def a_fecha(dia, mes_txt, anio):
    from datetime import date
    m = MESES_NUM.get(str(mes_txt).lower().strip())
    if not m:
        return None
    try:
        return date(int(anio), m, int(dia))
    except ValueError:
        return None


def limpiar(t):
    """El HTML del normograma parte los numeros en lineas propias porque
    son enlaces. Hay que volver a unirlos antes de leer."""
    if not t:
        return ""
    t = re.sub(r"[ \t\xa0]+", " ", t)
    t = re.sub(r"\n(?=\s*\d{1,4}\s*\n)", " ", t)   # numero suelto
    t = re.sub(r"\n(?=\s*(?:del|de la|de|y)\s)", " ", t)
    t = re.sub(r"\s*\n\s*", "\n", t)
    return t.strip()
