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

test('Coupes nationales : une coupe par pays, jouées jusqu\'à un vainqueur dans la saison', () => {
  const s = newGame();
  assert.equal(Object.keys(s.cups).length, E.CUP_DEFS.length);
  assert.ok(E.CUP_DEFS.length >= 19, 'une coupe pour chacun des 19 pays');
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

test('V8.9 : partie commencée avant les nouveaux championnats — ils arrivent à l\'intersaison, sans casser la saison', () => {
  const s = newGame();
  // retire du monde les championnats ajoutés en V8.9, comme dans une sauvegarde plus ancienne
  const newIds = E.LEAGUES_V89.map(l => l.id);
  for (const id of newIds) {
    for (const cid of s.leagues[id].clubIds) { for (const pid of s.clubs[cid].squad) delete s.players[pid]; delete s.clubs[cid]; }
    delete s.leagues[id];
  }
  for (const id of Object.keys(s.cups)) if (!E.CUP_DEFS.find(d => d.id === id).leagues.some(l => s.leagues[l])) delete s.cups[id];
  playMonths(s, 12);
  for (const id of newIds) {
    assert.ok(s.leagues[id], id + ' ajouté à l\'intersaison');
    assert.ok(s.leagues[id].fixtures.length > 0, id + ' a son calendrier');
  }
  playMonths(s, 6);
  for (const id of newIds) assert.ok(s.leagues[id].clubIds.every(c => s.clubs[c].table.mj > 0), id + ' joue sa saison');
});

test('V8.9 : noms uniques et cohérents avec l\'origine', () => {
  const s = newGame();
  const ps = Object.values(s.players);
  assert.equal(new Set(ps.map(p => p.name)).size, ps.length, 'aucun homonyme dans un monde neuf');
  assert.ok(ps.every(p => p.origin === null || E.NAT_ORIGINS[p.nat][p.origin] > 0), 'origine possible pour la nationalité');
  // un Sénégalais porte un nom sénégalais ; un Français d'origine maghrébine, le plus souvent un nom du Maghreb
  const naf = ps.filter(p => p.nat === 'FR' && p.origin === 'naf');
  const maghreb = new Set(['MA', 'DZ', 'TN'].flatMap(c => E.NAME_POOLS[c].last));
  assert.ok(naf.filter(p => maghreb.has(p.name.split(' ').slice(1).join(' '))).length / naf.length > 0.6);
});


// partie « 8.8 » : le monde sans les championnats V8.9 (comme une ancienne sauvegarde)
function stripV89(s) {
  for (const lg of E.LEAGUES_V89) {
    for (const cid of s.leagues[lg.id].clubIds) { for (const pid of s.clubs[cid].squad) delete s.players[pid]; delete s.clubs[cid]; }
    delete s.leagues[lg.id];
  }
  for (const id of Object.keys(s.cups)) if (!E.CUP_DEFS.find(d => d.id === id).leagues.some(l => s.leagues[l])) delete s.cups[id];
  s.freeAgents = (s.freeAgents || []).filter(id => s.players[id]);
}

test('V8.9.1 : partie en cours convertie en novembre — nouveaux championnats tout de suite, coupes, Ligue des Champions à 32', () => {
  const s = newGame();
  playMonths(s, 3);
  stripV89(s);
  const res = E.integrateMissingLeagues(s);
  assert.equal(res.count, E.LEAGUES_V89.length);
  for (const lg of E.LEAGUES_V89) {
    const st = s.leagues[lg.id];
    assert.ok(st && st.fixtures.length > 0, lg.id + ' a un calendrier resserré');
    const months = new Set(st.fixtures.map(f => f.month));
    assert.ok(![8, 9, 10].some(m => months.has(m)), lg.id + ' : aucun match dans un mois déjà passé');
  }
  assert.equal(Object.keys(s.cups).length, E.CUP_DEFS.length, 'une coupe par pays dès cette saison');
  playMonths(s, 7); // novembre -> mai
  for (const lg of E.LEAGUES_V89) assert.ok(s.leagues[lg.id].fixtures.every(f => f.played), lg.id + ' : toute la saison resserrée jouée');
  playMonths(s, 2); // juin, juillet : fin de saison
  assert.ok(s.news.some(n => /sacré champion de Eredivisie/.test(n.text)), 'un champion des Pays-Bas');
  assert.equal(s.europe.stage, 'groups', 'Ligue des Champions jouée la saison suivante');
  assert.equal(s.europe.groups.flat().length, 32);
  assert.equal(Object.keys(s.cups).length, E.CUP_DEFS.length);
});

test('V8.9.1 : conversion trop tardive (mai) — pas de titre ni de montée pour un championnat qui n\'a pas joué', () => {
  const s = newGame();
  playMonths(s, 9); // mai : dernier mois de matchs
  stripV89(s);
  const ptBefore = [...s.leagues.PT.clubIds].sort();
  E.integrateMissingLeagues(s);
  assert.ok(E.LEAGUES_V89.every(l => s.leagues[l.id].catchUp === 'next' && s.leagues[l.id].fixtures.length === 0));
  playMonths(s, 3); // fin de saison
  for (const l of E.LEAGUES_V89) assert.ok(s.leagues[l.id].clubIds.every(c => !s.clubs[c].titlesWon), l.id + ' : aucun titre attribué');
  assert.deepEqual([...s.leagues.PT.clubIds].sort(), ptBefore, 'pas de montée/descente avec une Liga Portugal 2 qui n\'a pas joué');
  assert.equal(s.europe.stage, 'groups');
  assert.equal(s.europe.groups.flat().length, 32, 'places complétées par les 5 grands');
  assert.ok(E.LEAGUES_V89.every(l => s.leagues[l.id].fixtures.length > 0), 'saison complète l\'année suivante');
});

test('V8.9.1 : aucun vrai footballeur recréé, ni à la génération ni dans une partie existante (hors clients)', () => {
  for (let k = 0; k < 3; k++) {
    const s = newGame();
    const hits = Object.values(s.players).filter(p => E.FAMOUS_PLAYERS.has(p.name)).map(p => p.name);
    assert.deepEqual(hits, [], 'monde neuf sans vrai footballeur');
  }
  // partie existante : un joueur du monde et un client de l'agence portent un nom célèbre
  const s = newGame();
  const [a, b] = Object.values(s.players).filter(p => !p.retired);
  a.name = 'Thomas Müller'; b.name = 'Bruno Fernandes'; b.agentId = 'player';
  s.meta.famousCleanup = 0;
  assert.ok(E.renameFamousPlayers(s) >= 1);
  assert.notEqual(a.name, 'Thomas Müller', 'joueur du monde renommé');
  assert.equal(b.name, 'Bruno Fernandes', 'le client de l\'agence garde son nom');
  assert.equal(E.renameFamousPlayers(s), 0, 'une seule fois');
});

test('V8.9.1 : prépositions des pays', () => {
  assert.equal(E.inCountry('FR'), 'en France');
  assert.equal(E.inCountry('JP'), 'au Japon');
  assert.equal(E.inCountry('US'), 'aux États-Unis');
  assert.equal(E.inCountry('EC'), 'en Équateur');
  assert.equal(E.ofCountry('PT'), 'du Portugal');
  assert.equal(E.ofCountry('EN'), "de l'Angleterre");
  assert.equal(E.ofCountry('NL'), 'des Pays-Bas');
  for (const c of E.NAT_CODES) assert.match(E.inCountry(c), /^(en|au|aux) /);
});

test('V8.10 : Ligue 3 avec Amiens — montées et descentes chaînées entre les trois divisions', () => {
  const s = newGame();
  assert.equal(s.leagues.L3.clubIds.length, 18);
  assert.equal(s.clubs.amiens.league, 'L3');
  assert.ok(E.clubBudgetScale(s.clubs.bastia) < E.clubBudgetScale({ tier: 1, league: 'L2' }), 'moyens réduits en Ligue 3');
  const before = {};
  for (const lg of ['L1', 'L2', 'L3']) for (const c of s.leagues[lg].clubIds) before[c] = lg;
  playMonths(s, 12);
  const moves = Object.entries(before).filter(([c, lg]) => s.clubs[c].league !== lg).map(([c, lg]) => lg + '>' + s.clubs[c].league);
  const count = m => moves.filter(x => x === m).length;
  assert.ok(!moves.includes('L1>L3') && !moves.includes('L3>L1'), 'sans saut de division');
  for (const [down, up] of [['L1>L2', 'L2>L1'], ['L2>L3', 'L3>L2']]) {
    assert.equal(count(down), count(up), 'autant de montées que de descentes');
    assert.ok([2, 3].includes(count(down)), 'deux clubs, ou trois après un barrage gagné par le club d\'en bas');
  }
  assert.ok(s.news.filter(n => /^Barrage :/.test(n.text)).length >= 2, 'barrages L1/L2 et L2/L3 joués');
  for (const lg of ['L1', 'L2', 'L3']) {
    assert.equal(s.leagues[lg].clubIds.length, 18, lg);
    assert.ok(s.leagues[lg].clubIds.every(c => s.clubs[c].league === lg), lg + ' cohérent');
  }
  assert.ok(E.CUP_DEFS.find(d => d.id === 'FR').leagues.includes('L3'), 'Coupe de France ouverte à la Ligue 3');
});

test('V8.10 : partie existante — la Ligue 3 arrive au chargement, même en cours de saison', () => {
  const s = newGame();
  playMonths(s, 3);
  for (const cid of s.leagues.L3.clubIds) { for (const pid of s.clubs[cid].squad) delete s.players[pid]; delete s.clubs[cid]; }
  delete s.leagues.L3;
  s.cups.FR.ties = s.cups.FR.ties.filter(t => t.every(c => s.clubs[c]));
  const res = E.integrateMissingLeagues(s);
  assert.equal(res.count, 1);
  assert.match(res.text, /un nouveau championnat rejoint la partie \(Ligue 3\)/);
  assert.ok(s.leagues.L3.fixtures.length > 0 && s.clubs.amiens);
  playMonths(s, 9);
  assert.ok(s.news.some(n => /sacré champion de Ligue 3/.test(n.text)));
});

test('V8.10 : parts de clubs — achat, prise de contrôle, gestion, dividendes, vente', () => {
  const s = newGame();
  s.agent.cash = 50e6;
  const c = s.clubs.amiens;
  assert.equal(E.buyClubStake(s, 'amiens', 101).ok, false, 'pas plus de 100 %');
  assert.equal(E.injectClubFunds(s, 'amiens', 1e6).ok, false, 'pas de gestion sans le contrôle');
  const p10 = E.stakeBuyPrice(s, c, 10);
  assert.ok(Math.abs(p10 - E.clubValuation(s, c) / 10 * 1.03) < 10, 'prix = valorisation + 3 % de frais');
  assert.ok(E.buyClubStake(s, 'amiens', 10).ok);
  assert.equal(E.isClubOwner(s, 'amiens'), false);
  assert.ok(E.clubRelation(s, 'amiens') > 50, 'un actionnaire a l\'oreille du club');
  const news = [];
  const r = E.buyClubStake(s, 'amiens', 41, news);
  assert.ok(r.becameOwner && E.isClubOwner(s, 'amiens'));
  assert.match(news[0].text, /propriétaire d'Amiens SC/);
  assert.ok(E.setClubPolicy(s, 'amiens', 'tickets', 'bas').ok);
  assert.equal(E.setClubPolicy(s, 'amiens', 'tickets', 'gratuit').ok, false);
  const b0 = c.budget;
  const r5 = E.injectClubFunds(s, 'amiens', 5e6);
  assert.ok(r5.ok);
  assert.equal(c.budget, b0 + 5e6);
  assert.ok(r5.pct > 51, 'augmentation de capital : la part monte');
  const cap0 = c.stadiumCapacity;
  assert.ok(E.upgradeClubStadium(s, 'amiens', 'capacity').ok);
  assert.ok(c.stadiumCapacity > cap0);
  const round = E.deserializeState(E.serializeState(s));
  assert.equal(round.agent.stakes.amiens.pct, s.agent.stakes.amiens.pct, 'parts sauvegardées');
  assert.equal(round.clubs.amiens.ownerPolicy.tickets, 'bas', 'choix du propriétaire sauvegardés');
  const cash0 = s.agent.cash;
  playMonths(s, 12);
  assert.ok(s.agent.stakes.amiens.divs > 0, 'dividendes en fin de saison');
  assert.ok(s.news.some(n => /Dividendes de vos parts de clubs/.test(n.text)));
  const sold = E.sellClubStake(s, 'amiens', s.agent.stakes.amiens.pct, []);
  assert.ok(sold.ok && sold.lostControl && !s.agent.stakes.amiens && !c.ownerPolicy);
  assert.ok(s.agent.cash > cash0, 'revente encaissée');
});

test('V8.11 : faillite — la banque vend d\'abord les parts de clubs', () => {
  const s = newGame();
  s.agent.cash = 20e6;
  E.buyClubStake(s, 'amiens', 51);
  s.agent.cash = -3e6;
  playMonths(s, 7);
  assert.equal(s.agent.careerStats.bankruptcies || 0, 0, 'les parts couvrent la dette : pas de restructuration');
  assert.ok(s.agent.cash > -250000);
  assert.ok((s.agent.stakes.amiens || { pct: 0 }).pct < 51, 'une partie des parts a été vendue');
  assert.ok(s.news.some(n => /la banque vend/.test(n.text)));
});

test('V8.11 : propriétaire — augmentation de capital, objectif, supporters, intransférable, centre de formation', () => {
  const s = newGame();
  s.agent.cash = 80e6;
  const c = s.clubs.amiens;
  E.buyClubStake(s, 'amiens', 51);
  assert.ok(c.ownerObjective && c.ownerObjective.label, 'objectif fixé à la prise de contrôle');
  assert.equal(c.fanMood, 60);
  const expected = E.capitalIncreasePct(s, c, 10e6);
  const r = E.injectClubFunds(s, 'amiens', 10e6);
  assert.equal(r.pct, expected);
  assert.ok(r.pct > 60, 'la part monte avec l\'apport');
  const sell = E.stakeSellPrice(s, c, r.pct);
  assert.ok(sell > 0.9 * (E.clubValuation(s, c) * r.pct / 100), 'l\'apport se retrouve dans la valeur de vos parts');
  // le plus jeune du club (un vétéran peut prendre sa retraite pendant la saison simulée)
  const p = c.squad.map(id => s.players[id]).sort((a, b) => a.age - b.age)[0];
  assert.ok(E.setPlayerUntouchable(s, p.id, true).ok);
  s.transferListed.push(p.id);
  assert.equal(E.setPlayerListed(s, p.id, false).ok, true);
  assert.ok(!s.transferListed.includes(p.id));
  assert.equal(E.setPlayerUntouchable(s, s.clubs.psg.squad[0], true).ok, false, 'pas sur un club qu\'on ne possède pas');
  c.budget = 50e6;
  assert.ok(E.upgradeClubStadium(s, 'amiens', 'academy').ok);
  assert.equal(c.academyLevel, 1);
  playMonths(s, 12);
  const q = s.players[p.id];
  assert.ok(q && (q.club === 'amiens' || !q.untouchable), 'un intransférable reste au club (sauf fin de contrat)');
  assert.ok(s.news.some(n => /Objectif (atteint|manqué) pour Amiens SC/.test(n.text)), 'bilan de l\'objectif');
  assert.ok(c.fanMood !== 60, 'l\'humeur des supporters a bougé');
  assert.ok(c.ownerObjective && c.ownerObjective.league === c.league, 'nouvel objectif pour la nouvelle saison, dans la bonne division');
  assert.ok(s.achievements.unlocked.includes('president'), 'trophée « Président »');
});

test('V8.11 : agents rivaux actionnaires — part disponible limitée, rachat avec prime', () => {
  const s = newGame();
  s.agent.cash = 80e6;
  const ra = s.rivalAgents[0];
  s.rivalStakes = { amiens: { [ra.id]: 60 } };
  assert.ok(E.rivalOwner(s, 'amiens'), 'un rival contrôle le club');
  assert.ok(E.clubRelation(s, 'amiens') < 50, 'club d\'un rival : relation dégradée');
  assert.equal(E.availableStakePct(s, 'amiens'), 40);
  const refused = E.buyClubStake(s, 'amiens', 51);
  assert.equal(refused.ok, false);
  assert.match(refused.reason, /détient 60 %/);
  const cash0 = ra.cash;
  const r = E.buyOutRival(s, 'amiens', ra.id, []);
  assert.ok(r.ok && r.becameOwner);
  assert.ok(ra.cash > cash0);
  assert.equal(E.availableStakePct(s, 'amiens'), 40);
  s.rivalAgents.forEach(x => { x.cash = 50e6; });
  for (let i = 0; i < 5; i++) E.runRivalInvestments(s, []);
  assert.ok(Object.keys(s.rivalStakes).length > 0, 'les rivaux investissent');
  for (const [cid, h] of Object.entries(s.rivalStakes)) assert.ok(Object.values(h).reduce((a, b) => a + b, 0) + E.stakePct(s, cid) <= 100.0001, cid);
});

test('V8.11 : dividendes imposés, conflit d\'intérêts, derbys et barrages', () => {
  const s = newGame();
  s.agent.cash = 200e6;
  E.buyClubStake(s, 'psg', 2);
  const p = s.players[s.onboarding.starterPlayerId];
  p.agentId = 'player';
  assert.ok(E.buyClubStake(s, 'lens', 30).ok);
  E.executeTransfer(s, p, s.clubs.lens, 0, [], {});
  assert.equal(s.agent.careerStats.conflictDeals, 1, 'transfert d\'un client vers un club dont on détient 30 %');
  assert.equal(E.derbyName('om', 'psg'), 'Le Classique');
  assert.equal(E.derbyName('amiens', 'lens'), E.derbyName('lens', 'amiens'));
  playMonths(s, 4);
  assert.ok(Object.values(s.leagues).some(l => l.fixtures.some(f => f.played && f.derby)), 'des derbys joués');
  playMonths(s, 8);
  const divNews = s.news.find(n => /Dividendes de vos parts/.test(n.text));
  assert.ok(divNews && /après 30 % d'impôt/.test(divNews.text));
  assert.ok(s.news.filter(n => /^Barrage :/.test(n.text)).length >= 3, 'barrages L1/L2, L2/L3 et Bundesliga');
  const pr = E.playPlayoff(s, 'psg', 'amiens');
  assert.ok(['psg', 'amiens'].includes(pr.winner) && pr.aGoals >= 0 && pr.bGoals >= 0);
});

test('V8.11 : plafond de masse salariale indexé sur la valeur des joueurs', () => {
  const s = newGame();
  playMonths(s, 24);
  const ratios = s.leagues.L1.clubIds.map(id => { const c = s.clubs[id]; return c.squad.reduce((t, pid) => t + (s.players[pid] ? s.players[pid].wage : 0), 0) / c.wageBudget; }).sort((a, b) => a - b);
  assert.ok(ratios[ratios.length >> 1] < 1.25, 'masse salariale médiane proche du plafond : ' + ratios[ratios.length >> 1].toFixed(2));
});

test('V8.13 : sélections nationales — trêves, Coupe du monde, Euro, Copa América, CAN', () => {
  const s = newGame();
  const ranking = E.nationRanking(s);
  assert.ok(ranking.length >= 40, 'presque tous les pays ont une sélection');
  for (const t of ranking) assert.ok(t.squad.length <= 23 && t.squad.filter(p => p.pos === 'GK').length >= 1, t.nat);
  assert.equal(E.theCountry('AR'), "l'Argentine");
  assert.equal(E.theCountry('BR'), 'le Brésil');
  assert.equal(E.theCountry('US'), 'les États-Unis');
  // tournois des années 2030 (Coupe du monde), 2028 (Euro + Copa), 2029 (CAN)
  const wcDef = E.INTL_TOURNAMENTS.find(d => d.id === 'wc');
  assert.ok(wcDef.when(2030) && !wcDef.when(2028));
  const news = [];
  const wc = E.playIntlTournament(s, wcDef, 2030, news);
  assert.equal(wc.groups.length, 8);
  assert.deepEqual(wc.rounds.map(r => r.name), ['Huitièmes de finale', 'Quarts de finale', 'Demi-finales', 'Finale']);
  assert.ok(news.some(n => /remporte la Coupe du monde 2030/.test(n.text)));
  const winners = Object.values(s.players).filter(p => (p.trophies || []).some(t => t.title === 'Coupe du monde 2030'));
  assert.ok(winners.length >= 15 && winners.every(p => p.nat === wc.winner), 'les champions du monde ont leur trophée');
  // une saison jouée : trêves (sélections) et tournoi de l'été 2027 (CAN)
  playMonths(s, 12);
  assert.ok(Object.values(s.players).some(p => p.caps >= 8), 'des sélections comptées');
  assert.ok(s.intl.history.some(r => r.id === 'can' && r.year === 2027), 'CAN 2027 jouée');
  const round = E.deserializeState(E.serializeState(s));
  const capped = Object.values(s.players).find(p => p.caps);
  assert.equal(round.players[capped.id].caps, capped.caps, 'sélections sauvegardées');
});
