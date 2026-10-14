-- Dirección única, cola de todo el universo y publicación de una versión validada.
create table if not exists public.ciclos_documentales (
 id uuid primary key default gen_random_uuid(), referencia text not null,
 version text not null, estado text not null default 'en_curso'
 check(estado in ('en_curso','completo','parcial','fallo','interrumpido')),
 iniciado_en timestamptz not null default now(), latido_en timestamptz not null default now(),
 finalizado_en timestamptz, resumen jsonb not null default '{}'::jsonb);
create table if not exists public.direccion_documental (
 id boolean primary key default true check(id), propietario uuid references public.ciclos_documentales(id),
 lease_hasta timestamptz, ultimo_rescate timestamptz);
insert into public.direccion_documental(id) values(true) on conflict do nothing;
create table if not exists public.etapas_documentales (
 ciclo_id uuid references public.ciclos_documentales(id), etapa text,
 estado text not null check(estado in ('en_curso','completo','parcial','fallo','omitido','interrumpido')),
 iniciado_en timestamptz not null default now(), finalizado_en timestamptz,
 resultado jsonb not null default '{}'::jsonb, primary key(ciclo_id,etapa));
create table if not exists public.fuentes_dian_mapeadas (
 url text primary key, numero_resolucion text, raiz text not null,
 indice text, huella text not null, registro jsonb not null,
 visto_en timestamptz not null default now(), ciclo_id uuid references public.ciclos_documentales(id));
create index if not exists idx_fuentes_dian_numero on public.fuentes_dian_mapeadas(numero_resolucion);
create table if not exists public.adaptaciones_documentales (
 documento_id uuid primary key references public.documentos_tributarios(id),
 estado text not null default 'pendiente' check(estado in ('pendiente','validado','publicado','reintentar','cuarentena')),
 version text, huella_ficha text, sha256_fuente text, documento_actualizado_en timestamptz,
 intentos integer not null default 0, ultimo_intento timestamptz,
 proximo_intento timestamptz not null default now(), accion text not null default 'capturar_y_adaptar',
 motivo text, evidencia jsonb not null default '{}'::jsonb,
 ciclo_id uuid references public.ciclos_documentales(id));
create index if not exists idx_adaptaciones_cola on public.adaptaciones_documentales(estado,proximo_intento,ultimo_intento);
create index if not exists idx_ciclos_recientes on public.ciclos_documentales(iniciado_en desc);
insert into public.adaptaciones_documentales(documento_id) select id from public.documentos_tributarios on conflict do nothing;

alter table public.ciclos_documentales enable row level security;
alter table public.direccion_documental enable row level security;
alter table public.etapas_documentales enable row level security;
alter table public.fuentes_dian_mapeadas enable row level security;
alter table public.adaptaciones_documentales enable row level security;
revoke all on public.ciclos_documentales,public.direccion_documental,public.etapas_documentales,
 public.fuentes_dian_mapeadas,public.adaptaciones_documentales from anon,authenticated;
grant all on public.ciclos_documentales,public.direccion_documental,public.etapas_documentales,
 public.fuentes_dian_mapeadas,public.adaptaciones_documentales to service_role;

create or replace function public.huella_ficha_documental(d public.documentos_tributarios)
returns text language sql immutable security invoker set search_path=public,pg_temp as $$
 select md5(jsonb_build_array(d.numero_resolucion,d.titulo,d.tipo_documento,d.enlace_oficial,
 d.texto_completo,d.fecha_publicacion,d.fecha_publicacion_web,d.fecha_es_real,d.estado_vigencia,
 d.fecha_entrada_vigencia,d.fecha_fin_vigencia,d.clasificacion_obligatoriedad,d.resumen_humano,
 d.resumen_borrador,d.descripcion_limpia,d.contenido,d.materia,d.temas,d.fuentes_formales,
 d.tesis_juridica,d.tesis_respuesta,d.problema_juridico,d.plazos_mencionados,d.zonas_afectadas,
 d.descriptores,d.banco_datos,d.area_derecho,d.numero_interno,d.dependencia_emisora,
 d.doctrina_citada,d.jurisprudencia_citada,d.anotaciones_vigencia,d.anio_publicacion,
 d.tiene_efectos_retroactivos,d.anos_afectados)::text);
$$;

create or replace function public.abrir_ciclo_documental(p_referencia text,p_version text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare control public.direccion_documental%rowtype; nuevo uuid;
begin
 select * into control from public.direccion_documental where id for update;
 if control.lease_hasta>now() then return jsonb_build_object('ocupado',true,'ciclo_id',control.propietario); end if;
 if control.propietario is not null then
  update public.ciclos_documentales set estado='interrumpido',finalizado_en=now()
  where id=control.propietario and estado='en_curso';
  update public.etapas_documentales set estado='interrumpido',finalizado_en=now()
  where ciclo_id=control.propietario and estado='en_curso';
 end if;
 insert into public.ciclos_documentales(referencia,version) values(p_referencia,p_version) returning id into nuevo;
 update public.direccion_documental set propietario=nuevo,lease_hasta=now()+interval '10 minutes' where id;
 return jsonb_build_object('ocupado',false,'ciclo_id',nuevo);
end; $$;
create or replace function public.latido_ciclo_documental(p_ciclo uuid)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.direccion_documental set lease_hasta=now()+interval '10 minutes'
 where id and propietario=p_ciclo and lease_hasta>now();
 if not found then return false; end if;
 update public.ciclos_documentales set latido_en=now() where id=p_ciclo and estado='en_curso';
 return found;
end; $$;
create or replace function public.cerrar_ciclo_documental(p_ciclo uuid,p_estado text,p_resumen jsonb)
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if p_estado not in ('completo','parcial','fallo') then raise exception 'Estado inválido'; end if;
 update public.direccion_documental set lease_hasta=null,propietario=null where id and propietario=p_ciclo;
 if not found then return false; end if;
 update public.ciclos_documentales set estado=p_estado,finalizado_en=now(),resumen=p_resumen where id=p_ciclo;
 return true;
end; $$;

create or replace function public.cola_adaptacion_documental(p_limite integer,p_version text)
returns setof public.documentos_tributarios language sql security invoker set search_path=public,pg_temp as $$
 with candidatos as materialized (
 select d.id from public.documentos_tributarios d join public.adaptaciones_documentales a on a.documento_id=d.id
 where (a.estado='pendiente' or (a.estado in ('reintentar','cuarentena','validado','publicado') and a.proximo_intento<=now())
  or (a.version is distinct from p_version and a.proximo_intento<=now())
  or (d.updated_at>a.documento_actualizado_en and public.huella_ficha_documental(d) is distinct from a.huella_ficha))
 order by coalesce(d.fecha_publicacion_web,d.fecha_publicacion,make_date(coalesce(d.anio_publicacion,d.anio,1900),1,1)) desc,
 a.ultimo_intento asc nulls first,d.id limit greatest(1,least(p_limite,1000)))
 select d.* from candidatos c join public.documentos_tributarios d on d.id=c.id;
$$;
create or replace function public.encolar_documento_nuevo()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 insert into public.adaptaciones_documentales(documento_id) values(new.id) on conflict do nothing;
 return new;
end; $$;
drop trigger if exists trg_encolar_documento_nuevo on public.documentos_tributarios;
create trigger trg_encolar_documento_nuevo after insert on public.documentos_tributarios
for each row execute function public.encolar_documento_nuevo();

-- La puerta usa la validación de la versión actual, no espera a un barrido
-- global ni permite que una evaluación antigua publique datos modificados.
create or replace function public.puerta_publicacion_documental()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
declare valido boolean;
begin
 if new.publicado_cliente is not true then return new; end if;
 select exists(select 1 from public.adaptaciones_documentales a where a.documento_id=new.id
  and a.estado in ('validado','publicado') and a.huella_ficha=public.huella_ficha_documental(new)
  and a.evidencia->>'identidad_verificada'='true' and a.evidencia->>'fuente_estable'='true'
  and a.evidencia->>'captura_completa'='true' and length(a.sha256_fuente)=64) into valido;
 if not valido or (new.fecha_publicacion is not null and new.fecha_publicacion_web<new.fecha_publicacion)
  or new.fecha_publicacion>current_date or new.fecha_publicacion_web>current_date
  or exists(select 1 from public.control_interno_expedientes e where e.documento_id=new.id
    and e.estado='en_cuarentena' and e.codigo in ('orden_fechas','identificacion','duplicado')) then
  new.publicado_cliente:=false; new.aprobado_para_email:=false;
 end if;
 return new;
end; $$;

create or replace function public.registrar_revision_documental(p_documento_id uuid,p_actualizado_en timestamptz,p_evaluacion jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare d public.documentos_tributarios%rowtype; informe jsonb; publicado boolean;
 resultado text:=p_evaluacion->>'resultado'; motivos text[]; estado_cola text; intento integer;
begin
 select * into d from public.documentos_tributarios where id=p_documento_id for update;
 if not found or d.updated_at is distinct from p_actualizado_en then
  return jsonb_build_object('conflicto',true,'publicado',false);
 end if;
 -- Clientes antiguos quedan reencolados; no pueden aprobar por el camino retirado.
 if p_evaluacion->>'version_reglas' is distinct from '5.0' then
  update public.adaptaciones_documentales set estado='pendiente',proximo_intento=now() where documento_id=d.id;
  return jsonb_build_object('conflicto',false,'publicado',false,'estado','pendiente');
 end if;
 informe:=coalesce(p_evaluacion->'adaptacion','{}'::jsonb);
 if resultado not in ('APPROVE','REVIEW') or resultado is null then raise exception 'Resultado inválido'; end if;
 if resultado='APPROVE' and (informe->>'identidad_verificada' is distinct from 'true'
  or informe->>'fuente_estable' is distinct from 'true' or length(coalesce(informe->>'sha256_fuente',''))<>64
  or (p_evaluacion->>'fuente_verificada')::boolean is not true
  or coalesce((p_evaluacion->>'puntuacion')::integer,0)<>100
  or informe->>'captura_completa' is distinct from 'true'
  or coalesce((informe->>'caracteres_fuente')::integer,0)<200
  or coalesce(length(d.texto_completo),0)<200
  or informe->>'url_fuente' is distinct from d.enlace_oficial
  or jsonb_array_length(coalesce(p_evaluacion->'reglas_fallidas','[]'::jsonb))<>0) then
  raise exception 'Adaptación sin evidencia suficiente';
 end if;
 motivos:=array(select jsonb_array_elements_text(coalesce(p_evaluacion->'motivos','[]'::jsonb)));
 estado_cola:=case when resultado='APPROVE' then 'validado' when informe->>'reintentar'='true' then 'reintentar' else 'cuarentena' end;
 insert into public.adaptaciones_documentales(documento_id) values(d.id) on conflict do nothing;
 select intentos+1 into intento from public.adaptaciones_documentales where documento_id=d.id;
 update public.adaptaciones_documentales set estado=estado_cola,version='5.0',intentos=intento,ultimo_intento=now(),
  documento_actualizado_en=d.updated_at,huella_ficha=public.huella_ficha_documental(d),
  sha256_fuente=informe->>'sha256_fuente',evidencia=informe,
  accion=coalesce(informe->>'accion','capturar_y_adaptar'),motivo=left(array_to_string(motivos,' | '),3000),
  proximo_intento=case when estado_cola='reintentar' then now()+make_interval(mins=>least(360,15*power(2,least(intento-1,5))::int))
   when estado_cola='cuarentena' then now()+interval '7 days' else now()+interval '7 days' end,
  ciclo_id=nullif(informe->>'ciclo_id','')::uuid where documento_id=d.id;
 if resultado='APPROVE' then
  update public.control_interno_expedientes set estado='resuelto_verificado',resuelto_en=now(),ultimo_control_en=now(),
   accion_requerida='Resuelto por adaptación 5.0 con fuente completa e identidad contrastada'
  where documento_id=d.id and estado<>'resuelto_verificado'
   and codigo in ('orden_fechas','identificacion','fuente','fecha_sin_valor','fecha_imposible','plazo_cortado');
 end if;
 insert into public.revisor_fiscal_euclidian_evaluaciones(documento_id,resultado,puntuacion,reglas_pasadas,reglas_fallidas,motivos,version_reglas,created_at)
 values(d.id,resultado,(p_evaluacion->>'puntuacion')::integer,
  array(select jsonb_array_elements_text(p_evaluacion->'reglas_pasadas')),
  array(select jsonb_array_elements_text(p_evaluacion->'reglas_fallidas')),motivos,'5.0',now())
 on conflict(documento_id) do update set resultado=excluded.resultado,puntuacion=excluded.puntuacion,
 reglas_pasadas=excluded.reglas_pasadas,reglas_fallidas=excluded.reglas_fallidas,motivos=excluded.motivos,version_reglas='5.0',created_at=now();
 update public.documentos_tributarios set publicado_cliente=(resultado='APPROVE'),aprobado_para_email=false,
 revisado_fiscal_en=now(),observaciones_revisor=case when resultado='APPROVE' then null else left(array_to_string(motivos,' | '),4000) end,
 borrador_confianza=case when resultado='APPROVE' then 'pendiente' else 'no_aprobado' end,
 borrador_advertencias=coalesce(array(select jsonb_array_elements_text(informe->'campos_pendientes')),motivos),
 estado_fuente_verificacion=case when resultado='APPROVE' and d.tipo_documento='boletin' then 'pdf_oficial_con_texto'
 when resultado='APPROVE' then 'verificado_oficial' else 'pendiente' end,
 fuente_verificada_en=case when resultado='APPROVE' then now() else null end,fuente_verificacion_url=d.enlace_oficial
 where id=d.id returning publicado_cliente into publicado;
 update public.adaptaciones_documentales set estado=case when publicado then 'publicado' else estado_cola end,
  documento_actualizado_en=(select updated_at from public.documentos_tributarios where id=d.id)
 where documento_id=d.id;
 if resultado='APPROVE' and not publicado then
  update public.adaptaciones_documentales set estado='cuarentena',accion='resolver_bloqueo_publicacion',
   motivo='La puerta rechazó la versión adaptada; conservar aislada y contrastar bloqueo',proximo_intento=now()+interval '1 day'
  where documento_id=d.id;
 end if;
 return jsonb_build_object('conflicto',false,'publicado',publicado,'estado',case when publicado then 'publicado' when resultado='APPROVE' then 'cuarentena' else estado_cola end);
end; $$;

create or replace function public.estado_direccion_documental()
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 select jsonb_build_object('ultimo_ciclo',(select jsonb_build_object('id',id,'estado',estado,'iniciado_en',iniciado_en,
 'latido_en',latido_en,'finalizado_en',finalizado_en,'resumen',resumen) from public.ciclos_documentales order by iniciado_en desc limit 1),
 'universo',(select count(*) from public.documentos_tributarios),'cola',(select coalesce(jsonb_object_agg(estado,total),'{}'::jsonb)
 from(select estado,count(*) total from public.adaptaciones_documentales group by estado)s),
 'activo',exists(select 1 from public.direccion_documental where lease_hasta>now()),
 'etapas',(select coalesce(jsonb_agg(jsonb_build_object('etapa',etapa,'estado',estado,'resultado',resultado)),'[]'::jsonb)
 from public.etapas_documentales where ciclo_id=(select id from public.ciclos_documentales order by iniciado_en desc limit 1)));
$$;
revoke all on function public.huella_ficha_documental(public.documentos_tributarios),
 public.abrir_ciclo_documental(text,text),public.latido_ciclo_documental(uuid),public.cerrar_ciclo_documental(uuid,text,jsonb),
 public.cola_adaptacion_documental(integer,text),public.encolar_documento_nuevo(),public.estado_direccion_documental() from public,anon,authenticated;
grant execute on function public.huella_ficha_documental(public.documentos_tributarios),
 public.abrir_ciclo_documental(text,text),public.latido_ciclo_documental(uuid),public.cerrar_ciclo_documental(uuid,text,jsonb),
 public.cola_adaptacion_documental(integer,text),public.encolar_documento_nuevo(),public.estado_direccion_documental() to service_role;

-- Reserva atómica del rescate: una avería no crea bucles de ejecuciones.
create or replace function public.reservar_rescate_documental()
returns boolean language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 update public.direccion_documental set ultimo_rescate=now()
 where id and (lease_hasta is null or lease_hasta<now())
 and (ultimo_rescate is null or ultimo_rescate<now()-interval '45 minutes')
 and not exists(select 1 from public.ciclos_documentales where latido_en>now()-interval '45 minutes');
 return found;
end; $$;
revoke all on function public.reservar_rescate_documental() from public,anon,authenticated;
grant execute on function public.reservar_rescate_documental() to service_role;
