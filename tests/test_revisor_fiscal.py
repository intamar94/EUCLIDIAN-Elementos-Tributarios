import unittest

from scripts.revisor_fiscal_euclidian import evaluate


BASE = {
    "numero_resolucion": "DIAN-OFICIO-13000-2026",
    "titulo": "Oficio 13000 de 2026 DIAN",
    "enlace_oficial": "https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_13000_2026.htm",
    "contenido": "Contenido oficial suficiente.",
    "fecha_publicacion": "2026-08-21",
    "fecha_es_real": True,
    "estado_vigencia": "vigente",
    "clasificacion_obligatoriedad": "obligatorio_dian_y_contribuyentes",
    "materia": "Impuesto sobre la renta",
    "resumen_humano": "La DIAN establece el criterio aplicable a la obligación indicada.",
    "borrador_advertencias": [],
}


class RevisorFiscalTests(unittest.TestCase):
    def test_complete_document_can_pass(self):
        result, score, passed, failed, reasons = evaluate(BASE, True)
        self.assertEqual(result, "APPROVE")
        self.assertEqual(score, 100)
        self.assertEqual(failed, [])
        self.assertEqual(reasons, [])

    def test_missing_classification_returns_review_without_visibility_block(self):
        doc = dict(BASE)
        doc["clasificacion_obligatoriedad"] = None
        result, _, _, failed, _ = evaluate(doc, True)
        self.assertEqual(result, "REVIEW")
        self.assertIn("CLASIFICACION", failed)
        self.assertIn("A_QUIEN", failed)

    def test_missing_evidence_returns_review_without_visibility_block(self):
        result, _, _, failed, _ = evaluate(BASE, False)
        self.assertEqual(result, "REVIEW")
        self.assertIn("EVIDENCIA", failed)

    def test_missing_summary_returns_review_without_visibility_block(self):
        doc = dict(BASE)
        doc["resumen_humano"] = None
        result, _, _, failed, _ = evaluate(doc, True)
        self.assertEqual(result, "REVIEW")
        self.assertIn("RESUMEN", failed)

    def test_warning_does_not_block(self):
        doc = dict(BASE)
        doc["borrador_advertencias"] = ["Fecha ambigua"]
        result, _, _, failed, _ = evaluate(doc, True)
        self.assertEqual(result, "APPROVE")
        self.assertNotIn("ADVERTENCIAS", failed)

    def test_current_date_conflict_cannot_pass_with_verified_source(self):
        doc = dict(BASE, fecha_publicacion_web="2026-08-20")
        result, score, _, failed, _ = evaluate(doc, True)
        self.assertEqual(result, "REVIEW")
        self.assertLess(score, 100)
        self.assertIn("INTEGRIDAD_ACTUAL", failed)


if __name__ == "__main__":
    unittest.main()
