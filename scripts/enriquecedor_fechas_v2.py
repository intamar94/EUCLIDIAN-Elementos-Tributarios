"""EUCLIDIAN — Reparador/enriquecedor autónomo.

Fuente de verdad: documento oficial del Normograma DIAN.

Reglas estrictas:
- fecha_publicacion solo se escribe con evidencia explícita de publicación.
- La fecha de expedición NO se convierte en fecha de publicación.
- 01-01 artificial nunca se considera verificada.
- Cada documento se guarda individualmente; una interrupción se reanuda sola.
"""
import argparse
import logging
import os
import re
import sys
import time
from collections import Counter
from datetime import date, datetime, timezone
from urllib.parse import urlparse

import requests
from bs4 import BeautifulSoup
from supabase import create_client

OFFICIAL_HOST = "normograma.dian.gov.co"
OFFICIAL_PREFIX = "/dian/compilacion/"
TIMEOUT = 30
PAUSA = 0.15
MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
DEPARTAMENTOS = ["Amazonas","Antioquia","Arauca","Atlántico","Bolívar","Boyacá","Caldas","Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca","Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño","Norte de Santander","Putumayo","Quindío","Risaralda","San Andrés","Santander","Sucre","Tolima","Valle del Cauca","Vaupés","Vichada","Bogotá"]

logging.basicConfig(level=logging.INFO, format="%(asctime)s %(levelname)-7s %(message)s", datefmt="%H:%M:%S")
log = logging.getLogger("euclidian")

def a_fecha(dia, mes_txt, anio):
    mes = MESES.get(mes_txt.lower().strip())
    if not mes: return None
    try: return date(int(anio), mes, int(dia))
    except ValueError: return None

class EnriquecedorFechasV2:
    def __init__(self, limite=250, anio=None, dry_run=False):
        self.limite, self.anio, self.dry_run = limite, anio, dry_run
        self.stats = Counter()
        url, key = os.getenv("SUPABASE_URL"), os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key:
            raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
        self.db = create_client(url, key)
        self.s = requests.Session()
        self.s.headers.update({"User-Agent":"EUCLIDIAN/1.0 (Normograma DIAN)","Accept-Language":"es-CO,es;q=0.9"})

    def correr(self):
        docs = self._pendientes()
        if not docs:
            log.info("No hay documentos por enriquecer.")
            return
        log.info("%d documentos seleccionados", len(docs))
        for i, doc in enumerate(docs, 1):
            if PAUSA: time.sleep(PAUSA)
            self._procesar(doc, i, len(docs))
        for k in sorted(self.stats): log.info("  %-24s %s", k, self.stats[k])

    def _pendientes(self):
        campos="id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas"
        encontrados={}
        try:
            q=self.db.table("documentos_tributarios").select(campos).eq("fecha_es_real",False)
            if self.anio: q=q.gte("fecha_publicacion",f"{self.anio}-01-01").lte("fecha_publicacion",f"{self.anio}-12-31")
            r=q.order("fecha_publicacion",desc=True).order("numero_resolucion",desc=True).limit(self.limite).execute()
            for d in r.data or []: encontrados[d["id"]]=d
            # Repara fechas artificiales antiguas incluso si quedaron marcadas true.
            for anio in range(1950, datetime.now().year+2):
                r=self.db.table("documentos_tributarios").select(campos).eq("fecha_publicacion",f"{anio}-01-01").limit(self.limite).execute()
                for d in r.data or []: encontrados[d["id"]]=d
        except Exception as e:
            log.error("No se pudo leer la cola: %s", str(e)[:250]); raise
        return list(encontrados.values())[:self.limite]

    def _procesar(self, doc, i, total):
        url=doc.get("enlace_oficial") or ""
        p=urlparse(url)
        if p.netloc != OFFICIAL_HOST or not p.path.startswith(OFFICIAL_PREFIX):
            self.stats["url_no_oficial"]+=1; log.error("[%d/%d] %s URL no oficial",i,total,doc.get("numero_resolucion")); return
        try:
            r=self.s.get(url,timeout=TIMEOUT)
            if r.status_code==429:
                time.sleep(3); r=self.s.get(url,timeout=TIMEOUT)
            r.raise_for_status(); r.encoding=r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            self.stats["error_red"]+=1; log.warning("[%d/%d] %s red: %s",i,total,doc.get("numero_resolucion"),str(e)[:100]); return
        soup=BeautifulSoup(r.text,"html.parser")
        for x in soup(["script","style","nav","footer"]): x.decompose()
        texto=re.sub(r"\n{3,}","\n\n",re.sub(r"[ \t]+"," ",soup.get_text("\n"))).strip()
        fecha=self._fecha_publicacion(texto)
        campos={"texto_completo":texto[:60000],"enriquecido_en":datetime.now(timezone.utc).isoformat()}
        if fecha:
            campos.update(fecha_publicacion=fecha.isoformat(),fecha_es_real=True); self.stats["fecha_verificada"]+=1
        else:
            # No se toca fecha_publicacion ni fecha_es_real: queda pendiente.
            self.stats["fecha_no_verificada"]+=1
        diario=self._diario(texto)
        if diario: campos["diario_oficial"]=diario[:120]; self.stats["con_diario"]+=1
        entidad=self._entidad(texto)
        if entidad: campos["entidad_emisora"]=entidad[:200]
        vig=self._vigencia(texto)
        if vig: campos["fecha_entrada_vigencia"]=vig.isoformat()
        anot=self._anotaciones(r.text,texto)
        if anot: campos["anotaciones_vigencia"]=anot[:25]
        retro,anos=self._retroactividad(texto)
        if retro: campos["tiene_efectos_retroactivos"]=True; campos["anos_afectados"]=anos
        zonas=self._zonas(texto)
        if zonas: campos["zonas_afectadas"]=zonas
        plazos=self._plazos(texto)
        if plazos: campos["plazos_mencionados"]=plazos[:12]
        estado,motivo=self._estado(anot)
        if estado: campos["estado_vigencia"]=estado; campos["motivo_cambio_estado"]=motivo[:500]
        if self.dry_run:
            log.info("[%d/%d] %s fecha=%s DO=%s",i,total,doc.get("numero_resolucion"),fecha or "NO VERIFICADA","si" if diario else "-"); return
        try:
            self.db.table("documentos_tributarios").update(campos).eq("id",doc["id"]).execute()
            self.stats["actualizados"]+=1
            self._alertas(doc,campos,retro,zonas)
        except Exception as e:
            self.stats["error_guardado"]+=1; log.error("[%d/%d] %s guardar: %s",i,total,doc.get("numero_resolucion"),str(e)[:150]); return
        log.info("[%d/%d] %s fecha=%s",i,total,doc.get("numero_resolucion"),fecha or "NO VERIFICADA")

    def _fecha_publicacion(self,texto):
        patrones=[r"Diario Oficial[^\n]{0,160}?de\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"Diario Oficial[^\n]{0,160}?del\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"publicad[ao][^\n]{0,180}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"publicaci[oó]n[^\n]{0,180}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})"]
        for patron in patrones:
            m=re.search(patron,texto[:25000],re.I)
            if m:
                f=a_fecha(m.group(1),m.group(2),m.group(3))
                if f: return f
        return None

    def _diario(self,texto):
        m=re.search(r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)[^\n]{0,100}?((?:19|20)\d{2})",texto[:4000],re.I)
        return f"No. {m.group(1)} de {m.group(2)}" if m else None

    def _entidad(self,texto):
        m=re.search(r"^\s*((?:MINISTERIO|DIRECCI[OÓ]N|UNIDAD|DEPARTAMENTO|SUPERINTENDENCIA|CONSEJO|CORTE|PRESIDENCIA)[^\n]{4,160})$",texto[:5000],re.M|re.I)
        return m.group(1).strip() if m else None

    def _vigencia(self,texto):
        m=re.search(r"(?:rige|regir[aá]|entrar[aá] en vigencia|vigencia)[^.\n]{0,140}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",texto,re.I)
        return a_fecha(m.group(1),m.group(2),m.group(3)) if m else None

    def _anotaciones(self,html,texto):
        crudas=re.findall(r"&lt;([^&<>]{12,240}?)&gt;",html)+re.findall(r"<([^<>]{12,240}?)>",html)+re.findall(r"<([^<>]{12,240}?)>",texto)
        clave=re.compile(r"suspensi|suspend|derogad|modificad|adicionad|inexequib|revocad|sustituid|anulad",re.I)
        return list(dict.fromkeys(c.strip() for c in crudas if len(c.strip())>=12 and not re.search(r"=[\"']",c) and clave.search(c)))

    def _estado(self,anot):
        t=" | ".join(anot).lower()
        if "inexequib" in t: return "inexequible","Anotación del Normograma: "+anot[0][:200]
        if "suspensi" in t or "suspendid" in t: return "suspendido","Anotación del Normograma: "+next((x for x in anot if re.search(r"suspensi|suspendid",x,re.I)),anot[0])[:200]
        if re.search(r"\bderogad[oa]\b",t): return "derogado","Anotación del Normograma: "+next((x for x in anot if "derogad" in x.lower()),anot[0])[:200]
        return None,None

    def _retroactividad(self,texto):
        m=re.search(r"\bDE\s+((?:19|20)\d{2})\b",texto[:800],re.I); anio=int(m.group(1)) if m else None
        anos=sorted({int(x) for x in re.findall(r"(?:año|a[ñn]os|per[ií]odos? gravables?)\s+((?:19|20)\d{2})",texto,re.I)})
        anteriores=[x for x in anos if anio and x<anio]
        return bool(anteriores or re.search(r"retroactiv|efectos? hacia atr[aá]s",texto,re.I)),anteriores[:8]

    def _zonas(self,texto):
        ventana=texto[:15000]; halladas=[d for d in DEPARTAMENTOS if re.search(rf"\b{re.escape(d)}\b",ventana,re.I)]
        return halladas[:15] if len(halladas)>=2 and re.search(r"emergencia|calamidad|desastre|afectad|damnificad|zona",ventana,re.I) else []

    def _plazos(self,texto):
        out=[]
        for m in re.finditer(r"([^\.\n]{0,120}?(?:vencimiento|plazo|hasta el|a m[aá]s tardar|pago)[^\.\n]{0,120}?\d{1,2}\s+de\s+[A-Za-záéíóúÁÉÍÓÚ]+\s+de\s+(?:19|20)\d{2}[^\.\n]{0,40})",texto,re.I):
            s=re.sub(r"\s+"," ",m.group(1)).strip()
            if 25<len(s)<300 and s not in out: out.append(s)
        return out

    def _alertas(self,doc,campos,retro,zonas):
        alertas=[]
        estado=campos.get("estado_vigencia")
        if estado in ("suspendido","inexequible"): alertas.append(("critica","doctrina_revocada",campos.get("motivo_cambio_estado",estado)))
        if retro: alertas.append(("alta","efecto_retroactivo",f"Menciona años anteriores: {', '.join(map(str,campos.get('anos_afectados',[])))}"))
        if zonas: alertas.append(("alta","desastre_natural",f"Medida territorial. Zonas: {', '.join(zonas[:6])}"))
        for nivel,tipo,desc in alertas:
            try:
                self.db.table("alertas_urgentes").upsert({"documento_id":doc["id"],"nivel_urgencia":nivel,"tipo_alerta":tipo,"descripcion":desc[:1000],"zonas_afectadas":zonas[:15],"aprobada_por_humano":False,"enviada":False},on_conflict="documento_id,tipo_alerta").execute()
            except Exception as e: log.debug("alerta no creada: %s",str(e)[:100])

if __name__ == "__main__":
    ap=argparse.ArgumentParser(); ap.add_argument("--limite",type=int,default=250); ap.add_argument("--anio",type=int,default=None); ap.add_argument("--dry-run",action="store_true"); a=ap.parse_args()
    EnriquecedorFechasV2(a.limite,a.anio,a.dry_run).correr()
