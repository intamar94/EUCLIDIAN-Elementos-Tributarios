"""EUCLIDIAN — Reparador/enriquecedor autónomo.

Fuente de verdad: documento oficial del Normograma DIAN.
- fecha_publicacion solo se escribe con evidencia explícita de publicación.
- La fecha de expedición no se convierte en fecha de publicación.
- 01-01 artificial nunca se considera verificada.
- Cada documento se guarda individualmente para permitir reanudación.
- Los fallos HTTP transitorios se reintentan; los 404 se consideran
  definitivos para ese enlace y no se presentan como éxito.
"""
import argparse, logging, os, re, sys, time
from collections import Counter
from datetime import date, datetime, timezone
from urllib.parse import urlparse
import requests
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from bs4 import BeautifulSoup
from supabase import create_client
from plazos_dian import complete_deadlines

OFFICIAL_HOST="normograma.dian.gov.co"; OFFICIAL_PREFIX="/dian/compilacion/"; TIMEOUT=30; PAUSA=0.15; PAGE=1000
MESES={"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
DEPARTAMENTOS=["Amazonas","Antioquia","Arauca","Atlántico","Bolívar","Boyacá","Caldas","Caquetá","Casanare","Cauca","Cesar","Chocó","Córdoba","Cundinamarca","Guainía","Guaviare","Huila","La Guajira","Magdalena","Meta","Nariño","Norte de Santander","Putumayo","Quindío","Risaralda","San Andrés","Santander","Sucre","Tolima","Valle del Cauca","Vaupés","Vichada","Bogotá"]
logging.basicConfig(level=logging.INFO,format="%(asctime)s %(levelname)-7s %(message)s",datefmt="%H:%M:%S"); log=logging.getLogger("euclidian")

def a_fecha(dia,mes_txt,anio):
    mes=MESES.get(mes_txt.lower().strip())
    if not mes:return None
    try:return date(int(anio),mes,int(dia))
    except ValueError:return None

class EnriquecedorFechasV2:
    def __init__(self,limite=250,anio=None,dry_run=False):
        self.limite,self.anio,self.dry_run=limite,anio,dry_run; self.stats=Counter()
        url,key=os.getenv("SUPABASE_URL"),os.getenv("SUPABASE_SERVICE_KEY")
        if not url or not key: raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
        self.db=create_client(url,key)
        self.s=requests.Session()
        self.s.headers.update({"User-Agent":"EUCLIDIAN/1.1 (Normograma DIAN)","Accept-Language":"es-CO,es;q=0.9"})
        retry=Retry(total=4,connect=4,read=4,status=4,backoff_factor=1, status_forcelist=(429,500,502,503,504), allowed_methods=frozenset(["GET"]))
        self.s.mount("https://",HTTPAdapter(max_retries=retry))

    def correr(self):
        docs=self._pendientes()
        if not docs:
            log.info("No hay documentos por enriquecer.")
            return
        log.info("%d documentos seleccionados",len(docs))
        for i,doc in enumerate(docs,1):
            if PAUSA: time.sleep(PAUSA)
            self._procesar(doc,i,len(docs))
        for k in sorted(self.stats): log.info("  %-24s %s",k,self.stats[k])
        total=sum(self.stats.values())
        if total: log.info("RESUMEN_EUCLIDIAN %s",dict(sorted(self.stats.items())))

    def _pendientes(self):
        campos="id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas,fecha_publicacion,fecha_es_real,texto_completo,notas_verificacion"
        encontrados={}; prioritarios={}
        try:
            # La cuarentena documentó la fecha descartada; reabrir esos
            # formatos históricos antes de la cola general de enriquecimiento.
            r=self.db.table("documentos_tributarios").select(campos).ilike("notas_verificacion","%fecha_cuarentena_2026-10-08:%").eq("fecha_es_real",False).limit(self.limite).execute()
            for d in r.data or []:prioritarios[d["id"]]=d
            # Una fecha no basta para sustentar una ficha. También abrimos los
            # documentos sin texto capturado, aunque el índice ya hubiera
            # identificado una fecha válida.
            q=self.db.table("documentos_tributarios").select(campos).or_("fecha_es_real.is.false,texto_completo.is.null")
            if self.anio:q=q.gte("fecha_publicacion",f"{self.anio}-01-01").lte("fecha_publicacion",f"{self.anio}-12-31")
            r=q.order("fecha_publicacion",desc=True).order("numero_resolucion",desc=True).limit(self.limite).execute()
            for d in r.data or []:encontrados[d["id"]]=d
            # Recorrer metadatos pequeños por ID evita OFFSET profundo sobre
            # 17.000 filas con texto_completo, que puede agotar statement_timeout.
            ultimo_id=None; ids_criticos=[]; ids_enero=[]
            while True:
                q=(self.db.table("documentos_tributarios")
                   .select("id,numero_resolucion,fecha_publicacion")
                   .eq("fecha_es_real",True)
                   .gte("fecha_publicacion","1950-01-01")
                   .lte("fecha_publicacion",f"{datetime.now().year+1}-12-31"))
                if ultimo_id:q=q.gt("id",ultimo_id)
                lote=q.order("id").limit(PAGE).execute().data or []
                if not lote:break
                for d in lote:
                    fecha=str(d.get("fecha_publicacion") or "")
                    anio=re.search(r"-((?:19|20)\d{2})$",str(d.get("numero_resolucion") or ""))
                    if anio and fecha and fecha[:4]!=anio.group(1):ids_criticos.append(d["id"])
                    elif fecha.endswith("-01-01"):ids_enero.append(d["id"])
                ultimo_id=lote[-1]["id"]
                if len(lote)<PAGE:break
            # Traer el texto completo solo para los casos que realmente se
            # procesarán. Los años contradictorios conservan prioridad.
            for id_ in ids_criticos:
                if id_ in encontrados:prioritarios[id_]=encontrados.pop(id_)
            criticos=set(ids_criticos)
            faltantes=[i for i in ids_criticos+ids_enero if i not in prioritarios and i not in encontrados]
            for start in range(0,min(len(faltantes),self.limite),50):
                ids=faltantes[start:start+50]
                r=self.db.table("documentos_tributarios").select(campos).in_("id",ids).execute()
                por_id={d["id"]:d for d in r.data or []}
                for id_ in ids:
                    if id_ in por_id:
                        if id_ in criticos:prioritarios[id_]=por_id[id_]
                        else:encontrados[id_]=por_id[id_]
        except Exception as e:
            log.error("No se pudo leer la cola: %s",str(e)[:250]); raise
        # Una fecha que contradice el número del acto tiene prioridad sobre
        # las fichas aún sin texto: se muestra mal al suscriptor y altera el orden.
        prioritarios.update({k:v for k,v in encontrados.items() if k not in prioritarios})
        return list(prioritarios.values())[:self.limite]

    def _procesar(self,doc,i,total):
        url=doc.get("enlace_oficial") or ""; p=urlparse(url)
        numero=doc.get("numero_resolucion")
        if p.netloc!=OFFICIAL_HOST or not p.path.startswith(OFFICIAL_PREFIX):
            self.stats["url_no_oficial"]+=1; log.error("[%d/%d] %s URL no oficial",i,total,numero); return
        try:
            r=self.s.get(url,timeout=TIMEOUT)
            if r.status_code==404:
                self.stats["enlace_404"]+=1
                log.error("[%d/%d] %s ENLACE_404 %s",i,total,numero,url)
                return
            r.raise_for_status(); r.encoding=r.apparent_encoding or "utf-8"
        except requests.RequestException as e:
            self.stats["error_red"]+=1
            log.warning("[%d/%d] %s ERROR_RED %s",i,total,numero,str(e)[:180])
            return
        soup=BeautifulSoup(r.text,"html.parser")
        for x in soup(["script","style","nav","footer"]):x.decompose()
        texto=re.sub(r"\n{3,}","\n\n",re.sub(r"[ \t]+"," ",soup.get_text("\n"))).strip()
        identificador=re.search(r"-((?:19|20)\d{2})$",str(numero or ""))
        anio_identificador=int(identificador.group(1)) if identificador else None
        fecha_documento=self._fecha_documento(texto,numero)
        fecha_web=self._fecha_publicacion(texto)
        campos={"texto_completo":texto[:60000],"enriquecido_en":datetime.now(timezone.utc).isoformat()}
        if fecha_documento and (not anio_identificador or fecha_documento.year==anio_identificador):
            campos.update(fecha_publicacion=fecha_documento.isoformat(),fecha_es_real=True)
            if anio_identificador:campos["anio_publicacion"]=anio_identificador
            self.stats["fecha_documento_verificada"]+=1
        else:
            self.stats["fecha_documento_no_verificada"]+=1
            fecha_anterior=str(doc.get("fecha_publicacion") or "")
            if anio_identificador and fecha_anterior and fecha_anterior[:4]!=str(anio_identificador):
                campos.update(fecha_publicacion=None,fecha_es_real=False,anio_publicacion=anio_identificador)
                self.stats["fecha_incoherente_retirada"]+=1
            elif doc.get("fecha_es_real") is not True and fecha_anterior.endswith("-01-01"):
                nota=f"fecha_marcador_retirada: {fecha_anterior}; año conservado desde identificador DIAN"
                anterior=str(doc.get("notas_verificacion") or "").strip()
                campos.update(fecha_publicacion=None,fecha_es_real=False,
                              anio_publicacion=anio_identificador or int(fecha_anterior[:4]),
                              notas_verificacion=(anterior+" | " if anterior else "")+nota)
                self.stats["fecha_marcador_retirada"]+=1
            if re.search(r"Diario Oficial|publicad[ao]|publicaci[oó]n",texto[:25000],re.I): self.stats["fecha_patron_sin_fecha_valida"]+=1
            else: self.stats["fecha_sin_evidencia_en_pagina"]+=1
        if fecha_web:
            campos["fecha_publicacion_web"]=fecha_web.isoformat();self.stats["fecha_web_verificada"]+=1
        diario=self._diario(texto)
        if diario:campos["diario_oficial"]=diario[:120]
        entidad=self._entidad(texto)
        if entidad:campos["entidad_emisora"]=entidad[:200]
        vig=self._vigencia(texto)
        if vig:campos["fecha_entrada_vigencia"]=vig.isoformat()
        anot=self._anotaciones(r.text,texto)
        if anot:campos["anotaciones_vigencia"]=anot[:25]
        retro,anos=self._retroactividad(texto)
        if retro:campos["tiene_efectos_retroactivos"]=True;campos["anos_afectados"]=anos
        zonas=self._zonas(texto)
        if zonas:campos["zonas_afectadas"]=zonas
        plazos=self._plazos(texto)
        if plazos:campos["plazos_mencionados"]=plazos[:12]
        estado,motivo=self._estado(anot)
        if estado:campos["estado_vigencia"]=estado;campos["motivo_cambio_estado"]=motivo[:500]
        if self.dry_run:
            log.info("[%d/%d] %s fecha_documento=%s fecha_web=%s DO=%s",i,total,numero,fecha_documento or "NO VERIFICADA",fecha_web or "NO VERIFICADA","si" if diario else "-");return
        try:
            self.db.table("documentos_tributarios").update(campos).eq("id",doc["id"]).execute();self.stats["actualizados"]+=1;self._alertas(doc,campos,retro,zonas)
        except Exception as e:self.stats["error_guardado"]+=1;log.error("[%d/%d] %s ERROR_GUARDADO: %s",i,total,numero,str(e)[:180]);return
        log.info("[%d/%d] %s fecha_documento=%s fecha_web=%s",i,total,numero,fecha_documento or "NO VERIFICADA",fecha_web or "NO VERIFICADA")

    def _fecha_documento(self,texto,numero):
        """Lee la fecha propia del acto del encabezado, separada de su publicación web."""
        anio=re.search(r"-((?:19|20)\d{2})$",str(numero or ""))
        year=anio.group(1) if anio else None
        cab=texto[:2500]
        encabezado=re.search(r"(?im)^\s*(?:CONCEPTO(?:\s+TRIBUTARIO)?|OFICIO|RESOLUCI[OÓ]N|DECRETO)\s*(?:N[oO]\.?)?\s*\d{1,7}\s*(?:DE\s+(?:19|20)\d{2})?",cab)
        if not encabezado:return None
        fragmento=cab[encabezado.end():encabezado.end()+180]
        if not year:
            m=re.search(r"\b(?:19|20)\d{2}\b",cab[encabezado.start():encabezado.end()])
            year=m.group(0) if m else None
        if not year:return None
        mes=r"([A-Za-záéíóúÁÉÍÓÚ]+)"
        patrones=[
            (rf"\(\s*{mes}\s+(\d{{1,2}})(?:\s+de\s+((?:19|20)\d{{2}}))?\s*\)","mes_dia"),
            (rf"\(\s*(\d{{1,2}})\s+(?:de\s+)?{mes}(?:\s+de\s+((?:19|20)\d{{2}}))?\s*\)","dia_mes"),
            (rf"\b(\d{{1,2}})\s+de\s+{mes}\s+de\s+((?:19|20)\d{{2}})\b","dia_mes"),
            (rf"\bde\s+{mes}\s+(\d{{1,2}})\s+de\s+((?:19|20)\d{{2}})\b","mes_dia"),
            (rf"\b{mes}\s+(\d{{1,2}})/(\d{{2}})\b","mes_dia_corto"),
        ]
        for patron,orden in patrones:
            m=re.search(patron,fragmento,re.I)
            if not m:continue
            dia,mes_txt=(m.group(1),m.group(2)) if orden=="dia_mes" else (m.group(2),m.group(1))
            fuente_anio=m.group(3) if m.lastindex and m.lastindex>=3 else None
            if orden=="mes_dia_corto":fuente_anio=year[:2]+fuente_anio
            if fuente_anio and fuente_anio!=year:continue
            fecha=a_fecha(dia,mes_txt,year)
            if fecha:return fecha
        return None

    def _fecha_publicacion(self,texto):
        patrones=[r"Diario Oficial[^\n]{0,160}?de\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"Diario Oficial[^\n]{0,160}?del\s+(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"publicad[ao][^\n]{0,180}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",r"publicaci[oó]n[^\n]{0,180}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})"]
        for patron in patrones:
            m=re.search(patron,texto[:25000],re.I)
            if m:
                f=a_fecha(m.group(1),m.group(2),m.group(3))
                if f:return f
        return None
    def _diario(self,texto):
        m=re.search(r"Diario Oficial\s*(?:No\.?|N[uú]mero)?\s*([\d.]+)[^\n]{0,100}?((?:19|20)\d{2})",texto[:4000],re.I);return f"No. {m.group(1)} de {m.group(2)}" if m else None
    def _entidad(self,texto):
        m=re.search(r"^\s*((?:MINISTERIO|DIRECCI[OÓ]N|UNIDAD|DEPARTAMENTO|SUPERINTENDENCIA|CONSEJO|CORTE|PRESIDENCIA)[^\n]{4,160})$",texto[:5000],re.M|re.I);return m.group(1).strip() if m else None
    def _vigencia(self,texto):
        m=re.search(r"(?:rige|regir[aá]|entrar[aá] en vigencia|vigencia)[^.\n]{0,140}?(\d{1,2})\s+de\s+([A-Za-záéíóúÁÉÍÓÚ]+)\s+de\s+((?:19|20)\d{2})",texto,re.I);return a_fecha(m.group(1),m.group(2),m.group(3)) if m else None
    def _anotaciones(self,html,texto):
        crudas=re.findall(r"&lt;([^&<>]{12,240}?)&gt;",html)+re.findall(r"<([^<>]{12,240}?)>",html)+re.findall(r"<([^<>]{12,240}?)>",texto);clave=re.compile(r"suspensi|suspend|derogad|modificad|adicionad|inexequib|revocad|sustituid|anulad",re.I);return list(dict.fromkeys(c.strip() for c in crudas if len(c.strip())>=12 and not re.search(r"=[\"']",c) and clave.search(c)))
    def _estado(self,anot):
        t=" | ".join(anot).lower()
        if "inexequib" in t:return "inexequible","Anotación del Normograma: "+anot[0][:200]
        if "suspensi" in t or "suspendid" in t:return "suspendido","Anotación del Normograma: "+next((x for x in anot if re.search(r"suspensi|suspendid",x,re.I)),anot[0])[:200]
        if re.search(r"\bderogad[oa]\b",t):return "derogado","Anotación del Normograma: "+next((x for x in anot if "derogad" in x.lower()),anot[0])[:200]
        return None,None
    def _retroactividad(self,texto):
        m=re.search(r"\bDE\s+((?:19|20)\d{2})\b",texto[:800],re.I);anio=int(m.group(1)) if m else None;anos=sorted({int(x) for x in re.findall(r"(?:año|a[ñn]os|per[ií]odos? gravables?)\s+((?:19|20)\d{2})",texto,re.I)});anteriores=[x for x in anos if anio and x<anio];return bool(anteriores or re.search(r"retroactiv|efectos? hacia atr[aá]s",texto,re.I)),anteriores[:8]
    def _zonas(self,texto):
        ventana=texto[:15000];halladas=[d for d in DEPARTAMENTOS if re.search(rf"\b{re.escape(d)}\b",ventana,re.I)];return halladas[:15] if len(halladas)>=2 and re.search(r"emergencia|calamidad|desastre|afectad|damnificad|zona",ventana,re.I) else []
    def _plazos(self,texto):
        # La misma regla conservadora que usa el agente al reparar: nunca
        # reintroducir un fragmento que luego marque el inspector.
        return complete_deadlines(texto)
    def _alertas(self,doc,campos,retro,zonas):
        alertas=[];estado=campos.get("estado_vigencia")
        if estado in ("suspendido","inexequible"):alertas.append(("critica","doctrina_revocada",campos.get("motivo_cambio_estado",estado)))
        if retro:alertas.append(("alta","efecto_retroactivo",f"Menciona años anteriores: {', '.join(map(str,campos.get('anos_afectados',[])))}"))
        if zonas:alertas.append(("alta","desastre_natural",f"Medida territorial. Zonas: {', '.join(zonas[:6])}"))
        for nivel,tipo,desc in alertas:
            try:self.db.table("alertas_urgentes").upsert({"documento_id":doc["id"],"nivel_urgencia":nivel,"tipo_alerta":tipo,"descripcion":desc[:1000],"zonas_afectadas":zonas[:15],"aprobada_por_humano":False,"enviada":False},on_conflict="documento_id,tipo_alerta").execute()
            except Exception as e:log.debug("alerta no creada: %s",str(e)[:100])

if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--limite",type=int,default=250);ap.add_argument("--anio",type=int,default=None);ap.add_argument("--dry-run",action="store_true");a=ap.parse_args();EnriquecedorFechasV2(a.limite,a.anio,a.dry_run).correr()
