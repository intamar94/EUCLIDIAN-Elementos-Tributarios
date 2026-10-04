-- Aplicado como migración `inspector_euclidian` en Supabase.
-- Acceso exclusivo desde el servidor con service_role; nunca desde el navegador.
create table if not exists public.inspector_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  estado text not null check (estado in ('en_curso','correcto','alerta','fallo')),
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  total integer not null default 0,
  revisados integer not null default 0,
  correctos integer not null default 0,
  avisos integer not null default 0,
  criticos integer not null default 0,
  motivos jsonb not null default '{}'::jsonb,
  casos jsonb not null default '[]'::jsonb,
  enlaces jsonb not null default '{}'::jsonb,
  error text
);

create table if not exists public.inspector_resultados (
  documento_id uuid not null references public.documentos_tributarios(id) on delete cascade,
  ejecucion_id uuid not null references public.inspector_ejecuciones(id) on delete cascade,
  estado text not null check (estado in ('correcto','aviso','critico')),
  hallazgos jsonb not null default '[]'::jsonb,
  verificado_en timestamptz not null default now(),
  primary key (ejecucion_id, documento_id)
);

create index if not exists inspector_resultados_ejecucion_estado_idx
  on public.inspector_resultados (ejecucion_id, estado);
create index if not exists inspector_ejecuciones_inicio_idx
  on public.inspector_ejecuciones (iniciado_en desc);

alter table public.inspector_ejecuciones enable row level security;
alter table public.inspector_resultados enable row level security;
revoke all on public.inspector_ejecuciones from anon, authenticated;
revoke all on public.inspector_resultados from anon, authenticated;
grant select, insert, update, delete on public.inspector_ejecuciones to service_role;
grant select, insert, update, delete on public.inspector_resultados to service_role;
