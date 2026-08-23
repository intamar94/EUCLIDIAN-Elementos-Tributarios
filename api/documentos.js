// EUCLIDIAN — lista de documentos pendientes de revision.
// La clave de servicio vive solo aca, en el servidor. Nunca llega al navegador.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;

export default async function handler(req, res) {
  if (CLAVE && req.headers['x-clave'] !== CLAVE) {
    return res.status(401).json({ error: 'clave_incorrecta' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'falta_configuracion' });
  }

  const desde = req.query.desde || '2026-01-01';
  const estado = req.query.estado || 'pendientes';
  const tema = req.query.tema || '';

  // Los filtros responden a como trabaja un contador, no a como esta
  // guardada la base. En temporada de renta abre "obligatorias", revisa
  // veinte y cierra. Los conceptos quedan para cuando haya tiempo.
  const FILTROS = {
    pendientes:  'revisado_por_humano=eq.false',
    obligatorias:'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes',
    urgentes:    'revisado_por_humano=eq.false&or=(tiene_efectos_retroactivos.eq.true,estado_vigencia.neq.vigente)',
    conceptos:   'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_solo',
    aprobados:   'aprobado_para_email=eq.true',
    todos:       '',
  };

  let filtro = `fecha_publicacion=gte.${desde}`;
  const extra = FILTROS[estado];
  if (extra) filtro += '&' + extra;
  if (tema) filtro += `&temas=cs.{${encodeURIComponent(tema)}}`;

  const campos = [
    'id', 'numero_resolucion', 'tipo_documento', 'subtipo', 'titulo',
    'contenido', 'enlace_oficial', 'estado_vigencia', 'temas',
    'clasificacion_obligatoriedad', 'tiene_efectos_retroactivos',
    'revisado_por_humano', 'aprobado_para_email', 'resumen_humano',
    'materia', 'descripcion_limpia', 'fecha_publicacion', 'fecha_es_real',
    'diario_oficial', 'zonas_afectadas', 'plazos_mencionados', 'anos_afectados',
    'resumen_borrador', 'borrador_confianza', 'borrador_advertencias',
    'modifica_a', 'modificado_por', 'nivel_alerta', 'fecha_entrada_vigencia',
    'anotaciones_vigencia', 'motivo_cambio_estado',
  ].join(',');

  const url =
    `${SUPABASE_URL}/rest/v1/v_bandeja` +
    `?select=${campos}&${filtro}` +
    `&order=fecha_publicacion.desc,numero_resolucion.desc&limit=60`;

  try {
    const r = await fetch(url, {
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
    });
    if (!r.ok) {
      const detalle = await r.text();
      return res.status(502).json({ error: 'supabase', detalle: detalle.slice(0, 300) });
    }
    const documentos = await r.json();

    // Conteos para la cabecera
    const contar = async (q) => {
      const rc = await fetch(
        `${SUPABASE_URL}/rest/v1/documentos_tributarios?select=id&${q}`,
        {
          headers: {
            apikey: SUPABASE_KEY,
            Authorization: `Bearer ${SUPABASE_KEY}`,
            Prefer: 'count=exact',
            Range: '0-0',
          },
        }
      );
      const rango = rc.headers.get('content-range') || '*/0';
      return parseInt(rango.split('/')[1], 10) || 0;
    };

    // Cada pestana muestra su numero. Saber cuantas hay antes de entrar
    // evita abrir una lista de trescientas sin querer.
    // Los conteos respetan el tema elegido. Si dicen 371 conceptos
    // mientras la lista muestra solo los de devoluciones, el numero
    // engana sobre lo que hay realmente ahi.
    const porTema = tema ? `&temas=cs.{${encodeURIComponent(tema)}}` : '';
    const claves = ['pendientes', 'obligatorias', 'urgentes', 'conceptos', 'aprobados'];
    const valores = await Promise.all(
      claves.map((k) =>
        contar(`fecha_publicacion=gte.${desde}` +
               (FILTROS[k] ? '&' + FILTROS[k] : '') + porTema)
      )
    );
    const conteos = Object.fromEntries(claves.map((k, i) => [k, valores[i]]));

    // Cuando se actualizaron los datos por ultima vez. Sin este dato
    // nadie sabe si esta viendo informacion fresca o de hace una semana.
    let actualizado = null;
    try {
      const ra = await fetch(
        `${SUPABASE_URL}/rest/v1/logs_scraping?select=created_at&order=created_at.desc&limit=1`,
        { headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${SUPABASE_KEY}` } }
      );
      const filas = await ra.json();
      if (filas && filas[0]) actualizado = filas[0].created_at;
    } catch (e) { /* dato accesorio: si falla, no se muestra */ }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      documentos,
      conteos,
      actualizado,
      pendientes: conteos.pendientes,
      aprobados: conteos.aprobados,
    });
  } catch (e) {
    return res.status(500).json({ error: 'fallo_lectura', detalle: String(e).slice(0, 200) });
  }
}
