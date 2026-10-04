// Parcours réel dans le navigateur (Playwright) : `npm run test:e2e`
// Nécessite Playwright (`npm install`) et un Chromium (`npx playwright install chromium`).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { GAME_FILE: SOURCE_FILE } = require('./load-engine');
// V8.25 : GAME_FILE=dist/football-agent.html pour tester la version publiée (obfusquée) avec les mêmes parcours
const GAME_FILE = process.env.GAME_FILE ? require('path').resolve(process.env.GAME_FILE) : SOURCE_FILE;

async function withGame(viewport, fn, settings, opts = {}) {
  const html = fs.readFileSync(GAME_FILE);
  const root = path.dirname(GAME_FILE);
  const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip', '.webp': 'image/webp' };
  // la page du jeu, plus les fichiers du module de portraits (portraits/…)
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (rel.startsWith('portraits/') && file.startsWith(root) && fs.existsSync(file)) { res.writeHead(200, { 'content-type': TYPES[path.extname(file)] || 'application/octet-stream' }); return fs.createReadStream(file).pipe(res); }
    res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // le jeu doit fonctionner sans les polices
  // réglages de départ (ex. portraits « Aucun » pour les parcours qui ne testent pas les visages)
  // V8.33 : le guide du jeu (ouvert à la première carrière) est considéré comme déjà vu, sauf pour son propre test
  const startSettings = opts.guide ? (settings || {}) : Object.assign({ guideSeen: true }, settings || {});
  await ctx.addInitScript(s => { if (!localStorage.getItem('football_agent_settings')) localStorage.setItem('football_agent_settings', s); }, JSON.stringify(startSettings));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    // V8.19 : page de démarrage — « Nouvelle carrière » mène au formulaire (sauf test de la page elle-même)
    if (!opts.home) { await page.waitForTimeout(150); const start = await page.$('#startContinue') || await page.$('#startNew'); if (start) await start.click(); }
    await fn(page);
  } finally {
    await browser.close(); srv.close();
  }
  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
}

// V8.20 : la page de démarrage s'affiche à chaque lancement ; « Continuer » reprend la partie en cours
async function resume(page) {
  await page.waitForFunction(() => document.querySelector('#startContinue') || document.querySelector('#startNew') || document.querySelector('#fabAdvance'), null, { timeout: 20000 });
  const c = await page.$('#startContinue'); if (c) await c.click();
}

async function advanceMonth(page) {
  await page.click('#fabAdvance');
  for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(80);
    const reply = await page.$('.chat-reply-btn');
    if (reply) { await reply.click(); await page.waitForTimeout(60); await page.click('.event-modal .btn-primary'); continue; }
    const cont = await page.$('.modal .btn-primary.btn-block');
    if (cont && /Continuer/.test(await cont.textContent())) { await cont.click(); continue; }
    break;
  }
}

for (const [name, viewport] of [['desktop', { width: 1440, height: 900 }], ['mobile', { width: 390, height: 844 }]]) {
  test(`Parcours ${name} : création, transfert libre, 3 mois, rechargement fidèle`, async () => {
    await withGame(viewport, async page => {
      await page.click('text=Lancer ma carrière');
      const sid = await page.evaluate(() => G.onboarding.starterPlayerId);
      await page.evaluate(id => { openTransferSearch(id); handleSearchClubs(); }, sid);
      assert.match(await page.textContent('#transferSearchResults'), /sans indemnité/);
      await page.click('#transferSearchResults button:has-text("Accepter")');
      assert.ok(await page.evaluate(id => G.players[id].club, sid));
      for (let i = 0; i < 3; i++) await advanceMonth(page);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0, 'pas de débordement horizontal');
      await page.waitForTimeout(500); // la sauvegarde compressée est asynchrone
      const before = await page.evaluate(() => serializeState(G));
      await page.reload(); await resume(page); await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => serializeState(G)), before);
      // novembre : hors mercato, la recherche de transfert l'annonce d'emblée, sans bouton « Accepter » voué à l'échec (V8.5)
      await page.evaluate(id => { G.players[id].lastTransferMonth = -99; openTransferSearch(id); }, sid);
      assert.match(await page.textContent('#transferSearchResults'), /mercato est fermé/);
      assert.equal(await page.$$eval('.modal button', bs => bs.filter(b => /Accepter|Chercher/.test(b.textContent)).length), 0);
      // un client lâché emporte son offre : plus d'action « Offre pour … » sur le tableau de bord (V8.6)
      await page.evaluate(id => {
        closeModal(); G.date.absMonth = 5; // janvier : mercato ouvert
        // client installé depuis longtemps : l'offre ne dépend pas du club tiré (règle « il veut s'installer »)
        G.players[id].lastPermanentMove = -99;
        const club = Object.values(G.clubs).find(c => c.id !== G.players[id].club);
        if (!createIncomingOffer(G, G.players[id], club, 100000, G.players[id].wage).ok) throw new Error('offre non créée');
        navigate('dashboard');
      }, sid);
      assert.match(await page.textContent('#content'), /Offre pour/);
      await page.evaluate(id => { resolveDropClient(G, id); navigate('dashboard'); }, sid);
      assert.doesNotMatch(await page.textContent('#content'), /Offre pour/);
    }, { portraits: '2d' });
  });
}

test('Portraits photo puis 2D : visage photo selon l\'origine, identique après rechargement, désactivable', async () => {
  await withGame({ width: 1280, height: 900 }, async page => {
    await page.click('text=Lancer ma carrière');
    const pid = await page.evaluate(() => G.freeAgents[0]);
    await page.evaluate(id => openPlayerDetail(id, 'market'), pid);
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 120000 });
    const img = await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage);
    assert.match(img, /^url\("data:image\/(webp|png);base64,/);
    // le visage vient de la banque de photos, parmi ceux de l'origine du joueur
    const face = await page.evaluate(id => { const p = G.players[id], i = photoFaceIndex(p); return { ok: PHOTO_FACES[i].includes(p.origin || Object.keys(NAT_ORIGINS[p.nat]).sort((a, b) => NAT_ORIGINS[p.nat][b] - NAT_ORIGINS[p.nat][a])[0]), n: PHOTO_FACES.length }; }, pid);
    assert.ok(face.ok, 'visage de la bonne origine'); assert.ok(face.n >= 100);
    // le même identifiant donne toujours le même visage
    assert.equal(await page.evaluate(id => photoFaceIndex(G.players[id]) === photoFaceIndex(Object.assign({}, G.players[id])), pid), true);
    // dans un club, deux coéquipiers n'ont jamais le même visage ; le visage est gardé dans la sauvegarde
    const clubs = await page.evaluate(() => { let dups = 0, n = 0; for (const c of Object.values(G.clubs)) { const f = c.squad.map(id => photoFaceIndex(G.players[id])); dups += f.length - new Set(f).size; n++; } return { dups, n }; });
    assert.ok(clubs.n > 100); assert.equal(clubs.dups, 0, 'aucun visage en double dans un même club');
    const kept = await page.evaluate(() => { const c = Object.values(G.clubs)[3], id = c.squad[0], face = G.players[id].face; saveGame(); const g = deserializeState(serializeState(G)); return g.players[id].face === face && Number.isInteger(face); });
    assert.ok(kept, 'visage sauvegardé');
    // l'image est vraiment décodable et non vide
    const size = await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = src; }), img.slice(5, -2));
    assert.ok(size[0] >= 96 && size[1] >= 96, 'image de portrait valide');
    await page.waitForTimeout(800); // écriture du cache
    await page.reload(); await resume(page); await page.waitForTimeout(500);
    await page.evaluate(id => openPlayerDetail(id, 'market'), pid);
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    assert.equal(await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage), img, 'même visage après rechargement');
    // photos impossibles (planche non chargée) : la 2D prend le relais et les paramètres l'expliquent
    await page.evaluate(() => { closeModal(); portraitEngineOff('photo', 'load'); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    const img2d = await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage);
    assert.match(img2d, /^url\("data:image\/svg\+xml;base64,/);
    await page.evaluate(() => { closeModal(); openSettingsModal(); });
    assert.match(await page.textContent('.portrait-status'), /Photos indisponibles/);
    // cadrage 2D : de y = 20 au plus haut jusqu'à y = 500 au moins (menton et haut des épaules compris)
    const vb = await page.evaluate(src => atob(src.split(',')[1]).match(/viewBox="([^"]+)"/)[1].split(' ').map(Number), img2d.slice(5, -2));
    assert.ok(vb[1] <= 20 && vb[1] + vb[3] >= 500 && vb[2] === vb[3], 'cadre 2D carré, visage entier : ' + vb);
    // réglage « 2D » : même visage dessiné (SVG), déterministe
    await page.evaluate(() => setSetting('portraits', '2d')); await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    assert.equal(await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage), img2d, 'même visage 2D');
    await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    assert.equal(await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage), img2d, 'même visage 2D');
    await page.evaluate(() => setSetting('portraits', 'simple')); await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForTimeout(400);
    assert.equal(await page.$$eval('.has-photo', els => els.length), 0, 'silhouettes en mode simple');
  });
});

test('Sauvegarde trop grosse pour localStorage : repli IndexedDB, partie retrouvée après rechargement', async () => {
  await withGame({ width: 1280, height: 900 }, async page => {
    await page.click('text=Lancer ma carrière');
    // quota dépassé simulé pour la sauvegarde compressée
    await page.evaluate(() => {
      const set = Storage.prototype.setItem;
      Storage.prototype.setItem = function (k, v) { if (k === 'football_agent_save_v3') throw new DOMException('quota', 'QuotaExceededError'); return set.call(this, k, v); };
    });
    await advanceMonth(page);
    assert.equal(await page.evaluate(() => saveGame()), true, 'écriture réussie grâce au repli');
    const before = await page.evaluate(() => serializeState(G));
    await page.reload(); await resume(page); await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => serializeState(G)), before, 'partie identique après rechargement');
    assert.equal(await page.$$eval('.save-warning, .banner-warning', els => els.length), 0);
  }, { portraits: 'simple' });
});

test('Partie en cours sans les championnats V8.9 : au rechargement, tous les classements sont visibles (50 en V8.29)', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    // partie « ancienne » en novembre : sans les championnats ajoutés en V8.9
    await page.evaluate(async () => {
      for (let i = 0; i < 3; i++) { advanceMonth(G); G.pendingEvent = null; }
      for (const lg of LEAGUES_V89) { for (const cid of G.leagues[lg.id].clubIds) { for (const pid of G.clubs[cid].squad) delete G.players[pid]; delete G.clubs[cid]; } delete G.leagues[lg.id]; }
      for (const id of Object.keys(G.cups)) if (!['FR', 'EN', 'ES', 'IT', 'DE', 'PT'].includes(id)) delete G.cups[id];
      G.freeAgents = (G.freeAgents || []).filter(id => G.players[id]);
      await saveGame();
    });
    await page.reload(); await resume(page); await page.waitForTimeout(1500);
    await page.evaluate(() => { ui.worldTab = 'classements'; ui.clubTab = 'BSA'; navigate('world'); });
    assert.equal(await page.$$eval('.league-picker option', o => o.length), 50, '50 championnats dans la liste (Ligue 3 et petits championnats V8.29 compris)');
    assert.equal(await page.$$eval('.tbl tbody tr', r => r.length), 20, 'classement du Brésil affiché');
    assert.match(await page.textContent('#content'), /Arrivé en cours de saison/);
    assert.match(await page.evaluate(() => G.news[0].text), /nouveaux championnats rejoignent la partie/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.10 : Ligue 3 et parts de clubs — prise de contrôle d\'Amiens via l\'interface, gestion conservée au rechargement', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    // V8.18 : les parts de clubs se débloquent au rang « Agent international »
    await page.evaluate(() => { G.agent.cash = 40e6; G.agent.careerTier = 3; ui.worldTab = 'classements'; ui.clubTab = 'L3'; navigate('world'); });
    assert.equal(await page.$$eval('.tbl tbody tr', r => r.length), 18, 'classement de Ligue 3');
    assert.match(await page.textContent('#content'), /ASC/);
    await page.evaluate(() => openClubDetail('amiens', 'world'));
    await page.click('text=Prendre le contrôle');
    const guard = await page.$('text=Dépenser quand même'); if (guard) await guard.click();
    assert.equal(await page.evaluate(() => isClubOwner(G, 'amiens')), true);
    assert.match(await page.textContent('#content'), /Gestion du club/);
    await page.click('text=Formation');
    await page.click('text=+1.0M€');
    await page.evaluate(() => saveGame()); // attendre la fin de la sauvegarde (compressée dans un Worker) avant de recharger
    await page.reload(); await resume(page); await page.waitForFunction(() => typeof G !== 'undefined' && G && G.clubs && G.clubs.amiens && document.querySelector('#fabAdvance')); await page.waitForTimeout(800);
    const st = await page.evaluate(() => ({ pct: stakePct(G, 'amiens'), pol: G.clubs.amiens.ownerPolicy, injected: G.agent.stakes.amiens.injected }));
    assert.ok(st.pct > 51, 'l\'apport fait monter la part (augmentation de capital)');
    assert.equal(st.pol.strategy, 'formation');
    assert.equal(st.injected, 1e6);
    await page.evaluate(() => navigate('agency'));
    assert.match(await page.textContent('#content'), /Parts de clubs[\s\S]*Amiens SC/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.11 : propriétaire — rachat des parts d\'un rival, augmentation de capital, joueur intransférable, barrages affichés', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { G.agent.cash = 60e6; G.agent.careerTier = 3; G.rivalStakes = { amiens: { [G.rivalAgents[0].id]: 20 } }; openClubDetail('amiens', 'world'); });
    assert.match(await page.textContent('#content'), /Agents rivaux actionnaires/);
    await page.click('text=Prendre le contrôle');
    let guard = await page.$('text=Dépenser quand même'); if (guard) await guard.click();
    assert.match(await page.textContent('#content'), /Objectif de la saison/);
    await page.click('text=/^\\+5\\.0M€/');
    guard = await page.$('text=Dépenser quand même'); if (guard) await guard.click();
    assert.ok(await page.evaluate(() => stakePct(G, 'amiens') > 51), 'augmentation de capital');
    await page.click('text=/Racheter/');
    guard = await page.$('text=Dépenser quand même'); if (guard) await guard.click();
    assert.equal(await page.evaluate(() => G.rivalStakes.amiens || null), null, 'parts du rival rachetées');
    const pid = await page.evaluate(() => G.clubs.amiens.squad[0]);
    await page.evaluate(id => openPlayerDetail(id, 'world'), pid);
    await page.click('text=Rendre intransférable');
    await page.evaluate(() => saveGame()); // attendre la fin de la sauvegarde (compressée dans un Worker) avant de recharger
    await page.reload(); await resume(page); await page.waitForFunction(() => typeof G !== 'undefined' && G && G.clubs && G.clubs.amiens && document.querySelector('#fabAdvance')); await page.waitForTimeout(800);
    assert.equal(await page.evaluate(id => G.players[id].untouchable, pid), true, 'intransférable conservé au rechargement');
    await page.evaluate(() => { ui.worldTab = 'classements'; ui.clubTab = 'L2'; navigate('world'); });
    assert.match(await page.textContent('#content'), /3e = barrage/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.12 : trois parties, mode clair, page d\'aide', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.fill('#obName', 'Alice'); await page.fill('#obAgency', 'Agence A');
    await page.click('text=Lancer ma carrière');
    await page.evaluate(async () => { advanceMonth(G); G.pendingEvent = null; await saveGame(); setSetting('theme', 'light'); closeModal(); navigate('aide'); });
    assert.ok(await page.evaluate(() => document.body.classList.contains('theme-light')), 'mode clair');
    assert.match(await page.textContent('#content'), /Comment jouer/);
    await page.evaluate(() => openSettingsModal());
    await Promise.all([page.waitForNavigation(), page.click('text=Nouvelle partie ici')]);
    assert.match(await page.textContent('body'), /Reprendre une partie[\s\S]*Agence A/);
    await page.click('#startNew');
    await page.fill('#obName', 'Bob'); await page.fill('#obAgency', 'Agence B');
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => saveGame());
    await page.evaluate(() => openSettingsModal());
    await Promise.all([page.waitForNavigation(), page.click('text=Charger')]); await resume(page);
    await page.waitForFunction(() => typeof G !== 'undefined' && G && document.querySelector('#fabAdvance')); await page.waitForTimeout(800);
    const back = await page.evaluate(() => ({ slot: activeSlot, agency: G.agent.agency, month: calMonth(G), light: document.body.classList.contains('theme-light') }));
    assert.deepEqual(back, { slot: 1, agency: 'Agence A', month: 9, light: true }, 'partie 1 retrouvée intacte');
    assert.equal(await page.evaluate(() => readSlotIndex().meta[2].agency), 'Agence B');
  }, { portraits: 'simple' });
});

test('V8.13 : onglet Sélections — tournoi de l\'été, classement des sélections', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { for (let i = 0; i < 11; i++) { G.pendingEvent = null; advanceMonth(G); } ui.worldTab = 'nations'; navigate('world'); });
    const txt = await page.textContent('#content');
    assert.match(txt, /Coupe d'Afrique des nations 2027/);
    assert.match(txt, /Classement des sélections/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.14 : langues — anglais et espagnol, actualités traduites, retour au français', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { for (let i = 0; i < 2; i++) { G.pendingEvent = null; advanceMonth(G); } G.news.unshift({ text: 'Amiens SC monte en Ligue 2 !', tag: 'promotion', season: seasonLabel(G), month: calMonth(G) }); setSetting('lang', 'en'); closeModal(); ui.newsFilter = 'all'; navigate('news'); });
    let txt = await page.innerText('#app');
    assert.match(txt, /Amiens SC go up to Ligue 2!/, 'actualité traduite');
    assert.match(txt, /Dashboard[\s\S]*My players/);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await page.evaluate(() => { setSetting('lang', 'es'); closeModal(); navigate('dashboard'); });
    txt = await page.innerText('#app');
    assert.match(txt, /Panel[\s\S]*Mis jugadores/);
    assert.doesNotMatch(txt, /Tableau de bord|Mes joueurs/);
    await page.reload(); await resume(page);
    // attendre que le jeu soit réaffiché (un délai fixe ne suffit pas toujours sur la machine de CI)
    await page.waitForFunction(() => typeof G !== 'undefined' && G && document.querySelector('#fabAdvance'), null, { timeout: 15000 }).catch(() => {});
    await page.waitForTimeout(300);
    assert.match(await page.innerText('#app'), /Mis jugadores/, 'langue conservée au rechargement');
    await page.evaluate(() => { setSetting('lang', 'fr'); closeModal(); });
    assert.match(await page.innerText('#app'), /Tableau de bord[\s\S]*Mes joueurs/, 'retour au français');
  }, { portraits: 'simple' });
});

test('V8.15 : avancer par semaine depuis le bouton', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    // le message de la semaine s'efface après 2,6 s : on le relève au passage plutôt que de dépendre de la vitesse de la machine
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); renderPage(); window.__toasts = []; const t = toast; toast = m => { window.__toasts.push(m); t(m); }; });
    await page.click('#fabStep'); await page.click('#stepWeek');
    assert.match(await page.textContent('#fabAdvance'), /semaine suivante/i);
    assert.match(await page.textContent('#topbarDate'), /Sem\. 1/);
    // un client sous contrat au PSG, pour voir les matchs de son club dans le bilan
    await page.evaluate(() => { const id = G.agent.portfolio[0], p = G.players[id]; p.club = 'psg'; G.clubs.psg.squad.push(id); });
    // résumé détaillé : une fenêtre « Bilan de la semaine »
    for (const w of [2, 3]) {
      await page.click('#fabAdvance');
      assert.match(await page.textContent('#topbarDate'), new RegExp('Sem\\. ' + w));
      const recap = await page.textContent('#modalRoot');
      assert.match(recap, new RegExp('Bilan de la semaine[\\s\\S]*Semaine ' + (w - 1) + ' · '));
      assert.match(recap, /Vos joueurs[\s\S]*Les matchs de la semaine[\s\S]*Paris/);
      assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
      await page.click('#modalRoot >> text=Continuer');
    }
    // résumé court : un simple message
    await page.evaluate(() => { setSetting('recap', 'short'); closeModal(); });
    await page.click('#fabAdvance');
    assert.match(await page.textContent('#topbarDate'), /Sem\. 4/);
    assert.match(await page.evaluate(() => window.__toasts[window.__toasts.length - 1]), /^Semaine 3 · /);
    await page.evaluate(() => { setSetting('recap', 'full'); closeModal(); });
    assert.match(await page.textContent('#fabAdvance'), /fin du mois/);
    const month0 = await page.evaluate(() => G.date.absMonth);
    await page.click('#fabAdvance');
    assert.equal(await page.evaluate(() => G.date.absMonth), month0 + 1, 'la 4e semaine boucle le mois');
    assert.match(await page.textContent('#modalRoot'), /Bilan du mois/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
    await page.evaluate(() => { closeModal(); G.pendingEvent = null; renderPage(); });
    await page.click('#fabStep'); await page.click('#stepMonth');
    assert.match(await page.textContent('#fabAdvance'), /mois suivant/i);
  }, { portraits: 'simple' });
});

test('V8.17 : classement au bilan de la semaine, match en direct, calendrier, avancer jusqu\'à…', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); const id = G.agent.portfolio[0], p = G.players[id]; p.club = 'psg'; G.clubs.psg.squad.push(id); navigate('dashboard'); });
    assert.match(await page.innerText('#content'), /Prochains matchs[\s\S]*Paris Saint-Germain/i, 'calendrier au tableau de bord');
    await page.click('#fabStep'); await page.click('#stepWeek');
    // appui pile sur l'icône du gros bouton : le clic ne doit pas être perdu
    const ico = await (await page.$('#fabAdvance svg')).boundingBox();
    await page.mouse.click(ico.x + ico.width / 2, ico.y + ico.height / 2);
    assert.match(await page.textContent('#topbarDate'), /Sem\. 2/, 'appui sur l\'icône pris en compte');
    const recap = await page.innerText('#modalRoot');
    assert.match(recap, /Bilan de la semaine[\s\S]*Classement[\s\S]*Paris Saint-Germain[\s\S]*\d+(er|e) · \d+ pts/i); // « 1er », « 2e »…
    // match en direct depuis le bilan : le score final est le vrai résultat
    await page.click('#modalRoot button[aria-label="Revivre le match"]');
    await page.click('#liveSkip');
    const live = await page.evaluate(() => { const f = clubRecent(G, 'psg', 1)[0].f; return { shown: document.getElementById('liveH').textContent + '-' + document.getElementById('liveA').textContent, real: f.scoreHome + '-' + f.scoreAway, end: document.getElementById('liveMin').textContent }; });
    assert.equal(live.shown, live.real); assert.equal(live.end, 'Terminé');
    await page.click('#modalRoot >> text=Retour au bilan');
    assert.match(await page.innerText('#modalRoot'), /Bilan de la semaine/i, 'retour au bilan après le match');
    await page.evaluate(() => continueFromRecap());
    // rechargement en plein mois : le bilan du mois garde le début du mois
    await page.evaluate(() => saveGame());
    await page.reload(); await resume(page); await page.waitForFunction(() => typeof G !== 'undefined' && G && document.querySelector('#fabAdvance'), null, { timeout: 15000 });
    assert.equal(await page.evaluate(() => !!G.monthSnap && G.monthSnap.abs === G.date.absMonth), true, 'début du mois conservé');
    // avancer jusqu'à la saison prochaine (arrêt possible sur une décision)
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); });
    await page.click('#fabStep'); await page.click('text=Début de la saison prochaine');
    // pas à pas avec la progression affichée : on attend le bilan de la période
    await page.waitForFunction(() => /Bilan de la période/i.test(document.getElementById('modalRoot').innerText), null, { timeout: 240000 });
    const st = await page.evaluate(() => ({ abs: G.date.absMonth, pending: !!G.pendingEvent, week: currentWeek(G) }));
    assert.ok(st.pending || st.abs === 12, 'arrivé en août suivant, ou arrêté sur une décision');
    assert.equal(st.week, 0);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.18 : pages regroupées, cérémonie, dernier jour du mercato, scénario, Panthéon, parts verrouillées', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.evaluate(() => { ui.obStep = 'scenarios'; renderOnboarding(); });
    await page.click('.start-btn[data-scn="zero"]');
    await page.click('text=Lancer ma carrière');
    assert.equal(await page.evaluate(() => G.scenario), 'zero');
    assert.ok(await page.evaluate(() => G.agent.cash) < 100000, 'scénario Sans un sou');
    // 9 pages ; les anciennes adresses mènent aux onglets
    assert.deepEqual(await page.evaluate(() => [...document.querySelectorAll('.nav-item[data-nav]')].map(n => n.dataset.nav)), ['dashboard', 'myplayers', 'scouting', 'market', 'messages', 'news', 'world', 'agency', 'carriere']);
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); navigate('finances'); });
    assert.equal(await page.evaluate(() => ui.page), 'agency');
    assert.match(await page.innerText('#content'), /Impôt de la saison/i);
    await page.evaluate(() => navigate('negotiations'));
    assert.equal(await page.evaluate(() => ui.page), 'messages');
    await page.evaluate(() => navigate('carriere'));
    assert.match(await page.innerText('#content'), /Prochains objectifs[\s\S]*Ennemi juré[\s\S]*Hauts faits/i);
    // parts de clubs verrouillées au début
    await page.evaluate(() => openClubDetail('amiens', 'world'));
    assert.match(await page.innerText('#content'), /débloqué au rang/);
    // dernière semaine du mercato d'août, avec un client au club
    await page.evaluate(() => { const id = G.agent.portfolio[0], p = G.players[id]; p.club = 'om'; G.clubs.om.squad.push(id); p.ovr = 80; setTimeStep('week'); navigate('dashboard'); });
    for (let i = 0; i < 3; i++) { await page.click('#fabAdvance'); await page.evaluate(() => { if (document.querySelector('#modalRoot .modal-head')) continueFromRecap(); G.pendingEvent = null; renderPage(); }); }
    assert.match(await page.innerText('#content'), /Dernière semaine du mercato/i);
    assert.match(await page.textContent('#topbarDate'), /Dernière semaine/);
    // fin de saison : cérémonie, puis entrée au Panthéon
    await page.evaluate(() => { setTimeStep('month'); while (calMonth(G) !== 7) { G.pendingEvent = null; advanceMonth(G); } G.pendingEvent = null; renderPage(); });
    await page.click('#fabAdvance');
    await page.evaluate(() => continueFromRecap());
    assert.match(await page.innerText('#modalRoot'), /Cérémonie de fin de saison[\s\S]*Ballon d'Or[\s\S]*Agent de l'année/i);
    assert.equal(await page.evaluate(() => readPantheon().length), 1, 'carrière au Panthéon');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.19 : page de démarrage (langue, scénarios), expéditeur des messages, plus de Conversations, prêt d\'Amiens', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    // page de démarrage : langue, puis scénarios
    assert.match(await page.innerText('#app'), /Bienvenue, agent[\s\S]*Nouvelle carrière[\s\S]*Jouer un scénario/i);
    await page.click('[data-lang="en"]');
    assert.match(await page.innerText('#app'), /Welcome, agent[\s\S]*New career/i);
    await page.click('[data-lang="fr"]');
    await page.click('#startScenario');
    assert.match(await page.innerText('#app'), /Choisissez un scénario[\s\S]*Sans un sou[\s\S]*Relancer Amiens[\s\S]*Aventure au Brésil/i);
    await page.click('.start-btn[data-scn="amiens"]');
    assert.equal(await page.evaluate(() => document.getElementById('scnSummary').dataset.scn), 'amiens');
    await page.click('text=Lancer ma carrière');
    assert.equal(await page.evaluate(() => G.scenario), 'amiens');
    assert.ok(await page.evaluate(() => G.agent.loan && G.agent.loan.left > 1e6), 'rachat à crédit');
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); navigate('finances'); });
    assert.match(await page.innerText('#content'), /Prêt du vendeur[\s\S]*Reste à rembourser/i);
    // plus d'onglet Conversations ni de carte Téléphone
    await page.evaluate(() => navigate('phone'));
    assert.equal(await page.evaluate(() => ui.page), 'messages');
    assert.doesNotMatch(await page.innerText('#content'), /Conversations/);
    await page.evaluate(() => navigate('dashboard'));
    assert.doesNotMatch(await page.innerText('#content'), /Téléphone/i);
    // expéditeur : un directeur sportif écrit au sujet de votre client
    await page.evaluate(() => { const id = G.agent.portfolio[0], p = G.players[id]; p.club = 'om'; G.clubs.om.squad.push(id);
      G.pendingEvent = { id: 'dirigeant_contact', playerId: id, rivalId: null, fromClubId: 'ol', text: 'Le directeur sportif vous appelle.', choiceLabels: ['On en parle', 'Pas maintenant'] }; showEventModal(); });
    const head = await page.innerText('.chat-modal');
    assert.match(head, /Directeur sportif[\s\S]*Lyon[\s\S]*Au sujet de/i);
    await page.click('.chat-reply-btn');
    const reply = await page.innerText('.chat-modal');
    assert.match(reply, /Directeur sportif/i, 'expéditeur gardé dans la réponse');
    assert.match(reply, /Olympique Lyonnais apprécie/, 'la réponse parle du club qui a écrit');
    await page.evaluate(() => { closeModal(); const id = G.agent.portfolio[0]; G.pendingEvent = { id: 'temps_jeu', playerId: id, rivalId: null, text: 'Je veux jouer plus.', choiceLabels: ['OK'] }; showEventModal(); });
    assert.match(await page.innerText('.chat-modal'), /Votre client ·/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' }, { home: true });
});

test('V8.20 : page de démarrage à chaque lancement, menu principal, nouvelle carrière dans un emplacement libre, scénario réussi', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('#startNew'); await page.fill('#obAgency', 'Agence Une'); await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); return saveGame(); });
    // rechargement : la page de démarrage s'affiche, avec « Continuer »
    await page.reload(); await page.waitForSelector('#startContinue');
    assert.match(await page.innerText('#startContinue'), /Continuer[\s\S]*Agence Une/i);
    await page.click('#startContinue');
    assert.ok(await page.$('#fabAdvance'));
    // menu principal depuis « Plus »
    await page.evaluate(() => openMoreSheet()); await page.click('#menuMain');
    await page.waitForSelector('#startContinue');
    // scénarios : 11 au total, « Dernier jour du mercato » dans un nouvel emplacement
    await page.click('#startScenario');
    assert.equal(await page.$$eval('.start-btn[data-scn]', b => b.length), 11);
    await page.click('.start-btn[data-scn="deadline"]');
    await page.fill('#obAgency', 'Agence Deux'); await page.click('text=Lancer ma carrière');
    await page.waitForFunction(() => typeof G !== 'undefined' && G && G.scenario === 'deadline' && document.querySelector('#fabAdvance'), null, { timeout: 30000 });
    const st = await page.evaluate(() => ({ slot: activeSlot, month: calMonth(G), step: settings.step, first: readSlotIndex().meta[1] && readSlotIndex().meta[1].agency }));
    assert.equal(st.month, 1); assert.equal(st.step, 'week'); assert.equal(st.first, 'Agence Une', 'la première partie est gardée'); assert.ok(st.slot !== 1);
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); navigate('dashboard'); });
    assert.match(await page.innerText('#content'), /Dernier jour du mercato[\s\S]*Placer vos clients/i);
    // réussite : les clients sont placés, puis une semaine passe
    await page.evaluate(() => { for (const id of G.scenarioState.clients) { const p = G.players[id], c = G.clubs.amiens; p.club = c.id; c.squad.push(id); } G.pendingEvent = null; renderPage(); });
    await page.click('#fabAdvance');
    // le bilan de la semaine ou un événement peuvent s'ouvrir avant la fin du scénario : on les ferme jusqu'à la fenêtre de réussite
    let won = false;
    for (let i = 0; i < 100 && !won; i++) {
      await page.waitForTimeout(200);
      won = await page.evaluate(() => {
        const txt = document.getElementById('modalRoot').innerText;
        if (readScenarioWins().deadline && /Scénario réussi/i.test(txt) && !/Bilan/i.test(txt)) return true;
        if (/Bilan/i.test(txt)) continueFromRecap();
        else if (G.pendingEvent && document.querySelector('.chat-reply-btn')) { handleResolveEventModal(0); closeModal(); renderPage(); }
        return false;
      });
    }
    assert.ok(won, 'la fenêtre « Scénario réussi » apparaît');
    assert.ok(await page.evaluate(() => readScenarioWins().deadline && readScenarioWins().deadline.won));
    // le mode difficile est débloqué sur la page de démarrage
    await page.evaluate(() => goStartMenu()); await page.click('#startScenario');
    assert.ok(await page.$('.scn-hard[data-hard="deadline"]'));
    assert.match(await page.innerText('#app'), /Réussi/i);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' }, { home: true });
});

test('V8.22 : choisir soi-même un club — filtres, tri, négociation et démarchage depuis la liste', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    const pid = await page.evaluate(() => {
      G.pendingEvent = null; closeModal();
      const c = Object.values(G.clubs).find(c => c.league === 'L1' && c.tier === 2);
      const id = c.squad.find(i => G.players[i].age >= 23); G.players[id].agentId = 'player'; G.agent.portfolio.push(id);
      return id;
    });
    await page.evaluate(id => openPlayerDetail(id, 'myplayers'), pid);
    await page.click('#openClubPicker');
    await page.waitForSelector('.club-pick-row');
    assert.match(await page.innerText('.modal'), /Choisir un club/i);
    // recherche par nom, filtre par pays
    await page.fill('#clubPickSearch', 'real');
    const names = await page.$$eval('.club-pick-row .name', els => els.map(e => e.textContent));
    assert.ok(names.length > 0 && names.every(n => /real/i.test(n)), names.join(', '));
    await page.fill('#clubPickSearch', '');
    await page.selectOption('#clubPickNat', 'ES');
    const leagues = await page.$$eval('.club-pick-row', els => els.map(e => e.dataset.club));
    assert.ok(leagues.length > 0 && await page.evaluate(ids => ids.every(id => ['LIGA', 'LIGA2'].includes(G.clubs[id].league) || (LEAGUES.find(l => l.id === G.clubs[id].league) || {}).nat === 'ES'), leagues));
    // tri par prestige : réputations décroissantes
    await page.click('.club-pick-sorts [data-sort="prestige"]');
    const reps = await page.$$eval('.club-pick-row', els => els.map(e => e.dataset.club));
    assert.ok(await page.evaluate(ids => ids.every((id, i) => !i || (G.clubs[ids[i - 1]].reputation + G.clubs[ids[i - 1]].tier * 10) >= (G.clubs[id].reputation + G.clubs[id].tier * 10)), reps));
    // négocier : la négociation s'ouvre avec ce club ; « Changer » rouvre la liste et garde la négociation
    const target = await page.$eval('.club-pick-row:has(.club-pick-neg)', e => e.dataset.club);
    await page.click(`.club-pick-row[data-club="${target}"] .club-pick-neg`);
    assert.equal(await page.evaluate(() => ui.negotiation.targetClubId), target);
    await page.evaluate(() => { ui.negotiation.years = 4; });
    await page.click('#negPickClub');
    await page.waitForSelector('.club-pick-row');
    const other = await page.$eval(`.club-pick-row:not([data-club="${target}"]):has(.club-pick-neg)`, e => e.dataset.club);
    await page.click(`.club-pick-row[data-club="${other}"] .club-pick-neg`);
    assert.deepEqual(await page.evaluate(() => [ui.negotiation.targetClubId, ui.negotiation.years]), [other, 4]);
    assert.ok(await page.evaluate(() => ui.negotiation.fee > 0));
    // démarchage le mois qui précède le mercato : un clic, une réponse, puis plus de bouton « Proposer »
    await page.evaluate(id => { closeModal(); G.date.absMonth += Math.max(0, monthsUntilNextMercato(G) - 1); openClubPicker(id, 'detail'); }, pid);
    await page.waitForSelector('.club-pick-pitch');
    await page.click('.club-pick-pitch');
    await page.waitForSelector('.club-pick-row');
    assert.equal(await page.$$eval('.club-pick-pitch', els => els.length), 0, 'un seul démarchage par mois');
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.23 : prêt vers un club choisi, boutons en attente hors mercato', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    const pid = await page.evaluate(() => {
      G.pendingEvent = null; closeModal();
      const c = Object.values(G.clubs).find(c => c.league === 'L1' && c.tier === 3);
      const id = c.squad.map(i => G.players[i]).filter(p => p.age <= 21).sort((a, b) => b.ovr - a.ovr)[0].id; G.players[id].agentId = 'player'; G.agent.portfolio.push(id); // V8.24 : un jeune (les titulaires ne se prêtent pas)
      return id;
    });
    // prêt : fenêtre de prêt → « Choisir moi-même un club » → prêt conclu
    await page.evaluate(id => openLoanSearch(id), pid);
    await page.click('#loanPickClub');
    await page.waitForSelector('.club-pick-loan');
    assert.match(await page.innerText('.modal'), /pour un prêt/i);
    const dest = await page.$eval('.club-pick-row:has(.club-pick-loan)', e => e.dataset.club);
    await page.click(`.club-pick-row[data-club="${dest}"] .club-pick-loan`);
    assert.deepEqual(await page.evaluate(id => [G.players[id].club, !!G.players[id].parentClub], pid), [dest, true]);
    // hors mercato : on prépare, on ne négocie pas
    await page.evaluate(id => { const p = G.players[id]; G.clubs[p.club].squad = G.clubs[p.club].squad.filter(x => x !== id); G.clubs[p.parentClub].squad.push(id); p.club = p.parentClub; p.parentClub = null; p.lastTransferMonth = null; G.date.absMonth += 3; openClubPicker(id, 'detail'); }, pid);
    await page.waitForSelector('.club-pick-row');
    assert.equal(await page.$$eval('.club-pick-neg', els => els.length), 0);
    assert.ok(await page.$$eval('.club-pick-wait', els => els.length) > 0);
    assert.match(await page.innerText('.club-pick-wait'), /Mercato fermé/i);
  }, { portraits: 'simple' });
});

test('V8.27 : crédits, œuf de Pâques (nom du créateur ou blason) et accueil du créateur', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('#startCredits');
    assert.match(await page.innerText('.modal'), /Une création de\s+Florian Deconinck/);
    for (let i = 0; i < 5; i++) await page.click('#creditsName');
    assert.match(await page.innerText('.modal'), /Œuf de Pâques[\s\S]*trouvé le secret/i);
    await page.click('.modal .btn-primary');
    assert.ok(await page.$eval('#startCrest', e => e.classList.contains('golden')), 'blason doré une fois le secret trouvé');
    // traduit en anglais
    await page.click('.start-langs [data-lang="en"]');
    await page.click('#startCredits');
    assert.match(await page.innerText('.modal'), /A creation by\s+Florian Deconinck/);
    await page.click('.modal .modal-close');
    await page.click('.start-langs [data-lang="fr"]');
    // un agent au nom du créateur est accueilli, et le haut fait suit la partie
    await page.click('#startNew');
    await page.fill('#obName', 'florian deconinck');
    await page.click('#obLaunch');
    await page.waitForFunction(() => /Florian Deconinck en personne/.test((document.getElementById('toastRoot') || {}).textContent || ''), null, { timeout: 5000 });
    assert.ok(await page.evaluate(() => G.news.some(n => /ouvre sa propre agence/.test(n.text))));
    assert.ok(await page.evaluate(() => { checkAchievements(G); return G.achievements.unlocked.includes('easter_egg') && G.agent.cash >= 0; }));
  }, { portraits: 'simple' }, { home: true });
  // le blason de l'accueil (7 touches rapides) révèle aussi le secret
  await withGame({ width: 1280, height: 900 }, async page => {
    for (let i = 0; i < 7; i++) await page.click('#startCrest');
    assert.match(await page.innerText('.modal'), /trouvé le secret/);
  }, { portraits: 'simple' }, { home: true });
});

test('V8.33 : guide du jeu à la première carrière, puis à la demande', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('#obLaunch');
    await page.waitForSelector('.guide', { timeout: 20000 });
    assert.match(await page.innerText('.guide'), /Vous êtes agent de joueurs/);
    for (let i = 0; i < 6; i++) await page.click('#guideNext');
    assert.match(await page.innerText('.guide'), /À vous de jouer/);
    await page.click('#guideNext');
    assert.equal(await page.$('.guide'), null, 'guide refermé');
    assert.ok(await page.evaluate(() => settings.guideSeen), 'vu une fois pour toutes');
    // ne revient pas tout seul à la carrière suivante, mais reste accessible
    await page.evaluate(() => navigate('aide'));
    await page.click('text=Revoir le guide du jeu');
    await page.waitForSelector('.guide');
    await page.click('#guideSkip');
    assert.equal(await page.$('.guide'), null);
  }, { portraits: 'simple' }, { guide: true });
  // en anglais
  await withGame({ width: 1280, height: 900 }, async page => {
    await page.click('#startGuide');
    assert.match(await page.innerText('.guide'), /You are a players' agent/);
  }, { portraits: 'simple', lang: 'en' }, { home: true, guide: true });
});

test('V8.37 : récapitulatif des nouveautés après une mise à jour, une seule fois', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.waitForSelector('.whatsnew', { timeout: 10000 });
    const txt = await page.innerText('.whatsnew');
    assert.match(txt, /Version 8\.37/i);
    assert.match(txt, /Version 8\.36/i);
    assert.doesNotMatch(txt, /Version 8\.35/i, 'seulement ce qui est nouveau depuis la dernière visite');
    await page.click('#whatsNewOk');
    assert.equal(await page.evaluate(() => settings.seenVersion), await page.evaluate(() => GAME_VERSION));
    await page.reload();
    await page.waitForSelector('#startNew');
    await page.waitForTimeout(300);
    assert.equal(await page.$('.whatsnew'), null, 'pas de nouvel affichage tant que la version ne change pas');
    // toujours consultable depuis les Paramètres
    await page.evaluate(() => openSettingsModal());
    await page.click('text=Nouveautés');
    assert.match(await page.innerText('.whatsnew'), /Version 8\.32/i);
  }, { portraits: 'simple', guideSeen: true, seenVersion: '8.35' }, { home: true });
  // premier lancement : rien (le guide accueille le joueur)
  await withGame({ width: 1280, height: 900 }, async page => {
    await page.waitForSelector('#startNew'); await page.waitForTimeout(300);
    assert.equal(await page.$('.whatsnew'), null);
  }, { portraits: 'simple' }, { home: true });
});

test('V8.38 : suivre un joueur depuis sa fiche, liste « Suivis », vue Attributs', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('#obLaunch'); await page.waitForSelector('#fabAdvance', { timeout: 20000 });
    await page.evaluate(() => { G.pendingEvent = null; closeModal(); const p = Object.values(G.players).find(x => x.club && x.agentId !== 'player' && x.ovr > 75); openPlayerDetail(p.id, 'dashboard'); });
    await page.click('#followBtn');
    assert.match(await page.innerText('#followBtn'), /Suivi/);
    await page.evaluate(() => navigate('myplayers'));
    await page.click('#tabFollowed');
    assert.equal(await page.$$eval('.player-card', els => els.length), 1, 'le joueur suivi est listé');
    await page.click('#viewAttrs');
    assert.equal(await page.$$eval('.player-card-attrs > div', els => els.length), 6, 'six attributs sur la carte');
    // filtre des actualités
    await page.evaluate(() => navigate('news'));
    assert.match(await page.innerText('.filter-bar'), /Suivis/i);
  }, { portraits: 'simple' });
});
