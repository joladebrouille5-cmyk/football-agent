// Dictionnaire des langues (V8.14) : chaque entrée a ses trois langues et des parties variables cohérentes.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const { GAME_FILE } = require('./load-engine');

const html = fs.readFileSync(GAME_FILE, 'utf8');
const start = html.indexOf('const I18N_ROWS = ') + 'const I18N_ROWS = '.length;
const rows = JSON.parse(html.slice(start, html.indexOf(';\n', start)));

test('V8.14 : dictionnaire français / anglais / espagnol complet et cohérent', () => {
  assert.ok(rows.length > 1300, 'plus de 1 300 textes traduits');
  const seen = new Set();
  for (const [fr, en, es] of rows) {
    assert.ok(fr && en && es, 'trois langues : ' + fr);
    assert.ok(!seen.has(fr), 'entrée en double : ' + fr); seen.add(fr);
    const n = (fr.match(/\{\}/g) || []).length;
    for (const t of [en, es]) {
      const refs = t.match(/\{(\d*)\}/g) || [];
      assert.ok(refs.length <= n, `trop de parties variables dans « ${t} » (${fr})`);
      for (const r of refs) { const k = r.slice(1, -1); if (k !== '') assert.ok(+k < n, `indice {${k}} hors limites dans « ${t} »`); }
    }
  }
  for (const key of ['Passer au mois suivant', 'Tableau de bord', 'Mes joueurs', 'Paramètres', '{} monte en {} !', 'Coupe du monde'])
    assert.ok(seen.has(key) || rows.some(r => r[0].includes(key)), 'texte clé traduit : ' + key);
});
