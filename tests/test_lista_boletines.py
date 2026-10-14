import sys,json,unittest
from pathlib import Path
sys.path.insert(0,str(Path(__file__).resolve().parents[1]/'scripts'))
from unittest.mock import patch
from types import SimpleNamespace
from boletines_dian import publicaciones_lista,registro_publicacion
INDEX='https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/Paginas/BoletinesTributarios.aspx'
FOLDER='/normatividad/Publicaciones-Juridicas/BoletinesTributarios'
GUID='484A340A-ACEC-4CE0-BCD1-413DD2D818A8'
HTML=f'ctx.listName = "{{{GUID}}}"; ctx.listUrlDir = "{FOLDER}";'
ROW={'FileRef':FOLDER+'/01_Enero.pdf','FileLeafRef':'01_Enero.pdf','Title':None,'A_x00f1_o':2016.0,'Modified':'2026-10-14'}
class ListaTests(unittest.TestCase):
    def test_derives_list_from_official_html_and_preserves_period(self):
        s=SimpleNamespace(headers={'Accept':'text/html'});api=INDEX.split('/Paginas/')[0]+f"/_api/web/lists(guid'{GUID}')/items?"
        with patch('boletines_dian.descargar',return_value=(json.dumps({'value':[ROW]}).encode(),api,'application/json')) as download:
            docs=publicaciones_lista(s,HTML.encode(),INDEX)
        self.assertIn(GUID,download.call_args.args[1]);self.assertEqual(len(docs),1)
        record=registro_publicacion({'url':docs[0][0],'titulo':docs[0][1],'subtipo':'boletin_tributario_historico','fuente_indice':INDEX})
        self.assertEqual(record['anio_publicacion'],2016)
        self.assertNotIn('fecha_publicacion',record)
        self.assertEqual(s.headers['Accept'],'text/html')
    def test_pagination_cannot_fetch_arbitrary_url(self):
        s=SimpleNamespace(headers={});api=INDEX.split('/Paginas/')[0]+f"/_api/web/lists(guid'{GUID}')/items?"
        response={'value':[ROW],'@odata.nextLink':'https://external.example/collect'}
        with patch('boletines_dian.descargar',return_value=(json.dumps(response).encode(),api,'application/json')) as download:
            with self.assertRaisesRegex(ValueError,'paginación salió'):publicaciones_lista(s,HTML,INDEX)
        self.assertEqual(download.call_count,1);self.assertNotIn('Accept',s.headers)
    def test_only_pdfs_inside_derived_library_are_ingested(self):
        s=SimpleNamespace(headers={});api=INDEX.split('/Paginas/')[0]+f"/_api/web/lists(guid'{GUID}')/items?"
        bad=dict(ROW,FileRef='/Documents/unrelated.pdf')
        with patch('boletines_dian.descargar',return_value=(json.dumps({'value':[bad,ROW]}).encode(),api,'application/json')):
            self.assertEqual(len(publicaciones_lista(s,HTML,INDEX)),1)
if __name__=='__main__':unittest.main()
