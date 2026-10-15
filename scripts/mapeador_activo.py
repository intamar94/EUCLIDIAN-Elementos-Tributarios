"""Mapa persistente de fuentes e ingreso incremental; nunca publica fichas."""
import hashlib
import json
from urllib.parse import urljoin, urlsplit, urlunsplit
from bs4 import BeautifulSoup
from scraper import Scraper, INDICES, BASE
from validar_fuentes_dian import FUENTES_RAIZ
from fuente_documental import descargar, canonica
from boletines_dian import descubrir_publicaciones, registro_publicacion
from adaptador_documental import retry_db, session, now
from identidad_documental import identidad_desde_titulo

class Mapa(Scraper):
    def __init__(self,historico):
        super().__init__(historico=historico,dry_run=True)
        self.s.close();self.s=session();self.por_url={}
    def _extraer_documento(self,*args):
        record=super()._extraer_documento(*args)
        if record:
            record['enlace_oficial']=canonica(record['enlace_oficial'])
            url=record['enlace_oficial'];old=self.por_url.get(url)
            if not old or len(record.get('contenido') or '')>len(old.get('contenido') or ''):self.por_url[url]=record
        return record

def fingerprint(record):
    return hashlib.sha256(json.dumps({k:record.get(k) for k in ('titulo','contenido','temas','enlace_oficial','anio_publicacion')},ensure_ascii=False,sort_keys=True).encode()).hexdigest()

def pages(db,table,fields):
    last=None
    while True:
        q=db.table(table).select(fields).order('id').limit(300)
        if last:q=q.gt('id',last)
        rows=retry_db(q.execute).data or []
        yield from rows
        if len(rows)<300:break
        last=rows[-1]['id']

def indices_desde_raices(linked):
    indices=list(INDICES);known={i for i,_ in indices}
    for url in sorted(linked):
        p=urlsplit(url)
        if p.scheme!='https' or p.hostname!='normograma.dian.gov.co' or not p.path.startswith('/dian/compilacion/'):continue
        name=p.path.rsplit('/',1)[-1].removesuffix('.html')
        if name.startswith('nyb_novedades_') and name!='nyb_novedades_juridicas_portal_web_dian' and name not in known:
            indices.append((name,'boletin'));known.add(name)
    return indices

def run(db,ciclo,historico=False):
    mapper=Mapa(historico);errors=[];roots={};linked=set()
    counts={'nuevos':0,'actualizados':0,'sin_cambio':0,'colisiones':0}
    try:
        for key,url in FUENTES_RAIZ.items():
            try:
                data,final,_=descargar(mapper.s,url)
                html=data.decode('utf-8',errors='replace');roots[key]=html
                if 'compilaci' not in html.lower():raise ValueError('La raíz no se identifica como compilación DIAN')
                for a in BeautifulSoup(html,'html.parser').select('a[href]'):
                    p=urlsplit(urljoin(final,a['href']))
                    linked.add(urlunsplit((p.scheme,p.netloc,p.path,'','')))
            except Exception as exc:errors.append({'fuente':url,'error':str(exc)[:350]})
        indices=indices_desde_raices(linked)
        for indice,categoria in indices:
            # Solo se recorren índices enlazados desde las raíces autorizadas.
            if urljoin(BASE,indice+'.html') not in linked:
                errors.append({'fuente':indice,'error':'Índice no enlazado desde una raíz accesible'});continue
            mapper._procesar_indice(indice,categoria)
        records=list(mapper.por_url.values())
        if 'novedades_boletines' in roots:
            try:
                items,uncovered=descubrir_publicaciones(mapper.s,roots['novedades_boletines'],historico=historico)
                records.extend(registro_publicacion(item) for item in items)
                errors.extend({'fuente':url,'error':'Lista histórica dinámica: cobertura PDF incompleta'} for url in uncovered)
            except Exception as exc:errors.append({'fuente':'boletines','error':str(exc)[:350]})
        for key in ('indices_fallidos','partes_error','partes_404'):
            if mapper.stats[key]:errors.append({'fuente':key,'error':str(mapper.stats[key])})
        existing=list(pages(db,'documentos_tributarios','id,numero_resolucion,enlace_oficial,contenido,titulo,temas,anio_publicacion,publicado_cliente'))
        by_url={}
        for d in sorted(existing,key=lambda r:(r['enlace_oficial']==canonica(r['enlace_oficial']),bool(r.get('publicado_cliente')))):
            by_url[canonica(d['enlace_oficial'])]=d
        by_num={d['numero_resolucion']:d for d in existing}
        registry=[]
        for record in records:
            url=record['enlace_oficial'];old=by_url.get(url);digest=fingerprint(record)
            if not old and record['numero_resolucion'] in by_num:
                # Las URLs con ceros significativos no se fusionan por int().
                import re
                ident=re.search(r'_(\d+)_(\d{4})\.htm$',url)
                if ident:record['numero_resolucion']=f"DIAN-{record['tipo_documento'].upper()}-{ident[1]}-{ident[2]}"
                if record['numero_resolucion'] in by_num:
                    counts['colisiones']+=1;errors.append({'fuente':url,'error':'Identificador ocupado por otra URL: conservar ambas fuentes en el mapa'})
                    # Registrar la colisión para resolverla, nunca sobrescribir.
                    registry.append({'url':url,'numero_resolucion':record['numero_resolucion'],'raiz':FUENTES_RAIZ['tributario'],'indice':record.get('notas_verificacion'),'huella':digest,'registro':record,'visto_en':now(),'ciclo_id':ciclo})
                    continue
            import re
            provenance=re.search(r'raiz: (https://[^ |]+)',str(record.get('notas_verificacion') or ''))
            root=provenance[1] if provenance and provenance[1] in FUENTES_RAIZ.values() else FUENTES_RAIZ['tributario']
            canonical=old['numero_resolucion'] if old else record['numero_resolucion']
            registry.append({'url':url,'numero_resolucion':canonical,'raiz':root,'indice':record.get('notas_verificacion'),'huella':digest,'registro':record,'visto_en':now(),'ciclo_id':ciclo})
            if old:
                # El cuerpo define el título/tipo; el índice solo actualiza su descripción.
                changes={k:record[k] for k in ('contenido','temas') if k in record and record[k]!=old.get(k)}
                if changes:
                    retry_db(lambda:db.table('documentos_tributarios').update(changes).eq('id',old['id']).execute());counts['actualizados']+=1
                else:counts['sin_cambio']+=1
            else:
                record.update(identidad_desde_titulo(record['titulo'],record['numero_resolucion']))
                record.update(estado_vigencia='desconocido',publicado_cliente=False,aprobado_para_email=False)
                result=retry_db(lambda:db.table('documentos_tributarios').insert(record).execute()).data
                counts['nuevos']+=len(result or [])
                if result:by_url[url]=result[0];by_num[canonical]=result[0]
        registry=list({r['url']:r for r in registry}.values())
        for start in range(0,len(registry),100):
            batch=registry[start:start+100]
            retry_db(lambda:db.table('fuentes_dian_mapeadas').upsert(batch,on_conflict='url').execute())
        reopened=retry_db(lambda:db.rpc('reencolar_enlaces_recuperables',{}).execute()).data
        return dict(counts,enlaces_reabiertos=reopened,fuentes=len(records),historico=historico,errores=errors,estado='parcial' if errors else 'completo')
    finally:mapper.s.close()
