-- Preparación de aportes voluntarios. EJECUCIÓN MANUAL Y REVISION DE PRIVACIDAD PREVIA.
-- No ejecutar en producción sin actualizar el expediente de tratamiento de datos de LEGAL.ia.
create table if not exists public.aportes_usuario (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references auth.users(id) on delete cascade,
  tipo text not null check (tipo in ('error_plataforma','dato_tributario','documento_faltante','sugerencia')),
  referencia text check (char_length(referencia)<=180),
  detalle text not null check (char_length(detalle) between 20 and 3000),
  fecha_colombia date not null,
  consentimiento_en timestamptz not null default now(),
  creado_en timestamptz not null default now(),
  unique (usuario_id,fecha_colombia,tipo)
);
create index if not exists aportes_usuario_creado_idx on public.aportes_usuario (creado_en desc);
alter table public.aportes_usuario enable row level security;
-- Sin permisos ni policies directas de clientes: solo backend con service role.
revoke all on public.aportes_usuario from anon,authenticated;
grant select,insert on public.aportes_usuario to service_role;
comment on table public.aportes_usuario is 'Aportes voluntarios de usuarios autorizados; definir retencion y borrado en privacidad antes de activar.';
