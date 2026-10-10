import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

const html=await readFile(new URL('../index.html',import.meta.url),'utf8');
const css=await readFile(new URL('../landing.css',import.meta.url),'utf8');

assert.match(html,/<title>[^<]*EUCLIDIAN[^<]*<\/title>/i);
assert.match(html,/<meta name="description" content="[^"]{80,}"/i);
assert.match(html,/<link rel="canonical" href="https:\/\/euclidian-elementos-tributarios\.vercel\.app\//i);
assert.match(html,/<meta property="og:title"/i);
assert.match(html,/<script type="application\/ld\+json">/i);
assert.match(html,/href="\/app\.html"/i);
assert.match(html,/EUCLIDIAN no es un sitio oficial de la DIAN/i);
assert.match(html,/id="como-funciona"/i);
assert.match(html,/id="lectura"/i);
assert.match(css,/@media\(max-width:620px\)/i);
assert.match(css,/focus-visible/i);
console.log('Contrato portada pública/SEO: 10/10 escenarios OK');
