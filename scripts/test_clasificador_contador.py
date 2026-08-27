from clasificador_contador import clasificar


def test_clasifica_iva_y_facturacion_con_evidencia():
    etiquetas = clasificar(
        "La factura electrónica genera obligaciones de IVA. "
        "El calendario tributario establece vencimiento."
    )
    categorias = {e.categoria for e in etiquetas}
    assert "iva" in categorias
    assert "facturacion" in categorias
    assert "calendario" in categorias
    assert all(e.evidencias for e in etiquetas)


def test_no_clasifica_sin_senal():
    assert clasificar("Texto jurídico general sin términos tributarios") == []
