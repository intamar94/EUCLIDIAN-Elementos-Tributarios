"""Actualización incremental diaria del catálogo DIAN.

Primero descubre fuentes, después incorpora/actualiza el índice histórico.
No borra documentos antiguos y no marca contenido como aprobado.
"""
from __future__ import annotations

import subprocess
import sys
from datetime import datetime, timezone

from catalogo_historico import abrir, importar


def main() -> int:
    subprocess.run(
        [sys.executable, "scripts/descubrimiento_fuentes.py", "--limite", "1000"],
        check=True,
    )
    import json
    from pathlib import Path
    data = json.loads(Path("descubrimiento_fuentes.json").read_text(encoding="utf-8"))
    db = abrir("euclidian_historico.db")
    ahora = datetime.now(timezone.utc).isoformat()
    total = importar(db, data.get("documentos", []), ahora)
    print(f"ACTUALIZACION_DIARIA_OK: {total} registros sincronizados")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
