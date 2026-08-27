"""Clasificación de documentos para consulta contable.

No sustituye revisión jurídica: etiqueta cada documento según señales
explícitas de su contenido y conserva evidencia de por qué recibió la etiqueta.
"""
from __future__ import annotations

import re
from dataclasses import dataclass, asdict


CATEGORIAS = {
    "impuesto_renta": r"renta|ganancia ocasional|retención en la fuente",
    "iva": r"\biva\b|impuesto sobre las ventas",
    "facturacion": r"facturaci[oó]n|factura electr[oó]nica|documento equivalente",
    "retenciones": r"retenci[oó]n|autoretenedor",
    "procedimiento": r"procedimiento tributario|fiscalizaci[oó]n|sanci[oó]n|emplazamiento",
    "calendario": r"vencimiento|plazo|calendario tributario|declaraci[oó]n",
    "aduanas": r"aduana|importaci[oó]n|exportaci[oó]n|arancel",
    "regimen_simple": r"r[eé]gimen simple|SIMPLE",
    "territorial": r"municipio|distrito|departamento|territorial",
}

@dataclass(frozen=True)
class Etiqueta:
    categoria: str
    confianza: float
    evidencias: tuple[str, ...]

    def to_dict(self):
        return asdict(self)


def clasificar(texto: str, max_evidencias: int = 3) -> list[Etiqueta]:
    resultado = []
    for categoria, patron in CATEGORIAS.items():
        coincidencias = list(re.finditer(patron, texto, re.IGNORECASE))
        if not coincidencias:
            continue
        evidencias = []
        for match in coincidencias[:max_evidencias]:
            inicio = max(0, match.start() - 80)
            fin = min(len(texto), match.end() + 120)
            frase = " ".join(texto[inicio:fin].split())
            if frase not in evidencias:
                evidencias.append(frase)
        confianza = min(0.95, 0.55 + 0.08 * min(len(coincidencias), 5))
        resultado.append(Etiqueta(categoria, round(confianza, 2), tuple(evidencias)))
    return sorted(resultado, key=lambda x: (-x.confianza, x.categoria))
