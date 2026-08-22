// EUCLIDIAN — darse de baja.
//
// Un solo clic, sin login, sin preguntas, sin "¿seguro que quieres irte?".
// Si alguien quiere dejar de recibir el boletin, la herramienta no debe
// ponerse en el camino. Ademas los clientes de correo modernos llaman
// este enlace automaticamente por la cabecera List-Unsubscribe, asi que
// tiene que funcionar tanto por GET como por POST.

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY;

const PAGINA = (titulo, mensaje) => `<!DOCTYPE html>
<html lang="es"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>${titulo}</title>
<link href="https://fonts.googleapis.com/css2?family=Spectral:wght@400;600&family=IBM+Plex+Mono&display=swap" rel="stylesheet">
<style>
body{margin:0;min-height:100vh;display:flex;align-items:center;
  justify-content:center;background:#EDF1E9;color:#17211C;padding:26px;
  font-family:Spectral,Georgia,serif;
  background-image:linear-gradient(#D2DACB 1px,transparent 1px);
  background-size:100% 34px;}
.caja{max-width:400px;background:#FAFBF8;border:1px solid #D2DACB;
  border-left:3px solid #B23A32;padding:26px 24px;}
.marca{font-size:20px;font-weight:600;letter-spacing:.06em;margin-bottom:3px}
.marca em{font-style:normal;color:#B23A32}
.sub{font-family:'IBM Plex Mono',monospace;font-size:10px;letter-spacing:.14em;
  text-transform:uppercase;color:#5E6B62;margin-bottom:20px}
h1{font-size:19px;font-weight:600;margin:0 0 10px}
p{font-size:15px;line-height:1.6;color:#28332C;margin:0 0 10px}
</style></head><body>
<div class="caja">
  <div class="marca">EUCL<em>i</em>DIAN</div>
  <div class="sub">Elementos Tributarios</div>
  <h1>${titulo}</h1>
  <p>${mensaje}</p>
</div></body></html>`;

export default async function handler(req, res) {
  const token = (req.query && req.query.t) || (req.body && req.body.t);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');

  if (!token) {
    return res.status(400).send(PAGINA(
      'Enlace incompleto',
      'Este enlace no trae el identificador necesario. Si quieres dejar de recibir el boletín, responde al correo y te damos de baja a mano.'
    ));
  }

  if (!SUPABASE_URL || !SUPABASE_KEY) {
    return res.status(500).send(PAGINA(
      'Algo falló de nuestro lado',
      'No pudimos procesar la baja en este momento. Responde al correo y lo hacemos manualmente.'
    ));
  }

  try {
    const r = await fetch(
      `${SUPABASE_URL}/rest/v1/suscriptores?token_baja=eq.${encodeURIComponent(token)}`,
      {
        method: 'PATCH',
        headers: {
          apikey: SUPABASE_KEY,
          Authorization: `Bearer ${SUPABASE_KEY}`,
          'Content-Type': 'application/json',
          Prefer: 'return=representation',
        },
        body: JSON.stringify({ activo: false }),
      }
    );

    if (!r.ok) throw new Error(await r.text());
    const filas = await r.json();

    if (!filas.length) {
      return res.status(200).send(PAGINA(
        'Ya no estabas suscrito',
        'No encontramos una suscripción activa con este enlace. Puede que ya te hayas dado de baja antes.'
      ));
    }

    return res.status(200).send(PAGINA(
      'Listo, no recibirás más correos',
      'Tu suscripción quedó cancelada. Si algún día quieres volver, la puerta queda abierta. Gracias por haber leído.'
    ));
  } catch (e) {
    return res.status(500).send(PAGINA(
      'Algo falló de nuestro lado',
      'No pudimos procesar la baja. Responde al correo y te damos de baja a mano ese mismo día.'
    ));
  }
}
