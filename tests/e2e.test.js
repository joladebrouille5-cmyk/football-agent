// Parcours réel dans le navigateur (Playwright) : `npm run test:e2e`
// Nécessite Playwright (`npm install`) et un Chromium (`npx playwright install chromium`).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const { GAME_FILE } = require('./load-engine');

async function withGame(viewport, fn, settings) {
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
  // WebGL logiciel (SwiftShader) : les portraits 3D se dessinent aussi dans le navigateur de test
  const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // le jeu doit fonctionner sans les polices
  // réglages de départ (ex. portraits 2D : la 3D en WebGL logiciel occupe le processeur et rend les clics lents)
  if (settings) await ctx.addInitScript(s => { if (!localStorage.getItem('football_agent_settings')) localStorage.setItem('football_agent_settings', s); }, JSON.stringify(settings));
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  try {
    await page.goto(`http://127.0.0.1:${srv.address().port}/`);
    await fn(page);
  } finally {
    await browser.close(); srv.close();
  }
  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
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
      await page.reload(); await page.waitForTimeout(800);
      assert.equal(await page.evaluate(() => serializeState(G)), before);
      // novembre : hors mercato, la recherche de transfert l'annonce d'emblée, sans bouton « Accepter » voué à l'échec (V8.5)
      await page.evaluate(id => { G.players[id].lastTransferMonth = -99; openTransferSearch(id); }, sid);
      assert.match(await page.textContent('#transferSearchResults'), /mercato est fermé/);
      assert.equal(await page.$$eval('.modal button', bs => bs.filter(b => /Accepter|Chercher/.test(b.textContent)).length), 0);
      // un client lâché emporte son offre : plus d'action « Offre pour … » sur le tableau de bord (V8.6)
      await page.evaluate(id => {
        closeModal(); G.date.absMonth = 5; // janvier : mercato ouvert
        const club = Object.values(G.clubs).find(c => c.id !== G.players[id].club);
        createIncomingOffer(G, G.players[id], club, 100000, G.players[id].wage);
        navigate('dashboard');
      }, sid);
      assert.match(await page.textContent('#content'), /Offre pour/);
      await page.evaluate(id => { resolveDropClient(G, id); navigate('dashboard'); }, sid);
      assert.doesNotMatch(await page.textContent('#content'), /Offre pour/);
    }, { portraits: '2d' });
  });
}

test('Portraits 3D puis 2D : visage dessiné, identique après rechargement, désactivable', async () => {
  await withGame({ width: 1280, height: 900 }, async page => {
    await page.click('text=Lancer ma carrière');
    const pid = await page.evaluate(() => G.freeAgents[0]);
    await page.evaluate(id => openPlayerDetail(id, 'market'), pid);
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 120000 });
    const img = await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage);
    assert.match(img, /^url\("data:image\/(webp|png);base64,/);
    // l'image est vraiment décodable et non vide
    const size = await page.evaluate(src => new Promise(r => { const i = new Image(); i.onload = () => r([i.naturalWidth, i.naturalHeight]); i.onerror = () => r([0, 0]); i.src = src; }), img.slice(5, -2));
    assert.ok(size[0] >= 96 && size[1] >= 96, 'image de portrait valide');
    await page.waitForTimeout(800); // écriture du cache
    await page.reload(); await page.waitForTimeout(500);
    await page.evaluate(id => openPlayerDetail(id, 'market'), pid);
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    assert.equal(await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage), img, 'même visage après rechargement');
    // 3D impossible (ex. pas de WebGL) : la 2D prend le relais et les paramètres l'expliquent
    await page.evaluate(() => { closeModal(); portraitEngineOff('3d', 'webgl'); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    const img2d = await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage);
    assert.match(img2d, /^url\("data:image\/svg\+xml;base64,/);
    await page.evaluate(() => { closeModal(); openSettingsModal(); });
    assert.match(await page.textContent('.portrait-status'), /3D coupée.*WebGL/);
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
    await page.reload(); await page.waitForTimeout(800);
    assert.equal(await page.evaluate(() => serializeState(G)), before, 'partie identique après rechargement');
    assert.equal(await page.$$eval('.save-warning, .banner-warning', els => els.length), 0);
  }, { portraits: 'simple' });
});

test('Partie en cours sans les championnats V8.9 : au rechargement, les 26 classements sont visibles', async () => {
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
    await page.reload(); await page.waitForTimeout(1500);
    await page.evaluate(() => { ui.worldTab = 'classements'; ui.clubTab = 'BSA'; navigate('world'); });
    assert.equal(await page.$$eval('.league-picker option', o => o.length), 26, '26 championnats dans la liste (Ligue 3 comprise)');
    assert.equal(await page.$$eval('.tbl tbody tr', r => r.length), 20, 'classement du Brésil affiché');
    assert.match(await page.textContent('#content'), /Arrivé en cours de saison/);
    assert.match(await page.evaluate(() => G.news[0].text), /nouveaux championnats rejoignent la partie/);
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth), 0);
  }, { portraits: 'simple' });
});

test('V8.10 : Ligue 3 et parts de clubs — prise de contrôle d\'Amiens via l\'interface, gestion conservée au rechargement', async () => {
  await withGame({ width: 390, height: 844 }, async page => {
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => { G.agent.cash = 40e6; ui.worldTab = 'classements'; ui.clubTab = 'L3'; navigate('world'); });
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
    await page.reload(); await page.waitForFunction(() => typeof G !== 'undefined' && G && G.clubs && G.clubs.amiens && document.querySelector('#fabAdvance')); await page.waitForTimeout(800);
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
    await page.evaluate(() => { G.agent.cash = 60e6; G.rivalStakes = { amiens: { [G.rivalAgents[0].id]: 20 } }; openClubDetail('amiens', 'world'); });
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
    await page.reload(); await page.waitForFunction(() => typeof G !== 'undefined' && G && G.clubs && G.clubs.amiens && document.querySelector('#fabAdvance')); await page.waitForTimeout(800);
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
    await page.fill('#obName', 'Bob'); await page.fill('#obAgency', 'Agence B');
    await page.click('text=Lancer ma carrière');
    await page.evaluate(() => saveGame());
    await page.evaluate(() => openSettingsModal());
    await Promise.all([page.waitForNavigation(), page.click('text=Charger')]);
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
    await page.evaluate(() => { for (let i = 0; i < 2; i++) { G.pendingEvent = null; advanceMonth(G); } G.news.unshift({ text: 'Amiens SC monte en Ligue 2 !', tag: 'promotion', season: seasonLabel(G), month: calMonth(G) }); setSetting('lang', 'en'); closeModal(); navigate('news'); });
    let txt = await page.innerText('#app');
    assert.match(txt, /Amiens SC go up to Ligue 2!/, 'actualité traduite');
    assert.match(txt, /Dashboard[\s\S]*My players/);
    assert.equal(await page.evaluate(() => document.documentElement.lang), 'en');
    await page.evaluate(() => { setSetting('lang', 'es'); closeModal(); navigate('dashboard'); });
    txt = await page.innerText('#app');
    assert.match(txt, /Panel[\s\S]*Mis jugadores/);
    assert.doesNotMatch(txt, /Tableau de bord|Mes joueurs/);
    await page.reload(); await page.waitForTimeout(800);
    assert.match(await page.innerText('#app'), /Mis jugadores/, 'langue conservée au rechargement');
    await page.evaluate(() => { setSetting('lang', 'fr'); closeModal(); });
    assert.match(await page.innerText('#app'), /Tableau de bord[\s\S]*Mes joueurs/, 'retour au français');
  }, { portraits: 'simple' });
});
