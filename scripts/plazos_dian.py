"""Extracción conservadora de plazos literales desde actos DIAN."""

import re


def complete_deadlines(text):
    """Devuelve frases con fecha completa; descarta recortes y antecedentes."""
    source = str(text or "")
    start = re.search(r"\bRESUELVE\b", source, re.IGNORECASE)
    if start:
        source = source[start.end():]
    date_pattern = r"\d{1,2}\s+de\s+[A-Za-záéíóúÁÉÍÓÚ]+\s+de\s+(?:19|20)\d{2}"
    trigger = r"plazo|vencimiento|hasta el|a m[aá]s tardar|pagar[aá]n?|pago"
    found = []
    for line in source.splitlines():
        clean = re.sub(r"\s+", " ", line).strip(" -•\t")
        if not (25 <= len(clean) <= 420 and re.search(trigger, clean, re.IGNORECASE)):
            continue
        matches = list(re.finditer(date_pattern, clean, re.IGNORECASE))
        if not matches:
            continue
        ending = clean[matches[-1].end():].strip()
        if ending and not re.fullmatch(r"(?:inclusive|[).,;:»”\"]*)", ending, re.IGNORECASE):
            continue
        value = clean.rstrip(".,;: ") + "."
        if value not in found:
            found.append(value)
    return found[:12]
