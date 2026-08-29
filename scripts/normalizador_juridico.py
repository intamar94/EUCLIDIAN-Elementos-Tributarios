"""EUCLIDIAN — normalización jurídica determinista.

Convierte variantes de redacción en conceptos comparables sin decidir que dos
expresiones tienen el mismo efecto jurídico cuando difieren en elementos
materiales. No inventa evidencia y no modifica el texto fuente.
"""
from __future__ import annotations
import re
import unicodedata
from dataclasses import dataclass, asdict


CONCEPTS = {
    "OBLIGACION_PRESENTAR": [
        "debe presentar", "esta obligado a presentar", "se encuentra obligado a presentar",
        "tiene el deber de presentar", "le corresponde presentar"
    ],
    "NO_OBLIGACION_PRESENTAR": [
        "no esta obligado a presentar", "no se encuentra obligado a presentar",
        "no tiene el deber de presentar", "no resulta exigible"
    ],
    "VIGENCIA": ["entra en vigencia", "rige a partir de", "vigente desde", "comienza a regir"],
    "DEROGACION": ["deroga", "queda derogado", "derogase", "deróguese"],
    "MODIFICACION": ["modifica", "modificado por", "se modifica", "sustituye el articulo", "adiciona"],
}

MATERIAL = {
    "sujeto": ["persona natural", "persona juridica", "contribuyente", "responsable", "agente retenedor"],
    "periodo": ["año gravable", "periodo gravable", "bimestre", "trimestre", "mes"],
    "condicion": ["siempre que", "cuando", "en caso de", "a condicion de", "salvo que"],
    "excepcion": ["excepto", "exceptuado", "salvo", "sin perjuicio de"],
    "cuantia": ["por ciento", "%", "uvt", "salario minimo"],
}


def clean(text: str) -> str:
    text = unicodedata.normalize("NFKD", text or "").encode("ascii", "ignore").decode().lower()
    text = re.sub(r"\s+", " ", text).strip()
    text = re.sub(r"(\d)\s*%", r"\1 %", text)
    text = re.sub(r"(articulo|art\.)\s+", "articulo ", text)
    return text


def concepts(text: str) -> list[str]:
    t = clean(text)
    return sorted(k for k, variants in CONCEPTS.items() if any(v in t for v in variants))


def material_markers(text: str) -> dict[str, list[str]]:
    t = clean(text)
    return {k: sorted({v for v in values if v in t}) for k, values in MATERIAL.items() if any(v in t for v in values)}


@dataclass
class Comparison:
    equivalent: bool
    confidence: float
    concepts_a: list[str]
    concepts_b: list[str]
    material_a: dict[str, list[str]]
    material_b: dict[str, list[str]]
    differences: list[str]


def compare(a: str, b: str) -> Comparison:
    ca, cb = concepts(a), concepts(b)
    ma, mb = material_markers(a), material_markers(b)
    differences = []
    for key in sorted(set(ma) | set(mb)):
        if set(ma.get(key, [])) != set(mb.get(key, [])):
            differences.append(key)
    same_concept = bool(set(ca) & set(cb)) or (not ca and not cb)
    equivalent = same_concept and not differences
    confidence = 0.98 if equivalent and ca else (0.90 if equivalent else 0.35)
    return Comparison(equivalent, confidence, ca, cb, ma, mb, differences)


def normalize_record(text: str) -> dict:
    return {"texto_normalizado": clean(text), "conceptos": concepts(text), "marcadores_materiales": material_markers(text)}


if __name__ == "__main__":
    import argparse, json
    p = argparse.ArgumentParser(); p.add_argument("texto_a"); p.add_argument("texto_b", nargs="?"); a = p.parse_args()
    out = normalize_record(a.texto_a) if a.texto_b is None else asdict(compare(a.texto_a, a.texto_b))
    print(json.dumps(out, ensure_ascii=False, indent=2))
