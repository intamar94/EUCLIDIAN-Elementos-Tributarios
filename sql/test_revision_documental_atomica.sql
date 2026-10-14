-- Pruebas sobre filas reales, con reversión completa de todas las escrituras.
begin;
do $$
declare
  doc public.documentos_tributarios%rowtype;
  respuesta jsonb;
  evaluacion jsonb := '{"resultado":"REVIEW","puntuacion":90,"reglas_pasadas":[],"reglas_fallidas":["EVIDENCIA"],"motivos":["Prueba transaccional"],"version_reglas":"test","fuente_verificada":false}';
begin
  select * into strict doc from public.documentos_tributarios
  where fecha_publicacion_web='2026-10-05' order by id limit 1 for update;
  respuesta := public.registrar_revision_documental(doc.id,doc.updated_at-interval '1 second',evaluacion);
  if respuesta->>'conflicto' <> 'true' then raise exception 'Aceptó versión obsoleta'; end if;
  respuesta := public.registrar_revision_documental(doc.id,doc.updated_at,evaluacion);
  if respuesta->>'conflicto' <> 'false' then raise exception 'Rechazó versión actual'; end if;
  if not exists(select 1 from public.revisor_fiscal_euclidian_evaluaciones
    where documento_id=doc.id and version_reglas='test') then raise exception 'Falta evaluación atómica'; end if;
  if not exists(select 1 from public.documentos_tributarios where id=doc.id
    and revisado_fiscal_en is not null and publicado_cliente=false
    and revisado_por_humano is not distinct from doc.revisado_por_humano
    and resumen_humano is not distinct from doc.resumen_humano) then raise exception 'Revisión o autoría incorrecta'; end if;
  update public.documentos_tributarios set enriquecido_en=now() where id=doc.id;
  if exists(select 1 from public.documentos_tributarios where id=doc.id and revisado_fiscal_en is null)
    then raise exception 'Reencoló una marca de tiempo sin cambio de contenido'; end if;
  update public.documentos_tributarios set descripcion_limpia=coalesce(descripcion_limpia,'')||' Prueba transaccional.' where id=doc.id;
  if exists(select 1 from public.documentos_tributarios where id=doc.id and
    (revisado_fiscal_en is not null or publicado_cliente or aprobado_para_email))
    then raise exception 'No reencoló un cambio de contenido'; end if;
  select * into strict doc from public.documentos_tributarios
  where numero_resolucion='DIAN-OFICIO-9452-2024' for update;
  evaluacion := evaluacion || '{"resultado":"APPROVE","puntuacion":100,"reglas_fallidas":[],"fuente_verificada":true}';
  respuesta := public.registrar_revision_documental(doc.id,doc.updated_at,evaluacion);
  if respuesta->>'publicado' <> 'false' then raise exception 'Saltó la cuarentena crítica'; end if;
  if has_function_privilege('anon','public.registrar_revision_documental(uuid,timestamptz,jsonb)','execute')
    or has_function_privilege('authenticated','public.registrar_revision_documental(uuid,timestamptz,jsonb)','execute')
    then raise exception 'RPC expuesta al cliente'; end if;
end;
$$;
rollback;
