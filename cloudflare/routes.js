import auth from '../api/auth.js';
import baja from '../api/baja.js';
import checkout from '../api/checkout.js';
import datenschutz from '../api/datenschutz.js';
import documentos from '../api/documentos.js';
import health from '../api/health.js';
import impressum from '../api/impressum.js';
import payment_webhook from '../api/payment-webhook.js';
import plans from '../api/plans.js';
import profile from '../api/profile.js';
import session from '../api/session.js';
import usage from '../api/usage.js';
export const handlers = {
  '/api/auth': auth,
  '/api/baja': baja,
  '/api/checkout': checkout,
  '/api/datenschutz': datenschutz,
  '/api/documentos': documentos,
  '/api/health': health,
  '/api/impressum': impressum,
  '/api/payment-webhook': payment_webhook,
  '/api/plans': plans,
  '/api/profile': profile,
  '/api/session': session,
  '/api/usage': usage
};
