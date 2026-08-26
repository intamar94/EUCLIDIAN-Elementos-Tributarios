"""Compatibilidad histórica.

El motor activo y único es enriquecedor_fechas_v2.py. Este módulo conserva
el nombre Enriquecedor para scripts antiguos sin mantener dos implementaciones
que puedan divergir.
"""
from enriquecedor_fechas_v2 import EnriquecedorFechasV2, a_fecha

Enriquecedor = EnriquecedorFechasV2

__all__ = ["Enriquecedor", "EnriquecedorFechasV2", "a_fecha"]
