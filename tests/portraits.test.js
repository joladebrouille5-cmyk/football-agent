// Portraits : le génome (portraits/src/genome.js) donne à chaque nationalité du jeu des visages crédibles.
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { loadEngine } = require('./load-engine');

const SRC = fs.readFileSync(path.join(__dirname, '..', 'portraits', 'src', 'genome.js'), 'utf8');
const load = () => import('data:text/javascript,' + encodeURIComponent(SRC)); // module sans dépendance
const N = 1500;
const mels = (genome, nat) => Array.from({ length: N }, (_, i) => genome({ id: 'p' + i, nat, age: 18 + i % 18 }).mel);

test('Chaque nationalité du jeu a sa répartition d\'origines', async () => {
  const { NAT_PROFILES, PROFILES } = await load();
  for (const nat of loadEngine().NAT_CODES) {
    assert.ok(NAT_PROFILES[nat], `origines manquantes pour ${nat}`);
    for (const k of Object.keys(NAT_PROFILES[nat])) assert.ok(PROFILES[k], `profil inconnu ${k} (${nat})`);
  }
});

test('Couleur de peau cohérente avec la nationalité (aucun Sénégalais à peau claire…)', async () => {
  const { genome } = await load();
  for (const nat of ['SN', 'NG', 'CI', 'CM', 'GH']) assert.ok(mels(genome, nat).every(m => m >= 0.65), `${nat} : peau foncée attendue`);
  for (const nat of ['MA', 'DZ', 'TN', 'EG']) assert.ok(mels(genome, nat).every(m => m >= 0.3 && m <= 0.55), `${nat} : peau mate attendue`);
  for (const nat of ['JP', 'KR']) assert.ok(mels(genome, nat).every(m => m <= 0.35), `${nat} : peau claire à moyenne attendue`);
  // pays européens : surtout des peaux claires, mais la diversité existe
  for (const nat of ['DE', 'IT', 'ES']) { const light = mels(genome, nat).filter(m => m < 0.32).length / N; assert.ok(light > 0.8 && light < 1, `${nat} : ${light}`); }
  const fr = mels(genome, 'FR'); assert.ok(fr.some(m => m > 0.65) && fr.some(m => m < 0.2), 'France : population diverse');
});

test('Visage déterministe et vieillissement du même visage', async () => {
  const { genome } = await load();
  const a = genome({ id: 'p42', nat: 'SN', age: 22 }), b = genome({ id: 'p42', nat: 'SN', age: 22 }), old = genome({ id: 'p42', nat: 'SN', age: 34 });
  assert.deepEqual(a, b);
  assert.equal(old.mel, a.mel); assert.deepEqual(old.anc, a.anc); assert.equal(old.arch, a.arch);
});
