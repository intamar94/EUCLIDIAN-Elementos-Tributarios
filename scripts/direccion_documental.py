"""Único ciclo escritor: mapea, adapta y publica con cola, lease y latido."""
import argparse
import json
import os
from pathlib import Path
import subprocess
import sys
import tempfile
import time
from supabase import create_client
from adaptador_documental import VERSION, retry_db, now, run as adaptar
from mapeador_activo import run as mapear

ROOT=Path(__file__).resolve().parents[1]

def client():return create_client(os.environ['SUPABASE_URL'],os.environ['SUPABASE_SERVICE_KEY'])
def rpc(db,name,args=None):return retry_db(lambda:db.rpc(name,args or {}).execute()).data

def stage(db,cycle,name,args,timeout):
    retry_db(lambda:db.table('etapas_documentales').insert({'ciclo_id':cycle,'etapa':name,'estado':'en_curso'}).execute())
    with tempfile.TemporaryDirectory(prefix='euclidian-') as tmp:
        target=Path(tmp)/'resultado.json'
        proc=subprocess.Popen([sys.executable,str(Path(__file__).resolve()),'--etapa',name,'--ciclo',cycle,'--resultado',str(target),*args],cwd=ROOT)
        started=time.monotonic()
        try:
            while proc.poll() is None:
                try:proc.wait(timeout=25)
                except subprocess.TimeoutExpired:pass
                if not rpc(db,'latido_ciclo_documental',{'p_ciclo':cycle}):raise RuntimeError('Se perdió la exclusión del ciclo; detener escritor')
                if time.monotonic()-started>timeout:raise TimeoutError(f'Etapa {name} excedió presupuesto; conserva cola para retomar')
            if proc.returncode:raise RuntimeError(f'Etapa {name} terminó con código {proc.returncode}')
            result=json.loads(target.read_text())
            status=result.get('estado','completo')
            if result.get('errores_tecnicos'):status='parcial'
        except Exception as exc:
            proc.terminate()
            try:proc.wait(timeout=10)
            except subprocess.TimeoutExpired:proc.kill();proc.wait()
            result={'error':str(exc)[:1000]};status='fallo'
    retry_db(lambda:db.table('etapas_documentales').update({'estado':status,'finalizado_en':now(),'resultado':result}).eq('ciclo_id',cycle).eq('etapa',name).execute())
    print('ETAPA',name,status,json.dumps(result,ensure_ascii=False),flush=True)
    return status,result

def run(db,limite=400,workers=4,historico=False):
    ref=os.getenv('GITHUB_SERVER_URL','local')+'/'+os.getenv('GITHUB_REPOSITORY','euclidian')+'/actions/runs/'+os.getenv('GITHUB_RUN_ID','manual')
    opened=rpc(db,'abrir_ciclo_documental',{'p_referencia':ref,'p_version':VERSION})
    if opened.get('ocupado'):print('CICLO_OCUPADO',opened,flush=True);return {'ocupado':True}
    cycle=opened['ciclo_id'];results={};statuses=[]
    try:
        # Compatibilidad de la primera ejecución: reabrir errores 404 previos
        # a la clasificación HTTP para ejecutar el recuperador de alias.
        retry_db(lambda:db.table('adaptaciones_documentales').update({'estado':'pendiente','accion':'recuperar_enlace_desde_mapa','proximo_intento':now()}).eq('estado','cuarentena').is_('evidencia->>http_status','null').like('motivo','404 Client Error:%').execute())
        previous=retry_db(lambda:db.table('etapas_documentales').select('ciclo_id').eq('etapa','mapeo').in_('estado',['completo','parcial']).eq('resultado->>historico','true').limit(1).execute()).data or []
        historico=historico or not previous
        status,result=stage(db,cycle,'mapeo',['--historico'] if historico else [],900)
        statuses.append(status);results['mapeo']=result
        # Una raíz temporalmente caída no paraliza las fuentes ya identificadas.
        if not rpc(db,'latido_ciclo_documental',{'p_ciclo':cycle}):raise RuntimeError('Lease perdido')
        status,result=stage(db,cycle,'adaptacion',['--limite',str(limite),'--workers',str(workers)],1500)
        statuses.append(status);results['adaptacion']=result
        results['cobertura']=rpc(db,'estado_direccion_documental')
        # No anidar recursivamente los resúmenes de ciclos anteriores.
        results['cobertura'].pop('ultimo_ciclo',None)
        state='completo' if all(x=='completo' for x in statuses) else 'fallo' if all(x=='fallo' for x in statuses) else 'parcial'
    except Exception as exc:
        state='fallo';results['error']=str(exc)[:1000]
    finally:
        rpc(db,'cerrar_ciclo_documental',{'p_ciclo':cycle,'p_estado':state,'p_resumen':results})
    print('CICLO_RESULTADO',cycle,state,json.dumps(results,ensure_ascii=False),flush=True)
    if state!='completo':raise RuntimeError(f'Ciclo {state}; consultar etapas persistidas')
    return results

def main():
    p=argparse.ArgumentParser();p.add_argument('--historico',action='store_true');p.add_argument('--limite',type=int,default=400)
    p.add_argument('--workers',type=int,default=4);p.add_argument('--etapa',choices=['mapeo','adaptacion']);p.add_argument('--ciclo');p.add_argument('--resultado')
    args=p.parse_args()
    if not 1<=args.limite<=1000 or not 1<=args.workers<=8:raise SystemExit('Límites inválidos')
    db=client()
    if args.etapa:
        result=mapear(db,args.ciclo,args.historico) if args.etapa=='mapeo' else adaptar(db,args.limite,args.workers,20,args.ciclo)
        Path(args.resultado).write_text(json.dumps(result,ensure_ascii=False))
    else:run(db,args.limite,args.workers,args.historico)
if __name__=='__main__':main()
