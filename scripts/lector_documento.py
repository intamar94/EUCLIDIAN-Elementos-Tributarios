"""EUCLIDIAN — Elementos Tributarios
Lectura del documento oficial

Un metodo por cada dato que se saca de la pagina de la DIAN: la fecha
real, el Diario Oficial, las anotaciones del compilador juridico, la
retroactividad, las zonas y los plazos.

Aparte del enriquecedor porque son dos oficios: aqui se decide COMO se
lee una pagina; alla, cuales se abren, en que orden y hasta cuando.
"""

import re

from patrones_dian import a_fecha


MESES = {
    "enero": 1, "febrero": 2, "marzo": 3, "abril": 4, "mayo": 5, "junio": 6,
    "julio": 7, "agosto": 8, "septiembre": 9, "setiembre": 9, "octubre": 10,
    "noviembre": 11, "diciembre": 12,
}

DEPARTAMENTOS = [
    "Amazonas", "Antioquia", "Arauca", "Atlántico", "Bolívar", "Boyacá",
    "Caldas", "Caquetá", "Casanare", "Cauca", "Cesar", "Chocó", "Córdoba",
    "Cundinamarca", "Guainía", "Guaviare", "Huila", "La Guajira", "Magdalena",
    "Meta", "Nariño", "Norte de Santander", "Putumayo", "Quindío", "Risaralda",
    "San Andrés", "Santander", "Sucre", "Tolima", "Valle del Cauca", "Vaupés",
    "Vichada", "Bogotá",
]


class LectorDocumento:
    """Extraccion campo por campo. Enriquecedor hereda de aqui."""

    def _fecha(self, texto):
        """
        Formatos que usa el normograma, en orden de confianza:
          (febrero 24)
          Diario Oficial No. 53.409 de 24 de febrero de 2026
          Dado a 24 de febrero de 2026
        """
        anio = None
        m_anio = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:600])
        if m_anio:
            anio = m_anio.group(1)

        # (febrero 24)  o  (24 de febrero)
        m = re.search(r"\(\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(\d{1,2})\s*\)", texto[:1500])
        if m and anio:
            f = a_fecha(m.group(2), m.group(1), anio)
            if f:
                return f
        m = re.search(r"\(\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*\)", texto[:1500])
        if m and anio:
            f = a_fecha(m.group(1), m.group(2), anio)
            if f:
                return f

        # Diario Oficial No. X de DD de MMMM de YYYY
        m = re.search(
            r"Diario Oficial[^\n]{0,60}?de\s+(\d{1,2})\s+de\s+"
            r"([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto[:2500], re.IGNORECASE)
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f

        # Dado a / Dada en Bogota a los ...
        m = re.search(
            r"Dad[oa][^\n]{0,60}?(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)"
            r"\s+de\s+((?:19|20)\d{2})",
            texto, re.IGNORECASE)
        if m:
            f = a_fecha(m.group(1), m.group(2), m.group(3))
            if f:
                return f
        return None

    def _diario_oficial(self, texto):
        """
        El Diario Oficial es el ancla de verificacion independiente: con
        ese numero y esa fecha, cualquiera puede comprobar la norma sin
        pasar por la DIAN. Por eso se guarda la fecha completa y no solo
        el ano, como se hacia antes.
        """
        m = re.search(
            r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)\s*"
            r"de\s+(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto[:3000], re.IGNORECASE)
        if m:
            return f"No. {m.group(1)} de {m.group(2)} de {m.group(3).lower()} de {m.group(4)}"
        # Sin fecha completa, al menos el numero y el ano
        m = re.search(
            r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)"
            r"[^\n]{0,70}?((?:19|20)\d{2})",
            texto[:2500], re.IGNORECASE)
        if m:
            return f"No. {m.group(1)} de {m.group(2)}"
        return None

    def _entidad(self, texto):
        candidatos = re.findall(
            r"^\s*((?:MINISTERIO|DIRECCI[OÓ]N|UNIDAD|DEPARTAMENTO|"
            r"SUPERINTENDENCIA|CONSEJO|CORTE|PRESIDENCIA)[^\n]{4,120})$",
            texto[:4000], re.MULTILINE)
        return candidatos[0].strip() if candidatos else None

    def _vigencia(self, texto):
        m = re.search(
            r"(?:rige|regir[aá]|entrar[aá] en vigencia|vigencia)[^.\n]{0,120}?"
            r"(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            texto, re.IGNORECASE)
        if m:
            return a_fecha(m.group(1), m.group(2), m.group(3))
        return None

    def _anotaciones(self, html, texto=""):
        """
        El normograma inserta anotaciones del compilador entre < >:
            <Ver SUSPENSION parcial por el Auto A-533-26>
            <Numeral modificado por el articulo 17 del Decreto 240 de 2026>
            <Articulo derogado por el articulo 5 de la Ley 2277 de 2022>
        Son la fuente mas confiable del estado de vigencia porque las
        escribe el compilador juridico, no nosotros.

        El truco esta en separarlas de las etiquetas HTML de verdad. Se
        descarta lo que tenga sintaxis de atributo (href=") y lo que
        empiece con un nombre de etiqueta conocido.
        """
        ETIQUETAS = re.compile(
            r"^/?(?:a|p|br|hr|div|span|img|td|tr|th|table|tbody|thead|li|ul|ol|"
            r"b|i|u|em|strong|font|small|sup|sub|h[1-6]|meta|link|input|form|"
            r"script|style|html|head|body|nav|footer|header|section|article|"
            r"button|label|select|option|iframe|svg|path|g|!)\b",
            re.IGNORECASE)

        crudas = []
        crudas += re.findall(r"&lt;([^&<>]{12,240}?)&gt;", html)
        crudas += re.findall(r"<([^<>]{12,240}?)>", html)
        if texto:
            crudas += re.findall(r"<([^<>]{12,240}?)>", texto)

        clave = re.compile(
            r"suspensi|suspend|derogad|deroga|modificad|adicionad|"
            r"inexequib|revocad|sustituid|anulad|"
            r"Ver\s+(?:SUSPENSI|Sentencia|Auto|INEXEQUIB)",
            re.IGNORECASE)

        utiles = []
        for c in crudas:
            c = re.sub(r"\s+", " ", c).strip()
            if not c or len(c) < 12:
                continue
            if re.search(r"=[\"']", c):
                continue
            if ETIQUETAS.match(c):
                continue
            if not clave.search(c):
                continue
            if c not in utiles:
                utiles.append(c)
        return utiles

    def _estado(self, anotaciones):
        """Traduce las anotaciones a un estado de vigencia."""
        texto = " | ".join(anotaciones).lower()
        if re.search(r"inexequib", texto):
            return "inexequible", f"Declarado inexequible. Anotación: {anotaciones[0][:200]}"
        if re.search(r"suspensi[oó]n|suspendid", texto):
            nota = next((a for a in anotaciones
                         if re.search(r"suspensi|suspendid", a, re.I)), "")
            return "suspendido", f"Suspendido. Anotación del normograma: {nota[:200]}"
        if re.search(r"\bderogad[oa]\s+(?:total|por)", texto):
            nota = next((a for a in anotaciones if re.search(r"derogad", a, re.I)), "")
            return "derogado", f"Derogado. Anotación del normograma: {nota[:200]}"
        return None, None

    def _retroactividad(self, texto):
        anios = set()
        patrones = [
            r"a[ñn]o\s+gravable\s+((?:19|20)\d{2})",
            r"aplicable\s+(?:a\s+partir\s+del?\s+)?(?:a[ñn]o\s+)?((?:19|20)\d{2})",
            r"retroactiv\w*[^.\n]{0,80}?((?:19|20)\d{2})",
            r"per[ií]odos?\s+gravables?\s+((?:19|20)\d{2})",
            r"desde\s+el\s+a[ñn]o\s+((?:19|20)\d{2})",
        ]
        for p in patrones:
            for m in re.finditer(p, texto, re.IGNORECASE):
                anios.add(int(m.group(1)))

        hay_palabra = bool(re.search(
            r"retroactiv|efectos?\s+hacia\s+atr[aá]s|per[ií]odos?\s+anteriores",
            texto, re.IGNORECASE))

        anio_doc = None
        m = re.search(r"\bDE\s+((?:19|20)\d{2})\b", texto[:600])
        if m:
            anio_doc = int(m.group(1))

        anteriores = sorted(a for a in anios if anio_doc and a < anio_doc)
        return (bool(anteriores) or hay_palabra), anteriores[:8]

    def _zonas(self, texto):
        halladas = []
        ventana = texto[:12000]
        for d in DEPARTAMENTOS:
            if re.search(rf"\b{re.escape(d)}\b", ventana):
                base = d.replace("á", "a").replace("é", "e").replace("í", "i") \
                        .replace("ó", "o").replace("ú", "u").replace("ñ", "n")
                if base not in [z.replace("á", "a") for z in halladas]:
                    halladas.append(d)
        if len(halladas) >= 2 and re.search(
                r"emergencia|calamidad|desastre|afectad|damnificad|zona",
                ventana, re.IGNORECASE):
            return halladas[:15]
        return []

    def _plazos(self, texto):
        plazos = []
        for m in re.finditer(
            r"([^\.\n]{0,110}?(?:declaren?|declarar|pagar[aá]n?|pago|cuota|"
            r"vencimiento|plazo|hasta el|a m[aá]s tardar)[^\.\n]{0,110}?"
            r"\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+(?:19|20)\d{2}[^\.\n]{0,40})",
            texto, re.IGNORECASE
        ):
            frase = re.sub(r"\s+", " ", m.group(1)).strip()
            if 25 < len(frase) < 260 and frase not in plazos:
                plazos.append(frase)
        return plazos
