-- Las evaluaciones del revisor son datos internos. Solo service_role accede.
alter table public.revisor_fiscal_euclidian_reglas enable row level security;
alter table public.revisor_fiscal_euclidian_evaluaciones enable row level security;
revoke all on public.revisor_fiscal_euclidian_reglas from anon, authenticated;
revoke all on public.revisor_fiscal_euclidian_evaluaciones from anon, authenticated;
grant select, insert, update, delete on public.revisor_fiscal_euclidian_reglas to service_role;
grant select, insert, update, delete on public.revisor_fiscal_euclidian_evaluaciones to service_role;
