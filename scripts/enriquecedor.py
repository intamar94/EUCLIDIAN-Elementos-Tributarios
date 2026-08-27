"""EUCLIDIAN — Enriquecedor robusto y reanudable."""
import argparse, logging, os, re, sys, time
from collections import Counter
from datetime import datetime, timezone
import requests
from alertas import Alertas
from lector_documento import LectorDocumento
from bs4 import BeautifulSoup
try:
    from supabase import create_client
except ImportError:
    print("Falta la libreria: pip install supabase"); sys.exit(1)
logging.basicConfig(level=logging.INFO,format="%(asctime)s  %(levelname)-7s %(message)s",datefmt="%H:%M:%S")
log=logging.getLogger("euclidian")
SUPABASE_URL=os.getenv("SUPABASE_URL"); SUPABASE_KEY=os.getenv("SUPABASE_SERVICE_KEY")
TIMEOUT=30; PAUSA=0.8; RETRY_DIAS=7

class Enriquecedor(LectorDocumento,Alertas):
    def __init__(self,limite=150,anio=None,dry_run=False,minutos=0):
        self.minutos=minutos; self.inicio=time.monotonic(); self.limite=limite; self.anio=anio; self.dry_run=dry_run; self.stats=Counter()
        self.s=requests.Session(); self.s.headers.update({"User-Agent":"Mozilla/5.0 Chrome/122.0 Safari/537.36","Accept-Language":"es-CO,es;q=0.9"})
        if not SUPABASE_URL or not SUPABASE_KEY: log.error("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY"); sys.exit(1)
        self.db=create_client(SUPABASE_URL,SUPABASE_KEY)
    def correr(self):
        pendientes=self._pendientes(); log.info("%d documentos por abrir",len(pendientes))
        for i,doc in enumerate(pendientes,1):
            if self._sin_tiempo(): log.info("Tope de %d minutos alcanzado; siguiente corrida continúa.",self.minutos); break
            time.sleep(PAUSA); self._enriquecer(doc,i,len(pendientes))
        self._resumen(); self._faltantes()
    def _faltantes(self):
        try:
            q=self.db.table("documentos_tributarios").select("id",count="exact").eq("fecha_es_real",False)
            if self.anio:q=q.gte("fecha_publicacion",f"{self.anio}-01-01").lte("fecha_publicacion",f"{self.anio}-12-31")
            r=q.limit(1).execute(); quedan=r.count or 0
        except Exception:return
        log.info("Quedan %d documentos pendientes de fecha real.",quedan)
        if quedan:log.info("A %d/lote son unas %d corridas, antes de descontar reintentos.",self.limite,-(-quedan//max(self.limite,1)))
    def _sin_tiempo(self):return bool(self.minutos and (time.monotonic()-self.inicio)>self.minutos*60)
    def _pendientes(self):
        q=self.db.table("documentos_tributarios").select("id,numero_resolucion,enlace_oficial,tipo_documento,contenido,temas,fecha_publicacion,enriquecido_en").eq("fecha_es_real",False)
        if self.anio:q=q.gte("fecha_publicacion",f"{self.anio}-01-01").lte("fecha_publicacion",f"{self.anio}-12-31")
        try:
            # Prioridad 1: nunca procesados. Prioridad 2: fallidos hace >=7 días.
            r=q.is_("enriquecido_en","null").order("fecha_publicacion",desc=True).limit(self.limite).execute()
            datos=r.data or []
            if len(datos)<self.limite:
                restante=self.limite-len(datos)
                corte=(datetime.now(timezone.utc)-__import__('datetime').timedelta(days=RETRY_DIAS)).isoformat()
                r2=q.not_.is_("enriquecido_en","null").lt("enriquecido_en",corte).order("enriquecido_en",desc=False).limit(restante).execute()
                datos += r2.data or []
            return datos
        except Exception as e:log.error("No se pudo leer la lista: %s",str(e)[:200]);sys.exit(1)
    def _enriquecer(self,doc,i,total):
        try:r=self.s.get(doc["enlace_oficial"],timeout=TIMEOUT);r.encoding=r.apparent_encoding or "utf-8"
        except requests.RequestException as e:self.stats["error_red"]+=1;log.warning("[%d/%d] %s red: %s",i,total,doc["numero_resolucion"],str(e)[:70]);return
        if r.status_code!=200:self.stats["http_error"]+=1;log.warning("[%d/%d] %s HTTP %s",i,total,doc["numero_resolucion"],r.status_code);return
        soup=BeautifulSoup(r.text,"html.parser")
        for basura in soup(["script","style","nav","footer"]):basura.decompose()
        texto=re.sub(r"[ \t]+"," ",soup.get_text("\n"));texto=re.sub(r"\n{3,}","\n\n",texto).strip()
        campos={"texto_completo":texto[:60000],"enriquecido_en":datetime.now(timezone.utc).isoformat()}
        fecha=self._fecha(texto)
        if fecha:campos.update({"fecha_publicacion":fecha.isoformat(),"fecha_es_real":True});self.stats["fecha_hallada"]+=1
        else:self.stats["fecha_no_hallada"]+=1
        diario=self._diario_oficial(texto)
        if diario:campos["diario_oficial"]=diario[:120];self.stats["con_diario_oficial"]+=1
        entidad=self._entidad(texto)
        if entidad:campos["entidad_emisora"]=entidad[:200]
        vig=self._vigencia(texto)
        if vig:campos["fecha_entrada_vigencia"]=vig.isoformat()
        anotaciones=self._anotaciones(r.text,texto)
        if anotaciones:campos["anotaciones_vigencia"]=anotaciones[:25]
        retro,anios=self._retroactividad(texto)
        if retro:campos["tiene_efectos_retroactivos"]=True;campos["anos_afectados"]=anios;self.stats["retroactivos"]+=1
        zonas=self._zonas(texto)
        if zonas:campos["zonas_afectadas"]=zonas;self.stats["con_zonas"]+=1
        plazos=self._plazos(texto)
        if plazos:campos["plazos_mencionados"]=plazos[:12];self.stats["con_plazos"]+=1
        estado,motivo=self._estado(anotaciones)
        if estado:campos["estado_vigencia"]=estado;campos["motivo_cambio_estado"]=motivo[:500];self.stats[f"estado_{estado}"]+=1
        if self.dry_run:return
        try:self.db.table("documentos_tributarios").update(campos).eq("id",doc["id"]).execute();self.stats["actualizados"]+=1
        except Exception as e:self.stats["error_guardado"]+=1;log.error("No se pudo guardar %s: %s",doc["numero_resolucion"],str(e)[:160]);return
        self._alertas(doc,campos,anotaciones,retro,zonas)
    def _resumen(self):
        log.info("RESUMEN");[log.info("  %-24s %s",k,v) for k,v in sorted(self.stats.items())]

if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--limite",type=int,default=150);ap.add_argument("--minutos",type=int,default=0);ap.add_argument("--anio",type=int,default=None);ap.add_argument("--dry-run",action="store_true");a=ap.parse_args();Enriquecedor(limite=a.limite,anio=a.anio,minutos=a.minutos,dry_run=a.dry_run).correr()
