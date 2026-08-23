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
import unicodedata
from datetime import datetime

from asunto import Asunto
from reglas_texto import ETIQUETAS_TEMA, INTERNO, RECONSIDERA, CITADOS, fecha_simple


class Composicion(Asunto):
    """Metodos de redaccion. RedactorReglas hereda de aqui."""

    def componer(self, d):
        desc = (d.get("descripcion_limpia") or d.get("contenido") or "").strip()
        desc = self._sin_tema_repetido(desc, d.get("banco_datos"))
        interno = bool(INTERNO.search(desc + " " + (d.get("titulo") or "")))

        asunto = self._asunto(desc)
        frases = []
        advertencias = []
        puntos = 0

        if interno:
            frases.append("Es organización interna de la DIAN: "
                          + (asunto[0].lower() + asunto[1:] if asunto else "un asunto administrativo")
                          + ".")
            frases.append("No genera obligaciones para contribuyentes.")
            return {"resumen": " ".join(frases)[:900], "confianza": "alta",
                    "advertencias": [], "interno": True,
                    "obligatoriedad": "orientativo"}

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

        quien = self._a_quien(d)
        if quien:
            frases.append(quien)
            puntos += 1

        hacer, mas_puntos, mas_avisos = self._que_hacer(d)
        frases.extend(hacer)
        puntos += mas_puntos
        advertencias.extend(mas_avisos)

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

    def _tesis(self, d):
        t = (d.get("tesis_juridica") or "").strip()
        if len(t) < 25:
            return None
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
        if not desc or not RECONSIDERA.search(desc):
            return None
        tema = ""
        m = re.match(r"\s*([^-–·]{8,110}?)\s*[-–·]\s*\b(?:Reconsidera|Revoca|Modifica|Aclara)",
                     desc, re.IGNORECASE)
        if m:
            tema = m.group(1).strip().rstrip(".")
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
        partes = [f"La DIAN {verbo}" + (f" sobre {tema}" if tema else "") + "."]
        if citados:
            lista = self._enumerar(citados)
            partes.append(f"Deja atrás {lista}.")
            partes.append("Si asesoraste con esa doctrina, revisa esos casos.")
        else:
            partes.append("Abre el documento para ver qué doctrina reemplaza.")
        return {"frase": " ".join(partes), "tema": tema, "citados": citados}

    def _a_quien(self, d):
        partes = []
        oblig = d.get("clasificacion_obligatoriedad")
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
        sep = " — " if ":" in partes[0] else ": "
        return partes[0] + sep + self._enumerar(partes[1:]) + "."

    @staticmethod
    def _enumerar(lista):
        if len(lista) == 1:
            return lista[0]
        return ", ".join(lista[:-1]) + " y " + lista[-1]

    def _que_hacer(self, d):
        frases, avisos = [], []
        puntos = 0
        estado = d.get("estado_vigencia")
        if estado == "suspendido":
            frases.append("Está SUSPENDIDA: no la apliques hasta verificar el alcance de la suspensión.")
            puntos += 2
        elif estado == "inexequible":
            frases.append("Fue declarada INEXEQUIBLE: no la apliques.")
            puntos += 2
        elif estado in ("derogado", "revocado"):
            frases.append(f"Ya no está vigente ({estado}). Si la citaste antes, revisa esos casos.")
            puntos += 2
        anot = d.get("anotaciones_vigencia") or []
        if anot and estado == "vigente":
            frases.append("El compilador anotó cambios en su texto: " + anot[0][:150] + ".")
            puntos += 1
        if d.get("tiene_efectos_retroactivos") and d.get("anos_afectados"):
            anios = ", ".join(str(a) for a in d["anos_afectados"][:4])
            frases.append(f"Menciona años anteriores ({anios}): revisa si afecta declaraciones ya presentadas.")
            puntos += 2
        plazos = d.get("plazos_mencionados") or []
        if plazos:
            p = re.sub(r"\s+", " ", plazos[0]).strip()
            frases.append(f"Anota este plazo: {p[:190]}.")
            puntos += 2
        if d.get("fuentes_formales"):
            puntos += 1
        vig = fecha_simple(d.get("fecha_entrada_vigencia"))
        pub = fecha_simple(d.get("fecha_publicacion"))
        if vig and d.get("fecha_es_real") and vig != pub:
            frases.append(f"Rige desde el {vig}.")
            puntos += 1
        if d.get("fecha_publicacion_web"):
            puntos += 1
        return frases, puntos, avisos
