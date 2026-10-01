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
  const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.gz': 'application/gzip' };
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
    // réglage « 2D » : visage dessiné (SVG), lui aussi déterministe
    await page.evaluate(() => setSetting('portraits', '2d')); await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    const img2d = await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage);
    assert.match(img2d, /^url\("data:image\/svg\+xml;base64,/);
    await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForSelector('.pd-portrait .has-photo', { timeout: 30000 });
    assert.equal(await page.$eval('.pd-portrait .player-card-portrait', el => el.style.backgroundImage), img2d, 'même visage 2D');
    await page.evaluate(() => setSetting('portraits', 'simple')); await page.evaluate(() => { closeModal(); openPlayerDetail(G.freeAgents[0], 'market'); });
    await page.waitForTimeout(400);
    assert.equal(await page.$$eval('.has-photo', els => els.length), 0, 'silhouettes en mode simple');
  });
});
