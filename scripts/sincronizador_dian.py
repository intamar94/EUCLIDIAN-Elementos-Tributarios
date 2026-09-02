"""Sincroniza la sección oficial de Novedades Jurídicas de la DIAN.

La página DIAN es la fuente de descubrimiento de novedades. El Normograma
sigue siendo la fuente oficial que debe verificar el contenido antes de
publicarlo al cliente.
"""
from __future__ import annotations

import os
import re
from datetime import date, datetime, timezone
from urllib.parse import urljoin

import requests
from bs4 import BeautifulSoup
from supabase import create_client

URL = "https://www.dian.gov.co/Contribuyentes-Plus/Paginas/Normatividad.aspx"
NORMOGRAMA = "https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_{numero}_{anio}.htm"
MESES = {"enero":1,"febrero":2,"marzo":3,"abril":4,"mayo":5,"junio":6,"julio":7,"agosto":8,"septiembre":9,"setiembre":9,"octubre":10,"noviembre":11,"diciembre":12}


def parse_fecha(texto: str, anio: int | None) -> str | None:
    m = re.search(r"\b(\d{1,2})[-/]([0-9]{1,2})[-/]((?:19|20)\d{2})\b", texto)
    if m:return date(int(m.group(3)),int(m.group(2)),int(m.group(1))).isoformat()
    m = re.search(r"\b(\d{1,2})\s+de\s+([a-záéíóú]+)\s+de\s+((?:19|20)\d{2})\b", texto, re.I)
    if m and m.group(2).lower() in MESES:return date(int(m.group(3)),MESES[m.group(2).lower()],int(m.group(1))).isoformat()
    m = re.search(r"\b([a-záéíóú]+)\s+(\d{1,2})\b", texto, re.I)
    if m and anio and m.group(1).lower() in MESES:return date(anio,MESES[m.group(1).lower()],int(m.group(2))).isoformat()
    return None


def numero_y_anio(texto: str) -> tuple[str | None,int | None]:
    m = re.search(r"(?:CONCEPTO|OFICIO)\s+(?:A)?(\d{3,6})\s+(?:int\.?\s*\d+\s+)?DE\s+((?:19|20)\d{2})", texto, re.I)
    if not m:return None,None
    return m.group(1),int(m.group(2))


def main() -> int:
    u,k=os.getenv("SUPABASE_URL"),os.getenv("SUPABASE_SERVICE_KEY")
    if not u or not k:raise SystemExit("Faltan SUPABASE_URL o SUPABASE_SERVICE_KEY")
    s=requests.Session();s.headers.update({"User-Agent":"EUCLIDIAN/3.1 (sincronizador DIAN)","Accept-Language":"es-CO,es;q=0.9"})
    r=s.get(URL,timeout=30);r.raise_for_status();soup=BeautifulSoup(r.text,"html.parser")
    db=create_client(u,k); rows=[]
    for tr in soup.find_all("tr"):
        texto=" ".join(tr.stripped_strings)
        numero,anio=numero_y_anio(texto)
        if not numero or not anio:continue
        a=tr.find("a",href=True)
        if not a:continue
        href=urljoin(URL,a["href"])
        if ".pdf" not in href.lower():continue
        celdas=tr.find_all(["th","td"])
        tema=celdas[2].get_text(" ",strip=True) if len(celdas)>2 else ""
        tesis=celdas[3].get_text(" ",strip=True) if len(celdas)>3 else ""
        fecha=parse_fecha(texto,anio)
        rows.append({
            "numero_resolucion":f"DIAN-OFICIO-{numero}-{anio}",
            "tipo_documento":"concepto" if "CONCEPTO" in texto.upper() else "oficio",
            "titulo":a.get_text(" ",strip=True) or f"Documento DIAN {numero} de {anio}",
            "enlace_oficial":NORMOGRAMA.format(numero=numero,anio=anio),
            "fecha_publicacion":fecha,
            "fecha_es_real":bool(fecha),
            "anio":anio,
            "anio_publicacion":anio,
            "descripcion_limpia":tesis[:4000] if tesis else tema[:4000],
            "materia":tema[:250] if tema else None,
            "publicado_cliente":False,
            "revisado_por_humano":False,
            "aprobado_para_email":False,
            "revisado_fiscal_en":None,
        })
    unique={x["numero_resolucion"]:x for x in rows}
    if unique:
        db.table("documentos_tributarios").upsert(list(unique.values()),on_conflict="numero_resolucion").execute()
    print(f"SINCRONIZACION_DIAN_OK: {len(unique)} novedades encontradas")
    return 0

if __name__=="__main__":
    raise SystemExit(main())
