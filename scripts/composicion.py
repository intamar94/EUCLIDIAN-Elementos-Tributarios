"""
EUCLIDIAN — Elementos Tributarios
Composicion de la ficha

Toma un documento y arma las tres frases: que cambio, a quien le toca,
que hay que hacer. Cada frase se apoya en un dato verificado; ninguna
se inventa.

Vive aparte del recorrido de la base porque son dos oficios distintos:
aqui se decide COMO se dice algo, en redactor_reglas.py QUE documentos
se procesan y cuando.
"""

import re
from datetime import datetime

from reglas_texto import (
    INTERNO,
    RECONSIDERA,
    CITADOS,
    VERBOS,
    UBICACION,
    RESOLUCION_MADRE,
    ETIQUETAS_TEMA,
    fecha_simple,
)


class Composicion:
    """Metodos de redaccion. RedactorReglas hereda de aqui."""

    def componer(self, d):
        desc = (d.get("descripcion_limpia") or d.get("contenido") or "").strip()
        interno = bool(INTERNO.search(desc + " " + (d.get("titulo") or "")))

        asunto = self._asunto(desc)
        frases = []
        advertencias = []
        puntos = 0

        # ---- 1. QUE ----
        if interno:
            frases.append("Es organización interna de la DIAN: "
                          + (asunto[0].lower() + asunto[1:] if asunto else "un asunto administrativo")
                          + ".")
            frases.append("No genera obligaciones para contribuyentes.")
            # La clasificacion por tipo de documento dice que toda
            # resolucion obliga al contribuyente. Para un comite interno
            # eso es falso, y decirle a un contador que algo lo obliga
            # cuando no es asi es peor que no decirle nada. Aqui se
            # corrige: el contenido manda sobre el tipo.
            return {"resumen": " ".join(frases)[:900], "confianza": "alta",
                    "advertencias": [], "interno": True,
                    "obligatoriedad": "orientativo"}

        # La tesis juridica es la conclusion del documento: dice que
        # respondio la DIAN, no de que trataba. Cuando existe, es lo
        # primero que debe leerse.
        tesis = self._tesis(d)
        recon = self._reconsideracion(desc)

        if tesis:
            frases.append(tesis)
            puntos += 3
            asunto = None
        elif recon:
            frases.append(recon["frase"])
            puntos += 3
            asunto = None
        elif asunto:
            frases.append(asunto.rstrip(".") + ".")
            puntos += 1
        elif not recon and not tesis:
            advertencias.append("La descripción de la DIAN solo dice a qué norma "
                                "remite, no qué cambia")

        # ---- 2. A QUIEN ----
        quien = self._a_quien(d)
        if quien:
            frases.append(quien)
            puntos += 1

        # ---- 3. QUE HACER ----
        hacer, mas_puntos, mas_avisos = self._que_hacer(d)
        frases.extend(hacer)
        puntos += mas_puntos
        advertencias.extend(mas_avisos)

        # Antes se anadia "Abre el documento para ver el detalle". No
        # aportaba: el enlace ya esta ahi y el lector sabe que puede
        # abrirlo. Cuando no hay nada que senalar, es mejor callar.

        # ---- confianza ----
        if puntos >= 3:
            confianza = "alta"
        elif puntos == 2:
            confianza = "media"
        else:
            confianza = "baja"

        if not d.get("fecha_es_real"):
            advertencias.append("Falta la fecha exacta: aún no se ha abierto el "
                                "documento oficial")
            if confianza == "alta":
                confianza = "media"

        return {"resumen": " ".join(frases)[:900], "confianza": confianza,
                "advertencias": advertencias[:5], "interno": False,
                "obligatoriedad": None}

    # ------------------------------------------------------------------

    def _tesis(self, d):
        """
        Devuelve la conclusion del concepto en una frase, encabezada por
        la respuesta que dio la DIAN. Es texto literal del documento: no
        se resume ni se interpreta, solo se recorta si es muy largo.
        """
        t = (d.get("tesis_juridica") or "").strip()
        if len(t) < 25:
            return None

        # Quitar el "Si." o "No." inicial: se recupera como prefijo propio
        cuerpo = re.sub(r"^(?:S[ií]|No)\b\.?[,]?\s*", "", t).strip()
        respuesta = d.get("tesis_respuesta")

        prefijo = ""
        if respuesta == "si":
            prefijo = "Sí: "
        elif respuesta == "no":
            prefijo = "No: "
        elif respuesta == "matizada":
            prefijo = "Depende: "

        if len(cuerpo) > 420:
            corte = cuerpo[:420].rsplit(" ", 1)[0]
            cuerpo = corte + "…"

        if cuerpo and not cuerpo.endswith((".", "…")):
            cuerpo += "."
        return prefijo + cuerpo[0].upper() + cuerpo[1:] if prefijo == "" else prefijo + cuerpo

    def _reconsideracion(self, desc):
        """
        Traduce un cambio de criterio a lo que el contador necesita saber:
        que la DIAN cambio de opinion, sobre que, y que revise los casos
        que asesoro con la doctrina anterior.
        """
        if not desc or not RECONSIDERA.search(desc):
            return None

        # El tema suele ir antes del guion: "Impuesto a la Gasolina - Reconsidera..."
        tema = ""
        m = re.match(r"\s*([^-–]{8,110}?)\s*[-–]\s*\b(?:Reconsidera|Revoca|Modifica|Aclara)",
                     desc, re.IGNORECASE)
        if m:
            tema = m.group(1).strip().rstrip(".")

        # Los documentos que quedan atras
        citados, vistos = [], set()
        for c in CITADOS.finditer(desc[:600]):
            num = c.group(1)
            if num in vistos:
                continue
            vistos.add(num)
            citados.append(f"Concepto {num}" + (f" de {c.group(2)}" if c.group(2) else ""))
            if len(citados) >= 3:
                break

        verbo = "cambió su criterio"
        if re.search(r"\brevoca\b", desc, re.IGNORECASE):
            verbo = "revocó su doctrina"
        elif re.search(r"\baclara\b", desc, re.IGNORECASE) and \
             not re.search(r"\breconsidera\b", desc, re.IGNORECASE):
            verbo = "aclaró su doctrina"

        # No se pasa a minusculas: hay siglas (ACPM, IVA, GMF, RUT) que
        # quedarian irreconocibles.
        partes = [f"La DIAN {verbo}" + (f" sobre {tema}" if tema else "") + "."]
        if citados:
            lista = self._enumerar(citados)
            partes.append(f"Deja atrás {lista}.")
            partes.append("Si asesoraste con esa doctrina, revisa esos casos.")
        else:
            partes.append("Abre el documento para ver qué doctrina reemplaza.")

        return {"frase": " ".join(partes), "tema": tema, "citados": citados}

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

    # ------------------------------------------------------------------

    def _a_quien(self, d):
        partes = []
        oblig = d.get("clasificacion_obligatoriedad")

        # Frases cortas a proposito: estas lineas se repiten en cientos de
        # fichas. Si son largas, el ojo las salta y deja de leerlas.
        if oblig == "obligatorio_dian_y_contribuyentes":
            partes.append("Obligatorio")
        elif oblig == "obligatorio_dian_solo":
            partes.append("Doctrina DIAN: orienta, no obliga")
        elif oblig == "vinculante_jurisprudencia":
            partes.append("Jurisprudencia vinculante")

        temas = [ETIQUETAS_TEMA.get(t, t.replace("_", " "))
                 for t in (d.get("temas") or [])
                 if not t.startswith("dian:") and t != "boletin_mensual"]
        if temas:
            partes.append("te toca si trabajas con " + self._enumerar(temas[:3]))

        zonas = d.get("zonas_afectadas") or []
        if zonas:
            partes.append("solo aplica en " + self._enumerar(zonas[:4]))

        if not partes:
            return ""
        if len(partes) == 1:
            return partes[0] + "."
        # El primer elemento es la naturaleza (obligatorio / doctrina); el
        # resto son condiciones de aplicacion. Se separan con dos puntos,
        # salvo que la naturaleza ya traiga los suyos: entonces raya, para
        # no encadenar "Doctrina DIAN: orienta, no obliga: te toca...".
        sep = " — " if ":" in partes[0] else ": "
        return partes[0] + sep + self._enumerar(partes[1:]) + "."

    @staticmethod
    def _enumerar(lista):
        if len(lista) == 1:
            return lista[0]
        return ", ".join(lista[:-1]) + " y " + lista[-1]

    # ------------------------------------------------------------------

    def _que_hacer(self, d):
        frases, avisos = [], []
        puntos = 0
        estado = d.get("estado_vigencia")

        if estado == "suspendido":
            frases.append("Está SUSPENDIDA: no la apliques hasta verificar el "
                          "alcance de la suspensión.")
            puntos += 2
        elif estado == "inexequible":
            frases.append("Fue declarada INEXEQUIBLE: no la apliques.")
            puntos += 2
        elif estado in ("derogado", "revocado"):
            frases.append(f"Ya no está vigente ({estado}). Si la citaste antes, "
                          f"revisa esos casos.")
            puntos += 2

        anot = d.get("anotaciones_vigencia") or []
        if anot and estado == "vigente":
            frases.append("El compilador anotó cambios en su texto: "
                          + anot[0][:150] + ".")
            puntos += 1

        if d.get("tiene_efectos_retroactivos") and d.get("anos_afectados"):
            anios = ", ".join(str(a) for a in d["anos_afectados"][:4])
            frases.append(f"Menciona años anteriores ({anios}): revisa si afecta "
                          f"declaraciones ya presentadas.")
            puntos += 2

        plazos = d.get("plazos_mencionados") or []
        if plazos:
            p = re.sub(r"\s+", " ", plazos[0]).strip()
            frases.append(f"Anota este plazo: {p[:190]}.")
            puntos += 2

        fuentes = d.get("fuentes_formales") or []
        if fuentes:
            # Saber que articulo del Estatuto toca es lo que permite a un
            # contador decidir en dos segundos si le concierne.
            frases.append("Interpreta " + self._enumerar(
                [f.rstrip(".") for f in fuentes[:2]]) + ".")
            puntos += 1

        vig = fecha_simple(d.get("fecha_entrada_vigencia"))
        pub = fecha_simple(d.get("fecha_publicacion"))
        if vig and d.get("fecha_es_real") and vig != pub:
            frases.append(f"Rige desde el {vig}.")
            puntos += 1

        # Un concepto obliga a los funcionarios desde que se publica en la
        # web de la DIAN, no desde que se firma. Cuando hay diferencia
        # apreciable, conviene decirla: entre una fecha y otra la doctrina
        # todavia no era exigible.
        web = fecha_simple(d.get("fecha_publicacion_web"))
        if web and pub and web != pub and \
           d.get("clasificacion_obligatoriedad") == "obligatorio_dian_solo":
            frases.append(f"Publicada en la web de la DIAN el {web}: "
                          f"desde esa fecha obliga a sus funcionarios.")
            puntos += 1

        return frases, puntos, avisos

    # ==================================================================
