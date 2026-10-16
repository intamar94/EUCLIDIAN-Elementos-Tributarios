-- La entrada sin filtros debe recuperar una página sin ordenar todo el histórico.
-- Es la misma expresión de fecha_orden_documental en v_bandeja.
set lock_timeout = '3s';
set statement_timeout = '60s';
create index if not exists idx_doc_orden_cliente
on public.documentos_tributarios (
  (coalesce(fecha_publicacion_web,case when fecha_es_real then fecha_publicacion else null::date end,make_date(coalesce(anio_publicacion,anio,1900),1,1))) desc nulls last,
  numero_resolucion desc
) include (id) where publicado_cliente is true;
-- El selector de años y temas tampoco necesita leer las fichas completas.
create index if not exists idx_doc_metadatos_cliente
on public.documentos_tributarios ((coalesce(anio_publicacion,anio)))
include (temas,updated_at,anio_publicacion,anio) where publicado_cliente is true;
analyze public.documentos_tributarios;
