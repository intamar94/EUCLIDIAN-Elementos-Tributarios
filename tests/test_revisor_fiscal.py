import unittest

from scripts.revisor_fiscal_euclidian import evaluate


BASE = {
    "enlace_oficial": "https://www.dian.gov.co/fuente",
    "contenido": "Contenido oficial suficiente.",
    "fecha_es_real": True,
    "estado_vigencia": "vigente",
    "materia": "Impuesto sobre la renta",
    "borrador_confianza": "alta",
    "borrador_advertencias": [],
}


class RevisorFiscalTests(unittest.TestCase):
    def test_complete_document_can_pass(self):
        result, score, passed, failed, reasons = evaluate(BASE)
        self.assertEqual(result, "APPROVE")
        self.assertEqual(score, 100)
        self.assertEqual(failed, [])
        self.assertEqual(reasons, [])

    def test_missing_classification_returns_review(self):
        doc = dict(BASE)
        doc["materia"] = None
        doc["area_derecho"] = None
        result, _, _, failed, _ = evaluate(doc)
        self.assertEqual(result, "REVIEW")
        self.assertIn("CLASIFICACION", failed)

    def test_missing_evidence_returns_review(self):
        doc = dict(BASE)
        doc["enlace_oficial"] = ""
        result, _, _, failed, _ = evaluate(doc)
        self.assertEqual(result, "REVIEW")
        self.assertIn("OFICIAL", failed)
        self.assertIn("EVIDENCIA", failed)

    def test_warning_returns_review(self):
        doc = dict(BASE)
        doc["borrador_advertencias"] = ["Fecha ambigua"]
        result, _, _, failed, _ = evaluate(doc)
        self.assertEqual(result, "REVIEW")
        self.assertIn("ADVERTENCIAS", failed)


if __name__ == "__main__":
    unittest.main()
