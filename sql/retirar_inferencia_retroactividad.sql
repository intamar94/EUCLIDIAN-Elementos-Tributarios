-- Las frases generadas a partir de años citados no acreditan retroactividad.
-- Guardamos el texto anterior y retiramos únicamente la fórmula automática.
create table if not exists public.auditoria_retiro_retroactividad (
  documento_id uuid not null,
  numero_resolucion text,
  resumen_humano_anterior text,
  resumen_borrador_anterior text,
  motivo text not null,
  aplicado_en timestamptz not null default now(),
  primary key (documento_id, aplicado_en)
);
alter table public.auditoria_retiro_retroactividad enable row level security;
revoke all on public.auditoria_retiro_retroactividad from anon, authenticated;
grant select, insert on public.auditoria_retiro_retroactividad to service_role;

insert into public.auditoria_retiro_retroactividad
  (documento_id, numero_resolucion, resumen_humano_anterior, resumen_borrador_anterior, motivo)
select id, numero_resolucion, resumen_humano, resumen_borrador,
       'Retiro de frase automática: años citados no prueban efecto retroactivo.'
from public.documentos_tributarios
where resumen_humano ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.'
   or resumen_borrador ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.';

update public.documentos_tributarios
set resumen_humano = case
      when resumen_humano ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.'
      then btrim(regexp_replace(resumen_humano,
        '[[:space:]]*Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.', ' ', 'g'))
      else resumen_humano end,
    resumen_borrador = case
      when resumen_borrador ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.'
      then btrim(regexp_replace(resumen_borrador,
        '[[:space:]]*Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.', ' ', 'g'))
      else resumen_borrador end
where resumen_humano ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.'
   or resumen_borrador ~ 'Menciona años anteriores \([0-9, ]+\): revisa si afecta declaraciones ya presentadas\.';
