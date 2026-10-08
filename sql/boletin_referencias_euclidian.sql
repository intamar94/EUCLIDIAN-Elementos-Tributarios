-- Referencias primarias cotejadas dentro de una edición DIAN.
-- Solo el servidor puede leer o escribir: la API expone las referencias de
-- boletines ya publicados y cuyo PDF conserva la misma huella textual.

create table if not exists public.boletin_referencias (
  id bigint generated always as identity primary key,
  boletin_id uuid not null references public.documentos_tributarios(id) on delete cascade,
  pagina integer not null check (pagina between 1 and 1500),
  tipo text not null check (tipo in ('norma','doctrina','jurisprudencia')),
  referencia text not null check (length(trim(referencia)) between 8 and 250),
  url_oficial text not null check (
    url_oficial like 'https://normograma.dian.gov.co/dian/compilacion/docs/%'
    and position('?' in url_oficial) = 0 and position('#' in url_oficial) = 0
  ),
  pdf_hash char(64) not null,
  verificado_en timestamptz not null default now(),
  unique (boletin_id, url_oficial)
);

alter table public.boletin_referencias enable row level security;
revoke all on table public.boletin_referencias from public, anon, authenticated;
grant select, insert, update, delete on table public.boletin_referencias to service_role;
grant usage, select on sequence public.boletin_referencias_id_seq to service_role;
create index if not exists idx_boletin_referencias_edicion
  on public.boletin_referencias(boletin_id, pagina);

comment on table public.boletin_referencias is
  'Actos y doctrina primarios localizados en una pagina de un PDF DIAN; cada enlace se coteja con el texto original.';
