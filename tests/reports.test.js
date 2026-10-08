// Synthèse des signalements (site/report-summary.js) : thèmes, problèmes répétés regroupés, classement
const test = require('node:test');
const assert = require('node:assert/strict');
const R = require('../site/report-summary.js');

test('Synthèse : chaque message dans le bon thème', () => {
  assert.equal(R.themeOf("Mon agence est passée de 18 à 6 places alors que j'avais un bureau international").id, 'agence');
  assert.equal(R.themeOf('Ma sauvegarde a disparu, j\'ai perdu ma partie').id, 'sauvegarde');
  assert.equal(R.themeOf('Le jeu est bloqué, il plante quand je clique').id, 'plantage');
  assert.equal(R.themeOf('Le bouton est coupé sur mon téléphone').id, 'interface');
  assert.equal(R.themeOf('Ce serait bien d\'ajouter un mode carrière entraîneur').id, 'idees');
  assert.equal(R.themeOf('Défi Amiens trop facile').id, 'equilibre');
  assert.equal(R.themeOf('blabla').id, 'autre');
});

test('Synthèse : problèmes répétés regroupés et classés du plus signalé au moins signalé', () => {
  const reps = [
    { text: 'Mon agence a perdu des places sans raison', uid: 'a', ref: 'AAA111+save', v: '8.52', timestamp: '2026-10-08 10:00:00' },
    { text: "L'agence est redescendue, j'ai perdu des places", uid: 'b', ref: 'BBB222', v: '8.52', timestamp: '2026-10-08 11:00:00' },
    { text: 'Agence perdu des places, bug', uid: 'c', ref: 'CCC333', v: '8.51', timestamp: '2026-10-08 12:00:00' },
    { text: 'Le loyer de l\'agence est trop cher', uid: 'a', ref: 'DDD444', v: '8.52', timestamp: '2026-10-07 09:00:00' },
    { text: 'Ma sauvegarde a disparu', uid: 'd', ref: 'EEE555', v: '8.52', timestamp: '2026-10-06 09:00:00' },
  ];
  const s = R.summarize(reps);
  assert.equal(s.total, 5);
  assert.equal(s.themes[0].id, 'agence', 'le thème le plus signalé en premier');
  assert.equal(s.themes[0].count, 4); assert.equal(s.themes[0].playerCount, 3); assert.equal(s.themes[0].saves, 1);
  const top = s.themes[0].problems[0];
  assert.equal(top.count, 3, 'les trois messages « perdu des places » regroupés');
  assert.equal(top.players, 3);
  assert.deepEqual(top.refs.sort(), ['AAA111', 'BBB222', 'CCC333']);
  assert.equal(s.themes[0].repeated, 1);
  assert.equal(s.themes[1].id, 'sauvegarde');
  // texte à copier pour Claude
  const txt = R.toText(reps, 30);
  assert.match(txt, /5 sur 30 jours/); assert.match(txt, /AAA111 \(partie jointe\)/); assert.match(txt, /Classe ces problèmes/);
});
