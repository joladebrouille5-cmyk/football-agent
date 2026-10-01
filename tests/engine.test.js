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
  const s = newGame(); // août : fenêtre d'été ouverte (V8.4)
  const p = Object.values(s.players).find(x => x.club);
  assert.equal(E.isMercatoOpen(s), true);
  playMonths(s, 1); // septembre
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
  p.agentId = 'player'; s.agent.portfolio.push(p.id); p.lastTransferMonth = s.date.absMonth; p.lastPermanentMove = s.date.absMonth;
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

test('Défis de saison : trois objectifs, dont les commissions, avec récompense', () => {
  const s = newGame();
  assert.equal(s.seasonGoals.length, 3);
  assert.ok(s.seasonGoals.some(g => g.id === 'commissions'));
  for (const g of s.seasonGoals) { assert.ok(g.reward.cash > 0); assert.ok(E.goalProgress(s, g) >= 0); }
});

test('Leviers d\'influence : campagne d\'image une fois par saison, partenariat club', () => {
  const s = newGame();
  s.agent.cash = 50000000;
  const rep0 = s.agent.reputation;
  assert.equal(E.launchImageCampaign(s).ok, true);
  assert.ok(s.agent.reputation > rep0);
  assert.equal(E.launchImageCampaign(s).ok, false, 'une seule campagne par saison');
  const club = Object.values(s.clubs)[0];
  const budget0 = club.budget;
  assert.equal(E.signClubPartnership(s, club.id).ok, true);
  assert.ok(club.budget > budget0);
  assert.equal(E.clubRelation(s, club.id), 62);
  assert.equal(E.signClubPartnership(s, club.id).ok, false, 'un partenariat par club et par saison');
});

test('Coupes nationales : six coupes, jouées jusqu\'à un vainqueur dans la saison', () => {
  const s = newGame();
  assert.equal(Object.keys(s.cups).length, 6);
  playMonths(s, 10); // août -> mai inclus
  for (const cup of Object.values(s.cups)) {
    assert.ok(cup.winner, cup.name + ' a un vainqueur');
    assert.ok(cup.history.every(h => h.results.every(r => r.w === r.h || r.w === r.a)));
  }
});

test('Événements : pas de répétition rapprochée ni de double « première sélection »', () => {
  const s = newGame();
  const seen = {}, sel = {};
  for (let m = 0; m < 120; m++) {
    if (s.pendingEvent) {
      const e = s.pendingEvent;
      if (!/contact|performance|status_|goal_/.test(e.id)) { if (seen[e.id] !== undefined) assert.ok(m - seen[e.id] >= 6, e.id); seen[e.id] = m; }
      if (e.id === 'selection_nationale') { sel[e.playerId] = (sel[e.playerId] || 0) + 1; assert.equal(sel[e.playerId], 1); }
      E.resolveEvent(s, 0);
    }
    E.advanceMonth(s);
  }
});

test('8.4 : toute offre visible peut être acceptée (fenêtre, délai, consentement)', () => {
  for (let run = 0; run < 2; run++) {
    const s = newGame();
    const cl = Object.values(s.players).filter(p => p.club && !p.agentId && p.ovr >= 68).slice(0, 10);
    for (const p of cl) { p.agentId = 'player'; s.agent.portfolio.push(p.id); }
    for (let m = 0; m < 26; m++) {
      if (s.pendingEvent) E.resolveEvent(s, 0);
      E.advanceMonth(s);
      for (const o of E.visibleOffers(s)) {
        const p = s.players[o.playerId];
        if (!p || !p.club || !o.fee) continue;
        const move = E.canMoveNow(s, p, s.clubs[o.clubId]); // fenêtre, délai et consentement (V8.5 : assertion réelle)
        assert.equal(move.ok, true, move.reason);
      }
    }
  }
});

test('8.4 : la négociation garde une part d\'échec (contre-offre à risque)', () => {
  const s = newGame();
  playMonths(s, 5); // janvier
  let tries = 0, fails = 0;
  for (const p of Object.values(s.players).filter(x => x.club).slice(0, 250)) {
    p.agentId = 'player';
    const c = Object.values(s.clubs).find(c => c.id !== p.club && Math.abs(c.tier - s.clubs[p.club].tier) <= 1 && c.budget > p.value * 2);
    if (c) {
      const offer = { salary: p.wage, years: 2, roleProm: 'titulaire', commissionPct: 12, targetClubId: c.id, fee: E.estimateTransferFee(p, c, s) };
      if (E.evaluateNegotiationGate(s, p, offer).ok) {
        tries++;
        const ev = E.evaluateOffer(s, p, offer);
        if (!ev.accept) { const co = ev.score >= E.COUNTER_MIN_SCORE ? E.generateCounterOffer(s, p, offer) : null; if (!co || !E.counterOfferHolds(s, p, co.offer, co.ev)) fails++; }
      }
    }
    p.agentId = null;
  }
  assert.ok(tries > 50);
  assert.ok(fails / tries >= 0.04 && fails / tries < 0.4, `taux d'échec ${fails}/${tries}`); // 0 % en 8.3
});

test('8.4 : faillite après six mois sous -250 k€, puis redémarrage', () => {
  const s = newGame();
  s.agent.cash = -2000000;
  playMonths(s, 6);
  assert.equal(s.agent.careerStats.bankruptcies, 1);
  assert.ok(s.agent.cash > -250000 && s.agent.officeLevel === 1 && s.agent.portfolio.length <= 3);
});

test('8.4 : le jury est plus exigeant avec le tenant du titre', () => {
  const s = newGame();
  assert.equal(E.reignFactor(s), 1);
  s.agent.careerStats.agentOfYearStreak = 3;
  assert.ok(Math.abs(E.reignFactor(s) - 0.76) < 1e-9);
  s.agent.careerStats.agentOfYearStreak = 9;
  assert.ok(Math.abs(E.reignFactor(s) - 0.6) < 1e-9);
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
  assert.ok(s.rivalAgents.some(r => (r.careerStats.totalCommissions || 0) > 500000), 'les rivaux font des affaires');
  assert.ok(E.agentRank(s) >= 1 && E.agentRank(s) <= 13);
  const round = E.deserializeState(E.serializeState(s));
  assert.equal(E.serializeState(round), E.serializeState(s), 'aller-retour de sauvegarde fidèle');
});

test('8.5 : hors mercato, un client sous contrat ne peut pas bouger ; les clubs qu\'il refuserait ne sont pas proposés', () => {
  const s = newGame();
  playMonths(s, 2); // octobre
  const p = Object.values(s.players).find(x => x.club && s.clubs[x.club].tier <= 3);
  assert.equal(E.canMoveNow(s, p).ok, false);
  assert.match(E.canMoveNow(s, p).reason, /janvier/i);
  playMonths(s, 3); // janvier
  p.lastTransferMonth = null; // l'IA a pu le transférer entre-temps : on isole la règle de la fenêtre (test instable en 8.5)
  assert.equal(E.canMoveNow(s, p).ok, true);
  p.agentId = 'player'; s.agent.portfolio.push(p.id); p.lastPermanentMove = s.date.absMonth - 2;
  const cur = s.clubs[p.club];
  for (const o of E.findInterestedClubs(s, p.id)) assert.ok(s.clubs[o.clubId].tier > cur.tier, 'club refusé par le client proposé');
});

test('8.5 : le libellé de démarchage annonce le vrai mois de reprise', () => {
  const s = newGame();
  playMonths(s, 2); // octobre : les clubs n'écoutent qu'à partir de décembre
  const p = Object.values(s.players).find(x => x.club);
  const club = Object.values(s.clubs).find(c => c.id !== p.club);
  assert.equal(E.pitchStatus(s, p, club.id).ok, false);
  assert.equal(E.pitchWaitLabel(s, p, club.id), 'Décembre (dans 2 mois)');
  playMonths(s, 1); // novembre
  assert.equal(E.pitchWaitLabel(s, p, club.id), 'Le mois prochain');
});

test('8.5 : des joueurs libres dès le départ', () => {
  const s = newGame();
  const free = s.freeAgents.map(id => s.players[id]).filter(p => p && !p.club && !p.agentId);
  assert.equal(free.length, E.START_FREE_AGENTS);
  assert.ok(free.filter(p => p.age <= 21).length >= 5);
});

test('8.5 : impôt estimé en cours de saison, identique au prélèvement du bilan', () => {
  const s = newGame();
  assert.equal(E.estimatedSeasonTax(s), 0);
  s.agent.careerStats.totalCommissions += 3000000;
  assert.equal(E.estimatedSeasonTax(s), E.seasonTaxOn(3000000));
  s.agent.cash = E.estimatedSeasonTax(s) + 100000;
  assert.equal(E.spendLeavesTaxCovered(s, 50000), true);
  assert.equal(E.spendLeavesTaxCovered(s, 200000), false);
});

test('8.5 : les offres des clubs pour un client sous contrat sont utilisables dès le mois suivant', () => {
  for (let run = 0; run < 3; run++) {
    const s = newGame();
    for (const p of Object.values(s.players).filter(x => x.club && !x.agentId && x.ovr >= 66).slice(0, 12)) { p.agentId = 'player'; s.agent.portfolio.push(p.id); }
    for (let m = 0; m < 24; m++) {
      const now = s.date.absMonth;
      s.incomingOffers = [];
      E.generateIncomingOffers(s, []);
      for (const o of s.incomingOffers) if (s.players[o.playerId].club) assert.ok(o.visibleFrom <= now + 1, `offre visible ${o.visibleFrom - now} mois plus tard`);
      if (s.pendingEvent) E.resolveEvent(s, 0);
      E.advanceMonth(s);
    }
  }
});

test('8.5 : le palmarès pèse aussi sur le jury', () => {
  const s = newGame();
  s.agent.careerStats.agentOfYear = 8; s.agent.careerStats.agentOfYearStreak = 0;
  assert.ok(Math.abs(E.reignFactor(s) - 0.85) < 1e-9);
  s.agent.careerStats.agentOfYear = 20; s.agent.careerStats.agentOfYearStreak = 9;
  assert.ok(Math.abs(E.reignFactor(s) - 0.36) < 1e-9);
});

test('8.6 : un client perdu emporte ses offres (rupture, débauchage, transfert forcé)', () => {
  const s = newGame(); // août : mercato ouvert
  const pick = () => { const p = Object.values(s.players).find(x => x.club && !x.agentId && x.ovr >= 60 && x.lastTransferMonth == null); p.agentId = 'player'; s.agent.portfolio.push(p.id); return p; };
  const offerFor = p => {
    const c = Object.values(s.clubs).filter(c => c.id !== p.club && !(s.incomingOffers || []).some(o => o.playerId === p.id && o.clubId === c.id)).sort((a, b) => b.budget - a.budget)[0];
    const r = E.createIncomingOffer(s, p, c, Math.round(p.value), p.wage);
    assert.ok(r.ok, r.reason);
    return r.offer;
  };
  const dropped = pick(); const o1 = offerFor(dropped);
  E.resolveDropClient(s, dropped.id);
  const poached = pick(); const o2 = offerFor(poached);
  E.poachClient(s, poached, s.rivalAgents[0], []);
  for (const o of [o1, o2]) {
    assert.equal(E.visibleOffers(s).some(x => x.id === o.id), false, 'offre encore visible');
    assert.equal(E.acceptIncomingOffer(s, o.id).ok, false, 'offre encore acceptable');
  }
  // une offre restée en mémoire pour un ancien client n'est ni visible ni acceptable
  const ghost = pick(); const o3 = offerFor(ghost); ghost.agentId = null;
  assert.equal(E.visibleOffers(s).some(x => x.id === o3.id), false);
  assert.equal(E.acceptIncomingOffer(s, o3.id).ok, false);
  // transfert par un autre chemin (clause, événement) : les autres offres tombent
  const moved = pick(); offerFor(moved);
  const buyer = Object.values(s.clubs).find(c => c.id !== moved.club && !s.incomingOffers.some(o => o.clubId === c.id && o.playerId === moved.id));
  E.executeTransfer(s, moved, buyer, Math.round(moved.value), [], { silent: true });
  assert.equal(s.incomingOffers.some(o => o.playerId === moved.id), false);
});

test('8.6 : le vivier de départ reste disponible jusqu\'en décembre, et l\'agence nationale coûte 200 k€', () => {
  for (let run = 0; run < 3; run++) {
    const s = newGame();
    const seed = s.freeAgents.slice();
    playMonths(s, 4); // août -> novembre : ni les clubs ni les rivaux ne les ont pris
    const left = seed.map(id => s.players[id]).filter(p => p && !p.club && !p.agentId);
    assert.equal(left.length, seed.length);
    const q = E.deserializeState(E.serializeState(s)).players[seed[0]];
    assert.equal(q.reservedUntil, 4, 'réservation conservée par la sauvegarde');
  }
  assert.equal(E.OFFICE_LEVELS[1].cost, 200000);
});
