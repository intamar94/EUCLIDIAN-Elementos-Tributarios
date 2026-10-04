import unittest

from scripts.agente_control_interno import (
    complete_deadlines,
    date_correction,
    issue_codes,
    normalized_sources,
    priority,
    source_quarantine_changes,
)


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

    def test_preserves_a_previous_verified_correction(self):
        row = {"fecha_publicacion": "2026-09-07", "enlace_oficial": "https://normograma.dian.gov.co/dian/compilacion/docs/x.htm"}
        text = "2026 (septiembre 7) <Fuente: Archivo interno>"
        changes, evidence = date_correction(row, text)
        self.assertEqual(changes, {})
        self.assertEqual(evidence["despues"], "2026-09-07")

    def test_keeps_codes_and_prioritizes_documental_risk(self):
        found = issue_codes([{"codigo": "plazo_cortado"}, {"codigo": "duplicado"}, {"detalle": "sin código"}])
        self.assertEqual(found, {"plazo_cortado", "duplicado"})
        self.assertEqual(priority(found), "alta")

    def test_keeps_only_complete_deadline_sentence(self):
        text = """RESUELVE
El plazo para presentar la solicitud vence el 15 de octubre de 2026.
El obligado tendrá hasta el 17 de diciembre
"""
        self.assertEqual(complete_deadlines(text), [
            "El plazo para presentar la solicitud vence el 15 de octubre de 2026."
        ])

    def test_rebuilds_split_formal_source_without_guessing(self):
        text = """Fuentes Formales
Artículos
437-4 del Estatuto Tributario
Problema Jurídico
Consulta
"""
        self.assertEqual(normalized_sources(text), ["Artículos 437-4 del Estatuto Tributario"])

    def test_unavailable_official_source_is_removed_from_publication(self):
        self.assertEqual(source_quarantine_changes(), {
            "publicado_cliente": False,
            "aprobado_para_email": False,
        })


if __name__ == "__main__":
    unittest.main()
