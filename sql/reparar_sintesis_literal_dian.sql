-- Conserva el texto anterior y retira la ficha de publicación mientras el
-- revisor vuelve a contrastar la respuesta literal con el documento DIAN.
create table if not exists public.auditoria_sintesis_literal_dian (
  id bigint generated always as identity primary key,
  documento_id uuid not null,
  resumen_anterior text not null,
  resumen_nuevo text not null,
  fuente_url text not null,
  registrado_en timestamptz not null default now()
);
create index if not exists auditoria_sintesis_literal_dian_documento_idx
  on public.auditoria_sintesis_literal_dian (documento_id, registrado_en desc);
alter table public.auditoria_sintesis_literal_dian enable row level security;
revoke all on public.auditoria_sintesis_literal_dian from public, anon, authenticated;
grant select, insert on public.auditoria_sintesis_literal_dian to service_role;
grant usage, select on sequence public.auditoria_sintesis_literal_dian_id_seq to service_role;

create or replace function public.reparar_sintesis_literal_dian(
  p_documento_id uuid, p_resumen_anterior text, p_fuente_url text
) returns boolean
language plpgsql
security invoker
set search_path = public, pg_temp
as $$
declare
  d public.documentos_tributarios%rowtype;
  nuevo text;
begin
  select * into d from public.documentos_tributarios
  where id = p_documento_id for update;
  if not found or d.anio_publicacion is distinct from 2026
     or coalesce(d.numero_resolucion, '') !~ '^DIAN-OFICIO-[0-9]+-2026$'
     or d.enlace_oficial is distinct from p_fuente_url
     or d.resumen_humano is distinct from p_resumen_anterior
     or coalesce(d.resumen_humano, '') not like '%Doctrina DIAN: orienta, no obliga%'
     or coalesce(d.problema_juridico, '') not like '¿%'
     or coalesce(d.tesis_respuesta, '') not in ('si', 'no')
     or coalesce(length(d.tesis_juridica), 0) not between 80 and 900 then
    return false;
  end if;
  nuevo := 'La DIAN responde: ' || btrim(d.tesis_juridica);
  insert into public.auditoria_sintesis_literal_dian
    (documento_id, resumen_anterior, resumen_nuevo, fuente_url)
  values (d.id, d.resumen_humano, nuevo, d.enlace_oficial);
  update public.documentos_tributarios set
    resumen_humano = nuevo,
    resumen_borrador = nuevo,
    borrador_modelo = 'cita_tesis_dian_v1',
    aprobado_para_email = false,
    publicado_cliente = false,
    revisado_fiscal_en = null
  where id = d.id;
  return true;
end;
$$;
revoke all on function public.reparar_sintesis_literal_dian(uuid,text,text)
  from public, anon, authenticated;
grant execute on function public.reparar_sintesis_literal_dian(uuid,text,text)
  to service_role;
