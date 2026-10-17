// EUCLIDIAN — contrato estático de dominio y cabeceras de seguridad.
// No llama a servicios externos ni comprueba disponibilidad de APIs reales.
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const leer = p => readFileSync(new URL('../' + p, import.meta.url), 'utf8');
const home = leer('index.html');
const app = leer('app.html');
const robots = leer('robots.txt');
const sitemap = leer('sitemap.xml');
const vercel = JSON.parse(leer('vercel.json'));

assert.match(home, /<link rel="canonical" href="https:\/\/euclidianet\.com\/">/);
assert.match(home, /<meta property="og:url" content="https:\/\/euclidianet\.com\/">/);
assert.match(home, /<meta name="robots" content="index,follow">/);
assert.match(home, /EUCL<em>i<\/em>DIAN/);
assert.match(app, /<meta name="robots" content="noindex,nofollow">/);
assert.match(robots, /Sitemap:\s*https:\/\/euclidianet\.com\/sitemap\.xml/);
assert.match(sitemap, /<loc>https:\/\/euclidianet\.com\/<\/loc>/);

const headersGlobales = vercel.headers.find(x => x.source === '/(.*)')?.headers || [];
const headersApi = vercel.headers.find(x => x.source === '/api/(.*)')?.headers || [];
const valor = (headers, nombre) => headers.find(h => h.key.toLowerCase() === nombre.toLowerCase())?.value;
assert.equal(valor(headersGlobales, 'X-Content-Type-Options'), 'nosniff');
assert.equal(valor(headersGlobales, 'X-Frame-Options'), 'DENY');
assert.equal(valor(headersGlobales, 'Referrer-Policy'), 'strict-origin-when-cross-origin');
assert.match(valor(headersApi, 'Cache-Control') || '', /no-store/);

for (const f of ['api/auth.js','api/documentos.js','api/checkout.js','api/session.js','api/profile.js','api/plans.js']) {
  assert.ok(existsSync(new URL('../' + f, import.meta.url)), 'API missing: ' + f);
}
const contacto = new URL('../contacto.html', import.meta.url);
if (existsSync(contacto)) {
  const html = readFileSync(contacto, 'utf8');
  assert.match(html, /contacto@euclidianet\.com/);
  assert.match(html, /prepara|Preparar|enviará automáticamente/i);
}
console.log('OK: dominio, SEO básico, aislamiento de la app y cabeceras HTTP comprobados.');
console.log('PENDIENTE MANUAL: correos E2E, legal, hosting comercial, accesibilidad y APIs privadas.');
