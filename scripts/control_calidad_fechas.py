"""Control estricto de integridad de fechas de EUCLIDIAN."""
import os
import sys
from datetime import date, datetime
from urllib.parse import urlparse
from supabase import create_client

HOST="normograma.dian.gov.co"
PREFIX="/dian/compilacion/"

def main():
    url=os.getenv("SUPABASE_URL"); key=os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key: raise SystemExit("Faltan credenciales Supabase")
    db=create_client(url,key)
    graves=[]
    total=db.table("documentos_tributarios").select("id",count="exact").limit(1).execute().count or 0
    pendientes=db.table("documentos_tributarios").select("id",count="exact").eq("fecha_es_real",False).limit(1).execute().count or 0
    if total==0: graves.append("No hay documentos en documentos_tributarios")
    if pendientes: graves.append(f"Quedan {pendientes} documentos con fecha no verificada")

    # Una fecha 1 de enero nunca puede pasar como fecha real: es el valor
    # artificial que queremos eliminar. Se comprueba cada año posible.
    artificial=0
    for anio in range(1950,datetime.now().year+2):
        r=db.table("documentos_tributarios").select("id,numero_resolucion,fecha_es_real").eq("fecha_publicacion",f"{anio}-01-01").limit(1000).execute()
        artificial += len(r.data or [])
    if artificial: graves.append(f"Quedan {artificial} documentos con fecha_publicacion en 1 de enero")

    # Las fichas con fecha verificada deben conservar un enlace oficial DIAN.
    r=db.table("documentos_tributarios").select("id,numero_resolucion,enlace_oficial").eq("fecha_es_real",True).limit(1000).execute()
    no_oficial=[]
    for d in r.data or []:
        p=urlparse(d.get("enlace_oficial") or "")
        if p.netloc != HOST or not p.path.startswith(PREFIX): no_oficial.append(str(d.get("numero_resolucion")))
    if no_oficial: graves.append(f"Hay documentos verificados con URL no oficial: {', '.join(no_oficial[:10])}")

    print(f"DOCUMENTOS={total}")
    print(f"FECHAS_NO_VERIFICADAS={pendientes}")
    print(f"FECHAS_1_ENERO={artificial}")
    print(f"URLS_NO_OFICIALES={len(no_oficial)}")
    if graves:
        for g in graves: print("ERROR:",g)
        return 1
    print("CONTROL_FECHAS=OK")
    return 0

if __name__=="__main__": sys.exit(main())
