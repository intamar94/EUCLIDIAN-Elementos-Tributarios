import unittest
from scripts.sintesis_literal import extraer_literal,literal_presente,PREFIJO_LITERAL
from scripts.verificador_aprobacion import check_summary,norm
from scripts.revisor_fiscal_euclidian import necesita_revision,evaluate
from test_revisor_fiscal import BASE

class SintesisLiteralTests(unittest.TestCase):
    def test_complete_conclusion_keeps_exception_and_negation(self):
        text='10. Así las cosas, no existe obligación de realizar el trámite descrito para estos contribuyentes, excepto cuando se configure el supuesto expresamente indicado en esta disposición.'
        quote=extraer_literal('<p>'+text+'</p>')
        self.assertEqual(quote,PREFIJO_LITERAL+text)
        self.assertTrue(literal_presente(text,quote))
        self.assertTrue(check_summary(norm(text),quote)[0])
        altered=quote.replace('no existe','existe')
        self.assertFalse(literal_presente(text,altered))
        self.assertFalse(check_summary(norm(text),altered)[0])

    def test_does_not_truncate_long_paragraph(self):
        self.assertIsNone(extraer_literal('<p>10. Así las cosas, '+'palabra '*300+'excepto este caso.</p>'))

    def test_literal_can_pass_without_faking_human_review(self):
        text='1. La disposición establece expresamente las condiciones aplicables a la operación identificada en esta consulta y mantiene la excepción señalada por el legislador.'
        doc=dict(BASE,resumen_humano=None,resumen_borrador=PREFIJO_LITERAL+text,texto_completo=text,revisado_por_humano=False)
        self.assertEqual(evaluate(doc,True)[0],'APPROVE')
        self.assertFalse(doc['revisado_por_humano'])
        self.assertIsNone(doc['resumen_humano'])

    def test_changed_structure_is_requeued_after_prior_review(self):
        self.assertTrue(necesita_revision({'revisado_fiscal_en':'2026-10-13T10:00:00+00:00','estructura_extraida_en':'2026-10-14T10:00:00Z'}))
        self.assertFalse(necesita_revision({'revisado_fiscal_en':'2026-10-14T10:00:00+00:00','enriquecido_en':'2026-10-13T10:00:00Z'}))
        self.assertTrue(necesita_revision({'revisado_fiscal_en':None}))
