-- Expediente durable por documento y motivo. La inspección periódica aporta
-- observaciones; un cambio aplicado solo se cierra tras la reinspección.
create table if not exists public.control_interno_expedientes (
  id uuid primary key default gen_random_uuid(),
  clave text not null unique,
  documento_id uuid references public.documentos_tributarios(id) on delete set null,
  codigo text not null,
  prioridad text not null check (prioridad in ('alta', 'media')),
  estado text not null check (estado in (
    'abierto', 'en_cuarentena', 'correccion_verificada', 'resuelto_verificado'
  )),
  primera_deteccion timestamptz not null default now(),
  ultima_deteccion timestamptz not null default now(),
  ultimo_control_en timestamptz not null default now(),
  inspeccion_origen uuid not null references public.inspector_ejecuciones(id),
  inspeccion_ultima uuid not null references public.inspector_ejecuciones(id),
  verificacion_id uuid references public.inspector_ejecuciones(id),
  resuelto_en timestamptz,
  intentos integer not null default 0,
  detalle text not null,
  accion_requerida text not null,
  fuente_url text,
  evidencia jsonb not null default '{}'::jsonb
);
create index if not exists control_interno_expedientes_abiertos_idx
  on public.control_interno_expedientes (estado, prioridad, primera_deteccion)
  where estado <> 'resuelto_verificado';
create index if not exists control_interno_expedientes_documento_idx
  on public.control_interno_expedientes (documento_id, estado);
create index if not exists control_interno_expedientes_origen_idx
  on public.control_interno_expedientes (inspeccion_origen);
create index if not exists control_interno_expedientes_ultima_idx
  on public.control_interno_expedientes (inspeccion_ultima);
create index if not exists control_interno_expedientes_verificacion_idx
  on public.control_interno_expedientes (verificacion_id);
alter table public.control_interno_expedientes enable row level security;
revoke all on public.control_interno_expedientes from public, anon, authenticated;
grant select, insert, update on public.control_interno_expedientes to service_role;

alter table public.control_interno_ejecuciones
  add column if not exists en_cuarentena integer not null default 0,
  add column if not exists correcciones_verificadas integer not null default 0;
alter table public.control_interno_casos drop constraint if exists control_interno_casos_estado_check;
alter table public.control_interno_casos add constraint control_interno_casos_estado_check
  check (estado in ('corregido', 'pendiente_evidencia', 'requiere_analisis',
                   'correccion_verificada', 'en_cuarentena', 'resuelto_verificado'));
