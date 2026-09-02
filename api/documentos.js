// EUCLIDIAN — lista de documentos.
//
// La clave de servicio vive solo aca, en el servidor. Nunca llega al
// navegador.
//
// Los filtros son tres ejes que no se pisan:
//
//   estado      en que va el trabajo   por revisar / aprobados / todos
//   prioridad   que tan urgente es     accion / importante / informativa
//   naturaleza  que clase de documento obligatorias / conceptos
//
// Antes habia una sola lista donde "Plazo o retroactivas" y "Accion
// requerida" eran casi el mismo grupo por dos caminos distintos, y
// "Obligatorias" se cruzaba con "Importantes". Habia que entender dos
// sistemas para buscar una cosa.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;
const CLAVE = process.env.EUCLIDIAN_CLAVE;

const POR_PAGINA = 25;

const ESTADOS = {
  pendientes: 'revisado_por_humano=eq.false',
  nuevos:     'es_nuevo=is.true',
  // "Aprobado" significa aprobado por el Revisor Fiscal y publicado al
  // cliente. No depende de aprobado_para_email, que es otro proceso.
  aprobados:  'revisado_por_humano=eq.true&publicado_cliente=eq.true',
  todos:      '',
};

const PRIORIDADES = {
  accion:      'prioridad=eq.accion',
  importante:  'prioridad=eq.importante',
  informativa: 'prioridad=eq.informativa',
};

const NATURALEZAS = {
  obligatorias: 'clasificacion_obligatoriedad=eq.obligatorio_dian_y_contribuyentes',
  conceptos:    'clasificacion_obligatoriedad=eq.obligatorio_dian_solo',
};

// Periodos. El archivo completo va desde 1931; filtrar por 2026 era una
// decision nuestra, no del lector. Un contador que busca doctrina sobre
// firmeza necesita los de 2019 igual que los de este año.
const PERIODOS = {
  '2026':    'anio=eq.2026',
  'recientes':'anio=gte.2024',
  'decada':  'anio=gte.2016',
  'todo':    '',
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
  'revisado_por_humano', 'publicado_cliente', 'aprobado_para_email',
  'anio', 'precision_fecha', 'es_nuevo', 'nivel_detalle', 'created_at',
].join(',');

export default async function handler(req, res) {
  if (CLAVE && req.headers['x-clave'] !== CLAVE) {
    return res.status(401).json({ error: 'clave_incorrecta' });
  }
  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).json({ error: 'falta_configuracion' });
  }

  const periodo = PERIODOS[req.query.periodo] !== undefined ? req.query.periodo : '2026';
  const estado = ESTADOS[req.query.estado] !== undefined ? req.query.estado : 'pendientes';
  const tema = req.query.tema || '';
  const prioridad = PRIORIDADES[req.query.prioridad] ? req.query.prioridad : '';
  const naturaleza = NATURALEZAS[req.query.naturaleza] ? req.query.naturaleza : '';
  const orden = ORDENES[req.query.orden] || ORDENES.recientes;
  const pagina = Math.max(1, parseInt(req.query.pagina, 10) || 1);

  const cabeceras = {
    apikey: SUPABASE_KEY,
    Authorization: `Bearer ${SUPABASE_KEY}`,
  };

  let filtro = PERIODOS[periodo] ? PERIODOS[periodo] : 'id=not.is.null';
  if (ESTADOS[estado]) filtro += '&' + ESTADOS[estado];
  if (PRIORIDADES[prioridad]) filtro += '&' + PRIORIDADES[prioridad];
  if (NATURALEZAS[naturaleza]) filtro += '&' + NATURALEZAS[naturaleza];
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
          p_periodo: periodo,
          p_tema: tema || null,
          p_estado: estado,
          p_prioridad: prioridad || null,
          p_naturaleza: naturaleza || null,
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

    let resumen = {};
    try {
      resumen = (await rResumen.json()) || {};
    } catch (e) { /* sin contadores */ }

    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).json({
      documentos,
      total,
      pagina,
      porPagina: POR_PAGINA,
      paginas: Math.max(1, Math.ceil(total / POR_PAGINA)),
      estado: resumen.estado || {},
      prioridad: resumen.prioridad || {},
      naturaleza: resumen.naturaleza || {},
      temas: resumen.temas || [],
      periodo,
      periodos: resumen.periodos || {},
      actualizado: resumen.actualizado || null,
      pendientes: (resumen.estado || {}).pendientes ?? 0,
      aprobados: (resumen.estado || {}).aprobados ?? 0,
    });
  } catch (e) {
    return res.status(500).json({ error: 'fallo_lectura', detalle: String(e).slice(0, 200) });
  }
}
