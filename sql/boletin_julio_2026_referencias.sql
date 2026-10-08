-- Ficha editorial de localización, contrastada con la edición DIAN de julio
-- de 2026 y con los dos documentos primarios citados abajo. No publica la
-- edición ni la autoriza para correo; su período no es fecha de publicación.

with edicion as (
  select id, hash_contenido from public.documentos_tributarios
  where enlace_oficial = 'https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/BoletinActualidadJuridica/6-Boletin-Actualidad-Juridica-DIAN-julio-2026.pdf'
    and estado_fuente_verificacion = 'pdf_oficial_con_texto'
), referencias(pagina, tipo, referencia, url_oficial) as (
  values
    (3, 'norma', 'Resolución DIAN 000021 de 2026', 'https://normograma.dian.gov.co/dian/compilacion/docs/resolucion_dian_0021_2026.htm'),
    (3, 'doctrina', 'Concepto DIAN 010383 de 2026', 'https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_10383_2026.htm')
)
insert into public.boletin_referencias
  (boletin_id, pagina, tipo, referencia, url_oficial, pdf_hash)
select e.id, r.pagina, r.tipo, r.referencia, r.url_oficial, e.hash_contenido
from edicion e cross join referencias r
on conflict (boletin_id, url_oficial) do update
set pagina = excluded.pagina,
    tipo = excluded.tipo,
    referencia = excluded.referencia,
    pdf_hash = excluded.pdf_hash,
    verificado_en = now();

update public.documentos_tributarios
set resumen_humano = 'Edición de julio de 2026. En la página 3 reúne la Resolución DIAN 000021, sobre formatos y plazos extraordinarios de información exógena, y el Concepto DIAN 010383, sobre pagos en efectivo en los supuestos del parágrafo 5 del artículo 771-5 del Estatuto Tributario (continúa en la página 4). Entre las páginas 4 y 9 agrupa más doctrina tributaria, aduanera y cambiaria; las páginas 10 a 13 reseñan jurisprudencia del Consejo de Estado. Abre los documentos originales enlazados antes de aplicar un criterio a un cliente.'
where enlace_oficial = 'https://www.dian.gov.co/normatividad/Publicaciones-Juridicas/BoletinActualidadJuridica/6-Boletin-Actualidad-Juridica-DIAN-julio-2026.pdf'
  and estado_fuente_verificacion = 'pdf_oficial_con_texto';
