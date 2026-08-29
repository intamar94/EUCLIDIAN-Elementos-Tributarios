"""Cola resiliente de EUCLIDIAN.

Un documento nunca detiene el lote. Cada caso mantiene su propia iteración,
motivo y siguiente acción. Los errores de un caso quedan aislados de los demás.
"""
from __future__ import annotations
from dataclasses import dataclass, asdict
from datetime import datetime, timezone

MAX_ITERATIONS = 5

@dataclass
class WorkItem:
    documento_id: str
    estado: str = "REVIEW"
    iteracion: int = 0
    motivo: str = ""
    siguiente_accion: str = "CORREGIR"
    ultimo_error: str = ""


def route(item: WorkItem, approved: bool, correctable: bool, error: str = "") -> WorkItem:
    """Decide solo sobre este documento; nunca altera el estado del lote."""
    if approved:
        item.estado = "APPROVED"
        item.siguiente_accion = "NONE"
        item.motivo = "Revisión fiscal superada."
        return item
    item.ultimo_error = error
    if correctable and item.iteracion < MAX_ITERATIONS:
        item.iteracion += 1
        item.estado = "CORRECTING"
        item.siguiente_accion = "REPROCESS"
        item.motivo = "Corrección requerida; volver a extracción/normalización/clasificación/revisión."
    else:
        item.estado = "ESCALATED"
        item.siguiente_accion = "SPECIALIST_REVIEW"
        item.motivo = "No resuelto tras las iteraciones permitidas; escalar sin detener el lote."
    return item


def isolate(items: list[WorkItem]) -> list[WorkItem]:
    """Simula aislamiento: un elemento inválido no interrumpe los restantes."""
    out = []
    for item in items:
        try:
            if not item.documento_id:
                raise ValueError("documento_id vacío")
            out.append(item)
        except Exception as exc:
            out.append(WorkItem(documento_id="__invalid__", estado="ESCALATED", siguiente_accion="SPECIALIST_REVIEW", ultimo_error=str(exc)))
    return out


def snapshot(item: WorkItem) -> dict:
    return {**asdict(item), "updated_at": datetime.now(timezone.utc).isoformat()}
