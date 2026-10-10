-- Extracción literal contrastada con HTML oficial. No concede aprobación ni publicación.

begin;
update public.documentos_tributarios set fuentes_formales=ARRAY['Artículos 903, 904, 907, 908 y 910 del Estatuto Tributario.','Artículos 1.5.8.3.7, 1.5.8.3.11, 2.1.1.11, 2.1.1.12, 2.1.1.15 y 2.1.1.20 del Decreto 1625 de 2016.']::text[],
  notas_verificacion=coalesce(notas_verificacion,'') || ' | Revisión literal 2026-10-10 | Fuente: https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_15659_2026.htm | SHA256 HTML: 1063e854df76b4b3dd6297416e321e22641c9a64f78a528ad98f406f39ae276a',
  estructura_extraida_en=now(),
  updated_at=now()
where enlace_oficial='https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_15659_2026.htm';

update public.documentos_tributarios set fuentes_formales=ARRAY['Artículos 163 y 164 del Código de Comercio.','Artículos 596, 599, 602 y 606 del Estatuto Tributario.','Artículo 13 de la Ley 43 de 1990','CONSEJO DE ESTADO. Sala de lo Contencioso Administrativo, Sección Cuarta. Sentencia del 22 de septiembre de 2004. Consejera Ponente: María Inés Ortiz Barbosa. Radicación No. 11001-03-27-000-2002-00117-01 (13632).']::text[],
  problema_juridico='¿Se determina la procedencia de la firma del revisor fiscal en las declaraciones tributarias iniciales o en sus correcciones, cuando durante el tiempo transcurrido entre el período gravable objeto de declaración y la presentación de la declaración o de su corrección se producen cambios en la obligación legal de tener revisor fiscal o en la persona que ejerce dicho cargo?',
  tesis_juridica='En consecuencia, la procedencia de la firma del revisor fiscal en las declaraciones tributarias iniciales o en sus correcciones debe determinarse verificando si respecto del período gravable objeto de declaración existía obligación legal de tener revisor fiscal, de conformidad con las reglas desarrolladas por la doctrina vigente de esta Entidad. Por lo anterior y cuando respecto del período gravable objeto de declaración exista obligación legal de firma del revisor fiscal, la calidad con la que actúa quien suscribe la declaración y/o corrección deberá encontrarse debidamente acreditada ante la Administración Tributaria conforme a las reglas de designación, publicidad y oponibilidad previstas en el ordenamiento jurídico. Los cambios posteriores en la obligación legal de tener revisor fiscal no modifican la determinación de la procedencia de la firma respecto del período gravable objeto de declaración. Finalmente, la respuesta a los escenarios planteados dependerá, en cada caso, de verificar si respecto del período gravable objeto de declaración existía obligación legal de firma del revisor fiscal y, de existir dicha obligación, de la acreditación de la calidad de quien suscribe la correspondiente declaración y/o corrección ante la Administración Tributaria.',
  notas_verificacion=coalesce(notas_verificacion,'') || ' | Revisión literal 2026-10-10 | Fuente: https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_15661_2026.htm | SHA256 HTML: def78b7db1c1789681bf7ce79bd5f4cb561eda4ebeaf33c35c6896c6a1d4d738',
  estructura_extraida_en=now(),
  updated_at=now()
where enlace_oficial='https://normograma.dian.gov.co/dian/compilacion/docs/oficio_dian_15661_2026.htm';

update public.documentos_tributarios set zonas_afectadas=ARRAY['Antioquia','Bolívar','Caldas','Caquetá','Cauca','Chocó','Cundinamarca','Huila','Nariño','Norte de Santander','Quindío','Risaralda','Santander','Sucre','Tolima','Valle del Cauca']::text[],
  notas_verificacion=coalesce(notas_verificacion,'') || ' | Revisión literal 2026-10-10 | Fuente: https://normograma.dian.gov.co/dian/compilacion/docs/decreto_1419_2026.htm | SHA256 HTML: 157e3880604375c2b36ee29067b0e7eba1e05a5a24bb18bfcd8e12166bb289a7',
  estructura_extraida_en=now(),
  updated_at=now()
where enlace_oficial='https://normograma.dian.gov.co/dian/compilacion/docs/decreto_1419_2026.htm';
commit;
