import unittest
import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / "scripts"))
from lector_documento import LectorDocumento


class LectorDocumentoTests(unittest.TestCase):
    def test_plazos_uses_the_operational_section_instead_of_historical_considerandos(self):
        text = """CONSIDERANDO que la suspensión anterior operó desde el 13 de agosto de 2026 hasta el 25 de agosto de 2026.
        RESUELVE: ARTÍCULO 1. Prorrogar la suspensión de los términos desde el 14 de septiembre hasta el 14 de octubre de 2026."""
        plazos = LectorDocumento()._plazos(text)
        self.assertEqual(len(plazos), 1)
        self.assertIn("14 de septiembre", plazos[0])
        self.assertIn("14 de octubre de 2026", plazos[0])
        self.assertNotIn("13 de agosto", plazos[0])


if __name__ == "__main__":
    unittest.main()
