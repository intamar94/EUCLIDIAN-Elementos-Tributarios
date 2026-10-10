-- Solo el servidor puede conceder acceso. Un estado activo por sí solo no basta.
create or replace function public.euclidian_estado_acceso(p_user_id uuid)
returns table(permitido boolean,rol text,estado text,plan_codigo text,cancelar_al_fin boolean,periodo_fin timestamptz)
language sql stable security definer set search_path = '' as $$
select coalesce(r.acceso_total,false) or coalesce(
  a.estado in ('active','trialing') and p.activo is true
  and a.periodo_inicio <= now() and a.periodo_fin > now(),false),
  coalesce(r.rol,'usuario'),coalesce(a.estado,'pendiente'),a.plan_codigo,
  coalesce(a.cancelar_al_fin,false),a.periodo_fin
from (select p_user_id as user_id) u
left join private.roles_usuario r on r.user_id=u.user_id
left join public.accesos_suscripcion a on a.user_id=u.user_id
left join public.planes_suscripcion p on p.codigo=a.plan_codigo;
$$;
revoke all on function public.euclidian_estado_acceso(uuid) from public,anon,authenticated;
grant execute on function public.euclidian_estado_acceso(uuid) to service_role;

alter table public.accesos_suscripcion add column if not exists proveedor_evento_creado bigint;
alter table public.accesos_suscripcion add column if not exists checkout_clave uuid;
alter table public.accesos_suscripcion add column if not exists checkout_session_id text;
alter table public.accesos_suscripcion add column if not exists checkout_bloqueado_hasta timestamptz;

create or replace function public.euclidian_reservar_checkout(p_user_id uuid,p_clave uuid default null,p_reiniciar boolean default false)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.accesos_suscripcion%rowtype;
begin
  select * into a from public.accesos_suscripcion where user_id=p_user_id for update;
  if not found then raise exception 'cuenta_no_creada'; end if;
  if a.proveedor_suscripcion_id is not null and a.estado <> 'canceled' then
    return jsonb_build_object('existente',true);
  end if;
  if a.checkout_bloqueado_hasta > now() and a.checkout_clave is distinct from p_clave then
    return jsonb_build_object('ocupado',true);
  end if;
  if p_reiniciar and a.checkout_clave is distinct from p_clave then raise exception 'reserva_no_coincide'; end if;
  update public.accesos_suscripcion set
    checkout_clave=case when p_reiniciar or checkout_clave is null then gen_random_uuid() else checkout_clave end,
    checkout_session_id=case when p_reiniciar then null else checkout_session_id end,
    checkout_bloqueado_hasta=now()+interval '60 seconds'
  where user_id=p_user_id returning * into a;
  return jsonb_build_object('clave',a.checkout_clave,'session_id',a.checkout_session_id);
end;
$$;
revoke all on function public.euclidian_reservar_checkout(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.euclidian_reservar_checkout(uuid,uuid,boolean) to service_role;

-- Recepción y efecto de negocio en una sola transacción. Los fallos se pueden
-- reintentar: no queda un evento reclamado sin aplicar. No conserva tarjetas.
create or replace function public.euclidian_aplicar_evento_pago(
  p_evento_id text,p_tipo text,p_creado bigint,p_hash text,p_user_id uuid,
  p_customer_id text,p_suscripcion_id text,p_plan text,p_estado text,
  p_inicio timestamptz,p_fin timestamptz,p_cancelar boolean,p_factura text)
returns jsonb language plpgsql security definer set search_path = '' as $$
declare a public.accesos_suscripcion%rowtype; actualizado boolean := false;
begin
  if p_evento_id is null or p_creado is null or p_customer_id is null or p_suscripcion_id is null
    or p_estado not in ('active','trialing','past_due','canceled','unpaid','incomplete') then
    raise exception 'evento_pago_invalido';
  end if;
  select * into a from public.accesos_suscripcion where user_id=p_user_id for update;
  if not found then raise exception 'cuenta_no_encontrada'; end if;
  if a.proveedor_customer_id is distinct from p_customer_id or a.proveedor is distinct from 'stripe' then
    raise exception 'cliente_pago_no_coincide';
  end if;
  if exists(select 1 from public.eventos_pago where proveedor='stripe' and evento_id=p_evento_id and estado='procesado') then
    return jsonb_build_object('duplicado',true,'actualizado',false);
  end if;
  if a.proveedor_suscripcion_id is not null and a.proveedor_suscripcion_id <> p_suscripcion_id
    and a.estado <> 'canceled' then
    if exists(select 1 from public.eventos_pago where proveedor='stripe' and user_id=p_user_id and proveedor_suscripcion_id=p_suscripcion_id and estado='procesado') then
      -- Evento tardío de una suscripción anterior: registrar sin cambiar la actual.
      insert into public.eventos_pago(proveedor,evento_id,tipo,estado,user_id,proveedor_suscripcion_id,payload_hash,procesado_en)
        values('stripe',p_evento_id,p_tipo,'procesado',p_user_id,p_suscripcion_id,p_hash,now())
        on conflict(proveedor,evento_id) do nothing;
      return jsonb_build_object('duplicado',false,'actualizado',false,'anterior',true);
    end if;
    raise exception 'suscripcion_pago_no_coincide';
  end if;
  if not exists(select 1 from public.planes_suscripcion where codigo=p_plan and activo is true) then
    raise exception 'plan_no_disponible';
  end if;
  if p_estado in ('active','trialing') and (p_inicio is null or p_fin is null or p_inicio >= p_fin) then
    raise exception 'periodo_pago_invalido';
  end if;
  if a.proveedor_evento_creado is null or p_creado >= a.proveedor_evento_creado then
    update public.accesos_suscripcion set
      proveedor_suscripcion_id=p_suscripcion_id,plan_codigo=p_plan,estado=p_estado,
      periodo_inicio=p_inicio,periodo_fin=p_fin,cancelar_al_fin=coalesce(p_cancelar,false),
      ultima_factura_estado=p_factura,proveedor_evento_creado=p_creado,updated_at=now()
    where user_id=p_user_id;
    actualizado := true;
  end if;
  insert into public.eventos_pago(proveedor,evento_id,tipo,estado,user_id,proveedor_suscripcion_id,payload_hash,procesado_en)
    values('stripe',p_evento_id,p_tipo,'procesado',p_user_id,p_suscripcion_id,p_hash,now())
    on conflict(proveedor,evento_id) do update set estado='procesado',error=null,procesado_en=now();
  return jsonb_build_object('duplicado',false,'actualizado',actualizado);
end;
$$;
revoke all on function public.euclidian_aplicar_evento_pago(text,text,bigint,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,text) from public,anon,authenticated;
grant execute on function public.euclidian_aplicar_evento_pago(text,text,bigint,text,uuid,text,text,text,text,timestamptz,timestamptz,boolean,text) to service_role;
