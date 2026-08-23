// EUCLIDIAN — lista de documentos.
//
// La clave de servicio vive solo aca, en el servidor. Nunca llega al
// navegador.
//
// La version anterior hacia once consultas por carga: una por cada
// contador, mas los temas. Eso agotaba el tiempo de la funcion y devolvia
// 502. Ahora son dos: la pagina de documentos, y una llamada a
// conteos_bandeja que resuelve todos los contadores de un golpe.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;

const POR_PAGINA = 25;

const ESTADOS = {
  pendientes:   'revisado_por_humano=eq.false',
  obligatorias: 'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes',
  urgentes:     'revisado_por_humano=eq.false&or=(tiene_efectos_retroactivos.eq.true,estado_vigencia.neq.vigente)',
  conceptos:    'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_solo',
  aprobados:    'aprobado_para_email=eq.true',
  todos:        '',
};

const PRIORIDADES = {
  accion:      'prioridad=eq.accion',
  importante:  'prioridad=eq.importante',
  informativa: 'prioridad=eq.informativa',
};

const ORDENES = {
  recientes: 'fecha_publicacion.desc,numero_resolucion.desc',
  prioridad: 'orden_prioridad.asc,fecha_publicacion.desc',
  antiguos:  'fecha_publicacion.asc,numero_resolucion.asc',
};

const CAMPOS = [
  'id', 'numero_resolucion', 'numero_interno', 'tipo_documento', 'titulo',
  'contenido', 'descripcion_limpia', 'resumen_humano', 'resumen_borrador',
  'borrador_confianza', 'borrador_advertencias',
  'enlace_oficial', 'materia', 'temas', 'banco_datos',
  'fecha_publicacion', 'fecha_es_real', 'fecha_entrada_vigencia',
  'fecha_publicacion_web', 'diario_oficial', 'dependencia_emisora',
  'estado_vigencia', 'motivo_cambio_estado', 'clasificacion_obligatoriedad',
  'tiene_efectos_retroactivos', 'anos_afectados', 'zonas_afectadas',
  'plazos_mencionados', 'anotaciones_vigencia',
  'tesis_juridica', 'tesis_respuesta', 'problema_juridico',
  'fuentes_formales', 'descriptores', 'doctrina_citada', 'jurisprudencia_citada',
  'modifica_a', 'modificado_por', 'nivel_alerta', 'prioridad',
  'revisado_por_humano', 'aprobado_para_email',
].join(',');

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
  const prioridad = req.query.prioridad || '';
  const orden = ORDENES[req.query.orden] || ORDENES.recientes;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);

  const cabeceras = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  let filtro = `fecha_publicacion=gte.${desde}`;
  if (ESTADOS[estado]) filtro += '&' + ESTADOS[estado];
  if (PRIORIDADES[prioridad]) filtro += '&' + PRIORIDADES[prioridad];
  if (tema) filtro += `&temas=cs.{${encodeURIComponent(tema)}}`;

  const primera = (pagina - 1) * POR_PAGINA;

  try {
    const [rDocs, rResumen] = await Promise.all([
      fetch(
        `${SUPABASE_URL}/rest/v1/v_bandeja?select=${CAMPOS}&${filtro}&order=${orden}`,
        {
          headers: {
            ...cabeceras,
            Prefer: 'count=exact',
            Range: `${primera}-${primera + POR_PAGINA - 1}`,
          },
        }
      ),
      fetch(`${SUPABASE_URL}/rest/v1/rpc/conteos_bandeja`, {
        method: 'POST',
        headers: { ...cabeceras, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          p_desde: desde,
          p_tema: tema || null,
          p_estado: estado,
        }),
      }),
    ]);

    if (!rDocs.ok) {
      const detalle = await rDocs.text();
      return res.status(502).json({ error: 'supabase', detalle: detalle.slice(0, 300) });
    }

    const documentos = await rDocs.json();
    const rango = rDocs.headers.get('content-range') || '*/0';
    const total = parseInt(rango.split('/')[1], 10) || 0;

    // Los contadores son accesorios: si fallan, la lista igual sirve.
    let resumen = {};
    try {
      resumen = (await rResumen.json()) || {};
    } catch (e) { /* sin contadores */ }

    const conteos = resumen.conteos || {};
    const porPrioridad = resumen.porPrioridad || {};

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      documentos,
      total,
      pagina,
      porPagina: POR_PAGINA,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      conteos,
      porPrioridad,
      temas: resumen.temas || [],
      actualizado: resumen.actualizado || null,
      pendientes: conteos.pendientes ?? 0,
      aprobados: conteos.aprobados ?? 0,
    });
  } catch (e) {
    return res.status(500).json({ error: 'fallo_lectura', detalle: String(e).slice(0, 200) });
  }
}
