import unittest
from scripts.verificador_aprobacion import identidad_documental_coincide

class IdentidadFuenteTests(unittest.TestCase):
    def test_year_and_citation_cannot_validate_another_document(self):
        doc={'numero_resolucion':'DIAN-OFICIO-16548-2026'}
        self.assertFalse(identidad_documental_coincide('Compilación Jurídica DIAN - Oficio 16606 de 2026 DIAN. Cita el Concepto 16548 de 2026.',doc))
        self.assertFalse(identidad_documental_coincide('Compilación Jurídica DIAN - Oficio 16548 de 2025 DIAN',doc))

    def test_official_type_can_differ_from_filename_and_zero_padding(self):
        doc={'numero_resolucion':'DIAN-OFICIO-016548-2026'}
        self.assertTrue(identidad_documental_coincide('Compilación Jurídica DIAN - Concepto 16548 de 2026 DIAN',doc))

    def test_source_without_document_header_is_not_approved(self):
        self.assertFalse(identidad_documental_coincide('Normograma DIAN 2026: índice de publicaciones 16548',{'numero_resolucion':'DIAN-OFICIO-16548-2026'}))
