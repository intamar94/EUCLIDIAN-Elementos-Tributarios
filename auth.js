/* EUCLIDIAN — sesión de cliente. Sin service keys en navegador. */
const AUTH_KEYS={
  access:'euclidian_access_token',
  refresh:'euclidian_refresh_token',
  expires:'euclidian_expires_at'
};

function authGet(k){try{return localStorage.getItem(k)||'';}catch(_){return '';}}
function authSet(k,v){try{if(v)localStorage.setItem(k,String(v));else localStorage.removeItem(k);}catch(_){}}
let authGeneracion=0,authRefreshPendiente=null;
function authClear(){authGeneracion++;Object.values(AUTH_KEYS).forEach(k=>authSet(k,''));}
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
  if(authRefreshPendiente)return authRefreshPendiente;
  const generacion=authGeneracion;
  authRefreshPendiente=(async()=>{
    const {r,data}=await authPost({action:'refresh',refresh_token:refresh});
    if(generacion!==authGeneracion)return '';
    if(!r.ok||!authGuardar(data)){authClear();return '';}
    return authGet(AUTH_KEYS.access);
  })();
  try{return await authRefreshPendiente;}finally{authRefreshPendiente=null;}
}
function authMostrarPuerta(){
  const puerta=document.getElementById('puerta');if(puerta)puerta.hidden=false;
  ['cab','hoy','controles','barra','cuentaPanel'].forEach(id=>{const el=document.getElementById(id);if(el)el.hidden=true;});
  ['lista','paginas','hoyLista','hoyResumen'].forEach(id=>document.getElementById(id)?.replaceChildren());
  const explorar=document.getElementById('explorar');if(explorar)explorar.hidden=true;
  ['cuentaEmail','cuentaEstado','cuentaPlan','cuentaPeriodo','cuentaUso'].forEach(id=>{const el=document.getElementById(id);if(el)el.textContent='—';});
  ['perfilNombre','perfilCiudad'].forEach(id=>{const el=document.getElementById(id);if(el)el.value='';});
  window.euclidianCerrarInterno?.();
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
  if(!['recovery','signup','invite','magiclink'].includes(hash.get('type'))||!hash.get('access_token'))return false;
  window.euclidianEnRecuperacion=hash.get('type')==='recovery';
  authSet(AUTH_KEYS.access,hash.get('access_token'));
  if(hash.get('refresh_token'))authSet(AUTH_KEYS.refresh,hash.get('refresh_token'));
  authSet(AUTH_KEYS.expires,Math.floor(Date.now()/1000)+Number(hash.get('expires_in')||3600));
  history.replaceState(null,'',location.pathname+location.search);
  if(!window.euclidianEnRecuperacion)return true;
  document.getElementById('authLoginForm').hidden=true;
  document.getElementById('authRegisterForm').hidden=true;
  document.getElementById('authResetForm').hidden=false;
  authMostrarPuerta();authStatus('Enlace verificado. Define tu nueva contraseña.','ok');
  return true;
}
function renderPlanesCuenta(payload,access){
  const oferta=document.getElementById('suscripcionOferta');
  const cont=document.getElementById('planesDisponibles');
  if(!oferta||!cont)return;
  oferta.hidden=!!access?.permitido;
  cont.replaceChildren();
  if(oferta.hidden)return;
  const planes=Array.isArray(payload?.planes)?payload.planes:[];
  for(const plan of planes){
    const art=document.createElement('article');art.className='plan-candidato';
    const top=document.createElement('div');
    const small=document.createElement('small');small.textContent='PLAN';
    const h=document.createElement('h4');h.textContent=String(plan.nombre||plan.codigo||'EUCLIDIAN');
    const p=document.createElement('p');p.textContent=String(plan.descripcion||'Acceso a EUCLIDIAN');
    top.append(small,h,p);
    const meta=document.createElement('div');meta.className='plan-meta';
    const lim=document.createElement('span');lim.textContent=plan.limite_consultas_mensual?Number(plan.limite_consultas_mensual).toLocaleString('es-CO')+' consultas/mes':'Capacidad sin límite configurado';
    const price=document.createElement('strong');
    price.textContent=plan.pricing_publicado&&Number.isFinite(Number(plan.precio_mensual))
      ?new Intl.NumberFormat('es-CO',{style:'currency',currency:plan.moneda||'COP',maximumFractionDigits:0}).format(Number(plan.precio_mensual))+' / mes'
      :'Condiciones de suscripción próximamente';
    meta.append(lim,price);art.append(top,meta);
    if(payload.billing_enabled&&plan.pricing_publicado){
      const boton=document.createElement('button');boton.type='button';boton.textContent='Suscribirme';
      boton.addEventListener('click',()=>authCobro({plan_codigo:plan.codigo},boton));art.append(boton);
    }
    cont.append(art);
  }
  const nota=document.getElementById('suscripcionNota');
  if(nota)nota.textContent=payload?.billing_enabled?'Suscripción mensual con renovación automática. Podrás gestionar la cancelación desde tu cuenta. El acceso se activa al confirmar el pago.':'La contratación en línea aún no está disponible. Te mostraremos las condiciones completas antes de que puedas suscribirte.';
}
async function authCobro(body,boton){
  if(boton)boton.disabled=true;
  try{
    const token=await authToken();if(!token)throw new Error('Vuelve a iniciar sesión.');
    const r=await fetch('/api/checkout',{method:'POST',headers:{Authorization:`Bearer ${token}`,'Content-Type':'application/json'},body:JSON.stringify(body),cache:'no-store'});
    const data=await r.json();
    if(!r.ok)throw new Error(data.error==='checkout_en_preparacion'?'Tu compra se está preparando. Intenta de nuevo en un minuto.':data.error==='pago_pendiente_confirmacion'?'Tu pago está pendiente de confirmación. Actualiza el acceso en unos momentos.':'La gestión de pagos no está disponible en este momento.');
    const destino=new URL(data.url);if(destino.protocol!=='https:'||!['checkout.stripe.com','billing.stripe.com'].includes(destino.hostname))throw new Error('Destino de pago inválido.');
    location.assign(destino.href);
  }catch(err){const nota=document.getElementById('suscripcionNota');if(nota)nota.textContent=err.message;else authStatus(err.message,'error');}
  finally{if(boton)boton.disabled=false;}
}
async function authCuenta(){
  const generacion=authGeneracion;
  const token=await authToken();if(!token){authMostrarPuerta();return null;}
  const headers={Authorization:`Bearer ${token}`};
  const [sessionRes,profileRes,usageRes,plansRes]=await Promise.all([
    fetch('/api/session',{headers,cache:'no-store'}),
    fetch('/api/profile',{headers,cache:'no-store'}),
    fetch('/api/usage',{headers,cache:'no-store'}),
    fetch('/api/plans',{headers,cache:'no-store'})
  ]);
  const data=await sessionRes.json().catch(()=>({}));
  if(generacion!==authGeneracion)return null;
  if(sessionRes.status===401){authClear();authMostrarPuerta();return null;}
  if(!sessionRes.ok)return null;
  const perfil=profileRes.ok?await profileRes.json().catch(()=>({})): {};
  const uso=usageRes.ok?await usageRes.json().catch(()=>({})): {};
  const planes=plansRes.ok?await plansRes.json().catch(()=>({planes:[]})):{planes:[]};
  if(generacion!==authGeneracion)return null;
  const gestionar=document.getElementById('cuentaGestionarPago');if(gestionar)gestionar.hidden=!(planes.billing_enabled&&data.access?.plan_codigo);
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
  renderPlanesCuenta(planes,data.access);
  if(panel){panel.hidden=false;panel.scrollIntoView({behavior:'smooth',block:'start'});}
  return data;
}
window.euclidianAuthToken=authToken;
window.euclidianTieneSesion=()=>!!(authGet(AUTH_KEYS.access)||authGet(AUTH_KEYS.refresh));
window.addEventListener('storage',e=>{
  if((e.key===null||Object.values(AUTH_KEYS).includes(e.key))&&!window.euclidianTieneSesion()){authClear();authMostrarPuerta();authStatus('Sesión cerrada.','ok');}
});
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
  try{const {r}=await authPost({action:'recover',email});if(!r.ok)throw new Error('recuperacion_no_disponible');authStatus('Si existe una cuenta con ese correo, recibirás instrucciones para recuperar el acceso.','ok');}
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
document.getElementById('cuentaGestionarPago')?.addEventListener('click',e=>authCobro({action:'portal'},e.currentTarget));
document.getElementById('cuentaActualizar')?.addEventListener('click',()=>window.cargar?.().catch(()=>{}));
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
