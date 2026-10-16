"""Extracción conservadora de la identidad del encabezado del acto DIAN."""
import re
import unicodedata

TIPOS = r'concepto|oficio|resolucion|circular|comunicado|decreto|ley|sentencia|acuerdo|memorando'
HEADING = re.compile(rf'^(?P<tipo>{TIPOS})\s+(?:(?:numero|no\.?|nro\.?)\s+)?(?P<numero>\d+(?:\s*[-–]\s*\d+)?)(?:\s*\[\d+\])?\s+de\s+(?P<anio>(?:19|20)\d{{2}})\b')
TITLE = re.compile(rf'\b(?P<tipo>{TIPOS})\s+(?:(?:numero|no\.?|nro\.?)\s+)?(?P<numero>\d+)\s+de\s+(?P<anio>(?:19|20)\d{{2}})\b')


def _norm(line):
    line = unicodedata.normalize('NFKD', str(line or '')).encode('ascii', 'ignore').decode().lower()
    return re.sub(r'\s+', ' ', line).strip()


def _parse(match):
    if not match:
        return None
    number = match['numero'].replace(' ', '').replace('–', '-').split('-')[-1]
    # Circulares DIAN cuyo número completo incorpora código de dependencia.
    if match['tipo'] == 'circular' and number.startswith('1275700000'):
        number = number[len('1275700000'):]
    return (match['tipo'], int(number), match['anio'])


def cabecera_oficial(texto):
    """Prioriza el primer encabezado del cuerpo tras ÍNDICE, nunca una cita posterior.

    Una cabecera del cuerpo incongruente prevalece sobre el título SEO. Si el
    índice aparece pero falta una cabecera documental inmediata, no se valida.
    """
    lines = [_norm(line) for line in str(texto or '').splitlines()]
    marker = next((i for i, line in enumerate(lines[:60]) if line == 'indice'), None)
    if marker is not None:
        for line in lines[marker + 1:marker + 11]:
            match = HEADING.match(line)
            if match:
                return _parse(match)
        return None
    return _parse(TITLE.search(_norm(texto)[:2000]))
