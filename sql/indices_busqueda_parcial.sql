-- Evita escanear todas las fichas visibles cuando una búsqueda no coincide.
-- Todos los términos del OR deben disponer de índice para usar BitmapOr.
set lock_timeout = '5s';
set statement_timeout = '90s';
create extension if not exists pg_trgm with schema extensions;
create index if not exists idx_doc_numero_busqueda
  on public.documentos_tributarios using gin (numero_resolucion extensions.gin_trgm_ops)
  where publicado_cliente is true;
create index if not exists idx_doc_titulo_busqueda
  on public.documentos_tributarios using gin (titulo extensions.gin_trgm_ops)
  where publicado_cliente is true;
create index if not exists idx_doc_contenido_busqueda
  on public.documentos_tributarios using gin (contenido extensions.gin_trgm_ops)
  where publicado_cliente is true;
create index if not exists idx_doc_descripcion_busqueda
  on public.documentos_tributarios using gin (descripcion_limpia extensions.gin_trgm_ops)
  where publicado_cliente is true;
analyze public.documentos_tributarios;
