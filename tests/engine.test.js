// Tests du moteur (Node >= 18, sans dépendance) : `npm test`
// Couvre les corrections de l'audit 8.2 (P0/P1) et des invariants de simulation sur plusieurs saisons.
const test = require('node:test');
const assert = require('node:assert/strict');
const { loadEngine } = require('./load-engine');

const E = loadEngine();
const newGame = () => E.createNewGame({ agentName: 'Test', agency: 'Test', nationality: 'FR', specialty: 'negociateur' });
const playMonths = (s, n) => { for (let i = 0; i < n; i++) { if (s.pendingEvent) E.resolveEvent(s, 0); E.advanceMonth(s); } };

test('P0-5 : chaque onze aligne exactement un gardien et onze joueurs', () => {
  const s = newGame();
  for (let r = 0; r < 20; r++) {
    for (const c of Object.values(s.clubs)) {
      const xi = E.pickLineup(c.squad.map(id => s.players[id]).filter(Boolean));
      assert.equal(xi.length, 11);
      assert.equal(xi.filter(p => p.pos === 'GK').length, 1, c.name);
    }
  }
});

test('P0-1 : impossible de renégocier le contrat d\'un client sans club', () => {
  const s = newGame();
  const p = s.players[s.onboarding.starterPlayerId];
  assert.equal(p.club, null);
  const gate = E.evaluateNegotiationGate(s, p, { salary: p.wage * 2.5, years: 5, roleProm: 'titulaire', commissionPct: 20, targetClubId: null });
  assert.equal(gate.ok, false);
  const cash = s.agent.cash;
  E.applyAcceptedOffer(s, p, { salary: p.wage * 2.5, years: 5, roleProm: 'titulaire', commissionPct: 20, targetClubId: null }, []);
  assert.equal(s.agent.cash, cash, 'aucune commission sans club payeur');
});

test('P0-2 : aucune indemnité pour un joueur libre, frais d\'agent à la place', () => {
  const s = newGame();
  const p = s.players[s.onboarding.starterPlayerId];
  const offers = E.findInterestedClubs(s, p.id);
  assert.ok(offers.length > 0);
  for (const o of offers) assert.equal(o.fee, 0);
  const before = s.agent.careerStats.totalCommissions;
  p.wage = offers[0].wage;
  E.executeTransfer(s, p, s.clubs[offers[0].clubId], 0, [], {});
  const gained = s.agent.careerStats.totalCommissions - before;
  assert.equal(gained, Math.round(p.wage * 12 * (0.10 + 0.02)));
});

test('P0-3 : la sauvegarde conserve les champs joueur posés en cours de partie', () => {
  const s = newGame();
  const p = s.players[s.onboarding.starterPlayerId];
  Object.assign(p, { lastPitchAt: 3, pitchLog: { psg: 3 }, benchStreak: 2, lastStatusMsgAt: 1 });
  const q = E.deserializeState(E.serializeState(s)).players[p.id];
  for (const k of ['personalGoal', 'lastPitchAt', 'pitchLog', 'benchStreak', 'lastStatusMsgAt']) assert.deepEqual(q[k], p[k], k);
});

test('P1-1 : hors mercato, un joueur sous contrat ne peut pas changer de club', () => {
  const s = newGame(); // août
  const p = Object.values(s.players).find(x => x.club);
  assert.equal(E.isMercatoOpen(s), false);
  assert.equal(E.evaluateMercatoWindow(s, p).ok, false);
  const free = s.players[s.onboarding.starterPlayerId];
  assert.equal(E.evaluateMercatoWindow(s, free).ok, true, 'un joueur libre signe à tout moment');
});

test('P1-2 : probabilité d\'accord et décision stable pour une même offre', () => {
  assert.equal(Math.round(E.acceptanceChance(55) * 100), 50);
  assert.ok(E.acceptanceChance(65) > 0.85 && E.acceptanceChance(45) < 0.15);
  const s = newGame();
  const p = Object.values(s.players).find(x => x.club);
  const offer = { salary: p.wage, years: 3, roleProm: 'rotation', commissionPct: 10, targetClubId: p.club, fee: 0 };
  const first = E.evaluateOffer(s, p, offer).accept;
  for (let i = 0; i < 10; i++) assert.equal(E.evaluateOffer(s, p, offer).accept, first);
});

test('Un client tout juste transféré refuse de repartir dans l\'année, sauf pour un club plus huppé', () => {
  const s = newGame();
  const p = Object.values(s.players).find(x => x.club && s.clubs[x.club].tier <= 3);
  p.agentId = 'player'; s.agent.portfolio.push(p.id); p.lastTransferMonth = s.date.absMonth;
  const cur = s.clubs[p.club];
  const same = Object.values(s.clubs).find(c => c.id !== cur.id && c.tier === cur.tier);
  const bigger = Object.values(s.clubs).find(c => c.tier > cur.tier);
  assert.equal(E.evaluateClientConsent(s, p, same).ok, false);
  assert.equal(E.evaluateClientConsent(s, p, bigger).ok, true);
});

test('P1-4 : impôt progressif sur les commissions', () => {
  assert.equal(E.seasonTaxOn(150000), 0);
  assert.equal(E.seasonTaxOn(1000000), 200000);
  assert.ok(E.seasonTaxOn(50000000) > E.seasonTaxOn(10000000));
});

test('Simulation de 5 saisons : monde cohérent (contrats, gardiens, effectifs, sauvegarde)', () => {
  const s = newGame();
  playMonths(s, 5 * 12);
  const y = E.seasonStartYear(s);
  const inClub = Object.values(s.players).filter(p => p.club);
  assert.equal(inClub.filter(p => p.contractUntil && p.contractUntil <= y).length, 0, 'aucun contrat expiré au club');
  for (const c of Object.values(s.clubs)) {
    assert.ok(c.squad.some(id => s.players[id] && s.players[id].pos === 'GK'), `${c.name} a un gardien`);
    assert.ok(c.squad.length >= 15, `${c.name} : effectif jouable (${c.squad.length})`);
    for (const id of c.squad) assert.equal(s.players[id] && s.players[id].club, c.id, 'effectif cohérent');
  }
  const round = E.deserializeState(E.serializeState(s));
  assert.equal(E.serializeState(round), E.serializeState(s), 'aller-retour de sauvegarde fidèle');
});
