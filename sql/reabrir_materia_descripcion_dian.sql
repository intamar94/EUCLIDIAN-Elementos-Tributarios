-- La descripción conservada del índice DIAN aporta el asunto de la norma.
-- Reabrir únicamente fichas que el control anterior retuvo por MATERIA,
-- sin publicarlas ni aprobar correos antes de contrastar la fuente individual.
update public.documentos_tributarios d
set revisado_fiscal_en = null,
    aprobado_para_email = false
from public.revisor_fiscal_euclidian_evaluaciones v
where v.documento_id = d.id
  and d.publicado_cliente = false
  and v.reglas_fallidas::text like '%MATERIA%'
  and length(trim(coalesce(d.descripcion_limpia, ''))) >= 40
  and d.id in (select documento_id from public.auditoria_fecha_web_sin_fuente);
