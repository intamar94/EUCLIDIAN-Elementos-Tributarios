import unittest
from scripts.sintesis_literal import extraer_literal,literal_presente,PREFIJO_LITERAL
from scripts.verificador_aprobacion import check_summary,norm
from scripts.revisor_fiscal_euclidian import necesita_revision,evaluate,_load_pending,RULES_VERSION,identidad_desde_titulo,_guardar_cambios
from test_revisor_fiscal import BASE

class SintesisLiteralTests(unittest.TestCase):
    def test_source_title_defines_type_without_changing_stable_identifier(self):
        result=identidad_desde_titulo('Compilación Jurídica de la DIAN - Concepto 16548 de 2026 DIAN','DIAN-OFICIO-16548-2026')
        self.assertEqual(result,{'tipo_documento':'concepto','titulo':'Concepto 16548 de 2026 DIAN'})
        self.assertEqual(identidad_desde_titulo('Compilación Jurídica de la DIAN - Concepto 16549 de 2026 DIAN','DIAN-OFICIO-16548-2026'),{})

    def test_concurrent_change_is_requeued_without_overwriting_other_writer(self):
        from unittest.mock import Mock
        sb=Mock();q=sb.table.return_value.update.return_value
        q.eq.return_value.eq.return_value.execute.return_value.data=[]
        result=_guardar_cambios(sb,{'id':'id-prueba','updated_at':'2026-10-14T00:00:00Z'},{'materia':'IVA'})
        self.assertEqual(result,'CONFLICTO')
        q.eq.assert_called_once_with('id','id-prueba')

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

    def test_queue_finds_recent_documents_beyond_first_page_and_old_rules(self):
        from types import SimpleNamespace
        docs=[dict(id=f'{i:04}',fecha_publicacion_web='2026-01-01',revisado_fiscal_en='2026-10-14T10:00:00Z') for i in range(1002)]
        docs[-1]['fecha_publicacion_web']='2026-10-05'
        docs[-2]['fecha_publicacion_web']='2026-10-06'
        class Query:
            def __init__(self,table):
                self.rows=list(docs if table=='documentos_tributarios' else [dict(documento_id='1000',version_reglas=RULES_VERSION)])
                self.maximum=None
            def select(self,*_):return self
            def eq(self,k,v):self.rows=[r for r in self.rows if r.get(k)==v];return self
            def gt(self,k,v):self.rows=[r for r in self.rows if r[k]>v];return self
            def in_(self,k,values):self.rows=[r for r in self.rows if r[k] in values];return self
            def order(self,k):self.rows.sort(key=lambda r:r[k]);return self
            def limit(self,n):self.maximum=n;return self
            def execute(self):return SimpleNamespace(data=self.rows[:self.maximum])
        sb=SimpleNamespace(table=Query)
        selected=_load_pending(sb,1)
        self.assertEqual([d['id'] for d in selected],['1001'])
