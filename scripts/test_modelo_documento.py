"""Contrato determinista del modelo de documentos DIAN."""
from modelo_documento import normalizar_documento


def test_normaliza_documento_y_guarda_huella():
    doc = normalizar_documento(
        "https://normograma.dian.gov.co/dian/compilacion/tributario.html",
        "tributario",
        "<html><title>Tributario</title><script>x</script><p>Norma 2026</p></html>",
    )
    assert doc.titulo == "Tributario"
    assert "Norma 2026" in doc.texto
    assert len(doc.huella_contenido) == 64
    assert doc.raiz == "tributario"


def test_rechaza_url_fuera_de_dian():
    try:
        normalizar_documento("https://example.com/x", "tributario", "<p>x</p>")
    except ValueError:
        return
    raise AssertionError("Una fuente externa no debe entrar al modelo")
