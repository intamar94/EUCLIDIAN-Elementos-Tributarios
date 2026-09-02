"""EUCLIDIAN — verificador de alta confianza, paginado y con evidencia."""
import argparse, logging, os, re, unicodedata
from urllib.parse import urlparse
import requests
from bs4 import BeautifulSoup
from supabase import create_client
from validar_fuentes_dian import FUENTES_RAIZ, TIMEOUT
log = logging.getLogger("euclidian.aprobacion")
logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
DOMINIO="normograma.dian.gov.co"; PREFIJO="/dian/compilacion/"; PAGE=500
MESES={"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}
STOP={"para","como","desde","entre","sobre","esta","este","debe","puede","segun","cuando","donde","hace","solo","tambien","una","uno","los","las","del","por","con","que","sus","documento","normograma"}
def norm(s):
    s=unicodedata.normalize("NFKD",str(s or "")).encode("ascii","ignore").decode().lower();return re.sub(r"\s+"," ",s).strip()
def words(s):return {x for x in re.findall(r"[a-z0-9]{4,}",norm(s)) if x not in STOP}
def date_candidates(value):
    s=str(value or "").strip();out={norm(s)} if s else set();m=re.fullmatch(r"(\d{4})-(\d{2})-(\d{2})",s)
    if m:
        y,mo,d=map(int,m.groups())
        if 1<=mo<=12:
            month=next(k for k,v in MESES.items() if v==mo);out.update({norm(f"{d} de {month} de {y}"),norm(f"{d}/{mo:02d}/{y}"),norm(f"{d:02d}/{mo:02d}/{y}")})
    return out
def evidence(source_text,value):
    if value in (None,"",[]):return False
    src=norm(source_text);candidates=date_candidates(value) or {norm(value)}
    for c in candidates:
        if c and c in src:return True
    compact_src=re.sub(r"[^a-z0-9/]","",src)
    for c in candidates:
        compact=re.sub(r"[^a-z0-9/]","",c)
        if len(compact)>=6 and compact in compact_src:return True
    return False
def load(session,url):
    r=session.get(url,timeout=TIMEOUT,allow_redirects=True);r.raise_for_status();soup=BeautifulSoup(r.text,"html.parser")
    for x in soup(["script","style","nav","footer"]):x.decompose()
    return soup,norm(soup.get_text(" ",strip=True)),r.url
def validate_sources(session):
    for name,url in FUENTES_RAIZ.items():
        _,text,final=load(session,url);p=urlparse(final)
        if p.netloc!=DOMINIO or not p.path.startswith(PREFIJO):raise RuntimeError(f"Fuente raíz fuera del Normograma: {final}")
        if "normograma" not in text and "compilacion juridica dian" not in text:raise RuntimeError(f"La fuente raíz no se identifica como DIAN: {url}")
        log.info("Fuente raíz OK: %s",name)
def extract_claim_tokens(sentence):return words(sentence)
def check_summary(source_text,summary):
    sentences=[x.strip() for x in re.split(r"[.!?;]\s+",str(summary or "")) if len(x.strip())>=20]
    if not sentences:return False,["No hay afirmaciones verificables en el resumen."]
    src_words=words(source_text);src=norm(source_text);errors=[]
    for i,sentence in enumerate(sentences,1):
        ws=extract_claim_tokens(sentence)
        if ws:
            ratio=len(ws&src_words)/len(ws)
            if ratio<0.60:errors.append(f"Afirmación {i}: evidencia textual insuficiente ({ratio:.0%}).")
        for token in re.findall(r"\b\d+(?:[.,]\d+)?%?|\b(?:19|20)\d{2}\b",norm(sentence)):
            if token not in src:errors.append(f"Afirmación {i}: el dato '{token}' no aparece en la fuente.")
    return not errors,errors
def verify(session,doc):
    errors=[];url=str(doc.get("enlace_oficial") or "");p=urlparse(url)
    if p.scheme!="https" or p.netloc!=DOMINIO or not p.path.startswith(PREFIJO):return False,["Enlace fuera de la fuente oficial permitida."]
    try:_,source,final=load(session,url)
    except Exception as exc:return False,[f"No se pudo leer la fuente oficial: {str(exc)[:150]}"]
    fp=urlparse(final)
    if fp.scheme!="https" or fp.netloc!=DOMINIO or not fp.path.startswith(PREFIJO):return False,["La fuente redirige fuera del Normograma DIAN."]
    if "normograma" not in source and "compilacion juridica dian" not in source:errors.append("La página no se identifica como Normograma DIAN.")
    number=norm(doc.get("numero_resolucion"));digits=re.findall(r"\d{3,9}",number)
    if digits and not any(n in source for n in digits):errors.append("El número del documento no aparece en la fuente.")
    webdate=str(doc.get("fecha_publicacion_web") or "")
    docdate=str(doc.get("fecha_publicacion") or "")
    if webdate:
        if not evidence(source,webdate):errors.append("La fecha de publicación web DIAN no aparece en formato demostrable.")
    elif doc.get("fecha_es_real"):
        if not evidence(source,docdate):errors.append("La fecha propia del documento no aparece en formato demostrable.")
    else:errors.append("No hay una fecha oficial verificable del documento.")
    summary=doc.get("resumen_humano") or doc.get("resumen_borrador") or doc.get("descripcion_limpia") or ""
    ok,ev=check_summary(source,summary);errors.extend(ev)
    thesis=str(doc.get("tesis_juridica") or "").strip()
    if thesis and len(thesis)>=25:
        tw=words(thesis)
        if not tw or len(tw&words(source))/len(tw)<0.60:errors.append("La tesis jurídica no tiene suficiente respaldo textual.")
    for label,value in (("entidad emisora",doc.get("entidad_emisora")),("estado de vigencia",doc.get("estado_vigencia"))):
        if value and not evidence(source,value):errors.append(f"El campo {label} no tiene evidencia textual suficiente.")
    return not errors and ok,errors
def iter_docs(db,limit=None):
    offset=0;seen=set()
    while True:
        size=PAGE if limit is None else min(PAGE,max(0,limit-offset))
        if size<=0:return
        rows=(db.table("documentos_tributarios").select("id,numero_resolucion,contenido,descripcion_limpia,resumen_humano,resumen_borrador,enlace_oficial,fecha_publicacion,fecha_publicacion_web,fecha_es_real,tesis_juridica,entidad_emisora,estado_vigencia").not_.is_("resumen_borrador","null").order("id").range(offset,offset+size-1).execute().data or [])
        if not rows:return
        for row in rows:
            if row.get("id") not in seen:seen.add(row.get("id"));yield row
        if len(rows)<size:return
        offset+=len(rows)
def main(apply=False,limit=None):
    u,k=os.getenv("SUPABASE_URL"),os.getenv("SUPABASE_SERVICE_KEY")
    if not u or not k:raise RuntimeError("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    db=create_client(u,k);session=requests.Session();session.headers.update({"User-Agent":"EUCLIDIAN/3.1 (verificador de alta confianza)","Accept-Language":"es-CO,es;q=0.9"});validate_sources(session)
    total=good=bad=0;reasons={}
    for doc in iter_docs(db,limit):
        total+=1;ok,errors=verify(session,doc)
        if ok:
            good+=1
            if apply:db.table("documentos_tributarios").update({"aprobado_para_email":True,"borrador_confianza":"alta","borrador_advertencias":[]}).eq("id",doc["id"]).execute()
        else:
            bad+=1
            for e in errors[:5]:reasons[e]=reasons.get(e,0)+1
            if apply:db.table("documentos_tributarios").update({"aprobado_para_email":False,"borrador_confianza":"no_aprobado","borrador_advertencias":errors[:12]}).eq("id",doc["id"]).execute()
        if total%100==0:log.info("PROGRESO revisados=%d aptos=%d bloqueados=%d",total,good,bad)
    log.info("RESULTADO %s: universo_revisado=%d aptos=%d bloqueados=%d","APLICADO" if apply else "AUDITORIA",total,good,bad)
    if reasons:log.info("PRINCIPALES_MOTIVOS: %s",sorted(reasons.items(),key=lambda x:-x[1])[:10])
    return 0
if __name__=="__main__":
    ap=argparse.ArgumentParser();ap.add_argument("--apply",action="store_true");ap.add_argument("--limite",type=int,default=None);args=ap.parse_args()
    try:raise SystemExit(main(args.apply,args.limite))
    except Exception as exc:log.error("VERIFICADOR BLOQUEADO: %s",exc);raise SystemExit(1)
