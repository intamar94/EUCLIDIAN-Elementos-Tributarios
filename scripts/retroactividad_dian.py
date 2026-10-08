"""Detección conservadora: mencionar un año anterior no crea retroactividad."""

import re


def explicit_retroactivity(text):
    """Solo señala una afirmación expresa; la incertidumbre queda sin afirmar."""
    source = str(text or "")
    for match in re.finditer(r"[^.\n]{0,140}(?:retroactiv\w*|efectos?\s+hacia\s+atr[aá]s)[^.\n]{0,140}", source, re.IGNORECASE):
        phrase = match.group().strip()
        if re.search(r"\b(?:no|sin|carece\s+de|prohibid[oa])\b[^.\n]{0,60}(?:retroactiv|efectos?\s+hacia\s+atr[aá]s)", phrase, re.IGNORECASE):
            continue
        if not re.search(r"\b(?:tendr[aá]|producir[aá]|surtir[aá]|aplicar[aá]|aplica|rige|regir[aá]|reconoce|reconocer[aá])\b[^.\n]{0,80}(?:retroactiv|efectos?\s+hacia\s+atr[aá]s)", phrase, re.IGNORECASE):
            continue
        years = sorted({int(year) for year in re.findall(r"\b(?:19|20)\d{2}\b", phrase)})
        return True, years[:8]
    return False, []
