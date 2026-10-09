-- La fecha web solo procede del encabezado explícito de publicación DIAN.
-- Algunas fechas heredadas provienen del Diario Oficial o de citas del texto.
-- Se conserva cada valor anterior y se retira la ficha hasta nuevo control.
create table if not exists public.auditoria_fecha_web_sin_fuente (
  documento_id uuid primary key references public.documentos_tributarios(id),
  numero_resolucion text not null,
  fecha_web_anterior date not null,
  publicado_anterior boolean not null,
  enlace_oficial text,
  motivo text not null,
  registrado_en timestamptz not null default now()
);
alter table public.auditoria_fecha_web_sin_fuente enable row level security;
revoke all on public.auditoria_fecha_web_sin_fuente from anon, authenticated;

insert into public.auditoria_fecha_web_sin_fuente
  (documento_id, numero_resolucion, fecha_web_anterior,
   publicado_anterior, enlace_oficial, motivo)
select d.id, d.numero_resolucion, d.fecha_publicacion_web,
       coalesce(d.publicado_cliente, false), d.enlace_oficial,
       'Fecha web sin encabezado explícito en el texto DIAN conservado'
from public.documentos_tributarios d
where d.fecha_publicacion_web is not null
  and coalesce(d.texto_completo, '') !~*
      '(publicad[oa][[:space:]]+en[[:space:]]+la[[:space:]]+p[aá]gina[[:space:]]+(web[[:space:]]+)?(oficial[[:space:]]+)?de[[:space:]]+la[[:space:]]+DIAN|publicaci[oó]n[[:space:]]+en[[:space:]]+la[[:space:]]+DIAN)[[:space:]]*:'
on conflict (documento_id) do nothing;

update public.documentos_tributarios d
set fecha_publicacion_web = null,
    publicado_cliente = false,
    aprobado_para_email = false,
    revisado_fiscal_en = null
from public.auditoria_fecha_web_sin_fuente a
where a.documento_id = d.id
  and d.fecha_publicacion_web = a.fecha_web_anterior;
