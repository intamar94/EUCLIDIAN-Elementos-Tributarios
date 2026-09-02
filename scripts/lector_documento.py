"""EUCLIDIAN — Lectura robusta del documento oficial DIAN."""
import re
from patrones_dian import a_fecha

MESES={"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
DEPARTAMENTOS=["Amazonas","Antioquia","Arauca","Atlántico","Bolívar","Boyacá","Caldas","Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca","Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño","Norte de Santander","Putumayo","Quindío","Risaralda","San Andrés","Santander","Sucre","Tolima","Valle del Cauca","Vaupés","Vichada","Bogotá"]

class LectorDocumento:
    def _fecha(self,texto):
        """Fecha propia del acto/concepto, no la fecha de publicación web."""
        cab=texto[:5000]
        patrones=[
            r"\(\s*([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+(\d{1,2})\s*\)",
            r"\(\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s*\)",
            r"Dad[oa][^\n]{0,100}?(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"(?:expedid[oa]|suscrit[oa]|fecha)\s*(?:el|a|:)\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
            r"Diario Oficial[^\n]{0,100}?de\s+(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",
        ]
        anios=re.findall(r"\b(?:19|20)\d{2}\b",cab[:1500])
        anio=anios[0] if anios else None
        for idx,p in enumerate(patrones):
            m=re.search(p,cab,re.I)
            if not m: continue
            if idx in (0,1) and anio:
                f=a_fecha(m.group(2),m.group(1),anio) if idx==0 else a_fecha(m.group(1),m.group(2),anio)
            else:
                f=a_fecha(m.group(1),m.group(2),m.group(3))
            if f:return f
        return None

    def _fecha_publicacion_web(self,texto):
        """Fecha en que la DIAN indica que publicó el documento en su web."""
        m=re.search(r"Publicado\s+en\s+la\s+p[aá]gina\s+web\s+de\s+la\s+DIAN\s*:\s*(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})", texto[:7000], re.I)
        if not m:
            return None
        return a_fecha(m.group(1),m.group(2),m.group(3))

    def _diario_oficial(self,texto):
        m=re.search(r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)\s*de\s+(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",texto[:5000],re.I)
        if m:return f"No. {m.group(1)} de {m.group(2)} de {m.group(3).lower()} de {m.group(4)}"
        m=re.search(r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)",texto[:5000],re.I)
        return f"No. {m.group(1)}" if m else None

    def _entidad(self,texto):
        m=re.search(r"^\s*((?:MINISTERIO|DIRECCI[OÓ]N|UNIDAD|DEPARTAMENTO|SUPERINTENDENCIA|CONSEJO|CORTE|PRESIDENCIA)[^\n]{4,160})$",texto[:5000],re.M|re.I)
        return m.group(1).strip() if m else None

    def _vigencia(self,texto):
        m=re.search(r"(?:rige|regir[aá]|entrar[aá] en vigencia|vigencia)[^.\n]{0,150}?(\d{1,2})\s+de\s+([a-zA-ZáéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",texto,re.I)
        return a_fecha(m.group(1),m.group(2),m.group(3)) if m else None

    def _anotaciones(self,html,texto=""):
        crudas=re.findall(r"&lt;([^&<>]{12,300}?)&gt;",html)+re.findall(r"<([^<>]{12,300}?)>",html)
        clave=re.compile(r"suspensi|suspend|derogad|deroga|modificad|adicionad|inexequib|revocad|sustituid|anulad|Ver\s+(?:SUSPENSI|Sentencia|Auto|INEXEQUIB)",re.I)
        utiles=[]
        for c in crudas:
            c=re.sub(r"\s+"," ",c).strip()
            if len(c)<12 or re.search(r"=[\"']",c) or not clave.search(c):continue
            if c not in utiles:utiles.append(c)
        return utiles

    def _estado(self,anotaciones):
        t=" | ".join(anotaciones).lower()
        if "inexequib" in t:return "inexequible",anotaciones[0]
        if re.search(r"suspensi[oó]n|suspendid",t):return "suspendido",next(a for a in anotaciones if re.search(r"suspensi|suspendid",a,re.I))
        if re.search(r"derogad",t):return "derogado",next(a for a in anotaciones if re.search(r"derogad",a,re.I))
        return None,None

    def _retroactividad(self,texto):
        anios=set()
        for p in [r"a[ñn]o\s+gravable\s+((?:19|20)\d{2})",r"aplicable[^.\n]{0,100}?((?:19|20)\d{2})",r"retroactiv\w*[^.\n]{0,100}?((?:19|20)\d{2})",r"per[ií]odos?\s+gravables?\s+((?:19|20)\d{2})"]:
            anios.update(int(x) for x in re.findall(p,texto,re.I))
        m=re.search(r"\bDE\s+((?:19|20)\d{2})\b",texto[:1000],re.I); doc=int(m.group(1)) if m else None
        anteriores=sorted(x for x in anios if doc and x<doc)
        return bool(anteriores or re.search(r"retroactiv|efectos?\s+hacia\s+atr[aá]s",texto,re.I)),anteriores[:8]

    def _zonas(self,texto):
        encontrados=[d for d in DEPARTAMENTOS if re.search(rf"\b{re.escape(d)}\b",texto[:15000])]
        if len(encontrados)>=1 and re.search(r"emergencia|calamidad|desastre|afectad|damnificad|zona",texto[:15000],re.I):return encontrados[:15]
        return []

    def _plazos(self,texto):
        out=[]
        for m in re.finditer(r"([^\.\n]{0,120}?(?:plazo|vencimiento|hasta el|a m[aá]s tardar|pagar[aá]n?|pago)[^\.\n]{0,140}?\d{1,2}\s+de\s+[a-zA-ZáéíóúÁÉÍÓÚ]+\s+de\s+(?:19|20)\d{2}[^\.\n]{0,40})",texto,re.I):
            s=re.sub(r"\s+"," ",m.group(1)).strip()
            if 25<len(s)<300 and s not in out:out.append(s)
        return out
