"""Construye la representación de consulta de un documento tributario."""
from __future__ import annotations

from clasificador_contador import clasificar

CAMPOS = (
    "numero_resolucion", "tipo_documento", "fecha_publicacion", "diario_oficial",
    "entidad_emisora", "fecha_entrada_vigencia", "estado_vigencia",
    "motivo_cambio_estado", "plazos_mencionados", "zonas_afectadas",
    "enlace_oficial", "enriquecido_en", "texto_completo",
)


def construir_ficha(documento: dict) -> dict:
    texto = documento.get("texto_completo") or documento.get("contenido") or ""
    ficha = {campo: documento.get(campo) for campo in CAMPOS if documento.get(campo) is not None}
    ficha["etiquetas"] = [e.to_dict() for e in clasificar(texto)]
    ficha["consulta"] = {
        "texto": texto,
        "fuente_oficial": documento.get("enlace_oficial"),
        "ultima_comprobacion": documento.get("enriquecido_en"),
    }
    return ficha
