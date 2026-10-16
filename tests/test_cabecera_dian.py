"""Regresión: una cabecera DIAN acreditada prevalece sobre su título SEO."""
import sys
import unittest
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1] / 'scripts'))
from cabecera_dian import cabecera_oficial
from verificador_aprobacion import identidad_documental_coincide


class IdentidadCabeceraDianTests(unittest.TestCase):
    def test_titulo_seo_erroneo_cuerpo_correcto(self):
        text = ('Compilación Jurídica DIAN - Oficio 903218 de 2022 DIAN\n'
                'BUSCAR\nÍNDICE\nOFICIO 903215 DE 2022\n(abril 25)\n'
                'Se cita el Oficio 903218 de 2022')
        self.assertEqual(cabecera_oficial(text), ('oficio', 903215, '2022'))
        self.assertTrue(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-903215-2022'}))
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-903218-2022'}))

    def test_concepto_con_numeracion_compuesta(self):
        text = ('Compilación Jurídica DIAN - Oficio 905340 de 2020 DIAN\n'
                'ÍNDICE\nCONCEPTO 100208221-1182 [905340] DE 2020\n'
                '(septiembre 28)')
        self.assertEqual(cabecera_oficial(text), ('concepto', 1182, '2020'))
        self.assertTrue(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-CONCEPTO_TRIBUTARIO-1182-2020'}))
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-905340-2020'}))

    def test_circular_con_codigo_de_dependencia(self):
        text = ('Compilación Jurídica DIAN - Circular 12757000005876 de 2025 DIAN\n'
                'ÍNDICE\nCIRCULAR 12757000005876 DE 2025')
        self.assertEqual(cabecera_oficial(text), ('circular', 5876, '2025'))
        self.assertTrue(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-CIRCULAR-5876-2025'}))

    def test_cuerpo_invalida_titulo_que_coincide(self):
        text = ('Compilación Jurídica DIAN - Oficio 16548 de 2026 DIAN\n'
                'ÍNDICE\nOFICIO 16606 DE 2026\nCita el Oficio 16548 de 2026')
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-16548-2026'}))

    def test_memorando_con_ano_distinto_no_se_valida(self):
        text = ('Compilación Jurídica DIAN - Memorando 154 de 2024 DIAN\n'
                'ÍNDICE\nMEMORANDO 27 DE 2025')
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-MEMORANDO-27-2024'}))

    def test_cita_posterior_no_es_cabecera(self):
        text = ('Compilación Jurídica DIAN - Oficio 16606 de 2026 DIAN\n'
                'ÍNDICE\nOFICIO 16606 DE 2026\n'
                'Cita el Oficio 16548 de 2026')
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-16548-2026'}))

    def test_indice_sin_cabecera_no_valida(self):
        text = ('Compilación Jurídica DIAN - Oficio 16548 de 2026 DIAN\n'
                'ÍNDICE\nNOTA DE VIGENCIA\nCita el Oficio 16548 de 2026')
        self.assertFalse(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-16548-2026'}))

    def test_titulo_simple_no_perdio_compatibilidad(self):
        text = 'Compilación Jurídica DIAN - Concepto 16548 de 2026 DIAN'
        self.assertTrue(identidad_documental_coincide(
            text, {'numero_resolucion': 'DIAN-OFICIO-016548-2026'}))


if __name__ == '__main__':
    unittest.main()
