-- La cola conserva su prioridad al escribir: seleccionarla no lee 18.000 fichas.
alter table public.adaptaciones_documentales add column if not exists prioridad_fecha date;
update public.adaptaciones_documentales a set prioridad_fecha=coalesce(d.fecha_publicacion_web,
 case when d.fecha_es_real then d.fecha_publicacion end,
 make_date(coalesce(d.anio_publicacion,d.anio,1900),1,1))
from public.documentos_tributarios d where d.id=a.documento_id and a.prioridad_fecha is null;
create index if not exists idx_adaptaciones_prioridad on public.adaptaciones_documentales
 (prioridad_fecha desc,ultimo_intento asc nulls first,documento_id);
create or replace function public.encolar_documento_nuevo()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 insert into public.adaptaciones_documentales(documento_id,prioridad_fecha)
 values(new.id,coalesce(new.fecha_publicacion_web,case when new.fecha_es_real then new.fecha_publicacion end,
 make_date(coalesce(new.anio_publicacion,new.anio,1900),1,1))) on conflict do nothing;
 return new;
end; $$;
create or replace function public.encolar_documento_cambiado()
returns trigger language plpgsql security invoker set search_path=public,pg_temp as $$
begin
 if public.huella_ficha_documental(old) is distinct from public.huella_ficha_documental(new) then
  insert into public.adaptaciones_documentales(documento_id,prioridad_fecha)
  values(new.id,coalesce(new.fecha_publicacion_web,case when new.fecha_es_real then new.fecha_publicacion end,
    make_date(coalesce(new.anio_publicacion,new.anio,1900),1,1)))
  on conflict(documento_id) do update set estado='pendiente',proximo_intento=now(),accion='adaptar_version_modificada',
   prioridad_fecha=excluded.prioridad_fecha;
 end if;
 return new;
end; $$;
create or replace function public.ids_cola_adaptacion_documental(p_limite integer,p_version text)
returns table(documento_id uuid) language sql stable security invoker set search_path=public,pg_temp as $$
 select a.documento_id from public.adaptaciones_documentales a
 where a.estado='pendiente'
  or (a.estado in ('reintentar','cuarentena','validado','publicado') and a.proximo_intento<=now())
  or (a.estado<>'alias' and a.version is distinct from p_version and a.proximo_intento<=now())
 order by a.prioridad_fecha desc,a.ultimo_intento asc nulls first,a.documento_id
 limit greatest(1,least(p_limite,1000));
$$;
