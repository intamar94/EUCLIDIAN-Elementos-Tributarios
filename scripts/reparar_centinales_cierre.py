"""Reparaciones literales del cierre. No aprueba ni publica documentos."""
import argparse
import hashlib
import re
from pathlib import Path
import requests
from bs4 import BeautifulSoup
from lectores_dian import Lectores
from lector_documento import LectorDocumento
from patrones_dian import limpiar

NOMBRES=('oficio_dian_15659_2026.htm','oficio_dian_15661_2026.htm','decreto_1419_2026.htm')
BASE='https://normograma.dian.gov.co/dian/compilacion/docs/'

def campos(nombre,texto):
    if nombre=='decreto_1419_2026.htm':
        operativo=re.split(r'^Dado en\b|^Publíquese y cúmplase',texto,flags=re.I|re.M)[0]
        return {'zonas_afectadas':LectorDocumento()._zonas(operativo)}
    patch={'fuentes_formales':Lectores()._fuentes(limpiar(texto))}
    if nombre=='oficio_dian_15661_2026.htm':
        # La fuente no utiliza encabezados de tesis. Conserva literalmente la
        # pregunta reformulada (4) y su conclusión numerada (14 a 16).
        pregunta=re.search(r'^4\.\s*(.+?)(?=\n5\.)',texto,re.M|re.S)
        conclusion=re.search(r'^14\.\s*(.+?)(?=\n17\.)',texto,re.M|re.S)
        if not pregunta or not conclusion:raise ValueError('Estructura oficial cambió; revisar antes de escribir.')
        patch['problema_juridico']=re.sub(r'\s+',' ',pregunta.group(1)).strip()
        literal=re.sub(r'\[\d+\]|^1[56]\.\s*','',conclusion.group(1),flags=re.M)
        patch['tesis_juridica']=re.sub(r'\s+',' ',literal).strip()
        if len(patch['problema_juridico'])>1200 or len(patch['tesis_juridica'])>2500:raise ValueError('Texto excede la capacidad; no recortar.')
    return patch

def literal(v):
    return "'"+v.replace("'","''")+"'"

def generar():
    sentencias=[]
    for nombre in NOMBRES:
        r=requests.get(BASE+nombre,timeout=30);r.raise_for_status();r.encoding=r.apparent_encoding
        texto=BeautifulSoup(r.text,'html.parser').get_text('\n',strip=True)
        patch=campos(nombre,texto)
        cambios=[]
        for k,v in patch.items():
            valor='ARRAY['+','.join(literal(x) for x in v)+']::text[]' if isinstance(v,list) else literal(v)
            cambios.append(k+'='+valor)
        nota=f'Revisión literal 2026-10-10 | Fuente: {BASE+nombre} | SHA256 HTML: {hashlib.sha256(r.content).hexdigest()}'
        cambios.extend(["notas_verificacion=coalesce(notas_verificacion,'') || "+literal(' | '+nota),'estructura_extraida_en=now()','updated_at=now()'])
        sentencias.append('update public.documentos_tributarios set '+',\n  '.join(cambios)+'\nwhere enlace_oficial='+literal(BASE+nombre)+';')
    return '-- Extracción literal contrastada con HTML oficial. No concede aprobación ni publicación.\n\nbegin;\n'+ '\n\n'.join(sentencias)+'\ncommit;\n'

if __name__=='__main__':
    ap=argparse.ArgumentParser();ap.add_argument('--sql-file',required=True);args=ap.parse_args()
    Path(args.sql_file).write_text(generar())
    print('SQL generado para tres casos oficiales; revisar y aplicar por el servidor.')
