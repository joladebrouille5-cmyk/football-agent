// Joueur automatique « tricheur » (V8.24) : joue N saisons en exploitant tout ce qu'un joueur peut faire depuis l'interface,
// et mesure les gains anormaux. Usage : node tools/cheat-bot.js [saisons] [stratégies séparées par des virgules]
const { loadEngine } = require('../tests/load-engine');
const E = loadEngine();
const SEASONS = +process.argv[2] || 8;
const STRATS = (process.argv[3] || 'all').split(',');
const on = k => STRATS.includes('all') || STRATS.includes(k);
const s = E.createNewGame({ agentName: 'Bot', agency: 'Bot', nationality: 'FR', specialty: 'negociateur' });
const log = { renewals: 0, renewComm: 0, transfers: 0, transferComm: 0, pitches: 0, pitchOk: 0, offersAcc: 0, loans: 0, loanComm: 0, represent: 0, drops: 0, stakeLoops: 0, stakeGain: 0, scout: 0, events: 0, flags: [] };
const flag = (k, v) => { if (log.flags.length < 40) log.flags.push(k + ' ' + JSON.stringify(v)); };
const comm = () => s.agent.careerStats.totalCommissions;
const negotiate = (p, base) => {
  // l'interface permet de tester n'importe quels curseurs : on cherche l'offre la plus juteuse acceptée
  const tries = [];
  for (const pct of [20, 16, 12, 10]) for (const mult of [2.5, 1.8, 1.4, 1.15, 1.0]) for (const years of [5, 4, 3, 2]) {
    const offer = Object.assign({ salary: Math.round(p.wage * mult / 500) * 500, years, roleProm: 'titulaire', commissionPct: pct, signingBonus: Math.round(p.wage * 6), sellOnPct: 30 }, base);
    tries.push(offer);
  }
  tries.sort((a, b) => b.salary * b.years * b.commissionPct - a.salary * a.years * a.commissionPct);
  for (const offer of tries.slice(0, 40)) {
    const g = E.evaluateNegotiationGate(s, p, offer); if (!g.ok) continue;
    const ev = E.evaluateOffer(s, p, offer);
    if (ev.accept) return offer;
    if (ev.score >= E.COUNTER_MIN_SCORE) { const c = E.generateCounterOffer(s, p, offer); if (c && c.offer) { const g2 = E.evaluateNegotiationGate(s, p, c.offer); if (g2.ok) return c.offer; } }
  }
  return null;
};
let lastCash = s.agent.cash, seasonLog = [];
const t0 = Date.now();
for (let m = 0; m < SEASONS * 12; m++) {
  if (s.pendingEvent) { E.resolveEvent(s, Math.floor(Math.random() * (s.pendingEvent.choiceLabels || [1]).length)); log.events++; }
  const open = E.isMercatoOpen(s);
  // 1. recrutement massif de clients
  if (on('sign')) {
    const cap = E.OFFICE_LEVELS[s.agent.officeLevel - 1].cap;
    if (s.agent.portfolio.length >= cap && s.agent.officeLevel < E.OFFICE_LEVELS.length) { const r = E.upgradeOffice(s); }
    const cands = Object.values(s.players).filter(p => !p.agentId && !p.retired && p.age <= 23).sort((a, b) => b.pot - a.pot).slice(0, 8);
    for (const p of cands) { if (s.agent.portfolio.length >= E.OFFICE_LEVELS[s.agent.officeLevel - 1].cap) break; const r = E.resolveRepresent(s, p.id); if (r.ok) log.represent++; }
    if (s.agent.cash > 400000 && (s.agent.staff.negociateurs || 0) < 3) E.hireStaff(s, 'negociateurs');
  }
  for (const id of [...s.agent.portfolio]) {
    const p = s.players[id]; if (!p || p.retired) continue;
    // 2. renouvellements à rallonge, aussi souvent que le jeu le permet
    if (on('renew') && p.club) {
      const before = comm();
      const o = negotiate(p, { targetClubId: p.club, fee: 0 });
      if (o) { E.applyAcceptedOffer(s, p, Object.assign({ playerId: id }, o), []); log.renewals++; log.renewComm += comm() - before; if (comm() - before > 2e6) flag('grosse commission renouvellement', { name: p.name, c: comm() - before, wage: p.wage }); }
    }
    // 3. transferts en boucle vers le meilleur club, curseurs au maximum
    if (on('transfer') && (open || !p.club)) {
      const fits = Object.values(s.clubs).filter(c => c.id !== p.club).map(c => E.clubFitForPlayer(s, p, c)).filter(f => !f.blocked).sort((a, b) => b.best - a.best).slice(0, 6);
      for (const f of fits) {
        const before = comm();
        const o = negotiate(p, { targetClubId: f.club.id, fee: E.estimateTransferFee(p, f.club, s) });
        if (o) { E.applyAcceptedOffer(s, p, Object.assign({ playerId: id }, o), []); log.transfers++; log.transferComm += comm() - before; break; }
      }
    }
    // 4. démarchage de tous les clubs possibles
    if (on('pitch') && p.club) {
      const fits = Object.values(s.clubs).filter(c => c.id !== p.club).map(c => E.clubFitForPlayer(s, p, c)).filter(f => !f.blocked && f.level > 0).sort((a, b) => b.best - a.best);
      for (const f of fits.slice(0, 3)) { if (!E.pitchStatus(s, p, f.club.id).ok) break; log.pitches++; if (E.pitchPlayerToClub(s, id, f.club.id).ok) log.pitchOk++; }
    }
    // 5. prêts
    if (on('loan') && open && p.club && !p.parentClub && p.age <= 22) {
      const c = Object.values(s.clubs).find(c => E.evaluateLoanTarget(s, p, c).ok);
      if (c) { const before = s.agent.cash; if (E.executeLoan(s, id, c.id, 6, []).ok) { log.loans++; log.loanComm += s.agent.cash - before; } }
    }
  }
  // 6. accepter toutes les offres
  if (on('pitch') || on('offers')) for (const o of E.visibleOffers(s).slice()) { const r = E.acceptIncomingOffer(s, o.id); if (r.ok) log.offersAcc++; }
  // 7. lâcher puis re-signer un client (réinitialiser des compteurs ?)
  if (on('drop') && s.agent.portfolio.length > 2 && m % 6 === 0) {
    const id = s.agent.portfolio[s.agent.portfolio.length - 1]; const before = s.agent.cash;
    E.resolveDropClient(s, id); log.drops++; const r = E.resolveRepresent(s, id);
    if (r.ok && s.agent.cash > before) flag('drop/re-sign rapporte', s.agent.cash - before);
  }
  // 8. achat-revente de parts de club dans le même mois
  if (on('stake') && s.agent.cash > 2e6) {
    const club = Object.values(s.clubs).filter(c => c.tier <= 2).sort((a, b) => a.budget - b.budget)[0];
    const before = s.agent.cash;
    const b = E.buyClubStake(s, club.id, 5, []);
    if (b && b.ok) { const r = E.sellClubStake(s, club.id, 5, []); log.stakeLoops++; log.stakeGain += s.agent.cash - before; if (s.agent.cash > before) flag('achat-revente de parts rapporte', s.agent.cash - before); }
  }
  // 9. scouting à volonté
  if (on('scout') && s.agent.cash > 100000) { const r = E.startScoutMission(s, 'FR', 'standard'); if (r && r.ok) log.scout++; }
  if (s.pendingEvent) { E.resolveEvent(s, 0); log.events++; }
  E.advanceMonth(s);
  // invariants
  for (const p of Object.values(s.players)) {
    if (!isFinite(p.wage) || !isFinite(p.value)) { flag('NaN', p.name); break; }
    if (p.agentId === 'player' && p.club && !p.parentClub && p.wage > 3 * E.clubWage(p.value, s.clubs[p.club]) && p.wage > 50000) { flag('salaire hors norme', { name: p.name, wage: p.wage, fair: E.clubWage(p.value, s.clubs[p.club]) }); }
  }
  if (!isFinite(s.agent.cash)) flag('cash NaN', m);
  if (E.calMonth(s) === 7) { seasonLog.push({ season: E.seasonLabel(s), cash: Math.round(s.agent.cash), comm: Math.round(comm()), clients: s.agent.portfolio.length, rep: Math.round(s.agent.reputation) }); }
}
const minBudget = Math.min(...Object.values(s.clubs).map(c => c.budget));
const fl = [...new Set(log.flags)]; delete log.flags; console.log(JSON.stringify({ strats: STRATS.join("+"), final: { cash: Math.round(s.agent.cash), comm: Math.round(comm()), rep: Math.round(s.agent.reputation), clients: s.agent.portfolio.length, minClubBudget: Math.round(minBudget) }, log, flags: fl.slice(0, 6), cashBySeason: seasonLog.map(x => Math.round(x.cash / 1e6) + "M") }));
