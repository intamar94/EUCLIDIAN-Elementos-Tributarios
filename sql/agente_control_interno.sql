-- Agente de integridad documental: bitácora privada de decisiones y correcciones.
-- Aplicar como migración `agente_control_interno`.
create table if not exists public.control_interno_ejecuciones (
  id uuid primary key default gen_random_uuid(),
  inspeccion_id uuid not null references public.inspector_ejecuciones(id),
  verificacion_id uuid references public.inspector_ejecuciones(id),
  estado text not null check (estado in ('en_curso', 'correcto', 'alerta', 'fallo')),
  iniciado_en timestamptz not null default now(),
  finalizado_en timestamptz,
  detectados integer not null default 0,
  corregidos integer not null default 0,
  pendientes_evidencia integer not null default 0,
  requieren_analisis integer not null default 0,
  error text
);

create table if not exists public.control_interno_casos (
  id uuid primary key default gen_random_uuid(),
  ejecucion_id uuid not null references public.control_interno_ejecuciones(id) on delete cascade,
  inspeccion_id uuid not null references public.inspector_ejecuciones(id),
  documento_id uuid references public.documentos_tributarios(id) on delete cascade,
  codigo text not null,
  prioridad text not null check (prioridad in ('alta', 'media')),
  estado text not null check (estado in ('corregido', 'pendiente_evidencia', 'requiere_analisis')),
  detalle text not null,
  evidencia jsonb not null default '{}'::jsonb,
  creado_en timestamptz not null default now(),
  actualizado_en timestamptz not null default now(),
  unique (inspeccion_id, documento_id, codigo)
);

create index if not exists control_interno_ejecuciones_inicio_idx
  on public.control_interno_ejecuciones (iniciado_en desc);
create index if not exists control_interno_casos_ejecucion_estado_idx
  on public.control_interno_casos (ejecucion_id, estado, prioridad);

alter table public.control_interno_ejecuciones enable row level security;
alter table public.control_interno_casos enable row level security;
revoke all on public.control_interno_ejecuciones from anon, authenticated;
revoke all on public.control_interno_casos from anon, authenticated;
grant select, insert, update, delete on public.control_interno_ejecuciones to service_role;
grant select, insert, update, delete on public.control_interno_casos to service_role;
