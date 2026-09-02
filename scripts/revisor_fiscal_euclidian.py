import os
import sys
from pathlib import Path

# Permite ejecutar tanto `python scripts/...py` como importar desde los tests.
ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
for _p in (str(ROOT), str(SCRIPTS)):
    if _p not in sys.path:
        sys.path.insert(0, _p)

# El resto del módulo se conserva en el repositorio; este bloque garantiza que
# los imports internos de scripts funcionen en CI y al ejecutar el script.
