/* EUCLIDIAN — sesión de cliente. Sin service keys en navegador. */
const AUTH_KEYS={
  access:'euclidian_access_token',
  refresh:'euclidian_refresh_token',
  expires:'euclidian_expires_at'
};

function authGet(k){try{return localStorage.getItem(k)||'';}catch(_){return '';}}
function authSet(k,v){try{if(v)localStorage.setItem(k,String(v));else localStorage.removeItem(k);}catch(_){}}
function authClear(){Object.values(AUTH_KEYS).forEach(k=>authSet(k,''));}
function authStatus(msg,tipo=''){const el=document.getElementById('mal');if(el){el.textContent=msg||'';el.dataset.tipo=tipo;}}
function authGuardar(data){
  if(!data?.access_token)return false;
  authSet(AUTH_KEYS.access,data.access_token);
  authSet(AUTH_KEYS.refresh,data.refresh_token||authGet(AUTH_KEYS.refresh));
  const exp=data.expires_at||Math.floor(Date.now()/1000)+Number(data.expires_in||3600);
  authSet(AUTH_KEYS.expires,exp);
  return true;
}
async function authPost(body){
  const r=await fetch('/api/auth',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
  const data=await r.json().catch(()=>({error:'respuesta_invalida'}));
  return {r,data};
}
async function authToken(){
  let access=authGet(AUTH_KEYS.access);
  const refresh=authGet(AUTH_KEYS.refresh);
  const expires=Number(authGet(AUTH_KEYS.expires)||0);
  if(access&&expires>Date.now()/1000+90)return access;
  if(!refresh)return access;
  const {r,data}=await authPost({action:'refresh',refresh_token:refresh});
  if(!r.ok||!authGuardar(data)){authClear();return '';}
  return authGet(AUTH_KEYS.access);
}
function authMostrarPuerta(){
  const puerta=document.getElementById('puerta');if(puerta)puerta.hidden=false;
  ['cab','hoy','controles','barra','cuentaPanel'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
}
function authOcultarPuerta(){const p=document.getElementById('puerta');if(p)p.hidden=true;}
function authCambiarTab(registro){
  const login=document.getElementById('authLoginForm'), alta=document.getElementById('authRegisterForm'), reset=document.getElementById('authResetForm');
  if(reset)reset.hidden=true;if(login)login.hidden=registro;if(alta)alta.hidden=!registro;
  const a=document.getElementById('tabEntrar'),b=document.getElementById('tabCrear');
  if(a)a.setAttribute('aria-selected',registro?'false':'true');
  if(b)b.setAttribute('aria-selected',registro?'true':'false');
  authStatus('');
}
function authRecuperacionDesdeHash(){
  const hash=new URLSearchParams(location.hash.replace(/^#/,''));
  window.euclidianEnRecuperacion=false;
  if(hash.get('type')!=='recovery'||!hash.get('access_token'))return false;
  window.euclidianEnRecuperacion=true;
  authSet(AUTH_KEYS.access,hash.get('access_token'));
  if(hash.get('refresh_token'))authSet(AUTH_KEYS.refresh,hash.get('refresh_token'));
  authSet(AUTH_KEYS.expires,Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600));
  history.replaceState(null,'',location.pathname+location.search);
  document.getElementById('authLoginForm').hidden=true;
  document.getElementById('authRegisterForm').hidden=true;
  document.getElementById('authResetForm').hidden=false;
  authMostrarPuerta();authStatus('Enlace verificado. Define tu nueva contraseña.','ok');
  return true;
}
async function authCuenta(){
  const token=await authToken();if(!token){authMostrarPuerta();return null;}
  const headers={Authorization:`Bearer ${token}`};
  const [sessionRes,profileRes,usageRes]=await Promise.all([
    fetch('/api/session',{headers,cache:'no-store'}),
    fetch('/api/profile',{headers,cache:'no-store'}),
    fetch('/api/usage',{headers,cache:'no-store'})
  ]);
  const data=await sessionRes.json().catch(()=>({}));
  if(sessionRes.status===401){authClear();authMostrarPuerta();return null;}
  if(!sessionRes.ok)return null;
  const perfil=profileRes.ok?await profileRes.json().catch(()=>({})): {};
  const uso=usageRes.ok?await usageRes.json().catch(()=>({})): {};
  const panel=document.getElementById('cuentaPanel');
  document.getElementById('cuentaEmail').textContent=data.user?.email||'—';
  document.getElementById('cuentaEstado').textContent=data.access?.permitido?'Activo':String(data.access?.estado||'Pendiente').replaceAll('_',' ');
  document.getElementById('cuentaPlan').textContent=data.access?.plan_codigo||'Sin plan activo';
  const fin=data.access?.periodo_fin?new Date(data.access.periodo_fin):null;
  document.getElementById('cuentaPeriodo').textContent=fin&&!Number.isNaN(fin.getTime())?fin.toLocaleDateString('es-CO'):'—';
  const usoTexto=Number.isFinite(Number(uso.consultas_mes))?Number(uso.consultas_mes).toLocaleString('es-CO'):'—';
  document.getElementById('cuentaUso').textContent=uso.limite_consultas_mensual?usoTexto+' / '+Number(uso.limite_consultas_mensual).toLocaleString('es-CO'):usoTexto;
  const p=perfil.profile||{};
  const nombre=document.getElementById('perfilNombre'),ciudad=document.getElementById('perfilCiudad'),form=document.getElementById('perfilForm');
  if(nombre)nombre.value=p.nombre||'';if(ciudad)ciudad.value=p.ciudad||'';if(form)form.hidden=false;
  if(panel){panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});}
  return data;
}
window.euclidianAuthToken=authToken;
window.euclidianTieneSesion=()=>!!(authGet(AUTH_KEYS.access)||authGet(AUTH_KEYS.refresh));
window.euclidianAuthExpirada=()=>{authClear();authMostrarPuerta();authStatus('Tu sesión terminó. Vuelve a entrar.','aviso');};
window.euclidianMostrarCuenta=authCuenta;
window.euclidianAuthSinSuscripcion=async info=>{
  const data=await authCuenta();
  authOcultarPuerta();
  const estado=document.getElementById('cuentaEstado');
  if(estado&&info?.access?.estado)estado.textContent=String(info.access.estado).replaceAll('_',' ');
  authStatus('');
  return data;
};

document.getElementById('tabEntrar')?.addEventListener('click',()=>authCambiarTab(false));
document.getElementById('tabCrear')?.addEventListener('click',()=>authCambiarTab(true));

document.getElementById('authLoginForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;authStatus('Comprobando tu acceso…');
  try{
    const email=document.getElementById('authEmail').value.trim();
    const password=document.getElementById('authPassword').value;
    const {r,data}=await authPost({action:'signin',email,password});
    if(!r.ok)throw new Error('No pudimos iniciar sesión. Revisa tus datos o confirma tu correo.');
    authGuardar(data);authOcultarPuerta();authStatus('');
    await window.cargar?.();
  }catch(err){authStatus(err.message||'No se pudo iniciar sesión.','error');}
  finally{btn.disabled=false;}
});
document.getElementById('authRegisterForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;authStatus('Creando tu cuenta…');
  try{
    const email=document.getElementById('authRegisterEmail').value.trim();
    const password=document.getElementById('authRegisterPassword').value;
    const {r,data}=await authPost({action:'signup',email,password});
    if(!r.ok)throw new Error(data.message||'No se pudo crear la cuenta.');
    if(data.access_token){
      authGuardar(data);authOcultarPuerta();await window.cargar?.();
    }else{
      authStatus('Cuenta creada. Revisa tu correo y confirma el acceso para continuar.','ok');
    }
  }catch(err){authStatus(err.message||'No se pudo crear la cuenta.','error');}
  finally{btn.disabled=false;}
});
document.getElementById('authRecover')?.addEventListener('click',async()=>{
  const email=document.getElementById('authEmail').value.trim();
  if(!email){authStatus('Escribe primero el correo de tu cuenta.','aviso');return;}
  authStatus('Enviando instrucciones…');
  try{await authPost({action:'recover',email});authStatus('Si existe una cuenta con ese correo, recibirás instrucciones para recuperar el acceso.','ok');}
  catch(_){authStatus('No se pudo solicitar la recuperación en este momento.','error');}
});
document.getElementById('authResetForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.submitter;btn.disabled=true;
  try{
    const access=await authToken(),password=document.getElementById('authResetPassword').value;
    const {r,data}=await authPost({action:'update_password',access_token:access,password});
    if(!r.ok)throw new Error(data.message||'No se pudo actualizar la contraseña.');
    window.euclidianEnRecuperacion=false;authStatus('Contraseña actualizada. Ya puedes usar EUCLIDIAN.','ok');authOcultarPuerta();await window.cargar?.();
  }catch(err){authStatus(err.message||'No se pudo actualizar la contraseña.','error');}
  finally{btn.disabled=false;}
});
document.getElementById('authInternoForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const clave=document.getElementById('clave').value.trim();if(!clave)return;
  try{await window.euclidianEntrarInterno?.(clave);authStatus('');}
  catch(err){authStatus(err.message||'Clave interna incorrecta.','error');}
});
document.getElementById('cuentaSalir')?.addEventListener('click',async()=>{
  const access=authGet(AUTH_KEYS.access);authClear();
  if(access)authPost({action:'logout',access_token:access}).catch(()=>{});
  authMostrarPuerta();authCambiarTab(false);authStatus('Sesión cerrada.','ok');
});
document.getElementById('cuentaRecuperar')?.addEventListener('click',()=>{
  const email=document.getElementById('cuentaEmail')?.textContent||'';
  if(email.includes('@'))document.getElementById('authEmail').value=email;
  authMostrarPuerta();authCambiarTab(false);authStatus('Usa “Olvidé mi contraseña” para recibir un enlace seguro.','aviso');
});
document.getElementById('cerrarCuenta')?.addEventListener('click',()=>{document.getElementById('cuentaPanel').hidden=true;});
authRecuperacionDesdeHash();

document.getElementById('perfilForm')?.addEventListener('submit',async e=>{
  e.preventDefault();const btn=e.submitter,estado=document.getElementById('perfilEstado');
  if(btn)btn.disabled=true;if(estado)estado.textContent='Guardando…';
  try{
    const token=await authToken();if(!token)throw new Error('Sesión expirada.');
    const r=await fetch('/api/profile',{
      method:'PATCH',
      headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},
      body:JSON.stringify({nombre:document.getElementById('perfilNombre').value,ciudad:document.getElementById('perfilCiudad').value})
    });
    const data=await r.json().catch(()=>({}));
    if(!r.ok)throw new Error(data.error||'No se pudo guardar el perfil.');
    if(estado)estado.textContent='Perfil guardado';
    setTimeout(()=>{if(estado)estado.textContent='';},1800);
  }catch(err){if(estado)estado.textContent=err.message||'No se pudo guardar.';}
  finally{if(btn)btn.disabled=false;}
});
