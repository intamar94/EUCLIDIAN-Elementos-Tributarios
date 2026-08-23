"""
EUCLIDIAN — Elementos Tributarios
Redactor por reglas

LA IDEA
-------
No hace falta interpretar la norma para decirle a un contador lo que
necesita saber. Basta con aplicar reglas sobre hechos que ya tenemos
verificados del documento.

    HECHO VERIFICADO                  ->  CONSECUENCIA
    es un concepto de la DIAN             no te obliga, puedes discutirlo
    es resolucion o decreto               es de obligatorio cumplimiento
    tiene anotacion de suspension         no la apliques todavia
    menciona 2023 y es de 2026            revisa declaraciones presentadas
    trae un plazo con fecha               anota esa fecha
    aplica a unos departamentos           solo si tienes clientes ahi
    es un comite interno de la DIAN       no te aplica

Ninguna de esas conclusiones inventa nada. Todas se siguen mecanicamente
de un dato que el enriquecedor leyo del documento oficial.

VENTAJA SOBRE UN MODELO
-----------------------
Una regla solo puede decir lo que esta programada a decir. No hay
posibilidad de que alucine una tarifa, una fecha o un articulo. Y no
cuesta nada correrla.

Su limite es real: no puede razonar sobre un caso nuevo. Cuando el
documento no da para concluir, lo declara con confianza baja en vez de
disimularlo.

EL LENGUAJE
-----------
La DIAN escribe "Por la cual se adiciona la Seccion 5 al Capitulo 2 del
Titulo 8 de la Parte 1 de la Resolucion 000227". Eso describe DONDE se
guarda el texto, no que dice. Este redactor se queda con lo que va entre
comillas, que suele ser el asunto de verdad, y descarta la ubicacion.

USO
---
    python redactor_reglas.py --dry-run --limite 10
    python redactor_reglas.py --anio 2026
    python redactor_reglas.py --limite 500
"""

import argparse
import logging
import os
import re
import sys
from collections import Counter
from datetime import date, datetime, timezone

from composicion import Composicion

try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase")
    sys.exit(1)

logging.basicConfig(level=logging.INFO,
                    format="%(asctime)s  %(levelname)-7s %(message)s",
                    datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_SERVICE_KEY")
class RedactorReglas(Composicion):
    def __init__(self, limite=300, anio=None, dry_run=False, rehacer=False):
        self.limite = limite
        self.anio = anio
        self.dry_run = dry_run
        self.rehacer = rehacer
        self.stats = Counter()

        if not SUPABASE_URL or not SUPABASE_KEY:
            log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
            sys.exit(1)
        self.db = create_client(SUPABASE_URL, SUPABASE_KEY)

    # ==================================================================

    def correr(self):
        log.info("=" * 64)
        log.info("EUCLIDIAN — redaccion por reglas%s",
                 "  [DRY RUN]" if self.dry_run else "")
        log.info("=" * 64)

        docs = self._cola()
        if not docs:
            log.info("No hay documentos por redactar.")
            return
        log.info("%d documentos", len(docs))
        log.info("")

        for i, d in enumerate(docs, 1):
            ficha = self.componer(d)
            self.stats[f"confianza_{ficha['confianza']}"] += 1
