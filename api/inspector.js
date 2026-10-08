// Informe privado del inspector. La clave de servicio nunca sale al navegador.
const URL = process.env.SUPABASE_URL;
const SERVICE = process.env.SUPABASE_SERVICE_KEY;
const REVIEW_KEY = process.env.EUCLIDIAN_REVISOR_CLAVE;
const PAGE = 25;

async function read(path) {
  const response = await fetch(`${URL}/rest/v1/${path}`, {
    headers: { apikey: SERVICE, Authorization: `Bearer ${SERVICE}`, Prefer: 'count=exact' },
    cache: 'no-store'
  });
  if (!response.ok) throw new Error(`Supabase ${response.status}`);
  return { data: await response.json(), total: Number((response.headers.get('content-range') || '*/0').split('/')[1]) || 0 };
}

export default async function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store');
  if (req.method !== 'GET') return res.status(405).json({ error: 'metodo_no_permitido' });
  if (!URL || !SERVICE || !REVIEW_KEY) return res.status(503).json({ error: 'inspector_no_configurado' });
  if (req.headers['x-clave'] !== REVIEW_KEY) return res.status(401).json({ error: 'clave_incorrecta' });
  try {
    const latest = await read('inspector_ejecuciones?select=*&order=iniciado_en.desc&limit=1');
    const run = latest.data[0] || null;
    if (!run) return res.status(200).json({ ejecucion: null, resultados: [], total: 0 });
    const latestManagement = await read('control_interno_ejecuciones?select=*&order=iniciado_en.desc&limit=1');
    const management = latestManagement.data[0] || null;
    const caseState = ['en_cuarentena','correccion_verificada','resuelto_verificado'].includes(req.query.caso_estado) ? req.query.caso_estado : 'abiertos';
    const casePage = Math.max(1, Math.min(1000, Number.parseInt(req.query.caso_pagina, 10) || 1));
    const caseFirst = (casePage - 1) * PAGE;
    const caseFilter = caseState === 'abiertos' ? 'estado=neq.resuelto_verificado' : `estado=eq.${caseState}`;
    const [queue, open, quarantined, corrected, resolved] = await Promise.all([
      read(`control_interno_expedientes?select=id,documento_id,codigo,prioridad,estado,primera_deteccion,ultima_deteccion,ultimo_control_en,inspeccion_ultima,verificacion_id,intentos,detalle,accion_requerida,fuente_url,evidencia&${caseFilter}&order=prioridad.asc,primera_deteccion.asc&offset=${caseFirst}&limit=${PAGE}`),
      read('control_interno_expedientes?select=id&estado=neq.resuelto_verificado&limit=1'),
      read('control_interno_expedientes?select=id&estado=eq.en_cuarentena&limit=1'),
      read('control_interno_expedientes?select=id&estado=eq.correccion_verificada&limit=1'),
      read('control_interno_expedientes?select=id&estado=eq.resuelto_verificado&limit=1')
    ]);
    const caseIds = queue.data.map(x => x.documento_id).filter(x => /^[0-9a-f-]{36}$/i.test(x));
    const caseDocuments = caseIds.length ? (await read(`documentos_tributarios?select=id,numero_resolucion,titulo,enlace_oficial,publicado_cliente,resumen_humano,resumen_borrador,descripcion_limpia,fecha_publicacion,fecha_publicacion_web,fecha_es_real&id=in.(${caseIds.join(',')})`)).data : [];
    const caseById = new Map(caseDocuments.map(x => [x.id,x]));
    const state = ['critico', 'aviso', 'correcto'].includes(req.query.estado) ? req.query.estado : 'critico';
    const page = Math.max(1, Math.min(1000, Number.parseInt(req.query.pagina, 10) || 1));
    const first = (page - 1) * PAGE;
    const results = await read(`inspector_resultados?select=documento_id,estado,hallazgos,verificado_en&ejecucion_id=eq.${run.id}&estado=eq.${state}&order=verificado_en.desc&offset=${first}&limit=${PAGE}`);
    const ids = results.data.map(x => x.documento_id).filter(x => /^[0-9a-f-]{36}$/i.test(x));
    let documents = [];
    if (ids.length) {
      documents = (await read(`documentos_tributarios?select=id,numero_resolucion,titulo,enlace_oficial&id=in.(${ids.join(',')})`)).data;
    }
    const byId = new Map(documents.map(x => [x.id, x]));
    return res.status(200).json({ ejecucion: run, gestion: { ejecucion: management,
      expedientes: queue.data.map(x => ({...x, documento: caseById.get(x.documento_id) || null})),
      total: queue.total, pagina: casePage, estado: caseState,
      conteos: {en_cuarentena:quarantined.total,correccion_verificada:corrected.total,
        resuelto_verificado:resolved.total,abiertos:open.total} }, estado: state, pagina: page, porPagina: PAGE,
      total: results.total, resultados: results.data.map(x => ({ ...x, documento: byId.get(x.documento_id) || null })) });
  } catch (error) {
    return res.status(502).json({ error: 'inspector_no_disponible' });
  }
}
