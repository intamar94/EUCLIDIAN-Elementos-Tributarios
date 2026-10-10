-- EUCLIDIAN — telemetría mínima de uso para capacidad y límites.
-- Aplicada en Supabase como migración medicion_uso_consultas_euclidian.
-- No almacena el texto ni los filtros de la consulta.

create table if not exists public.uso_consultas (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  creado_en timestamptz not null default now(),
  latencia_ms integer check (latencia_ms is null or latencia_ms >= 0),
  resultados integer not null default 0 check (resultados >= 0),
  estado text not null default 'ok' check (estado in ('ok','sin_resultados','error'))
);

alter table public.uso_consultas enable row level security;
revoke all on table public.uso_consultas from anon, authenticated;

create index if not exists idx_uso_consultas_usuario_fecha
  on public.uso_consultas(user_id, creado_en desc);

comment on table public.uso_consultas is
  'Telemetria minima de uso para limites y capacidad. No almacena el texto de las consultas.';
