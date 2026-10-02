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
    return res.status(200).json({ ejecucion: run, estado: state, pagina: page, porPagina: PAGE,
      total: results.total, resultados: results.data.map(x => ({ ...x, documento: byId.get(x.documento_id) || null })) });
  } catch (error) {
    return res.status(502).json({ error: 'inspector_no_disponible' });
  }
}
