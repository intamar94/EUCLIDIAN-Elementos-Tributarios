"""Captura completa -> adaptación literal -> contraste independiente -> publicación.

No representa una revisión fiscal ni interpreta obligaciones del contribuyente.
Cada documento tiene resultado, evidencia y siguiente acción persistidos.
"""
from __future__ import annotations
import argparse
import hashlib
import os
import sys
import time
from concurrent.futures import ThreadPoolExecutor, wait, FIRST_COMPLETED
from datetime import datetime, timezone
from pathlib import Path

import requests
from bs4 import BeautifulSoup
from requests.adapters import HTTPAdapter
from urllib3.util.retry import Retry
from supabase import create_client

ROOT=Path(__file__).resolve().parents[1]
sys.path.insert(0,str(ROOT/'scripts'))
from fuente_documental import capturar
from extractor_estructura import ExtractorEstructura
from lectores_dian import Lectores
from enriquecedor_fechas_v2 import EnriquecedorFechasV2, DEPARTAMENTOS
from inspector_euclidian import inspect_row, trusted_bulletin
from identidad_documental import identidad_desde_titulo
from verificador_aprobacion import identidad_documental_coincide, norm
from sintesis_literal import extraer_literal, MODELO_LITERAL, comparable
from retroactividad_dian import explicit_retroactivity
from plazos_dian import complete_deadlines

VERSION='5.1'

def now():return datetime.now(timezone.utc).isoformat()

def retry_db(operation):
    for attempt in range(3):
        try:return operation()
        except Exception as exc:
            text=str(exc).lower()
            transient=any(s in text for s in ('504','503','502','429','gateway timeout','timeout','connection reset','server disconnected'))
            if '57014' in text or 'statement timeout' in text:raise
            if not transient or attempt==2:raise
            time.sleep(2**attempt)

def session():
    s=requests.Session()
    s.headers.update({'User-Agent':'EUCLIDIAN-Adaptacion/5.0','Accept-Language':'es-CO,es;q=0.9'})
    s.mount('https://',HTTPAdapter(max_retries=Retry(total=2,connect=2,read=1,status=2,
        backoff_factor=1,status_forcelist=(429,502,503,504),allowed_methods=frozenset(['GET']))))
    return s

def literal(text,value):
    return bool(value) and norm(value) in norm(text)

def paragraph_claim(html,value):
    if not value:return False
    soup=BeautifulSoup(html,'html.parser')
    wanted=norm(value)
    for tag in soup.find_all(['p','td']):
        text=norm(tag.get_text(' ',strip=True))
        if text==wanted:return True
    return False

def adaptar(row,capture):
    """Los campos opcionales no sustentados se retiran, sin bloquear la fuente."""
    import re
    d=dict(row);pending=[];reader=EnriquecedorFechasV2.__new__(EnriquecedorFechasV2)
    d.update(texto_completo=capture.texto,enriquecido_en=now(),enlace_oficial=capture.url)
    if capture.paginas:
        from boletines_dian import pdf_publicacion, indice_publicacion
        notes=str(row.get('notas_verificacion') or '')
        import re
        index=re.search(r'indice: ([^| ]+)',notes)
        if not pdf_publicacion(capture.url) or not index or not indice_publicacion(index[1]) or 'raiz: https://normograma.dian.gov.co/dian/compilacion/novedades_boletines.html' not in notes or capture.estado!='completo':
            raise ValueError('PDF sin trazabilidad o texto completo')
        d['notas_verificacion']=notes.split(' | captura:')[0]+f' | captura: completo; paginas: {capture.paginas}; URL verificada: {capture.url}'
        d.update(hash_contenido=capture.huella,estado_vigencia='desconocido',
            clasificacion_obligatoriedad='orientativo',resumen_borrador=None,
            borrador_modelo=MODELO_LITERAL,plazos_mencionados=[],fuentes_formales=[],
            tesis_juridica=None,problema_juridico=None,tiene_efectos_retroactivos=False,anos_afectados=[])
        d.update(resumen_humano=None,revisado_por_humano=False,fecha_entrada_vigencia=None,fecha_fin_vigencia=None,
            fecha_publicacion=None,fecha_publicacion_web=None,fecha_es_real=False,zonas_afectadas=[],
            doctrina_citada=[],jurisprudencia_citada=[],descriptores=[],tesis_respuesta=None)
        pending.append('La vigencia corresponde a cada acto citado, no al boletín informativo.')
        return d,pending
    if not identidad_documental_coincide(capture.texto,d):raise ValueError('El encabezado no corresponde al número y año de la ficha')
    soup=BeautifulSoup(capture.html,'html.parser')
    if soup.title:
        d.update(identidad_desde_titulo(soup.title.get_text(' ',strip=True),d['numero_resolucion']))
    # El encabezado aporta tipo e identidad; ninguna categoría viene de un
    # nombre de archivo heredado que pudiera estar mal clasificado.
    header=re.search(r'\b(concepto|oficio|resolucion|circular|comunicado|decreto|ley|sentencia)\s+(?:numero\s+|no\.?\s+)?0*(\d+)\s+de\s+(\d{4})',norm(capture.texto)[:2000])
    if header:d['tipo_documento']=header[1]
    d['clasificacion_obligatoriedad']=(
        'obligatorio_dian_y_contribuyentes' if d['tipo_documento'] in ('ley','decreto','resolucion')
        else 'obligatorio_dian_solo' if d['tipo_documento'] in ('concepto','oficio')
        else 'vinculante_jurisprudencia' if d['tipo_documento']=='sentencia' else 'orientativo')
    fields=ExtractorEstructura.extraer(Lectores(),capture.texto) or {}
    for name in ('problema_juridico','tesis_juridica','tesis_respuesta','fuentes_formales','descriptores','banco_datos','area_derecho','numero_interno','dependencia_emisora','doctrina_citada','jurisprudencia_citada'):
        d[name]=fields.get(name,[] if name in ('fuentes_formales','descriptores','doctrina_citada','jurisprudencia_citada') else None)
    for name,value in fields.items():d[name]=value
    d['estructura_extraida_en']=now()
    for name in ('problema_juridico','tesis_juridica'):
        if d.get(name) and not paragraph_claim(capture.html,d[name]):
            pending.append(f'{name}: no se muestra un fragmento recortado o sin párrafo completo.')
            d[name]=None
    if not d.get('tesis_juridica'):d['tesis_respuesta']=None
    for name in ('fuentes_formales','descriptores','doctrina_citada','jurisprudencia_citada'):
        values=d.get(name) or []
        d[name]=[v for v in values if literal(capture.texto,v)]
        if len(values)!=len(d[name]):pending.append(f'{name}: se excluyeron valores no sustentados literalmente.')
    date_doc=reader._fecha_documento(capture.texto,d['numero_resolucion'])
    date_web=reader._fecha_publicacion(capture.texto)
    d.update(fecha_publicacion=date_doc.isoformat() if date_doc else None,
        fecha_es_real=bool(date_doc),fecha_publicacion_web=date_web.isoformat() if date_web else None)
    if not date_doc:pending.append('Fecha exacta del documento no acreditada; se conserva el año identificado.')
    anot=reader._anotaciones(capture.html,capture.texto)
    state,reason=reader._estado(anot)
    # La ausencia de una marca de derogación no prueba que una norma siga vigente.
    d.update(estado_vigencia=state or 'desconocido',motivo_cambio_estado=reason,
        anotaciones_vigencia=anot,fecha_entrada_vigencia=None,fecha_fin_vigencia=None)
    if d['fecha_entrada_vigencia']:d['fecha_entrada_vigencia']=d['fecha_entrada_vigencia'].isoformat()
    if not state:pending.append('Vigencia por confirmar: la fuente no contiene una anotación concluyente.')
    # Retirar síntesis heredadas no literales: no se certifica una paráfrasis
    # mediante coincidencia de palabras. La fuente completa sigue disponible.
    if d.get('resumen_humano') and not literal(capture.texto,d['resumen_humano']):
        d.update(resumen_humano=None,revisado_por_humano=False)
        pending.append('Síntesis heredada retirada: se sustituye por evidencia literal.')
    citation=extraer_literal(capture.html)
    d.update(resumen_borrador=citation,borrador_modelo=MODELO_LITERAL,borrador_generado_en=now())
    if not citation:pending.append('Sin extracto concluyente: se presenta la descripción oficial y el texto completo.')
    description=str(row.get('contenido') or '').strip()
    d['descripcion_limpia']=description or row.get('titulo') or ''
    d['materia']=str(d.get('banco_datos') or d.get('area_derecho') or row.get('materia') or '')[:40] or None
    d['plazos_mencionados']=[v for v in complete_deadlines(capture.texto) if literal(capture.texto,v)]
    retro,years=explicit_retroactivity(capture.texto)
    d.update(tiene_efectos_retroactivos=bool(retro and years),anos_afectados=years if retro and years else [])
    # Una ciudad citada o la sede de firma no acreditan ámbito territorial.
    d['zonas_afectadas']=[]
    return d,pending

def failure(row,error,ciclo):
    message=str(error)[:1200]
    permanent=isinstance(error,requests.HTTPError) and error.response is not None and error.response.status_code in (400,401,403,404,410)
    technical=not permanent and (isinstance(error,requests.RequestException) or any(x in message.lower() for x in ('timeout','connection','tempor','429','502','503','504')))
    return dict(row),{},False,{'identidad_verificada':False,'fuente_estable':False,
        'reintentar':technical,'accion':'reintentar_fuente' if technical else 'recuperar_fuente_o_corregir_identidad',
        'http_status':getattr(getattr(error,'response',None),'status_code',None),'errores':[message],'campos_pendientes':[], 'ciclo_id':ciclo}

def procesar(row,ciclo=None):
    s=session()
    try:
        capture=capturar(s,row['enlace_oficial'])
        d,pending=adaptar(row,capture)
        # Descarga independiente: ni los datos preparados ni un HTML viejo se
        # validan contra sí mismos. Si DIAN cambia durante la lectura, se reintenta.
        contrast=capturar(s,row['enlace_oficial'])
        stable=capture.huella==contrast.huella and capture.url==contrast.url
        if not stable:raise requests.RequestException('La fuente cambió durante el contraste; reintentar con una sola versión')
        issues=inspect_row(d,datetime.now(timezone.utc).date())
        critical=[i['detalle'] for i in issues if i['nivel']=='critico']
        if capture.estado!='completo' or len(capture.texto)<200:critical.append('Captura incompleta o texto documental insuficiente')
        identity=trusted_bulletin(d) if capture.paginas else identidad_documental_coincide(contrast.texto,d)
        evidence={'identidad_verificada':bool(identity),'fuente_estable':stable,'sha256_fuente':capture.huella,
            'url_fuente':capture.url,'caracteres_fuente':len(capture.texto),'captura_completa':capture.estado=='completo',
            'extracto_del_cuerpo':bool(d.get('resumen_borrador')),'campos_pendientes':pending,
            'errores':critical,'codigos_criticos':[i['codigo'] for i in issues if i['nivel']=='critico'],'reintentar':False,'accion':'ninguna' if not critical else 'resolver_contradiccion_de_fuente',
            'version':VERSION,'ciclo_id':ciclo}
        changes={k:v for k,v in d.items() if k in row and v!=row.get(k)}
        return d,changes,bool(identity and stable and capture.estado=='completo' and not critical and len(capture.texto)>=200),evidence
    except Exception as exc:return failure(row,exc,ciclo)
    finally:s.close()

def identificadores_alternos(numero):
    import re
    match=re.fullmatch(r'(DIAN-[A-Z_]+)-(\d+)-(\d{4})',numero)
    if not match:return [numero]
    prefixes=[match[1]]
    if match[1] in ('DIAN-OFICIO','DIAN-CONCEPTO','DIAN-OF'):prefixes=['DIAN-OFICIO','DIAN-CONCEPTO','DIAN-OF']
    if match[1] in ('DIAN-R','DIAN-RES','DIAN-RESOLUCION'):prefixes=['DIAN-RESOLUCION','DIAN-RES','DIAN-R']
    return list(dict.fromkeys([numero]+[f'{p}-{int(match[2])}-{match[3]}' for p in prefixes]))

def guardar(db,row,changes,ok,evidence):
    stamp=row['updated_at']
    if changes:
        response=retry_db(lambda:db.table('documentos_tributarios').update(changes).eq('id',row['id']).eq('updated_at',stamp).execute())
        if not response.data:return {'conflicto':True,'publicado':False}
        stamp=response.data[0]['updated_at']
    return retry_db(lambda:db.rpc('registrar_revision_documental',{
        'p_documento_id':row['id'],'p_actualizado_en':stamp,'p_evaluacion':{
        'resultado':'APPROVE' if ok else 'REVIEW','puntuacion':100 if ok else 0,
        'reglas_pasadas':['IDENTIDAD','FUENTE_COMPLETA','CONTRASTE','INTEGRIDAD'] if ok else [],
        'reglas_fallidas':[] if ok else ['ADAPTACION_PENDIENTE'],
        'motivos':evidence.get('errores',[]),'version_reglas':VERSION,'fuente_verificada':ok,'adaptacion':evidence}}).execute()).data

# El texto anterior no se descarga desde la base: siempre se vuelve a
# capturar de DIAN. Evita serializar megabytes de 1.000 fichas para elegir IDs.
METADATA_FIELDS=','.join(('id','numero_resolucion','tipo_documento','subtipo','fecha_publicacion',
 'fecha_entrada_vigencia','fecha_fin_vigencia','titulo','contenido','resumen_humano','enlace_oficial',
 'clasificacion_obligatoriedad','tiene_efectos_retroactivos','anos_afectados','zonas_afectadas',
 'temas','estado_vigencia','motivo_cambio_estado','hash_contenido','revisado_por_humano',
 'publicado_cliente','notas_verificacion','updated_at','diario_oficial','entidad_emisora',
 'fecha_es_real','enriquecido_en','plazos_mencionados','anotaciones_vigencia','materia',
 'descripcion_limpia','clasificado_en','resumen_borrador','borrador_generado_en','borrador_modelo',
 'tesis_juridica','tesis_respuesta','problema_juridico','fuentes_formales','descriptores',
 'area_derecho','estructura_extraida_en','numero_interno','fecha_publicacion_web','banco_datos',
 'dependencia_emisora','doctrina_citada','jurisprudencia_citada','anio','precision_fecha',
 'anio_publicacion','fuente_verificacion_url','estado_fuente_verificacion','fuente_verificada_en'))

def metadata_chunk(db,ids):
    try:
        return retry_db(lambda:db.table('documentos_tributarios').select(METADATA_FIELDS).in_('id',ids).execute()).data or []
    except Exception as exc:
        if len(ids)>1 and ('57014' in str(exc) or 'statement timeout' in str(exc).lower()):
            middle=len(ids)//2
            return metadata_chunk(db,ids[:middle])+metadata_chunk(db,ids[middle:])
        raise

def metadata_rows(db,ids):
    for start in range(0,len(ids),20):
        chunk=ids[start:start+20]
        rows={r['id']:r for r in metadata_chunk(db,chunk)}
        for id_ in chunk:
            if id_ not in rows:continue # Borrado externo: no fabricar una ficha.
            row=rows[id_]
            row['texto_completo']=None # Se sustituye por la captura íntegra nueva.
            yield row

def run(db,limite=200,workers=4,minutos=20,ciclo=None):
    selected=retry_db(lambda:db.rpc('ids_cola_adaptacion_documental',{'p_limite':limite,'p_version':VERSION}).execute()).data or []
    ids=[r['documento_id'] for r in selected]
    counts={'alias_resueltos':0,'seleccionados':len(ids),'publicados':0,'reintentar':0,'cuarentena':0,'conflictos':0,'errores_tecnicos':0,'procesados':0}
    deadline=time.monotonic()+minutos*60
    iterator=iter(metadata_rows(db,ids))
    with ThreadPoolExecutor(max_workers=workers) as pool:
        futures={}
        def submit():
            if time.monotonic()>=deadline:return False
            row=next(iterator,None)
            if row is None:return False
            futures[pool.submit(procesar,row,ciclo)]=row
            return True
        for _ in range(workers):submit()
        while futures:
            completed,_=wait(futures,timeout=20,return_when=FIRST_COMPLETED)
            for future in completed:
                original=futures.pop(future)
                try:
                    _,changes,ok,evidence=future.result()
                    if not ok and evidence.get('http_status') in (404,410):
                        candidates=retry_db(lambda:db.rpc('alternativas_fuente_documental',{'p_numero':original['numero_resolucion'],'p_url':original['enlace_oficial']}).execute()).data or []
                        for candidate in candidates:
                            if candidate['url']==original['enlace_oficial']:continue
                            alternative=dict(original,enlace_oficial=candidate['url'])
                            _,fixed,valid,proof=procesar(alternative,ciclo)
                            if valid:
                                changes=dict(fixed,enlace_oficial=candidate['url']);ok=True
                                proof.update(enlace_recuperado_desde=original['enlace_oficial'],http_origen=evidence.get('http_status'))
                                evidence=proof;break
                            evidence.setdefault('alternativas_no_validas',[]).append({'url':candidate['url'],'huella_indice':candidate.get('huella'),'motivos':proof.get('errores',[])})
                    if ok and changes.get('enlace_oficial'):
                        canonical=retry_db(lambda:db.table('documentos_tributarios').select('id').eq('enlace_oficial',changes['enlace_oficial']).neq('id',original['id']).limit(1).execute()).data or []
                        if canonical:
                            result=retry_db(lambda:db.rpc('resolver_alias_documental',{'p_alias':original['id'],'p_canonico':canonical[0]['id'],'p_actualizado_en':original['updated_at'],'p_evidencia':evidence}).execute()).data
                            if result.get('resuelto'):
                                counts['alias_resueltos']+=1;counts['procesados']+=1;submit();continue
                            # La otra ficha debe quedar contrastada antes de cerrar
                            # el alias. No publicar dos registros de la misma URL.
                            changes={};ok=False;evidence.update(reintentar=True,accion='esperar_validacion_canonica',errores=['Fuente recuperada; la ficha canónica todavía no tiene la misma validación completa'])
                    result=guardar(db,original,changes,ok,evidence)
                    if result.get('conflicto'):counts['conflictos']+=1
                    elif result.get('publicado'):counts['publicados']+=1
                    elif evidence.get('reintentar'):counts['reintentar']+=1
                    else:counts['cuarentena']+=1
                except Exception as exc:
                    counts['errores_tecnicos']+=1
                    print('ADAPTACION_ERROR',original['numero_resolucion'],str(exc)[:350],flush=True)
                counts['procesados']+=1
                if counts['procesados']%25==0:print('ADAPTACION_PROGRESO',counts,flush=True)
                submit()
    print('ADAPTACION_RESULTADO',counts,flush=True)
    return counts

def main():
    ap=argparse.ArgumentParser();ap.add_argument('--limite',type=int,default=200);ap.add_argument('--workers',type=int,default=4)
    ap.add_argument('--minutos',type=int,default=20);ap.add_argument('--ciclo',default=None);args=ap.parse_args()
    if not 1<=args.limite<=1000 or not 1<=args.workers<=8:raise SystemExit('Lote o concurrencia inválidos')
    db=create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_KEY'])
    result=run(db,args.limite,args.workers,args.minutos,args.ciclo)
    if result['errores_tecnicos']:raise SystemExit(1)

if __name__=='__main__':main()
