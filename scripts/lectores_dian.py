"""
EUCLIDIAN — Elementos Tributarios
Lectores de documentos DIAN

Un metodo por cada dato que se saca del documento. Todos copian texto
literal; ninguno interpreta. Cuando un patron no calza con certeza, el
metodo devuelve None: un campo vacio es honesto, uno mal extraido no.
"""

import re

from patrones_dian import CIERRES, a_fecha


class Lectores:
    """Extraccion campo por campo. ExtractorEstructura hereda de aqui."""

    def _numero_interno(self, t):
        """
        El encabezado trae los dos numeros:
            CONCEPTO 012605 int 1057 DE 2026
        Los contadores citan indistintamente uno u otro. Guardar solo el
        primero deja media busqueda sin resultados.
        """
        m = re.search(r"\b(?:CONCEPTO|OFICIO|RESOLUCI[OÓ]N)\s+\d{3,7}\s+"
                      r"int\.?\s*(\d{1,6})\b", t[:1500], re.IGNORECASE)
        if m:
            return m.group(1).lstrip("0") or m.group(1)
        m = re.search(r"\(\s*int\.?\s*(\d{1,6})\s*\)", t[:2500], re.IGNORECASE)
        return (m.group(1).lstrip("0") or m.group(1)) if m else None

    def _fecha_web(self, t):
        """
        Fecha de publicacion en la pagina de la DIAN.

        No es un dato accesorio: el Concepto 405 de 2026 recuerda que un
        concepto obliga a los funcionarios a partir de su PUBLICACION, no
        de su firma. Entre una y otra puede haber semanas.
        """
        m = re.search(
            r"[Pp]ublicad[oa]\s+en\s+la\s+p[aá]gina\s+(?:web\s+)?(?:oficial\s+)?"
            r"de\s+la\s+DIAN\s*:?\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+"
            r"de\s+((?:19|20)\d{2})",
            t[:3000], re.IGNORECASE)
        if not m:
            m = re.search(
                r"[Pp]ublicaci[oó]n\s+en\s+la\s+DIAN\s*:?\s*(\d{1,2})\s+de\s+"
                r"([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
                t[:3000], re.IGNORECASE)
        return a_fecha(m.group(1), m.group(2), m.group(3)) if m else None

    def _banco_datos(self, t):
        """La clasificacion tematica de la propia DIAN."""
        m = re.search(r"^Banco de Datos\s*\n\s*(.{4,190})$", t, re.MULTILINE)
        if not m:
            return None
        v = re.sub(r"\s+", " ", m.group(1)).strip(" .-")
        return v if 4 < len(v) < 190 else None

    def _dependencia(self, t):
        """
        Quien lo firma importa: la Direccion de Gestion Juridica resuelve
        las reconsideraciones de los conceptos de la Subdireccion de
        Normativa y Doctrina. Hay jerarquia entre ambas.
        """
        for patron in (r"(Direcci[oó]n de Gesti[oó]n Jur[ií]dica)",
                       r"(Subdirecci[oó]n de Normativa y Doctrina)",
                       r"(Direcci[oó]n de Gesti[oó]n de Impuestos)",
                       r"(Unidad Inform[aá]tica de Doctrina)"):
            m = re.search(patron, t, re.IGNORECASE)
            if m:
                return m.group(1)
        return None

    def _doctrina_citada(self, t, interno_propio=None):
        """
        Conceptos en que se apoya, incluidas las notas al pie:
            Cfr. Concepto 016119 - int. 1905 del 10 de noviembre de 2025
        """
        # El propio numero del documento aparece en su encabezado y en el
        # titulo de la pagina. Citarse a si mismo no aporta nada.
        propios = set()
        m0 = re.search(r"\b(?:CONCEPTO|OFICIO)\s+0*(\d{3,9})", t[:1200], re.IGNORECASE)
        if m0:
            propios.add(m0.group(1).lstrip("0"))
        if interno_propio:
            propios.add(str(interno_propio).lstrip("0"))

        salida = []
        patron = re.compile(
            r"\b(?:Concepto|Oficio)\s+(?:General\s+)?(?:Unificado\s+)?"
            r"(?:DIAN\s+)?(?:N[o°º]\.\?\s*)?0*(\d{3,9})"
            r"(?:\s*[-(]?\s*int\.?\s*0*(\d{1,6})\s*\)?)?"
            r"(?:[^\d\n]{0,30}?((?:19|20)\d{2}))?",
            re.IGNORECASE)
        for m in patron.finditer(t):
            num = m.group(1)
            interno = m.group(2)
            anio = m.group(3)
            if num.lstrip("0") in propios:
                continue
            etiqueta = f"Concepto {num}"
            if interno:
                etiqueta += f" (int {interno})"
            if anio:
                etiqueta += f" de {anio}"
            if etiqueta not in salida:
                salida.append(etiqueta)
            if len(salida) >= 20:
                break
        return salida

    def _jurisprudencia(self, t):
        """
        Sentencias citadas. Un concepto apoyado en jurisprudencia del
        Consejo de Estado pesa distinto que uno que no la cita.
        """
        salida = []
        for patron in (
            r"[Ss]entencia\s+([CT]-\d{1,4}\s*(?:de\s*)?(?:19|20)?\d{2,4})",
            r"C\.?\s*E\.?\,?\s*Sec\.?\s*(?:Cuarta|4)[^\n]{0,40}?"
            r"(Sent\.?\s*\d{3,6}[^\n]{0,25})",
            r"[Cc]onsejo de Estado[^\n]{0,60}?(?:[Ee]xpediente|[Rr]adicado)"
            r"\s*(?:N[o°º]\.\?\s*)?(\d{4,6})",
            r"[Aa]uto\s+(A-\d{2,4}-\d{2,4})",
        ):
            for m in re.finditer(patron, t):
                v = re.sub(r"\s+", " ", m.group(1)).strip(" .,;")
                if 3 < len(v) < 70 and v not in salida:
                    salida.append(v)
        return salida

    def _area(self, t):
        m = re.search(r"[AÁ]rea del Derecho\s*\n\s*([A-Za-zÁÉÍÓÚáéíóúñ ]{4,40})", t)
        return m.group(1).strip() if m else None

    def _bloque(self, t, encabezado):
        """
        Devuelve las lineas de una seccion, SIN aplanarlas. Aplanar fue el
        primer error: los saltos de linea son lo que separa una fuente de
        la siguiente, y al quitarlos quedaban pegadas.
        """
        m = re.search(rf"^{encabezado}\s*\n(.{{5,1200}}?)(?=\n\s*(?:{CIERRES})\s*\n)",
                      t, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if not m:
            m = re.search(rf"^{encabezado}\s*\n(.{{5,1200}}?)(?=\n\s*\n)",
                          t, re.DOTALL | re.IGNORECASE | re.MULTILINE)
        if not m:
            return []
        return [re.sub(r"\s+", " ", l).strip(" .,;·-")
                for l in m.group(1).split("\n") if l.strip()]

    def _descriptores(self, t):
        """
        Vienen de dos formas segun el concepto:
            Descriptores          |  Descriptores
            Tema: GMF             |  Empresas de transporte
            Descriptores: Traslados  Agente de retencion
        """
        salida = []
        for linea in self._bloque(t, r"Descriptores"):
            linea = re.sub(r"^(?:Tema|Descriptores)\s*:\s*", "", linea,
                           flags=re.IGNORECASE)
            for parte in re.split(r"\s+[-–]\s+|;", linea):
                parte = parte.strip(" .·")
                if 3 < len(parte) < 90 and parte not in salida:
                    salida.append(parte)
        # Formato antiguo, con la etiqueta en la misma linea
        for etiqueta in ("Tema", "Descriptores"):
            for m in re.finditer(rf"^{etiqueta}\s*:\s*(.+)$", t, re.MULTILINE):
                for parte in re.split(r"\s+[-–]\s+|;", m.group(1)):
                    parte = parte.strip(" .·")
                    if 3 < len(parte) < 90 and parte not in salida:
                        salida.append(parte)
        return salida

    def _fuentes(self, t):
        """
        Los articulos que el documento interpreta, uno por linea.
        Permite despues buscar "todo lo que toca el articulo 911".
        """
        salida = []
        for linea in self._bloque(t, r"Fuentes Formales"):
            if len(linea) < 6 or len(linea) > 160:
                continue
            if not re.search(r"art[ií]culo|ley|decreto|resoluci[oó]n|"
                             r"estatuto|c[oó]digo|constituci[oó]n|sentencia",
                             linea, re.IGNORECASE):
                continue
            if linea not in salida:
                salida.append(linea)
        return salida

    def _problema(self, t):
        m = re.search(rf"Problema Jur[ií]dico\s*\n(.{{15,1400}}?)(?=\n(?:{CIERRES}))",
                      t, re.DOTALL | re.IGNORECASE)
        if not m:
            return None
        p = re.sub(r"\s+", " ", m.group(1)).strip()
        p = re.sub(r"^(?:PROBLEMA JUR[IÍ]DICO\s*(?:No\.?\s*\d+)?\s*[:.]?\s*)", "", p,
                   flags=re.IGNORECASE)
        return p if len(p) > 15 else None

    def _tesis(self, t):
        """
        La conclusion. Suele empezar con Si o No, a veces precedida de
        "TESIS JURIDICA No. 1" cuando el concepto responde varias cosas.
        """
        m = re.search(rf"Tesis Jur[ií]dica\s*\n(.{{15,2600}}?)(?=\n(?:{CIERRES}))",
                      t, re.DOTALL | re.IGNORECASE)
        if not m:
            return None, None

        cuerpo = re.sub(r"\s+", " ", m.group(1)).strip()
        cuerpo = re.sub(r"^(?:TESIS JUR[IÍ]DICA\s*(?:No\.?\s*\d+)?\s*[:.]?\s*)", "",
                        cuerpo, flags=re.IGNORECASE).strip()

        respuesta = None
        mr = re.match(r"^(S[ií]|No)\b\.?\,?\s*", cuerpo, re.IGNORECASE)
        if mr:
            crudo = mr.group(1).lower()
            respuesta = "si" if crudo.startswith("s") else "no"
        elif re.match(r"^(Depende|En principio|Parcialmente|Solo|S[oó]lo)\b",
                      cuerpo, re.IGNORECASE):
            respuesta = "matizada"

        return (cuerpo, respuesta) if len(cuerpo) > 15 else (None, None)
