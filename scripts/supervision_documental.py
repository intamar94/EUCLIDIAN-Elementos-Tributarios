"""Supervisión que actúa: recupera ciclos interrumpidos sin duplicar escritores."""
import os
import requests
from direccion_documental import client, rpc

def run(db,dispatch):
    state=rpc(db,'estado_direccion_documental')
    if state.get('activo'):return {'estado':'activo','rescate':False}
    if not rpc(db,'reservar_rescate_documental'):return {'estado':'sin_rescate_necesario','rescate':False}
    try:dispatch()
    except Exception:
        rpc(db,'liberar_rescate_documental')
        raise
    return {'estado':'rescate_solicitado','rescate':True}

def dispatch():
    repo=os.environ['GITHUB_REPOSITORY']
    response=requests.post(f'https://api.github.com/repos/{repo}/actions/workflows/ciclo_documental.yml/dispatches',
        headers={'Authorization':'Bearer '+os.environ['GITHUB_TOKEN'],'Accept':'application/vnd.github+json','X-GitHub-Api-Version':'2022-11-28'},
        json={'ref':'main'},timeout=30)
    response.raise_for_status()
if __name__=='__main__':print(run(client(),dispatch),flush=True)
