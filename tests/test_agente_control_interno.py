import unittest

from scripts.agente_control_interno import date_correction, issue_codes, priority


class AgenteControlInternoTests(unittest.TestCase):
    def test_uses_only_document_date_from_official_source(self):
        row = {
            "fecha_publicacion": "2026-09-10",
            "enlace_oficial": "https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_15660_2026.htm",
        }
        text = "2026 (septiembre 7) <Fuente: Archivo interno> Publicado en la página web de la DIAN: 10 de septiembre de 2026"
        changes, evidence = date_correction(row, text)
        self.assertEqual(changes, {"fecha_publicacion": "2026-09-07", "fecha_es_real": True})
        self.assertEqual(evidence["antes"], "2026-09-10")
        self.assertEqual(evidence["despues"], "2026-09-07")

    def test_does_not_change_when_document_date_is_not_present(self):
        row = {"fecha_publicacion": "2026-09-10", "enlace_oficial": "https://normograma.dian.gov.co/dian/compilacion/docs/x.htm"}
        changes, evidence = date_correction(row, "Publicado en la página web de la DIAN: 10 de septiembre de 2026")
        self.assertIsNone(changes)
        self.assertIsNone(evidence)

    def test_keeps_codes_and_prioritizes_documental_risk(self):
        found = issue_codes([{"codigo": "plazo_cortado"}, {"codigo": "duplicado"}, {"detalle": "sin código"}])
        self.assertEqual(found, {"plazo_cortado", "duplicado"})
        self.assertEqual(priority(found), "alta")


if __name__ == "__main__":
    unittest.main()
