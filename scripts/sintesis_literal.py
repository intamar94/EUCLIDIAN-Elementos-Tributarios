"""Extractos literales completos, sin atribuir aprobación humana."""
import re
import unicodedata
from bs4 import BeautifulSoup

PREFIJO_LITERAL = 'Extracto literal DIAN: '
MODELO_LITERAL = 'literal-dian-cuerpo-v2'


def es_referencia_o_cierre(text):
    return bool(re.search(r'^(?:\d{1,3}\.\s*)?(?:cfr\.?\s|cf\.?\s|v[eé]ase\b|vid\.?\s|en (?:los anteriores|estos) t[eé]rminos|atentamente\b|cordialmente\b)', comparable(text), re.I))


def comparable(value):
    # Solo normaliza espacios y Unicode; conserva negaciones, números y signos.
    return re.sub(r'\s+', ' ', unicodedata.normalize('NFKC', str(value or ''))).strip()


def cuerpo_literal(value):
    text = str(value or '').strip()
    return text[len(PREFIJO_LITERAL):].strip() if text.startswith(PREFIJO_LITERAL) else ''


def literal_presente(source, value):
    body = comparable(cuerpo_literal(value))
    return len(body) >= 80 and body in comparable(source)


def extraer_literal(html):
    soup = BeautifulSoup(html, 'html.parser')
    candidatos = []
    for p in soup.find_all('p'):
        text = comparable(p.get_text(' ', strip=True))
        # NF es el ancla de notas del Normograma; no confundir el número
        # de una nota con la numeración de la argumentación del concepto.
        if p.find(attrs={'name': re.compile(r'^NF$', re.I)}) or re.search(r'NOTAS DE PIE DE P[ÁA]GINA', text, re.I):
            break
        if p.find(attrs={'name': re.compile(r'^NF\d+', re.I)}) or p.find(attrs={'id': re.compile(r'^NF\d+', re.I)}):
            continue
        if es_referencia_o_cierre(text):
            continue
        # No se recortan párrafos: una excepción al final debe conservarse.
        if not 100 <= len(text) <= 1800 or not re.search(r'[.!?][\"”»]?$', text):
            continue
        if re.search(r'esta (?:subdirecci[oó]n|direcci[oó]n).*facultad|doctrina.*car[aá]cter general|atentamente|cordialmente', text, re.I):
            continue
        numerado = re.match(r'^\d{1,3}\.\s+', text)
        conclusion = re.search(r'^(?:\d{1,3}\.\s*)?(?:as[ií] las cosas|en conclusi[oó]n|en consecuencia|por lo (?:tanto|anterior)|en s[ií]ntesis)', text, re.I)
        if (numerado or conclusion) and '?' not in text:
            candidatos.append((bool(conclusion), text))
    if not candidatos:
        return None
    # Una conclusión completa tiene preferencia; la cita conserva su contexto
    # original a través del documento enlazado y nunca se llama síntesis humana.
    preferidos = [text for conclusion, text in candidatos if conclusion]
    return PREFIJO_LITERAL + (preferidos[-1] if preferidos else candidatos[-1][1])
