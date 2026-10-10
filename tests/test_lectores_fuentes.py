import sys
import unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from lectores_dian import Lectores
from lector_documento import LectorDocumento

class FuentesTests(unittest.TestCase):
    def test_cita_con_enlaces_no_pierde_numeros(self):
        t='Fuentes Formales\nArtículos\n903\n,\n904\n,\n907\n,\n908\ny\n910\ndel Estatuto Tributario.\nExtracto\nTexto siguiente'
        self.assertEqual(Lectores()._fuentes(t),['Artículos 903, 904, 907, 908 y 910 del Estatuto Tributario.'])
    def test_no_limita_departamentos_a_quince(self):
        from lector_documento import DEPARTAMENTOS
        zonas=LectorDocumento()._zonas('Emergencia en '+', '.join(DEPARTAMENTOS))
        self.assertIn('Valle del Cauca',zonas)
        self.assertEqual(len(zonas),len(DEPARTAMENTOS))

if __name__=='__main__': unittest.main()
