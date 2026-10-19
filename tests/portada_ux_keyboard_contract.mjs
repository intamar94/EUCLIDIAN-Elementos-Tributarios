import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

// La muestra se recorre con teclado sin abrir una cuenta ni consultar el servidor.
const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const panels = new Map();
const tabs = [...html.matchAll(/<button[^>]*role="tab"[^>]*id="([^"]+)"[^>]*aria-selected="([^"]+)"[^>]*aria-controls="([^"]+)"[^>]*tabindex="([^"]+)"/g)].map(([, id, selected, panel, tabIndex]) => {
  panels.set(panel, { hidden: selected !== 'true' });
  return { id, attrs: { 'aria-selected': selected, 'aria-controls': panel }, tabIndex: Number(tabIndex), listeners: {},
    getAttribute(key) { return this.attrs[key]; },
    setAttribute(key, value) { this.attrs[key] = value; },
    addEventListener(key, fn) { this.listeners[key] = fn; },
    focus() { focused = this; }
  };
});
let focused;
assert.equal(tabs.length, 3);
runInNewContext(readFileSync(new URL('../portada.js', import.meta.url), 'utf8'), {
  document: { querySelectorAll: () => tabs, getElementById: id => panels.get(id) }
});
const selected = expected => {
  assert.equal(tabs.filter(tab => tab.attrs['aria-selected'] === 'true').length, 1);
  assert.equal([...panels.values()].filter(panel => !panel.hidden).length, 1);
  for (const tab of tabs) {
    assert.equal(tab.tabIndex, tab === expected ? 0 : -1);
    assert.equal(panels.get(tab.attrs['aria-controls']).hidden, tab !== expected);
  }
};
const key = (tab, key, expected) => {
  let prevented = false;
  tab.listeners.keydown({ key, preventDefault() { prevented = true; } });
  assert.equal(prevented, true);
  assert.equal(focused, expected);
  selected(expected);
};
selected(tabs[0]);
key(tabs[0], 'ArrowLeft', tabs[2]);
key(tabs[2], 'ArrowRight', tabs[0]);
key(tabs[0], 'End', tabs[2]);
key(tabs[2], 'Home', tabs[0]);
key(tabs[0], 'ArrowRight', tabs[1]);
let prevented = false;
tabs[1].listeners.keydown({ key: 'Tab', preventDefault() { prevented = true; } });
assert.equal(prevented, false, 'Tab debe permitir salir de la barra de pestañas');
selected(tabs[1]);
tabs[2].listeners.click();
selected(tabs[2]);
for (const [, panel] of html.matchAll(/<div class="muestra-vista" id="([^"]+)" role="tabpanel" tabindex="0"/g)) {
  assert.ok(panels.has(panel), 'Cada vista se puede leer con Tab');
}
console.log('Portada: selección única, flechas cíclicas, Home/End, clic y salida con Tab OK');
