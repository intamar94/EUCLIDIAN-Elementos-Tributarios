-- Un alias conserva trazabilidad histórica, pero deja de duplicar el catálogo.
alter table public.adaptaciones_documentales drop constraint if exists adaptaciones_documentales_estado_check;
alter table public.adaptaciones_documentales add constraint adaptaciones_documentales_estado_check
 check(estado in ('pendiente','validado','publicado','reintentar','cuarentena','alias'));
create or replace function public.resolver_alias_documental(p_alias uuid,p_canonico uuid,p_actualizado_en timestamptz,p_evidencia jsonb)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare a public.documentos_tributarios%rowtype; c public.documentos_tributarios%rowtype;
 ia text[]; ic text[];
begin
 if p_alias=p_canonico then raise exception 'Alias igual al canónico'; end if;
 perform id from public.documentos_tributarios where id in(p_alias,p_canonico) order by id for update;
 select * into a from public.documentos_tributarios where id=p_alias;
 select * into c from public.documentos_tributarios where id=p_canonico;
 if a.id is null or c.id is null or a.updated_at is distinct from p_actualizado_en then
  return jsonb_build_object('resuelto',false,'conflicto',true); end if;
 ia:=regexp_match(a.numero_resolucion,'-([0-9]+)-([0-9]{4})$');
 ic:=regexp_match(c.numero_resolucion,'-([0-9]+)-([0-9]{4})$');
 if ia is null or ic is null or ia[1]::numeric<>ic[1]::numeric or ia[2]<>ic[2]
  or p_evidencia->>'identidad_verificada' is distinct from 'true'
  or p_evidencia->>'fuente_estable' is distinct from 'true'
  or p_evidencia->>'captura_completa' is distinct from 'true'
  or p_evidencia->>'url_fuente' is distinct from c.enlace_oficial then raise exception 'Alias sin identidad y fuente completas'; end if;
 if not c.publicado_cliente or not exists(select 1 from public.adaptaciones_documentales v
  where v.documento_id=c.id and v.estado='publicado' and v.version='5.0'
  and v.huella_ficha=public.huella_ficha_documental(c)
  and v.sha256_fuente=p_evidencia->>'sha256_fuente') then
  return jsonb_build_object('resuelto',false,'esperar_canonico',true); end if;
 update public.documentos_tributarios set publicado_cliente=false,aprobado_para_email=false,
  observaciones_revisor='Registro duplicado: consultar ficha canónica '||c.numero_resolucion where id=a.id;
 update public.adaptaciones_documentales set estado='alias',version='5.0',ultimo_intento=now(),intentos=intentos+1,
  accion='consultar_documento_canonico',motivo='Misma identidad y fuente oficial contrastada; duplicado retirado del catálogo',
  evidencia=p_evidencia||jsonb_build_object('documento_canonico',c.id,'numero_canonico',c.numero_resolucion),
  huella_ficha=public.huella_ficha_documental(a),documento_actualizado_en=(select updated_at from public.documentos_tributarios where id=a.id)
 where documento_id=a.id;
 update public.control_interno_expedientes set estado='resuelto_verificado',resuelto_en=now(),ultimo_control_en=now(),
  accion_requerida='Duplicado vinculado a ficha canónica contrastada '||c.numero_resolucion
 where documento_id=a.id and estado<>'resuelto_verificado';
 return jsonb_build_object('resuelto',true,'documento_canonico',c.id);
end; $$;
revoke all on function public.resolver_alias_documental(uuid,uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.resolver_alias_documental(uuid,uuid,timestamptz,jsonb) to service_role;
-- Reabrir los enlaces fallidos para que el nuevo recuperador resuelva alias.
update public.adaptaciones_documentales set estado='pendiente',proximo_intento=now(),accion='recuperar_enlace_desde_mapa'
where estado='cuarentena' and (evidencia->>'http_status' in ('404','410') or motivo like '404 Client Error:%' or motivo like '410 Client Error:%');
