import sys
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
import unittest
from unittest.mock import Mock,patch
from types import SimpleNamespace
import requests
from fuente_documental import extraer_contenido
import adaptador_documental as a
from supervision_documental import run as supervision

URL='https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_16898_2026.htm'
ROW={'id':'doc','numero_resolucion':'DIAN-OFICIO-16898-2026','titulo':'Oficio 16898 de 2026 DIAN','tipo_documento':'oficio','enlace_oficial':URL,'updated_at':'2026-10-14T00:00:00Z','texto_completo':None,'estado_vigencia':'vigente','fecha_publicacion':None,'fecha_publicacion_web':None,'fecha_es_real':False,'resumen_humano':None,'resumen_borrador':None}
PARAGRAPH='7. Por lo anterior, no existe obligación de realizar el trámite descrito para estos contribuyentes, excepto cuando se configure el supuesto expresamente indicado en esta disposición.'
HTML=f'<html><head><title>Compilación Jurídica de la DIAN - Concepto 16898 de 2026 DIAN</title></head><body><h1>CONCEPTO 16898 DE 2026</h1><p>{PARAGRAPH}</p></body></html>'
CAP=extraer_contenido(HTML.encode(),URL)
class AdaptacionTests(unittest.TestCase):
    def test_normalize_alias_only_as_candidate_not_source_proof(self):
        self.assertEqual(a.identificadores_alternos('DIAN-OFICIO-016346-2026'),['DIAN-OFICIO-016346-2026','DIAN-OFICIO-16346-2026','DIAN-CONCEPTO-16346-2026'])
        from fuente_documental import canonica
        self.assertEqual(canonica(URL+'#4'),URL)
        self.assertNotEqual(canonica(URL),canonica(URL.replace('_16898_','_016898_')))
    def test_unknown_validity_and_complete_literal_instead_of_invention(self):
        d,p=a.adaptar(ROW,CAP)
        self.assertEqual(d['tipo_documento'],'concepto')
        self.assertEqual(d['estado_vigencia'],'desconocido')
        self.assertIn(PARAGRAPH,d['resumen_borrador'])
        self.assertIsNone(d['fecha_publicacion'])
        self.assertFalse(d['fecha_es_real'])
        self.assertTrue(p)
    def test_full_source_not_truncated_at_60000(self):
        c=extraer_contenido(('<h1>CONCEPTO 16898 DE 2026</h1><p>'+'texto '*15000+'EXCEPCIÓN FINAL</p>').encode(),URL)
        self.assertGreater(len(c.texto),60000)
        self.assertTrue(c.texto.endswith('EXCEPCIÓN FINAL'))
    def test_different_identity_never_published(self):
        with patch.object(a,'capturar',return_value=CAP):
            _,_,ok,ev=a.procesar(dict(ROW,numero_resolucion='DIAN-OFICIO-99999-2026'))
        self.assertFalse(ok);self.assertFalse(ev['reintentar'])
    def test_changed_source_between_captures_is_retried(self):
        from dataclasses import replace
        with patch.object(a,'capturar',side_effect=[CAP,replace(CAP,huella='c'*64)]):
            _,_,ok,ev=a.procesar(ROW)
        self.assertFalse(ok);self.assertTrue(ev['reintentar'])
    def test_missing_optional_fields_do_not_make_idle_review_backlog(self):
        with patch.object(a,'capturar',return_value=CAP):
            d,_,ok,ev=a.procesar(ROW)
        self.assertTrue(ok,ev);self.assertEqual(ev['accion'],'ninguna')
        self.assertFalse(d.get('revisado_por_humano',False))
    def test_transient_database_retries_but_constraint_does_not(self):
        op=Mock(side_effect=[Exception('504 Gateway timeout'),'ok'])
        with patch.object(a.time,'sleep'):self.assertEqual(a.retry_db(op),'ok')
        self.assertEqual(op.call_count,2)
        op=Mock(side_effect=Exception('23514 check violation'))
        with self.assertRaises(Exception):a.retry_db(op)
        self.assertEqual(op.call_count,1)
    def test_cas_does_not_overwrite_another_version(self):
        db=Mock();db.table.return_value.update.return_value.eq.return_value.eq.return_value.execute.return_value.data=[]
        self.assertTrue(a.guardar(db,ROW,{'texto_completo':'new'},True,{})['conflicto'])
        db.rpc.assert_not_called()
    def test_404_has_recovery_action_and_not_fast_retry_loop(self):
        error=requests.HTTPError('404 Not Found',response=SimpleNamespace(status_code=404))
        _,_,ok,ev=a.failure(ROW,error,None)
        self.assertFalse(ok);self.assertFalse(ev['reintentar']);self.assertIn('recuperar',ev['accion'])
    def test_supervisor_never_duplicates_live_writer(self):
        dispatch=Mock()
        with patch('supervision_documental.rpc',return_value={'activo':True}) as rpc:
            self.assertFalse(supervision(Mock(),dispatch)['rescate'])
        dispatch.assert_not_called();self.assertEqual(rpc.call_count,1)
    def test_supervisor_dispatch_requires_atomic_rescue_reservation(self):
        for allowed in (True,False):
            dispatch=Mock()
            with patch('supervision_documental.rpc',side_effect=[{'activo':False},allowed]):
                self.assertEqual(supervision(Mock(),dispatch)['rescate'],allowed)
            self.assertEqual(dispatch.call_count,int(allowed))
    def test_only_two_automatic_operational_workflows(self):
        w=Path(__file__).resolve().parents[1]/'.github/workflows'
        self.assertEqual({p.name for p in w.glob('*.yml')},{'ciclo_documental.yml','supervision_documental.yml','control_calidad.yml','enviar_boletin.yml'})
        self.assertNotIn('schedule:',(w/'control_calidad.yml').read_text())
        self.assertNotIn('schedule:',(w/'enviar_boletin.yml').read_text())
if __name__=='__main__':unittest.main()
