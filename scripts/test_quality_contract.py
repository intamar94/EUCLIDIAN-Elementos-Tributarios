"""Pruebas locales del contrato de alta confianza de EUCLIDIAN.
No acceden a Supabase ni a internet: prueban únicamente reglas deterministas.
"""
from urllib.parse import urlparse

from verificador_aprobacion import check_summary

DOMINIO = "normograma.dian.gov.co"
PREFIJO = "/dian/compilacion/"


def fuente_permitida(url):
    p = urlparse(url)
    return p.scheme == "https" and p.netloc == DOMINIO and p.path.startswith(PREFIJO)


def test_fuente_permitida_solo_https_normograma():
    assert fuente_permitida("https://normograma.dian.gov.co/dian/compilacion/normas.html")
    assert not fuente_permitida("http://normograma.dian.gov.co/dian/compilacion/normas.html")
    assert not fuente_permitida("https://ejemplo.com/dian/compilacion/normas.html")
    assert not fuente_permitida("https://normograma.dian.gov.co/otra-ruta")


def test_resumen_sin_evidencia_no_se_aprueba():
    ok, errores = check_summary(
        "La tarifa aplicable es del 19 por ciento para el periodo 2026.",
        "La tarifa aplicable es del 35 por ciento para el periodo 2026.",
    )
    assert not ok
    assert errores


def test_resumen_con_dato_numerico_no_presente_falla():
    ok, errores = check_summary(
        "La obligación corresponde al periodo 2026 y aplica una tarifa del 19%.",
        "La obligación corresponde al periodo 2026 y aplica una tarifa del 20%.",
    )
    assert not ok
    assert any("20" in e for e in errores)


def test_resumen_vacio_no_se_aprueba():
    ok, errores = check_summary("contenido oficial suficiente", "")
    assert not ok
    assert errores
