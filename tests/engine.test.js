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
  assert.ok(news.some(n => /Coupe du monde 2030 : .* s'impose en finale/.test(n.text)));
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

test('V8.15 : avancer par semaine — 4 semaines valent un mois', () => {
  const s = newGame();
  const lg = s.leagues.L1, month = E.calMonth(s);
  const weeks = E.fixtureWeeks(lg, month);
  assert.ok(weeks.length > 0 && new Set(weeks.map(x => x.week)).size >= 3, 'journées réparties sur les semaines');
  const abs0 = s.date.absMonth;
  for (let w = 0; w < 3; w++) {
    const r = E.advanceWeek(s);
    assert.equal(r.monthEnd, false);
    assert.equal(s.date.absMonth, abs0, 'toujours le même mois');
    assert.equal(E.currentWeek(s), w + 1);
    const done = weeks.filter(x => x.f.played);
    assert.ok(done.every(x => x.week <= w) && weeks.filter(x => x.week <= w).every(x => x.f.played), 'semaine ' + (w + 1) + ' jouée, pas plus');
  }
  const r = E.advanceWeek(s);
  assert.equal(r.monthEnd, true);
  assert.equal(s.date.absMonth, abs0 + 1, 'la 4e semaine boucle le mois');
  assert.equal(E.currentWeek(s), 0);
  assert.ok(weeks.every(x => x.f.played), 'tout le mois joué');
  assert.ok(!s.weekCarry, 'réactions de la semaine consommées');
  // repasser au mois en pleine semaine joue le reste du mois
  E.advanceWeek(s);
  E.advanceMonth(s);
  assert.equal(E.currentWeek(s), 0);
  assert.ok(Object.values(s.leagues).every(l => l.fixtures.filter(f => f.month === 9).every(f => f.played)), 'septembre entièrement joué');
  // une saison complète à la semaine : tous les matchs joués
  while (E.calMonth(s) !== 7) { if (s.pendingEvent) E.resolveEvent(s, 0); E.advanceWeek(s); }
  assert.ok(Object.values(s.leagues).every(l => l.fixtures.every(f => f.played || !s.clubs[f.home] || !s.clubs[f.away])), 'saison complète jouée');
  const back = E.deserializeState(E.serializeState(s));
  assert.equal(E.currentWeek(back), E.currentWeek(s), 'semaine sauvegardée');
});

test('V8.17 : à la semaine, sélections, Europe et coupes jouées dans le mois, une seule fois ; intersaison d\'un coup', () => {
  const s = newGame();
  playMonths(s, 13); // septembre de la 2e saison (la Ligue des Champions commence la 2e saison) : coupes, groupes, trêve
  assert.equal(E.calMonth(s), 9);
  // un client sûr : le portefeuille a pu se vider en 13 mois (le test ne doit pas dépendre du hasard)
  let client = s.players[s.agent.portfolio[0]];
  if (!client) { client = s.players[s.clubs.psg.squad[0]]; client.agentId = 'player'; s.agent.portfolio.push(client.id); }
  if (!client.club) { client.club = 'psg'; s.clubs.psg.squad.push(client.id); }
  client.ovr = Math.max(client.ovr, 88); client.injuredUntil = 0; client.suspendedMatches = 0; // titulaire
  const cupRounds = () => Object.values(s.cups).reduce((n, c) => n + c.history.length, 0);
  const euroPlayed = () => s.europe.fixtures ? s.europe.fixtures.filter(f => f.played).length : 0;
  const caps = () => Object.values(s.players).reduce((n, p) => n + (p.caps || 0), 0);
  const c0 = cupRounds(), e0 = euroPlayed(), k0 = caps();
  E.advanceWeek(s); // semaine 1 : sélections
  assert.ok(caps() > k0, 'trêve internationale en semaine 1');
  assert.equal(cupRounds(), c0); assert.equal(euroPlayed(), e0);
  E.advanceWeek(s); // semaine 2 : Ligue des Champions
  const e1 = euroPlayed();
  assert.ok(e1 > e0, 'Ligue des Champions en semaine 2');
  assert.equal(cupRounds(), c0);
  E.advanceWeek(s); // semaine 3 : coupes
  const c1 = cupRounds();
  assert.ok(c1 > c0, 'coupes en semaine 3');
  const k1 = caps();
  E.advanceWeek(s); // semaine 4 : fin du mois, rien n'est rejoué
  assert.equal(E.calMonth(s), 10);
  assert.equal(euroPlayed(), e1, 'Europe pas rejouée'); assert.equal(cupRounds(), c1, 'coupes pas rejouées'); assert.equal(caps(), k1, 'sélections pas rejouées');
  // notes de vos joueurs gardées sur leurs matchs de championnat (les matchs de coupe et d'Europe comptent aussi
  // dans « apps », mais n'ont pas de feuille de match de championnat) : un mois de plus, client titulaire et en forme
  const ratedNow = () => Object.values(s.leagues).flatMap(l => l.fixtures.filter(f => f.played && f.rt && f.rt[client.id]));
  for (let w = 0; w < 4; w++) {
    if (s.pendingEvent) E.resolveEvent(s, 0);
    if (client.club !== 'psg' && s.clubs[client.club]) { s.clubs[client.club].squad = s.clubs[client.club].squad.filter(id => id !== client.id); client.club = 'psg'; s.clubs.psg.squad.push(client.id); }
    client.injuredUntil = 0; client.suspendedMatches = 0; client.fatigue = 0; client.ovr = Math.max(client.ovr, 88);
    E.advanceWeek(s);
  }
  const withRating = ratedNow();
  assert.ok(withRating.length > 0, 'note du client sur la feuille de match');
  assert.ok(withRating.length <= (client.seasonStats.apps || 0));
  assert.ok(withRating.every(f => f.rt[client.id] >= 3 && f.rt[client.id] <= 10));
  // intersaison : juin puis juillet passent chacun d'un coup
  while (E.calMonth(s) !== 6) { if (s.pendingEvent) E.resolveEvent(s, 0); E.advanceMonth(s); }
  assert.ok(E.isOffSeasonMonth(s));
  if (s.pendingEvent) E.resolveEvent(s, 0);
  const r = E.advanceWeek(s);
  assert.equal(r.monthEnd, true); assert.equal(E.calMonth(s), 7); assert.equal(E.currentWeek(s), 0);
});

test('V8.18 : jalons, offres de dernière minute, scénarios, histoire du joueur, ennemi juré, pépites rares', () => {
  // scénarios de départ
  const zero = E.createNewGame({ agentName: 'Z', agency: 'Z', nationality: 'FR', specialty: 'negociateur', scenario: 'zero' });
  assert.ok(zero.agent.cash <= 20000 && zero.agent.reputation <= 2);
  const am = E.createNewGame({ agentName: 'A', agency: 'A', nationality: 'FR', specialty: 'negociateur', scenario: 'amiens', legacyBonus: 30000 });
  assert.ok(am.agent.stakes.amiens.pct >= 51, 'propriétaire d\'Amiens');
  const br = E.createNewGame({ agentName: 'B', agency: 'B', nationality: 'FR', specialty: 'negociateur', scenario: 'bresil' });
  assert.equal(br.agent.nationality, 'BR'); assert.equal(br.players[br.agent.portfolio[0]].nat, 'BR');
  const s = newGame();
  assert.ok(s.meta.careerId);
  const p = s.players[s.agent.portfolio[0]];
  assert.ok(p.story.some(x => /Rejoint/.test(x.t)), 'histoire : signature');
  // jalons : notés sans fanfare au premier passage, fêtés une fois ensuite
  p.careerApps = 49; const news = [];
  E.checkMilestones(s, news); assert.equal(news.length, 0);
  p.careerApps = 50; E.checkMilestones(s, news); E.checkMilestones(s, news);
  assert.equal(news.filter(n => n.milestone).length, 1, '50e match fêté une seule fois');
  assert.ok(p.story.some(x => /50e match/.test(x.t)));
  // dernier jour du mercato : août = dernier mois de la fenêtre d'été
  assert.ok(E.isMercatoDeadline(s));
  p.club = 'om'; s.clubs.om.squad.push(p.id); p.ovr = 78;
  let got = 0;
  for (let k = 0; k < 20 && !got; k++) { s.deadlineDone = null; s.incomingOffers = []; got = E.deadlineDayOffers(s, []); }
  assert.ok(got > 0, 'offre de dernière minute');
  const o = s.incomingOffers.find(x => x.lastMinute);
  assert.ok(o && o.expires === s.date.absMonth, 'valable jusqu\'à la clôture');
  assert.equal(E.deadlineDayOffers(s, []), 0, 'une seule vague par fenêtre');
  // ennemi juré
  assert.equal(E.nemesisOf(s), null);
  s.rivalAgents[2].rivalry = 40;
  assert.equal(E.nemesisOf(s).id, s.rivalAgents[2].id);
  // sauvegarde : jalons et histoire gardés
  const back = E.deserializeState(E.serializeState(s));
  assert.deepEqual(back.players[p.id].milestones, p.milestones);
  assert.equal(back.players[p.id].story.length, p.story.length);
  // une saison : cérémonie (trophées et podium des agents) et pépites classées
  playMonths(s, 12);
  const sc = s.lastAwards || [];
  assert.ok(sc.length >= 3 && sc.every(x => x.title && x.name));
});

test('V8.19 : prêt d\'Amiens, ennemi juré déclaré, échanges gardés dans l\'histoire du joueur', () => {
  const s = E.createNewGame({ agentName: 'A', agency: 'A', nationality: 'FR', specialty: 'negociateur', scenario: 'amiens' });
  const loan0 = s.agent.loan.left;
  assert.ok(loan0 > 1e6 && s.agent.loan.clubId === 'amiens');
  const cash0 = s.agent.cash;
  playMonths(s, 2);
  assert.ok(s.agent.loan.left <= loan0 - 2 * s.agent.loan.monthly, 'mensualités prélevées');
  const left = s.agent.loan.left;
  const paid = E.repayLoanFrom(s, 'amiens', 50000, [], 'les dividendes');
  assert.equal(paid, 50000); assert.equal(s.agent.loan.left, left - 50000);
  assert.equal(E.repayLoanFrom(s, 'psg', 50000, [], 'x'), 0, 'seul le club financé rembourse');
  void cash0;
  // ennemi juré déclaré dès la 1re saison, et qui le reste
  const g = newGame();
  playMonths(g, 4);
  const n = E.nemesisOf(g);
  assert.ok(n && g.nemesisId === n.id);
  assert.ok((n.exchanges || []).length >= 1, 'premier échange avec le rival');
  n.rivalry = 5;
  assert.equal(E.nemesisOf(g).id, n.id, 'toujours ennemi juré');
  // un échange avec un client reste dans son histoire
  const p = g.players[g.agent.portfolio[0]];
  if (p) {
    g.pendingEvent = { id: 'temps_jeu', playerId: p.id, rivalId: null, text: 'Je veux plus de temps de jeu.', choiceLabels: ['a', 'b', 'c'] };
    E.resolveEvent(g, 0);
    assert.ok(p.story.some(x => x.i === '💬' && /Je veux plus de temps de jeu/.test(x.t)));
  }
});

test('V8.20 : scénarios avec objectif — mise en place, réussite, échec, suivi des transferts, carrière express', () => {
  const mk = (scenario, hard) => E.createNewGame({ agentName: 'A', agency: 'A', nationality: 'FR', specialty: 'negociateur', scenario, hard });
  // chaque scénario (hors classique) a un objectif actif et un délai
  for (const d of E.SCENARIOS.filter(x => x.id !== 'classique')) {
    const s = mk(d.id);
    assert.equal(s.scenarioState.id, d.id); assert.equal(s.scenarioState.status, 'active');
    assert.ok(s.scenarioState.deadlineAbs > s.scenarioState.startAbs, d.id);
    assert.ok(E.scenarioProgress(s).detail, d.id);
  }
  // Amiens : prêt raisonnable, effacé à la montée en Ligue 1
  const am = mk('amiens');
  assert.ok(am.agent.loan.left < 7e6 && am.agent.loan.left > 1e6);
  am.clubs.amiens.league = 'L1';
  const news = [];
  E.scenarioCheck(am, news);
  assert.equal(am.scenarioState.status, 'won'); assert.ok(!am.agent.loan, 'prêt effacé');
  assert.ok(am.scenarioState.announce);
  // mode difficile : un an de moins
  assert.equal(mk('amiens', true).scenarioState.deadlineAbs, 48);
  // Brésil : client au Brasileirão, transfert vers l'Europe compté
  const br = mk('bresil');
  const st = br.players[br.agent.portfolio[0]];
  assert.equal(br.clubs[st.club].league, 'BSA');
  E.scenarioOnTransfer(br, st, st.club, br.clubs.psg);
  assert.equal(br.scenarioState.brToEurope, 1);
  assert.equal(E.scoutMissionCost(br, 'AR', { cost: 25000 }), 12500, 'scouting moins cher en Amérique du Sud');
  assert.equal(E.scoutMissionCost(br, 'FR', { cost: 25000 }), 25000);
  // héritier : 8 clients trentenaires
  const he = mk('heritier');
  assert.ok(he.agent.portfolio.length >= 6 && he.agent.portfolio.every(id => he.players[id].age >= 30));
  // dernier jour du mercato : départ en janvier, échec si le mois passe sans placer les clients
  const dl = mk('deadline');
  assert.equal(E.calMonth(dl), 1);
  assert.equal(dl.scenarioState.clients.length, 3);
  E.advanceMonth(dl);
  assert.ok(['lost', 'won'].includes(dl.scenarioState.status));
  // carrière express : terminée au délai, avec un score
  const ex = mk('express');
  ex.date.absMonth = ex.scenarioState.deadlineAbs;
  E.scenarioCheck(ex, []);
  assert.equal(ex.scenarioState.status, 'won'); assert.ok(ex.scenarioState.score > 0);
  // sauvegarde
  const back = E.deserializeState(E.serializeState(am));
  assert.equal(back.scenarioState.status, 'won');
});

test('V8.22 : choisir soi-même un club — fiche de chaque club, démarchage de n\'importe quel club à portée', () => {
  const s = newGame();
  const club = Object.values(s.clubs).find(c => c.league === 'L1' && c.tier === 2);
  const p = s.players[club.squad.find(id => s.players[id].age >= 23)];
  p.agentId = 'player'; s.agent.portfolio.push(p.id);
  const fits = Object.values(s.clubs).filter(c => c.id !== p.club).map(c => E.clubFitForPlayer(s, p, c));
  assert.ok(fits.length > 300);
  for (const f of fits) {
    assert.ok(f.outlook >= 0 && f.outlook <= 1 && f.fee > 0 && f.level >= 0 && f.level <= 3);
    if (f.interest === null) assert.equal(f.level, 0);
  }
  // un club bien trop modeste refuse un joueur formé ; la raison est donnée
  assert.ok(fits.some(f => f.blocked));
  // les quatre plus intéressés restent ceux de la liste « Clubs intéressés »
  const top = E.computeInterestedClubs(s, p);
  for (const ic of top) assert.equal(E.clubInterestScore(s, p, ic.club).score, ic.score);
  // démarchage d'un club à portée hors du top 4 : la porte n'est plus fermée d'office
  const topIds = new Set(top.map(x => x.club.id));
  const other = fits.find(f => !topIds.has(f.club.id) && f.interest !== null && f.interest > 15 && !f.blocked);
  assert.ok(other, 'un autre club à portée existe');
  s.date.absMonth += Math.max(0, E.monthsUntilNextMercato(s) - 1); // le mois qui précède le mercato
  const r = E.pitchPlayerToClub(s, p.id, other.club.id);
  assert.ok(r.ok || /décline|budget|déjà/.test(r.reason), 'réponse du club, pas un refus de principe : ' + r.reason);
  // V8.24 : un club qui refuse le profil ne peut pas être démarché (sinon la règle de niveau se contournait)
  const refuses = fits.find(f => f.interest !== null && f.interest > 15 && f.blocked && /en-deçà/.test(f.blocked));
  if (refuses) { p.lastPitchAt = null; p.pitchLog = {}; assert.match(E.pitchPlayerToClub(s, p.id, refuses.club.id).reason, /en-deçà/); }
  // et la liste « Clubs intéressés » n'en contient aucun
  for (const ic of top) assert.ok(E.evaluateClubTransferAcceptance(s, ic.club, p, { fee: E.estimateTransferFee(p, ic.club, s) }).ok);
  // un club hors de portée reste fermé
  const far = fits.find(f => f.interest === null);
  p.lastPitchAt = null;
  assert.match(E.pitchPlayerToClub(s, p.id, far.club.id).reason, /pas l'intention/);
});

test('V8.23 : joueurs libres et jeunes jugés sur leur niveau, intérêt du club, démarchage et prêts vers un club choisi', () => {
  const s = newGame();
  const big = Object.values(s.clubs).filter(c => c.tier === 5);
  // un libre trop juste n'entre plus dans un grand club
  const weak = s.freeAgents.map(id => s.players[id]).find(p => p.ovr <= 62);
  weak.agentId = 'player'; s.agent.portfolio.push(weak.id);
  for (const c of big) assert.match(E.evaluateClubTransferAcceptance(s, c, weak, { fee: 0 }).reason, /en-deçà/);
  // un jeune : jugé à mi-chemin entre niveau et potentiel — une vraie pépite passe, un jeune moyen non
  const y = Object.values(s.players).find(p => p.club && p.age < 21 && s.clubs[p.club].tier <= 2);
  y.ovr = 66; y.pot = 70;
  assert.equal(E.evaluateClubTransferAcceptance(s, big[0], y, { fee: 0 }).ok, false);
  y.pot = 94;
  assert.equal(E.evaluateClubTransferAcceptance(s, big[0], y, { fee: 0 }).ok, true);
  // l'intérêt du club pèse dans la négociation
  const club = Object.values(s.clubs).find(c => c.league === 'L1' && c.tier === 2);
  const p = s.players[club.squad.find(id => s.players[id].age >= 23 && s.players[id].ovr >= 62)];
  p.agentId = 'player'; s.agent.portfolio.push(p.id);
  const fits = Object.values(s.clubs).filter(c => c.id !== p.club).map(c => E.clubFitForPlayer(s, p, c)).filter(f => !f.blocked);
  const low = fits.find(f => f.level === 0), high = fits.find(f => f.level === 3) || fits.find(f => f.level === 2);
  const offer = c => ({ targetClubId: c.id, salary: p.wage, years: 3, roleProm: 'rotation', commissionPct: 10, signingBonus: 0, fee: 0 });
  if (low) assert.ok(E.evaluateOffer(s, p, offer(low.club)).reactions.some(r => /ne cherchait pas/.test(r)));
  if (low && high) assert.ok(E.evaluateOffer(s, p, offer(high.club)).score > E.evaluateOffer(s, p, offer(low.club)).score - 30);
  // démarchage impossible juste après un transfert
  p.lastTransferMonth = s.date.absMonth;
  s.date.absMonth += Math.max(0, E.monthsUntilNextMercato(s) - 1);
  p.lastTransferMonth = s.date.absMonth - 1;
  assert.equal(E.pitchStatus(s, p, high ? high.club.id : fits[0].club.id).ok, false);
  // V8.24 : un titulaire (dans le onze le plus fort de son club, plus de 21 ans) ne se prête pas
  const sq = club.squad.map(id => s.players[id]).sort((a, b) => b.ovr - a.ovr);
  const starter = sq.find(x => x.age > 21);
  assert.match(E.loanReleaseCheck(s, starter).reason, /titulaires/);
  // prêt vers un club choisi : club à portée accepté, club hors de portée refusé (remplaçant de plus de 21 ans)
  const sub = sq.slice(11).find(x => x.age > 21) || sq[sq.length - 1];
  sub.agentId = 'player'; s.agent.portfolio.push(sub.id);
  const ok = Object.values(s.clubs).find(c => c.id !== sub.club && E.evaluateLoanTarget(s, sub, c).ok);
  assert.ok(ok, 'un club accepte le prêt');
  const far = Object.values(s.clubs).find(c => c.id !== sub.club && E.clubInterestScore(s, sub, c) === null && c.budget > 1e6);
  assert.equal(E.evaluateLoanTarget(s, sub, far).ok, false);
});

test('V8.24 : chasse aux tricheries — clause de revente, salaires gonflés, offres, prêts de titulaires', () => {
  const s = newGame();
  const club = Object.values(s.clubs).find(c => c.league === 'L1' && c.tier === 3);
  const p = s.players[club.squad.find(id => s.players[id].age >= 22 && s.players[id].age <= 28)];
  p.agentId = 'player'; s.agent.portfolio.push(p.id);
  const buyer = Object.values(s.clubs).find(c => c.id !== p.club && c.tier === 3);
  // clause de revente de l'agent sur son propre client : rien avant un an, 5 % au plus ensuite
  p.sellOnClause = { holderId: 'player', pct: 30, since: s.date.absMonth };
  let before = s.agent.careerStats.totalCommissions;
  const rate = 0.12;
  E.executeTransfer(s, p, buyer, 10e6, [], { silent: true });
  const first = s.agent.careerStats.totalCommissions - before;
  assert.ok(first < 10e6 * 0.2, 'pas de clause de revente avant un an : ' + first);
  p.sellOnClause = { holderId: 'player', pct: 30, since: s.date.absMonth - 13 };
  p.lastTransferMonth = null;
  before = s.agent.careerStats.totalCommissions;
  E.executeTransfer(s, p, Object.values(s.clubs).find(c => c.id !== p.club && c.tier === 3), 10e6, [], { silent: true });
  const second = s.agent.careerStats.totalCommissions - before;
  assert.ok(second <= first + 10e6 * 0.05 + 1, 'clause plafonnée à 5 % : ' + (second - first));
  // un nouveau club ne reprend pas un salaire gonflé au-delà de son plafond
  p.lastTransferMonth = null; p.lastPermanentMove = null;
  p.wage = 3 * E.clubWage(p.value, s.clubs[p.club]);
  const target = Object.values(s.clubs).find(c => c.id !== p.club && c.tier === s.clubs[p.club].tier);
  const g = E.evaluateNegotiationGate(s, p, { targetClubId: target.id, salary: p.wage, years: 3, roleProm: 'rotation', commissionPct: 10, signingBonus: 0, fee: E.estimateTransferFee(p, target, s) });
  assert.equal(g.ok, false); assert.match(g.reason, /trop élevé/);
  // une offre de club ne dépasse pas le plafond du club acheteur
  p.lastTransferMonth = null; p.lastPermanentMove = null; s.incomingOffers = [];
  const r = E.createIncomingOffer(s, p, target, 1e6, p.wage * 1.45);
  assert.ok(r.ok); assert.ok(r.offer.wage < p.wage, 'salaire offert plafonné');
  // un titulaire ne se prête pas
  const top = s.clubs[p.club].squad.map(id => s.players[id]).filter(x => x.age > 21).sort((a, b) => b.ovr - a.ovr)[0];
  top.agentId = 'player'; s.agent.portfolio.push(top.id);
  const dest = Object.values(s.clubs).find(c => c.id !== top.club && c.tier <= s.clubs[top.club].tier);
  assert.match(E.executeLoan(s, top.id, dest.id, 6, []).reason, /titulaires/);
});
