-- La cola entrega solo IDs: ningún texto pesado participa en su respuesta.
create or replace function public.ids_cola_adaptacion_documental(p_limite integer,p_version text)
returns table(documento_id uuid) language sql stable security invoker set search_path=public,pg_temp as $$
 select d.id from public.documentos_tributarios d
 join public.adaptaciones_documentales a on a.documento_id=d.id
 where a.estado='pendiente'
  or (a.estado in ('reintentar','cuarentena','validado','publicado') and a.proximo_intento<=now())
  or (a.estado<>'alias' and a.version is distinct from p_version and a.proximo_intento<=now())
 order by coalesce(d.fecha_publicacion_web,case when d.fecha_es_real then d.fecha_publicacion end,
  make_date(coalesce(d.anio_publicacion,d.anio,1900),1,1)) desc,
  a.ultimo_intento asc nulls first,d.id
 limit greatest(1,least(p_limite,1000));
$$;
revoke all on function public.ids_cola_adaptacion_documental(integer,text) from public,anon,authenticated;
grant execute on function public.ids_cola_adaptacion_documental(integer,text) to service_role;
