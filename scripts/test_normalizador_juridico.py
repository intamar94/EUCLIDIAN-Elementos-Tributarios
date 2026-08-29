from normalizador_juridico import compare


def test_variantes_sintacticas_equivalentes():
    r = compare("El contribuyente debe presentar la declaración.", "El contribuyente se encuentra obligado a presentar la declaración.")
    assert r.equivalent


def test_diferencia_de_sujeto_no_equivale():
    r = compare("La persona natural debe presentar la declaración.", "La persona juridica debe presentar la declaración.")
    assert not r.equivalent
    assert "sujeto" in r.differences


def test_diferencia_de_condicion_no_equivale():
    r = compare("Debe presentar cuando supera el límite.", "Debe presentar siempre.")
    assert not r.equivalent
    assert "condicion" in r.differences


def test_porcentaje_normalizado():
    r = compare("La tarifa es 19%.", "La tarifa es 19 %.")
    assert "cuantia" not in r.differences
