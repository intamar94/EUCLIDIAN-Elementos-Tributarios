from verificador_aprobacion import date_candidates, evidence, check_summary


def test_fecha_iso_y_fecha_textual_son_equivalentes():
    assert evidence("Publicado el 15 de agosto de 2026 en el Normograma DIAN", "2026-08-15")


def test_fecha_sintetica_no_se_inventa():
    assert not evidence("Documento expedido el 10 de enero de 2026", "2026-01-01")


def test_texto_exige_coincidencia_exacta():
    assert evidence("Entidad: Dirección de Gestión Jurídica", "Dirección de Gestión Jurídica")
    assert not evidence("Entidad: Dirección de Gestión Jurídica", "Ministerio de Hacienda")


def test_resumen_con_numero_ausente_se_bloquea():
    ok, errors = check_summary("La medida aplica desde 2026.", "La medida aplica desde 2027.")
    assert not ok
    assert errors


def test_date_candidates_no_agrega_otro_dia():
    candidates = date_candidates("2026-08-15")
    assert "15 de agosto de 2026" in candidates
    assert "16 de agosto de 2026" not in candidates
