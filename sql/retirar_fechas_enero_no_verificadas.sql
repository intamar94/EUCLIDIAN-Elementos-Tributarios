-- 01-01 se usó como marcador del año, no como fecha probada del acto.
-- Conserva el año para los filtros y registra el valor retirado para auditoría.
with candidatas as (
  select id, fecha_publicacion as fecha_anterior,
         right(numero_resolucion, 4)::integer as anio_identificador
  from public.documentos_tributarios
  where fecha_es_real is not true
    and fecha_publicacion is not null
    and extract(month from fecha_publicacion) = 1
    and extract(day from fecha_publicacion) = 1
    and numero_resolucion ~ '-(19|20)[0-9]{2}$'
    and extract(year from fecha_publicacion)::integer = right(numero_resolucion, 4)::integer
)
update public.documentos_tributarios as d
set fecha_publicacion = null,
    fecha_es_real = false,
    anio_publicacion = coalesce(d.anio_publicacion, c.anio_identificador),
    aprobado_para_email = false,
    notas_verificacion = concat_ws(' | ', nullif(d.notas_verificacion, ''),
      'fecha_marcador_retirada: ' || c.fecha_anterior::text || '; año conservado desde identificador DIAN')
from candidatas as c
where d.id = c.id;
