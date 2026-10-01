import unittest
from datetime import date

from scripts.auditar_fechas_documentos import findings


class AuditoriaFechasTests(unittest.TestCase):
    def test_accepts_document_and_web_dates_when_they_are_consistent(self):
        doc = {"numero_resolucion":"DIAN-OFICIO-13000-2026", "fecha_publicacion":"2026-08-21", "fecha_es_real":True, "fecha_publicacion_web":"2026-08-22"}
        self.assertEqual(findings(doc, date(2026, 10, 1)), [])

    def test_does_not_accept_synthetic_first_of_january_as_exact(self):
        doc = {"numero_resolucion":"DIAN-OFICIO-13000-2026", "fecha_publicacion":"2026-01-01", "fecha_es_real":True}
        self.assertIn("FECHA_1_ENERO_A_CONFIRMAR", findings(doc, date(2026, 10, 1)))

    def test_flags_unverified_date_that_the_subscriber_must_not_see_as_exact(self):
        doc = {"numero_resolucion":"DIAN-OFICIO-13000-2026", "fecha_publicacion":"2026-06-03", "fecha_es_real":False}
        self.assertEqual(findings(doc, date(2026, 10, 1)), [])

    def test_flags_document_year_mismatch_without_rewriting_it(self):
        doc = {"numero_resolucion":"DIAN-OFICIO-13000-2026", "fecha_publicacion":"2025-12-31", "fecha_es_real":True}
        self.assertIn("ANIO_IDENTIFICADOR_NO_COINCIDE", findings(doc, date(2026, 10, 1)))

    def test_identifies_the_decree_2039_date_error_seen_in_the_subscriber_view(self):
        doc = {"numero_resolucion":"DIAN-DECRETO-2039-2023", "fecha_publicacion":"2039-11-27", "fecha_es_real":True}
        self.assertIn("FECHA_DOCUMENTO_FUTURA", findings(doc, date(2026, 10, 1)))
        self.assertIn("ANIO_IDENTIFICADOR_NO_COINCIDE", findings(doc, date(2026, 10, 1)))

    def test_allows_an_official_web_publication_date_before_the_document_date(self):
        doc = {"numero_resolucion":"DIAN-OFICIO-13000-2026", "fecha_publicacion":"2026-08-21", "fecha_es_real":True, "fecha_publicacion_web":"2026-08-20"}
        self.assertEqual(findings(doc, date(2026, 10, 1)), [])


if __name__ == "__main__":
    unittest.main()
