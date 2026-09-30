// Parcours réel dans le navigateur (Playwright) : `npm run test:e2e`
// Nécessite Playwright (`npm install`) et un Chromium (`npx playwright install chromium`).
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const { chromium } = require('playwright');
const { GAME_FILE } = require('./load-engine');

async function withGame(viewport, fn) {
  const html = fs.readFileSync(GAME_FILE);
  const srv = http.createServer((req, res) => { res.writeHead(200, { 'content-type': 'text/html; charset=utf-8' }); res.end(html); });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const ctx = await browser.newContext({ viewport });
  await ctx.route(/fonts\.(googleapis|gstatic)\.com/, r => r.abort()); // le jeu doit fonctionner sans les polices
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
    });
  });
}
