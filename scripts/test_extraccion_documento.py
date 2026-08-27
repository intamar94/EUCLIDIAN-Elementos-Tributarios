"""Pruebas de extracción de metadatos tributarios desde texto oficial."""
from lector_documento import LectorDocumento


class Lector(LectorDocumento):
    pass


TEXTO = """
DECRETO 0173 DE 2026
(febrero 24)
Diario Oficial No. 53.409 de 24 de febrero de 2026
MINISTERIO DE HACIENDA Y CREDITO PUBLICO
ARTICULO 8. VIGENCIA. Rige a partir del 24 de febrero de 2026.
<Ver SUSPENSION parcial por el Auto A-533-26>
<Articulo modificado por el articulo 17 del Decreto 240 de 2026>
El plazo para declarar vence el 15 de marzo de 2026.
"""


def test_extrae_fecha_diario_entidad_y_vigencia():
    l = Lector()
    assert str(l._fecha(TEXTO)) == "2026-02-24"
    assert l._diario_oficial(TEXTO).startswith("No. 53.409")
    assert "MINISTERIO DE HACIENDA" in l._entidad(TEXTO)
    assert str(l._vigencia(TEXTO)) == "2026-02-24"


def test_extrae_anotaciones_y_estado_suspendido():
    l = Lector()
    notas = l._anotaciones(TEXTO, TEXTO)
    assert any("SUSPENSION" in n for n in notas)
    estado, motivo = l._estado(notas)
    assert estado == "suspendido"
    assert "Suspendido" in motivo


def test_extrae_plazo_y_no_inventa_retroactividad():
    l = Lector()
    plazos = l._plazos(TEXTO)
    assert plazos
    retro, anios = l._retroactividad(TEXTO)
    assert retro is False
    assert anios == []
