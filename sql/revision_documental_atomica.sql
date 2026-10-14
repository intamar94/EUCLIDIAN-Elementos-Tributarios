-- Una revisión solo puede publicar la versión exacta contrastada con DIAN.
create or replace function public.reencolar_documento_modificado()
returns trigger language plpgsql security invoker
set search_path = public, pg_temp as $$
begin
  if row(new.enlace_oficial,new.texto_completo,new.fecha_publicacion,new.fecha_publicacion_web,new.fecha_es_real,new.fecha_entrada_vigencia,new.fecha_fin_vigencia,new.plazos_mencionados,new.fuentes_formales,new.tiene_efectos_retroactivos,new.anos_afectados,new.estado_vigencia,new.clasificacion_obligatoriedad,new.materia,new.descripcion_limpia,new.contenido,new.resumen_borrador,new.resumen_humano,new.tesis_juridica,new.tesis_respuesta,new.problema_juridico,new.descriptores,new.banco_datos,new.area_derecho,new.temas,new.tipo_documento,new.titulo,new.numero_resolucion)
    is distinct from row(old.enlace_oficial,old.texto_completo,old.fecha_publicacion,old.fecha_publicacion_web,old.fecha_es_real,old.fecha_entrada_vigencia,old.fecha_fin_vigencia,old.plazos_mencionados,old.fuentes_formales,old.tiene_efectos_retroactivos,old.anos_afectados,old.estado_vigencia,old.clasificacion_obligatoriedad,old.materia,old.descripcion_limpia,old.contenido,old.resumen_borrador,old.resumen_humano,old.tesis_juridica,old.tesis_respuesta,old.problema_juridico,old.descriptores,old.banco_datos,old.area_derecho,old.temas,old.tipo_documento,old.titulo,old.numero_resolucion) then
    new.revisado_fiscal_en := null;
    new.publicado_cliente := false;
    new.aprobado_para_email := false;
    new.estado_fuente_verificacion := 'pendiente';
    new.fuente_verificada_en := null;
  end if;
  return new;
end;
$$;
revoke all on function public.reencolar_documento_modificado() from public, anon, authenticated;
grant execute on function public.reencolar_documento_modificado() to service_role;
drop trigger if exists trg_reencolar_documento_modificado on public.documentos_tributarios;
create trigger trg_reencolar_documento_modificado before update
on public.documentos_tributarios for each row
execute function public.reencolar_documento_modificado();

create or replace function public.registrar_revision_documental(
  p_documento_id uuid, p_actualizado_en timestamptz, p_evaluacion jsonb
) returns jsonb language plpgsql security invoker
set search_path = public, pg_temp as $$
declare
  doc public.documentos_tributarios%rowtype;
  resultado text := p_evaluacion->>'resultado';
  motivos text[];
  publicado boolean;
begin
  select * into doc from public.documentos_tributarios
  where id = p_documento_id for update;
  if not found or doc.updated_at is distinct from p_actualizado_en then
    return jsonb_build_object('conflicto',true,'publicado',false);
  end if;
  if resultado is null or resultado not in ('APPROVE','REVIEW') then
    raise exception 'Resultado de revisión inválido';
  end if;
  if resultado = 'APPROVE' and (
      coalesce((p_evaluacion->>'fuente_verificada')::boolean,false) is not true
      or coalesce((p_evaluacion->>'puntuacion')::int,0) <> 100
      or jsonb_array_length(coalesce(p_evaluacion->'reglas_fallidas','[]'::jsonb)) <> 0) then
    raise exception 'Aprobación sin controles completos';
  end if;
  motivos := array(select jsonb_array_elements_text(coalesce(p_evaluacion->'motivos','[]'::jsonb)));
  insert into public.revisor_fiscal_euclidian_evaluaciones
    (documento_id,resultado,puntuacion,reglas_pasadas,reglas_fallidas,motivos,version_reglas,created_at)
  values (p_documento_id,resultado,(p_evaluacion->>'puntuacion')::int,
    array(select jsonb_array_elements_text(p_evaluacion->'reglas_pasadas')),
    array(select jsonb_array_elements_text(p_evaluacion->'reglas_fallidas')),
    motivos,p_evaluacion->>'version_reglas',now())
  on conflict (documento_id) do update set
    resultado=excluded.resultado,puntuacion=excluded.puntuacion,
    reglas_pasadas=excluded.reglas_pasadas,reglas_fallidas=excluded.reglas_fallidas,
    motivos=excluded.motivos,version_reglas=excluded.version_reglas,created_at=excluded.created_at;
  update public.documentos_tributarios set
    revisado_fiscal_en=now(),publicado_cliente=(resultado='APPROVE'),
    aprobado_para_email=false,
    observaciones_revisor=case when resultado='APPROVE' then null else left(array_to_string(motivos,' | '),4000) end,
    borrador_confianza=case when resultado='APPROVE' then 'pendiente' else 'no_aprobado' end,
    borrador_advertencias=case when resultado='APPROVE' then array['Controles técnicos superados; falta revisión humana del contenido y su aplicación.'] else motivos end,
    estado_fuente_verificacion=case when (p_evaluacion->>'fuente_verificada')::boolean then 'verificado_oficial' else 'pendiente' end,
    fuente_verificada_en=case when (p_evaluacion->>'fuente_verificada')::boolean then now() else null end,
    fuente_verificacion_url=doc.enlace_oficial
  where id=p_documento_id returning publicado_cliente into publicado;
  return jsonb_build_object('conflicto',false,'publicado',publicado);
end;
$$;
revoke all on function public.registrar_revision_documental(uuid,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.registrar_revision_documental(uuid,timestamptz,jsonb) to service_role;
