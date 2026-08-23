// EUCLIDIAN — lista de documentos.
// La clave de servicio vive solo aca, en el servidor. Nunca llega al navegador.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;

const POR_PAGINA = 25;

// Los filtros responden a como trabaja un contador, no a como esta
// guardada la base. En temporada abre "obligatorias", revisa veinte y
// cierra. Los conceptos quedan para cuando haya tiempo.
const ESTADOS = {
  pendientes:   'revisado_por_humano=eq.false',
  obligatorias: 'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes',
  urgentes:     'revisado_por_humano=eq.false&or=(tiene_efectos_retroactivos.eq.true,estado_vigencia.neq.vigente)',
  conceptos:    'revisado_por_humano=eq.false&clasificacion_obligatoriedad=eq.obligatorio_dian_solo',
  aprobados:    'aprobado_para_email=eq.true',
  todos:        '',
};

// La prioridad se calcula en la vista, no en el navegador. Asi el filtro
// opera sobre los 390 documentos y no sobre la pagina ya descargada.
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
  'id', 'numero_resolucion', 'tipo_documento', 'subtipo', 'titulo',
  'contenido', 'descripcion_limpia', 'resumen_humano', 'resumen_borrador',
  'borrador_confianza', 'borrador_advertencias',
  'enlace_oficial', 'materia', 'temas',
  'fecha_publicacion', 'fecha_es_real', 'fecha_entrada_vigencia',
  'diario_oficial', 'estado_vigencia', 'motivo_cambio_estado',
  'clasificacion_obligatoriedad', 'tiene_efectos_retroactivos',
  'anos_afectados', 'zonas_afectadas', 'plazos_mencionados',
  'anotaciones_vigencia', 'tesis_juridica', 'tesis_respuesta',
  'problema_juridico', 'fuentes_formales', 'descriptores',
  'numero_interno', 'fecha_publicacion_web', 'banco_datos',
  'dependencia_emisora', 'doctrina_citada', 'jurisprudencia_citada',
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

  const armar = (est, pri) => {
    let f = `fecha_publicacion=gte.${desde}`;
    if (ESTADOS[est]) f += '&' + ESTADOS[est];
    if (pri && PRIORIDADES[pri]) f += '&' + PRIORIDADES[pri];
    if (tema) f += `&temas=cs.{${encodeURIComponent(tema)}}`;
    return f;
  };

  const contar = async (filtro) => {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/v_bandeja?select=id&${filtro}`,
      { headers: { ...cabeceras, Prefer: 'count=exact', Range: '0-0' } }
    );
    const rango = r.headers.get('content-range') || '*/0';
    return parseInt(rango.split('/')[1], 10) || 0;
  };

  try {
    const filtro = armar(estado, prioridad);
    const desdeFila = (pagina - 1) * POR_PAGINA;

    // Se pide el total en la misma llamada, para saber cuantas paginas
    // hay. Antes se traian 60 documentos sin decir que habia mas: quien
    // llegaba al final creia haberlo visto todo.
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/v_bandeja?select=${CAMPOS}&${filtro}&order=${orden}`,
      {
        headers: {
          ...cabeceras,
          Prefer: 'count=exact',
          Range: `${desdeFila}-${desdeFila + POR_PAGINA - 1}`,
        },
      }
    );
    if (!r.ok) {
      const detalle = await r.text();
      return res.status(502).json({ error: 'supabase', detalle: detalle.slice(0, 300) });
    }
    const documentos = await r.json();
    const rango = r.headers.get('content-range') || '*/0';
    const total = parseInt(rango.split('/')[1], 10) || 0;

    const claves = ['pendientes', 'obligatorias', 'urgentes', 'conceptos', 'aprobados'];
    const prioridades = ['accion', 'importante', 'informativa'];

    const [valoresEstado, valoresPrioridad] = await Promise.all([
      Promise.all(claves.map((k) => contar(armar(k, prioridad)))),
      Promise.all(prioridades.map((p) => contar(armar(estado, p)))),
    ]);

    const conteos = Object.fromEntries(claves.map((k, i) => [k, valoresEstado[i]]));
    const porPrioridad = Object.fromEntries(
      prioridades.map((p, i) => [p, valoresPrioridad[i]])
    );

    // Los temas disponibles salen de la seleccion completa, no de la
    // pagina: si solo se miraran los 25 visibles, el selector cambiaria
    // de opciones al pasar de pagina.
    let temas = [];
    try {
      const rt = await fetch(
        `${SUPABASE_URL}/rest/v1/v_bandeja?select=temas&${armar(estado, prioridad)}&limit=600`,
        { headers: cabeceras }
      );
      const filas = await rt.json();
      const vistos = new Set();
      (filas || []).forEach((f) =>
        (f.temas || []).forEach((t) => {
          if (!t.startsWith('dian:') && t !== 'boletin_mensual') vistos.add(t);
        })
      );
      temas = [...vistos].sort();
    } catch (e) { /* accesorio */ }

    let actualizado = null;
    try {
      const ra = await fetch(
        `${SUPABASE_URL}/rest/v1/logs_scraping?select=created_at&order=created_at.desc&limit=1`,
        { headers: cabeceras }
      );
      const filas = await ra.json();
      if (filas && filas[0]) actualizado = filas[0].created_at;
    } catch (e) { /* accesorio */ }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      documentos,
      total,
      pagina,
      porPagina: POR_PAGINA,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      conteos,
      porPrioridad,
      temas,
      actualizado,
      pendientes: conteos.pendientes,
      aprobados: conteos.aprobados,
    });
  } catch (e) {
    return res.status(500).json({ error: 'fallo_lectura', detalle: String(e).slice(0, 200) });
  }
}
