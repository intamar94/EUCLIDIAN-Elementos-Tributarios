-- Última defensa: ninguna escritura de un scraper, agente o API puede
-- publicar una ficha crítica, sin inspección, con expediente bloqueante,
-- o cuyos datos jurídicos primarios acaban de cambiar.
create or replace function public.puerta_publicacion_documental()
returns trigger
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  ultima_inspeccion uuid;
  resultado text;
  bloqueado boolean;
  cambio_primario boolean := false;
begin
  if new.publicado_cliente is not true then
    return new;
  end if;

  if tg_op = 'UPDATE' then
    cambio_primario :=
      new.enlace_oficial is distinct from old.enlace_oficial or
      new.fecha_publicacion is distinct from old.fecha_publicacion or
      new.fecha_publicacion_web is distinct from old.fecha_publicacion_web or
      new.fecha_es_real is distinct from old.fecha_es_real or
      new.plazos_mencionados is distinct from old.plazos_mencionados or
      new.fuentes_formales is distinct from old.fuentes_formales or
      new.tiene_efectos_retroactivos is distinct from old.tiene_efectos_retroactivos or
      new.anos_afectados is distinct from old.anos_afectados or
      new.estado_vigencia is distinct from old.estado_vigencia;
  end if;

  select id into ultima_inspeccion
  from public.inspector_ejecuciones
  where estado in ('alerta', 'correcto') and total > 0 and revisados = total
  order by iniciado_en desc limit 1;

  if ultima_inspeccion is not null then
    select estado into resultado
    from public.inspector_resultados
    where ejecucion_id = ultima_inspeccion and documento_id = new.id;
  end if;

  select exists (
    select 1 from public.control_interno_expedientes e
    where e.documento_id = new.id
      and (e.estado = 'en_cuarentena'
        or (e.estado = 'abierto' and e.prioridad = 'alta'))
  ) into bloqueado;

  if cambio_primario or resultado is null or resultado = 'critico' or bloqueado then
    new.publicado_cliente := false;
    new.aprobado_para_email := false;
    new.revisado_fiscal_en := null;
  elsif resultado <> 'correcto' then
    new.aprobado_para_email := false;
  end if;
  return new;
end;
$$;

revoke all on function public.puerta_publicacion_documental() from public, anon, authenticated;
grant execute on function public.puerta_publicacion_documental() to service_role;

drop trigger if exists trg_puerta_publicacion_documental on public.documentos_tributarios;
create trigger trg_puerta_publicacion_documental
before insert or update on public.documentos_tributarios
for each row execute function public.puerta_publicacion_documental();
