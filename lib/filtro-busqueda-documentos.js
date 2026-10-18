/* EUCLIDIAN — filtro de búsqueda PostgREST.
   Para siglas de 3+ caracteres, el ILIKE aprovecha los índices parciales
   GIN trigram ya existentes. El plfts conserva la coincidencia léxica
   de la búsqueda anterior (no basta con la subcadena). No requiere DDL. */
export function filtroBusquedaDocumentos(q){
 const termino=String(q??'').trim().slice(0,160)
   .replace(/[(),*%]/g,' ').replace(/\s+/g,' ').trim();
 if(!termino)return '';
 if(/^DIAN-[A-Z_]+-\d+-(?:19|20)\d{2}$/i.test(termino))
  return '&numero_resolucion=eq.'+encodeURIComponent(termino);
 const sigla=/^[A-ZÁÉÍÓÚÜÑ]{2,8}$/u.test(termino);
 if(sigla&&termino.length>=3){
  // Ambos brazos deben usar filtros indexados para permitir BitmapOr.
  // La coincidencia FTS se comprueba DESPUÉS del prefiltrado trigrama.
  const busqueda='(and(contenido.ilike.*'+termino+'*,contenido.plfts(spanish).'+termino+'),and(descripcion_limpia.ilike.*'+termino+'*,descripcion_limpia.plfts(spanish).'+termino+'))';
  return '&or='+encodeURIComponent(busqueda);
 }
 if(sigla){
  const busqueda='(contenido.plfts(spanish).'+termino+',descripcion_limpia.plfts(spanish).'+termino+')';
  return '&or='+encodeURIComponent(busqueda);
 }
 const busqueda='(numero_resolucion.ilike.*'+termino+'*,titulo.ilike.*'+termino+'*,contenido.ilike.*'+termino+'*,descripcion_limpia.ilike.*'+termino+'*)';
 return '&or='+encodeURIComponent(busqueda);
}
