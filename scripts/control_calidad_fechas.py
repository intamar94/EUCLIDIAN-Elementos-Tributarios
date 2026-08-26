"""Control estricto de integridad de fechas de EUCLIDIAN."""
import os
import sys
from datetime import datetime
from urllib.parse import urlparse
from supabase import create_client

HOST="normograma.dian.gov.co"
PREFIX="/dian/compilacion/"
PAGE=1000

def main():
    url=os.getenv("SUPABASE_URL"); key=os.getenv("SUPABASE_SERVICE_KEY")
    if not url or not key: raise SystemExit("Faltan credenciales Supabase")
    db=create_client(url,key); graves=[]
    total=db.table("documentos_tributarios").select("id",count="exact").limit(1).execute().count or 0
    pendientes=db.table("documentos_tributarios").select("id",count="exact").eq("fecha_es_real",False).limit(1).execute().count or 0
    if total==0: graves.append("No hay documentos en documentos_tributarios")
    if pendientes: graves.append(f"Quedan {pendientes} documentos con fecha no verificada")

    artificial=0
    for anio in range(1950,datetime.now().year+2):
        r=db.table("documentos_tributarios").select("id").eq("fecha_publicacion",f"{anio}-01-01").limit(PAGE).execute()
        artificial += len(r.data or [])
    if artificial: graves.append(f"Quedan {artificial} documentos con fecha_publicacion en 1 de enero")

    no_oficial=0; verificados=0
    for start in range(0,max(total,1),PAGE):
        r=db.table("documentos_tributarios").select("id,numero_resolucion,enlace_oficial").eq("fecha_es_real",True).range(start,start+PAGE-1).execute()
        rows=r.data or []
        if not rows: break
        verificados += len(rows)
        for d in rows:
            p=urlparse(d.get("enlace_oficial") or "")
            if p.netloc != HOST or not p.path.startswith(PREFIX): no_oficial += 1
    if no_oficial: graves.append(f"Hay {no_oficial} documentos verificados con URL no oficial")

    print(f"DOCUMENTOS={total}")
    print(f"FECHAS_NO_VERIFICADAS={pendientes}")
    print(f"FECHAS_1_ENERO={artificial}")
    print(f"DOCUMENTOS_VERIFICADOS_REVISADOS={verificados}")
    print(f"URLS_NO_OFICIALES={no_oficial}")
    if graves:
        for g in graves: print("ERROR:",g)
        return 1
    print("CONTROL_FECHAS=OK")
    return 0

if __name__=="__main__": sys.exit(main())
