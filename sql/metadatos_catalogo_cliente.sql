-- Año de referencia: publicación conocida; en su ausencia, año del acto.
-- Solo devuelve metadatos de fichas visibles al suscriptor.
create or replace function public.metadatos_catalogo_cliente(p_periodo text default 'todo')
returns jsonb
language sql stable security definer
set search_path = public
as $$
  with documentos as (
    select temas, updated_at, coalesce(anio_publicacion, anio) as anio_referencia
    from public.documentos_tributarios
    where publicado_cliente is true
  ),
  temas_periodo as (
    select distinct unnest(temas) as tema
    from documentos
    where case
      when p_periodo = 'todo' then true
      when p_periodo = 'recientes' then anio_referencia >= 2024
      when p_periodo = 'decada' then anio_referencia >= 2016
      when p_periodo ~ '^[0-9]{4}$' then anio_referencia = p_periodo::integer
      else false
    end
  ),
  anios as (
    select anio_referencia as anio, count(*) as total
    from documentos
    where anio_referencia between 1950 and extract(year from current_date)::integer + 1
    group by anio_referencia
  )
  select jsonb_build_object(
    'temas', coalesce((select jsonb_agg(tema order by tema) from temas_periodo
      where tema not like 'dian:%' and tema <> 'boletin_mensual'), '[]'::jsonb),
    'anios', coalesce((select jsonb_agg(jsonb_build_object('anio', anio, 'total', total)
      order by anio desc) from anios), '[]'::jsonb),
    'actualizado', (select max(updated_at) from documentos)
  );
$$;

revoke all on function public.metadatos_catalogo_cliente(text) from public, anon, authenticated;
grant execute on function public.metadatos_catalogo_cliente(text) to service_role;
