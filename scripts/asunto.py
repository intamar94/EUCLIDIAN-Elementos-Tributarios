"""
EUCLIDIAN — Elementos Tributarios
Limpieza y armado del asunto

La DIAN escribe sus descripciones bajando de tema a subtema con
guiones, y el primer tramo suele repetir el "Banco de Datos" que la
ficha ya muestra aparte. Aqui se depura eso y se arma la frase que
encabeza la ficha.

Aparte de composicion.py porque son dos oficios: aqui se decide COMO se
lee una descripcion; alla, que frases componen la ficha.
"""

import re
import unicodedata

from reglas_texto import (
    INTERNO,
    RECONSIDERA,
    CITADOS,
    VERBOS,
    UBICACION,
    RESOLUCION_MADRE,
)


class Asunto:
    """Depuracion del texto de la DIAN. Composicion hereda de aqui."""

    @staticmethod
    def _sin_tema_repetido(desc, banco):
        """
        La DIAN escribe sus descripciones bajando de tema a subtema con
        guiones:

            Impuestos Ambientales - Impuesto nacional sobre productos
            plasticos de un solo uso utilizados para envasar...

        Y el primer tramo suele ser el mismo "Banco de Datos" que la
        ficha ya muestra abajo. Repetirlo alarga el texto sin agregar
        nada, asi que se quita cuando coincide.

        Los tramos restantes se unen con punto medio: leen mejor que el
        guion, que confunde con los guiones dentro de las frases.
        """
        if not desc:
            return desc
        tramos = [t.strip() for t in re.split(r"\s+[-–]\s+", desc) if t.strip()]
        if len(tramos) < 2:
            return desc

        def plano(x):
            x = unicodedata.normalize("NFD", x or "")
            x = "".join(c for c in x if unicodedata.category(c) != "Mn")
            return re.sub(r"[^a-z0-9]+", "", x.lower())

        if banco and plano(tramos[0]) == plano(banco):
            tramos = tramos[1:]

        if not tramos:
            return desc
        return " · ".join(tramos)

    def _asunto(self, desc):
        """
        Se queda con el asunto y descarta la ubicacion normativa.

        "Por la cual se adiciona la Seccion 5 'Procedimiento para el
        recaudo de la tarifa del 0.1 % sobre transporte de carga' al
        Capitulo 2 del Titulo 8 de la Parte 1 de la Resolucion 000227"
                              |
                              v
        "Se agregó el procedimiento para el recaudo de la tarifa del
         0.1 % sobre transporte de carga"
        """
        if not desc:
            return ""
        t = desc.strip()

        # Lo entrecomillado suele ser el asunto real
        entrecomillado = re.findall(r'"([^"]{25,300})"', t)
        titulos = [c for c in entrecomillado
                   if not re.search(r"[uú]nica en materia|decreto [uú]nico|"
                                    r"estatuto tributario", c, re.IGNORECASE)]

        verbo = None
        for patron, simple in VERBOS:
            m = re.match(patron, t, re.IGNORECASE)
            if m:
                verbo = simple
                t = t[m.end():].strip()
                break

        if titulos:
            asunto = titulos[0].strip()
            asunto = asunto[0].lower() + asunto[1:] if len(asunto) > 1 else asunto
            return f"{verbo or 'Se dispuso sobre'} {asunto}"

        # Sin comillas: limpiar la ubicacion normativa
        t = RESOLUCION_MADRE.sub("", t)
        t = re.sub(r"\s*(?:de|del|de la)\s+la\s+Resoluci[oó]n\s+n[uú]mero\s+[\d.]+"
                   r"\s+del?\s+\d{1,2}\s+de\s+\w+\s+de\s+\d{4}", "", t,
                   flags=re.IGNORECASE)
        # La resolucion madre deja rastros de varias formas
        t = re.sub(r"\s*,?\s*Resoluci[oó]n\s+[UÚ]nica\s+en\s+Materia[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*[UÚ]nica\s+en\s+[Mm]ateria[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*(?:Tributaria,?\s*)?Aduanera\s+y\s+Cambiaria\b", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s*,?\s*Decreto\s+[UÚ]nico\s+Reglamentario[^.;]*", "", t,
                   flags=re.IGNORECASE)
        t = re.sub(r"\s{2,}", " ", t).strip(' ,;."')

        # Si lo que queda es solo referencias a articulos, no dice nada
        sin_refs = UBICACION.sub("", t).strip(" ,;.y")
        if len(sin_refs) < 22:
            return ""

        if len(t) > 240:
            corte = t[:240].rsplit(" ", 1)[0]
            t = corte + "…"
        if not verbo:
            return t[0].upper() + t[1:] if t else ""
        return f"{verbo} {t[0].lower() + t[1:]}" if t else ""
