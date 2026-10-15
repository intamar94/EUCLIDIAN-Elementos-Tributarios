-- Equivalencia solo para buscar candidatos; nunca concede una publicación.
create or replace function public.clave_identidad_documental(p_numero text)
returns text language plpgsql immutable security invoker set search_path=public,pg_temp as $$
declare m text[]; familia text;
begin
 m:=regexp_match(p_numero,'^DIAN-([A-Z_]+)-([0-9]+)-([0-9]{4})$');
 if m is null then return null; end if;
 familia:=case when m[1] in('OFICIO','CONCEPTO','OF') then 'DOCTRINA'
  when m[1] in('RESOLUCION','RES','R') then 'RESOLUCION' else m[1] end;
 return familia||'-'||m[2]::numeric::text||'-'||m[3];
end; $$;
revoke all on function public.clave_identidad_documental(text) from public,anon,authenticated;
grant execute on function public.clave_identidad_documental(text) to service_role;
create index if not exists idx_fuentes_dian_clave on public.fuentes_dian_mapeadas(public.clave_identidad_documental(numero_resolucion));
create or replace function public.reencolar_enlaces_recuperables()
returns integer language plpgsql security invoker set search_path=public,pg_temp as $$
declare total integer;
begin
 update public.adaptaciones_documentales a set estado='pendiente',proximo_intento=now(),accion='contrastar_alternativa_en_mapa'
 from public.documentos_tributarios d
 where a.documento_id=d.id and a.estado='cuarentena'
 and (a.evidencia->>'http_status' in('404','410') or a.motivo like '404 Client Error:%' or a.motivo like '410 Client Error:%')
 and exists(select 1 from public.fuentes_dian_mapeadas m
  where public.clave_identidad_documental(m.numero_resolucion)=public.clave_identidad_documental(d.numero_resolucion)
  and m.url<>d.enlace_oficial
  and not exists(select 1 from jsonb_array_elements(coalesce(a.evidencia->'alternativas_no_validas','[]'::jsonb)) rejected
   where rejected->>'url'=m.url and rejected->>'huella_indice'=m.huella));
 get diagnostics total=row_count;
 return total;
end; $$;
revoke all on function public.reencolar_enlaces_recuperables() from public,anon,authenticated;
grant execute on function public.reencolar_enlaces_recuperables() to service_role;
