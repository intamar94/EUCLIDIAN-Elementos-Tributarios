-- Orden de publicación coherente y vigencia desconocida sin urgencia ficticia.
CREATE OR REPLACE VIEW public.v_bandeja WITH (security_invoker=true) AS
 SELECT id,
    numero_resolucion,
    numero_interno,
    tipo_documento,
    subtipo,
    titulo,
    contenido,
    descripcion_limpia,
    resumen_humano,
    resumen_borrador,
    borrador_confianza,
    borrador_advertencias,
    enlace_oficial,
    materia,
    temas,
    banco_datos,
    fecha_publicacion,
    fecha_es_real,
    fecha_entrada_vigencia,
    fecha_publicacion_web,
    diario_oficial,
    entidad_emisora,
    dependencia_emisora,
    anio,
    precision_fecha,
    estado_vigencia,
    motivo_cambio_estado,
    clasificacion_obligatoriedad,
    tiene_efectos_retroactivos,
    anos_afectados,
    zonas_afectadas,
    plazos_mencionados,
    anotaciones_vigencia,
    tesis_juridica,
    tesis_respuesta,
    problema_juridico,
    fuentes_formales,
    descriptores,
    area_derecho,
    doctrina_citada,
    jurisprudencia_citada,
    revisado_por_humano,
    aprobado_para_email,
    publicado_cliente,
    created_at,
    COALESCE(COALESCE(fecha_publicacion_web, CASE WHEN fecha_es_real THEN fecha_publicacion END) BETWEEN CURRENT_DATE - 14 AND CURRENT_DATE, false) AS es_nuevo,
        CASE
            WHEN resumen_humano IS NOT NULL THEN 'revisado'::text
            WHEN resumen_borrador IS NOT NULL THEN 'con_ficha'::text
            WHEN texto_completo IS NOT NULL THEN 'leido'::text
            ELSE 'solo_listado'::text
        END AS nivel_detalle,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('accion', r.tipo_revision, 'numero', a.numero_resolucion, 'titulo', "left"(a.titulo::text, 90), 'enlace', a.enlace_oficial, 'estado', a.estado_vigencia) ORDER BY r.fecha_revision DESC) AS jsonb_agg
           FROM reconsideraciones r
             JOIN documentos_tributarios a ON a.id = r.documento_anterior_id
          WHERE r.documento_nuevo_id = d.id), '[]'::jsonb) AS modifica_a,
    COALESCE(( SELECT jsonb_agg(jsonb_build_object('accion', r.tipo_revision, 'numero', n.numero_resolucion, 'titulo', "left"(n.titulo::text, 90), 'enlace', n.enlace_oficial, 'fecha', n.fecha_publicacion) ORDER BY n.fecha_publicacion DESC) AS jsonb_agg
           FROM reconsideraciones r
             JOIN documentos_tributarios n ON n.id = r.documento_nuevo_id
          WHERE r.documento_anterior_id = d.id), '[]'::jsonb) AS modificado_por,
    ( SELECT a.nivel_urgencia
           FROM alertas_urgentes a
          WHERE a.documento_id = d.id
          ORDER BY (
                CASE a.nivel_urgencia
                    WHEN 'critica'::text THEN 1
                    WHEN 'alta'::text THEN 2
                    WHEN 'media'::text THEN 3
                    ELSE 4
                END)
         LIMIT 1) AS nivel_alerta,
        CASE
            WHEN COALESCE(anio_publicacion, anio)::numeric >= (EXTRACT(year FROM CURRENT_DATE) - 3::numeric) THEN
            CASE
                WHEN estado_vigencia::text NOT IN ('vigente'::text, 'desconocido'::text) THEN 'accion'::text
                WHEN (EXISTS ( SELECT 1
                   FROM alertas_urgentes a
                  WHERE a.documento_id = d.id AND a.nivel_urgencia::text = 'critica'::text)) THEN 'accion'::text
                WHEN tiene_efectos_retroactivos THEN 'accion'::text
                WHEN array_length(plazos_mencionados, 1) > 0 THEN 'importante'::text
                WHEN (EXISTS ( SELECT 1
                   FROM reconsideraciones r
                  WHERE r.documento_anterior_id = d.id)) THEN 'importante'::text
                WHEN clasificacion_obligatoriedad::text = 'obligatorio_dian_y_contribuyentes'::text THEN 'importante'::text
                ELSE 'informativa'::text
            END
            ELSE
            CASE
                WHEN estado_vigencia::text NOT IN ('vigente'::text, 'desconocido'::text) THEN 'importante'::text
                WHEN (EXISTS ( SELECT 1
                   FROM reconsideraciones r
                  WHERE r.documento_anterior_id = d.id)) THEN 'importante'::text
                ELSE 'informativa'::text
            END
        END AS prioridad,
        CASE
            WHEN COALESCE(anio_publicacion, anio)::numeric >= (EXTRACT(year FROM CURRENT_DATE) - 3::numeric) AND estado_vigencia::text NOT IN ('vigente'::text, 'desconocido'::text) THEN 0
            WHEN COALESCE(anio_publicacion, anio)::numeric >= (EXTRACT(year FROM CURRENT_DATE) - 3::numeric) AND tiene_efectos_retroactivos THEN 1
            WHEN array_length(plazos_mencionados, 1) > 0 THEN 2
            WHEN clasificacion_obligatoriedad::text = 'obligatorio_dian_y_contribuyentes'::text THEN 3
            ELSE 4
        END AS orden_prioridad,
    anio_publicacion,
    revisado_fiscal_en,
    observaciones_revisor,
    COALESCE(fecha_publicacion_web, CASE WHEN fecha_es_real THEN fecha_publicacion END,
      make_date(COALESCE(anio_publicacion,anio,1900),1,1)) AS fecha_orden_documental
   FROM documentos_tributarios d;

-- Cerrar un ciclo nunca deja etapas huérfanas «en curso».
CREATE OR REPLACE FUNCTION public.cerrar_ciclo_documental(p_ciclo uuid,p_estado text,p_resumen jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 IF p_estado NOT IN ('completo','parcial','fallo') THEN RAISE EXCEPTION 'Estado inválido'; END IF;
 UPDATE public.direccion_documental SET lease_hasta=null,propietario=null WHERE id AND propietario=p_ciclo;
 IF NOT FOUND THEN RETURN false; END IF;
 UPDATE public.etapas_documentales SET estado='interrumpido',finalizado_en=now(),
  resultado=resultado||jsonb_build_object('motivo_cierre','El ciclo terminó antes de cerrar esta etapa')
 WHERE ciclo_id=p_ciclo AND estado='en_curso';
 UPDATE public.ciclos_documentales SET estado=p_estado,finalizado_en=now(),resumen=p_resumen WHERE id=p_ciclo;
 RETURN true;
END; $$;

-- Un dispatch fallido no consume 45 minutos de recuperación sin hacer nada.
CREATE OR REPLACE FUNCTION public.liberar_rescate_documental()
RETURNS boolean LANGUAGE plpgsql SECURITY INVOKER SET search_path=public,pg_temp AS $$
BEGIN
 UPDATE public.direccion_documental SET ultimo_rescate=null
 WHERE id AND (lease_hasta IS NULL OR lease_hasta<now());
 RETURN found;
END; $$;
REVOKE ALL ON FUNCTION public.liberar_rescate_documental() FROM public,anon,authenticated;
GRANT EXECUTE ON FUNCTION public.liberar_rescate_documental() TO service_role;
CREATE INDEX IF NOT EXISTS idx_adaptaciones_ciclo ON public.adaptaciones_documentales(ciclo_id);
CREATE INDEX IF NOT EXISTS idx_fuentes_dian_ciclo ON public.fuentes_dian_mapeadas(ciclo_id);

