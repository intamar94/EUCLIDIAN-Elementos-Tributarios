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

  let filtro = `fecha_publicacion=gte.${desde}`;
  if (estado === 'pendientes') filtro += '&revisado_por_humano=eq.false';
  if (estado === 'aprobados') filtro += '&aprobado_para_email=eq.true';

  const campos = [
    'id', 'numero_resolucion', 'tipo_documento', 'subtipo', 'titulo',
    'contenido', 'enlace_oficial', 'estado_vigencia', 'temas',
    'clasificacion_obligatoriedad', 'tiene_efectos_retroactivos',
    'revisado_por_humano', 'aprobado_para_email', 'resumen_humano',
    'materia', 'descripcion_limpia', 'fecha_publicacion', 'fecha_es_real',
    'diario_oficial', 'zonas_afectadas', 'plazos_mencionados', 'anos_afectados',
    'resumen_borrador', 'borrador_confianza', 'borrador_advertencias',
  ].join(',');

  const url =
    `${SUPABASE_URL}/rest/v1/documentos_tributarios` +
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

    const [pendientes, aprobados] = await Promise.all([
      contar(`fecha_publicacion=gte.${desde}&revisado_por_humano=eq.false`),
      contar(`fecha_publicacion=gte.${desde}&aprobado_para_email=eq.true`),
    ]);

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({ documentos, pendientes, aprobados });
  } catch (e) {
    return res.status(500).json({ error: 'fallo_lectura', detalle: String(e).slice(0, 200) });
  }
}
