"""Pipeline histórico: descubrir -> indexar -> enriquecer por lotes.

Diseñado para ser reanudable y seguro: una etapa fallida no declara el
histórico completo. La carga y el enriquecimiento se pueden ejecutar en
pequeños lotes desde GitHub Actions.
"""
from __future__ import annotations

import argparse
import json
import subprocess
import sys
from pathlib import Path


def run(cmd: list[str]) -> None:
    print("PIPELINE:", " ".join(cmd))
    subprocess.run(cmd, check=True)


def main() -> int:
    ap = argparse.ArgumentParser()
    ap.add_argument("--descubrimiento", type=int, default=1000)
    ap.add_argument("--lote", type=int, default=100)
    ap.add_argument("--minutos", type=int, default=20)
    args = ap.parse_args()

    run([sys.executable, "scripts/descubrimiento_fuentes.py", "--limite", str(args.descubrimiento)])
    run([sys.executable, "scripts/carga_historica.py", "--lote", str(args.lote)])
    run([sys.executable, "scripts/enriquecedor.py", "--limite", str(args.lote), "--minutos", str(args.minutos)])

    cursor = Path("historico_cursor.json")
    if cursor.exists():
        estado = json.loads(cursor.read_text(encoding="utf-8"))
        print("PIPELINE_ESTADO:", estado)
    print("PIPELINE_OK")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
