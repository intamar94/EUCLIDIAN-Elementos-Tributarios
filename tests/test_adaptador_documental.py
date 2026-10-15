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
        self.assertEqual(a.identificadores_alternos('DIAN-OFICIO-016346-2026'),['DIAN-OFICIO-016346-2026','DIAN-OFICIO-16346-2026','DIAN-CONCEPTO-16346-2026','DIAN-OF-16346-2026'])
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
    def test_failed_dispatch_releases_rescue_reservation(self):
        with patch('supervision_documental.rpc',side_effect=[{'activo':False},True,True]) as rpc:
            with self.assertRaisesRegex(RuntimeError,'GitHub'):
                supervision(Mock(),Mock(side_effect=RuntimeError('GitHub temporalmente no disponible')))
        self.assertEqual(rpc.call_args.args[1],'liberar_rescate_documental')
    def test_failed_process_launch_closes_stage_instead_of_leaving_it_running(self):
        from direccion_documental import stage
        db=Mock()
        with patch('direccion_documental.subprocess.Popen',side_effect=OSError('No se pudo iniciar')):
            state,result=stage(db,'cycle','mapeo',['--historico'],60)
        self.assertEqual(state,'fallo');self.assertTrue(result['historico'])
        self.assertIn('No se pudo iniciar',result['error'])
        self.assertEqual(db.table.return_value.update.call_args.args[0]['estado'],'fallo')
    def test_lost_lease_terminates_child_before_another_stage(self):
        from direccion_documental import stage
        child=Mock();child.poll.return_value=None;child.wait.return_value=0
        with patch('direccion_documental.subprocess.Popen',return_value=child),patch('direccion_documental.rpc',return_value=False):
            state,result=stage(Mock(),'cycle','adaptacion',[],60)
        self.assertEqual(state,'fallo');self.assertIn('exclusión',result['error']);child.terminate.assert_called_once()
    def test_loading_metadata_is_lazy_and_does_not_request_old_body(self):
        ids=[str(i) for i in range(100)]
        with patch.object(a,'metadata_chunk',return_value=[{'id':i} for i in ids[:20]]) as load:
            iterator=a.metadata_rows(Mock(),ids)
            first=[next(iterator) for _ in range(4)]
        self.assertEqual(load.call_count,1)
        self.assertEqual([r['id'] for r in first],ids[:4])
        self.assertTrue(all(r['texto_completo'] is None for r in first))
        self.assertNotIn('texto_completo',a.METADATA_FIELDS.split(','))
    def test_statement_timeout_reduces_batch_instead_of_repeating_same_request(self):
        db=Mock()
        op=db.table.return_value.select.return_value.in_.return_value.execute
        op.side_effect=[Exception('57014 canceling statement due to statement timeout'),SimpleNamespace(data=[{'id':'1'}]),SimpleNamespace(data=[{'id':'2'}])]
        self.assertEqual(a.metadata_chunk(db,['1','2']),[{'id':'1'},{'id':'2'}])
        self.assertEqual(op.call_count,3)
    def test_bulletin_period_is_not_reused_as_publication_date_or_legal_claim(self):
        from fuente_documental import Captura
        pdf='https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/BoletinesTributarios/01_Enero.pdf'
        row=dict(ROW,tipo_documento='boletin',enlace_oficial=pdf,fecha_publicacion='2026-01-01',fecha_publicacion_web='2026-02-01',fecha_es_real=True,
            notas_verificacion='Procedencia DIAN | raiz: https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html | indice: https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/Paginas/BoletinesTributarios.aspx',zonas_afectadas=['Bogotá'])
        d,_=a.adaptar(row,Captura(pdf,'[Página 1] '+PARAGRAPH*2,'a'*64,'completo',1))
        self.assertIsNone(d['fecha_publicacion']);self.assertIsNone(d['fecha_publicacion_web']);self.assertFalse(d['fecha_es_real'])
        self.assertEqual(d['zonas_afectadas'],[]);self.assertEqual(d['clasificacion_obligatoriedad'],'orientativo')
    def test_mapper_follows_all_legal_news_linked_by_authorized_root(self):
        from mapeador_activo import indices_desde_raices
        base='https://normograma.dian.gov.co/dian/compilacion/'
        links={base+'nyb_novedades_derecho_aduanero.html',base+'nyb_novedades_derecho_cambiario.html',base+'nyb_novedades_asuntos_institucionales.html',base+'nyb_novedades_juridicas_portal_web_dian.html','https://external.example/dian/compilacion/nyb_novedades_falsa.html'}
        actual={i for i,_ in indices_desde_raices(links)}
        self.assertIn('nyb_novedades_derecho_aduanero',actual);self.assertIn('nyb_novedades_derecho_cambiario',actual)
        self.assertIn('nyb_novedades_asuntos_institucionales',actual)
        self.assertNotIn('nyb_novedades_juridicas_portal_web_dian',actual);self.assertNotIn('nyb_novedades_falsa',actual)
    def test_only_two_automatic_operational_workflows(self):
        w=Path(__file__).resolve().parents[1]/'.github/workflows'
        self.assertEqual({p.name for p in w.glob('*.yml')},{'ciclo_documental.yml','supervision_documental.yml','control_calidad.yml','enviar_boletin.yml'})
        self.assertNotIn('schedule:',(w/'control_calidad.yml').read_text())
        self.assertNotIn('schedule:',(w/'enviar_boletin.yml').read_text())
if __name__=='__main__':unittest.main()
