import unittest

from scripts.enriquecedor_fechas_v2 import EnriquecedorFechasV2


class FechasDocumentoTests(unittest.TestCase):
    def setUp(self):
        self.lector = object.__new__(EnriquecedorFechasV2)
        self.texto = """
        CONCEPTO 002294 int 235 DE 2024
        (abril 5)
        <Publicado en la página web de la DIAN: 17 de abril de 2024>
        """

    def test_keeps_document_date_distinct_from_web_publication(self):
        fecha_documento = self.lector._fecha_documento(
            self.texto, "DIAN-OFICIO-2294-2024"
        )
        fecha_web = self.lector._fecha_publicacion(self.texto)

        self.assertEqual(str(fecha_documento), "2024-04-05")
        self.assertEqual(str(fecha_web), "2024-04-17")

    def test_preserves_the_century_of_historical_documents(self):
        fecha = self.lector._fecha_documento(
            "CONCEPTO 45224 DE 1995\n(julio 4)",
            "DIAN-CONCEPTO_TRIBUTARIO-45224-1995",
        )

        self.assertEqual(str(fecha), "1995-07-04")


    def test_historical_month_first_header(self):
        for month in ['Agosto', 'AGOSTO', 'agosto']:
            text = f'CONCEPTO 016681 DE 1988\n{month} 26 de 1988\nDETERMINACION DE LA SANCION'
            self.assertEqual(str(self.lector._fecha_documento(text, 'DIAN-CONCEPTO_TRIBUTARIO-16681-1988')), '1988-08-26')

    def test_does_not_use_cited_or_conflicting_month_first_date(self):
        for text in [
            'CONCEPTO 016681 DE 1988\nAgosto 26 de 1987',
            'CONCEPTO 016681 DE 1988\nSe cita el oficio de Agosto 26 de 1988',
            'CONCEPTO 016681 DE 1988\nFebrero 31 de 1988',
        ]:
            self.assertIsNone(self.lector._fecha_documento(text, 'DIAN-CONCEPTO_TRIBUTARIO-16681-1988'))
