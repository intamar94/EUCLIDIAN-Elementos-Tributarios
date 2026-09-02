import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SCRIPTS = ROOT / "scripts"
if str(ROOT) not in sys.path:
    sys.path.insert(0, str(ROOT))
if str(SCRIPTS) not in sys.path:
    sys.path.insert(0, str(SCRIPTS))

# Imports del revisor. Se mantienen compatibles con ejecución directa e importación desde tests.
from scripts.composicion import Composicion

# TODO: restore remaining reviewer implementation from previous commit before CI run.
