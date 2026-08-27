"""Carga histórica reanudable del catálogo DIAN.

Procesa por lotes y deja un cursor para que una interrupción no obligue a
repetir todo. El histórico no se considera completo hasta que el índice haya
recorrido todas las páginas descubiertas y la validación lo confirme.
"""
from __future__ import annotations

import argparse
import json
from pathlib import Path
from datetime import datetime, timezone

from catalogo_historico import abrir, importar

CURSOR_DEFAULT = "historico_cursor.json"


def cargar(entrada: str, db_path: str, cursor_path: str, lote: int) -> tuple[int, int]:
    data = json.loads(Path(entrada).read_text(encoding="utf-8"))
    registros = data.get("documentos", [])
    cursor_file = Path(cursor_path)
    cursor = json.loads(cursor_file.read_text(encoding="utf-8")) if cursor_file.exists() else {"posicion": 0}
    posicion = int(cursor.get("posicion", 0))
    posicion = max(0, min(posicion, len(registros)))
    fin = min(posicion + max(1, lote), len(registros))

    db = abrir(db_path)
    ahora = datetime.now(timezone.utc).isoformat()
    procesados = importar(db, registros[posicion:fin], ahora)
    terminado = fin >= len(registros)
    cursor_file.write_text(json.dumps({
        "posicion": fin,
        "total_descubierto": len(registros),
        "terminado": terminado,
        "actualizado_en": ahora,
    }, ensure_ascii=False, indent=2), encoding="utf-8")
    print(f"CARGA_HISTORICA_OK: lote={procesados} posicion={fin}/{len(registros)} terminado={terminado}")
    return procesados, fin


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--entrada", default="descubrimiento_fuentes.json")
    ap.add_argument("--db", default="euclidian_historico.db")
    ap.add_argument("--cursor", default=CURSOR_DEFAULT)
    ap.add_argument("--lote", type=int, default=250)
    args = ap.parse_args()
    cargar(args.entrada, args.db, args.cursor, args.lote)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
