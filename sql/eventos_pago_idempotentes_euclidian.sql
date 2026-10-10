-- EUCLIDIAN — idempotencia de eventos de pago.
-- Aplicada en Supabase como migración eventos_pago_idempotentes_euclidian.
-- El payload completo no se conserva: solo identificadores mínimos y hash.

create table if not exists public.eventos_pago (
  id bigint generated always as identity primary key,
  proveedor text not null,
  evento_id text not null,
  tipo text,
  estado text not null default 'recibido'
    check (estado in ('recibido','procesado','error')),
  user_id uuid references auth.users(id) on delete set null,
  proveedor_suscripcion_id text,
  payload_hash text,
  recibido_en timestamptz not null default now(),
  procesado_en timestamptz,
  error text,
  unique (proveedor, evento_id)
);

alter table public.eventos_pago enable row level security;
revoke all on table public.eventos_pago from anon, authenticated;

create index if not exists idx_eventos_pago_estado_fecha
  on public.eventos_pago(estado, recibido_en desc);
