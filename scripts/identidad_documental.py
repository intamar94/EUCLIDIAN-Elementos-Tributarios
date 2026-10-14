"""Identidad literal del encabezado oficial, independiente del ejecutor."""
import re
from verificador_aprobacion import identidad_documental_coincide, norm

def identidad_desde_titulo(titulo_fuente, numero):
    match=re.search(r'(?:^| - )(Concepto|Oficio|Resolución|Circular|Comunicado|Decreto|Ley|Sentencia)\s+0*(\d+)\s+de\s+(\d{4})\b',titulo_fuente,re.I)
    ident=re.search(r'-(\d+)-(\d{4})$',numero)
    if not match or not ident or (int(match[2]),match[3])!=(int(ident[1]),ident[2]):return {}
    return {'tipo_documento':match[1].lower().replace('ó','o'),'titulo':titulo_fuente[match.start():].removeprefix(' - ').strip()}
