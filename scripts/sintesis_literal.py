"""Extractos literales completos, sin atribuir aprobación humana."""
import re
import unicodedata
from bs4 import BeautifulSoup

PREFIJO_LITERAL = 'Extracto literal DIAN: '


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
        # No se recortan párrafos: una excepción al final debe conservarse.
        if not 100 <= len(text) <= 1800 or not re.search(r'[.!?][\"”»]?$', text):
            continue
        if re.search(r'esta (?:subdirecci[oó]n|direcci[oó]n).*facultad|doctrina.*car[aá]cter general|atentamente|cordialmente', text, re.I):
            continue
        numerado = re.match(r'^\d{1,3}\.\s+', text)
        conclusion = re.search(r'^(?:\d{1,3}\.\s*)?(?:as[ií] las cosas|en conclusi[oó]n|en consecuencia|por lo tanto|en s[ií]ntesis)', text, re.I)
        if (numerado or conclusion) and '?' not in text:
            candidatos.append((bool(conclusion), text))
    if not candidatos:
        return None
    # Una conclusión completa tiene preferencia; la cita conserva su contexto
    # original a través del documento enlazado y nunca se llama síntesis humana.
    preferidos = [text for conclusion, text in candidatos if conclusion]
    return PREFIJO_LITERAL + (preferidos[-1] if preferidos else candidatos[-1][1])
