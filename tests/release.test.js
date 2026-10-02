// Version publiée protégée (V8.25) : `npm run build && npm run test:release`
// Joue la page obfusquée uniquement par l'interface (comme un joueur), puis tente de la craquer : console, sauvegarde
// modifiée, signature retirée.
const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('http');
const fs = require('fs');
const path = require('path');
const { chromium } = require('playwright');
const DIST = path.join(__dirname, '..', 'dist', 'index.html');
// V8.26 : la page est servie avec les en-têtes du site (dist/_headers), dont la politique de sécurité du contenu
function siteHeaders() {
  const f = path.join(path.dirname(DIST), '_headers');
  const out = {};
  if (!fs.existsSync(f)) return out;
  let cur = null;
  for (const line of fs.readFileSync(f, 'utf8').split('\n')) {
    if (/^\S/.test(line) && !line.startsWith('#')) cur = line.trim() === '/*' ? out : null;
    else if (cur && /^\s+\S/.test(line)) { const i = line.indexOf(':'); cur[line.slice(0, i).trim().toLowerCase()] = line.slice(i + 1).trim(); }
  }
  return out;
}
const TYPES = { '.webp': 'image/webp', '.js': 'text/javascript', '.png': 'image/png', '.html': 'text/html; charset=utf-8', '.webmanifest': 'application/manifest+json' };

async function withRelease(fn, html, extra) {
  const root = path.dirname(DIST);
  const srv = http.createServer((req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '');
    const file = path.join(root, rel);
    if (extra && extra[rel] !== undefined) { res.writeHead(200, { 'content-type': 'text/plain' }); return res.end(extra[rel]); }
    const hdr = siteHeaders();
    if (rel && rel !== 'index.html' && file.startsWith(root) && fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200, { ...hdr, 'content-type': TYPES[path.extname(rel)] || 'application/octet-stream' }); return fs.createReadStream(file).pipe(res); }
    res.writeHead(200, { ...hdr, 'content-type': 'text/html; charset=utf-8' }); res.end(html || fs.readFileSync(DIST));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const browser = await chromium.launch();
  const page = await (await browser.newContext({ viewport: { width: 1280, height: 900 } })).newPage();
  const errors = [];
  page.on('pageerror', e => errors.push(e.message));
  page.on('console', m => { if (/Content Security Policy/i.test(m.text())) errors.push('CSP : ' + m.text()); });
  try { await page.goto(`http://127.0.0.1:${srv.address().port}/`); await fn(page); }
  finally { await browser.close(); srv.close(); }
  assert.deepEqual(errors, [], 'aucune erreur JavaScript');
}
async function advance(page) {
  await page.click('#fabAdvance');
  for (let i = 0; i < 8; i++) {
    await page.waitForTimeout(120);
    const reply = await page.$('.chat-reply-btn');
    if (reply) { await reply.click(); await page.waitForTimeout(80); const ok = await page.$('.event-modal .btn-primary'); if (ok) await ok.click(); continue; }
    const btn = await page.$('.modal .btn-primary.btn-block');
    if (btn && /Continuer|Fermer/i.test(await btn.textContent())) { await btn.click(); continue; }
    if (await page.$('.modal-close')) { await page.click('.modal-close'); continue; }
    break;
  }
}
// sauvegarde compressée du navigateur : lecture / réécriture (ce que ferait un tricheur)
const readSave = page => page.evaluate(async () => {
  const b64 = localStorage.getItem('football_agent_save_v3'); const bin = Uint8Array.from(atob(b64), c => c.charCodeAt(0));
  return await new Response(new Blob([bin]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
});
const writeSave = (page, str) => page.evaluate(async str => {
  const b = new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer());
  let bin = ''; for (let i = 0; i < b.length; i += 0x8000) bin += String.fromCharCode.apply(null, b.subarray(i, i + 0x8000));
  localStorage.setItem('football_agent_save_v3', btoa(bin));
}, str);

test('Version protégée : partie jouée par l\'interface, état inaccessible depuis la console, sauvegarde trafiquée détectée', { skip: !fs.existsSync(DIST) && 'dist absent : npm run build' }, async () => {
  await withRelease(async page => {
    // le code est obfusqué : ni noms internes, ni commentaires
    const src = fs.readFileSync(DIST, 'utf8');
    for (const word of ['saveSignature', 'serializeState', 'SAVE_SIG_K', 'chasse aux tricheries', 'function advanceMonth']) assert.ok(!src.includes(word), 'visible dans la page : ' + word);
    // console : l'état de la partie et la signature ne sont pas atteignables
    assert.deepEqual(await page.evaluate(() => [typeof G, typeof saveSignature, typeof serializeState, typeof saveGame, typeof advanceMonth]), ['undefined', 'undefined', 'undefined', 'undefined', 'undefined']);
    // une vraie partie, par les boutons
    await page.click('#startNew'); await page.click('text=Lancer ma carrière');
    await page.waitForSelector('#fabAdvance');
    for (let i = 0; i < 3; i++) await advance(page);
    for (const nav of ['market', 'myplayers', 'world', 'agency', 'dashboard']) { const el = await page.$(`.nav-item[data-nav="${nav}"]`); if (el) { await el.click(); await page.waitForTimeout(150); } }
    const date = await page.textContent('#topbarDate');
    await page.waitForTimeout(800);
    await page.reload(); await page.click('#startContinue'); await page.waitForSelector('#fabAdvance');
    assert.equal(await page.textContent('#topbarDate'), date, 'partie retrouvée après rechargement');
    assert.equal(await page.$('#integrityChip'), null, 'partie honnête : pas d\'alerte');
    // tricheur 1 : trésorerie modifiée dans la sauvegarde
    const save = await readSave(page);
    assert.ok(save.startsWith('{"_sig":"'), 'sauvegarde signée');
    await writeSave(page, save.replace(/"cash":-?[\d.]+/, '"cash":999999999'));
    await page.reload(); await page.click('#startContinue'); await page.waitForSelector('#integrityChip');
    assert.match(await page.textContent('#integrityChip'), /modifiée/i);
    assert.match(await page.textContent('#topbarStats'), /1000M|999/);
    // tricheur 2 : signature retirée en espérant passer pour une ancienne sauvegarde
    await writeSave(page, save.replace(/^\{"_sig":"[^"]+",/, '{').replace(/"cash":-?[\d.]+/, '"cash":999999999'));
    await page.reload(); await page.click('#startContinue'); await page.waitForSelector('#integrityChip');
    assert.match(await page.textContent('#integrityChip'), /modifiée/i);
    // la marque reste même après une sauvegarde par le jeu
    await advance(page); await page.waitForTimeout(800);
    await page.reload(); await page.click('#startContinue'); await page.waitForSelector('#integrityChip');
  });
});

test('Version protégée : une copie modifiée de la page (sonde, puis lecture du code usurpée) se sait modifiée', { skip: !fs.existsSync(DIST) && 'dist absent : npm run build' }, async () => {
  const orig = fs.readFileSync(DIST, 'utf8');
  // sonde injectée au début de chaque fonction auto-exécutée : l'une d'elles contient l'état de la partie
  const probed = orig.replace(/\(function\(\)\{/g, m => m + '(window.__probes=window.__probes||[]).push(function(n){try{return eval(n)}catch(e){}});');
  const origJs = orig.slice(orig.indexOf('<script>') + 8, orig.lastIndexOf('</script>'));
  const spoof = '<script>(function(){var x=new XMLHttpRequest();x.open("GET","orig.txt",false);x.send();var t=x.responseText;Object.defineProperty(document,"currentScript",{configurable:true,get:function(){return {textContent:t,text:t,tagName:"SCRIPT"};}});})();</script>';
  for (const [label, html] of [['sonde', probed], ['sonde + usurpation', probed.replace('<script>', spoof + '<script>')]]) {
    await withRelease(async page => {
      await page.click('#startNew'); await page.click('text=Lancer ma carrière'); await page.waitForSelector('#fabAdvance');
      const ids = [...new Set(probed.match(/_0x[0-9a-f]{3,7}/g) || [])];
      const hit = await page.evaluate(ids => { for (const pr of window.__probes || []) for (const n of ids) { const v = pr(n); if (v && typeof v === 'object' && v.agent && 'cash' in v.agent) { v.agent.cash = 999999999; return true; } } return false; }, ids);
      assert.ok(hit, label + ' : la copie modifiée atteint bien l\'état (attaque réaliste)');
      await page.evaluate(() => { const d = document.querySelector('.nav-item[data-nav="market"]'); if (d) d.click(); });
      await page.waitForSelector('#integrityChip', { timeout: 5000 });
      assert.match(await page.textContent('#integrityChip'), /modifiée/i, label + ' : la copie se sait modifiée');
    }, html, { 'orig.txt': origJs });
  }
});

test('V8.26 : dist/ est un site complet (accueil, manifeste, service worker, confidentialité, en-têtes)', { skip: !fs.existsSync(DIST) && 'dist absent : npm run build' }, async () => {
  const dir = path.dirname(DIST);
  const manifest = JSON.parse(fs.readFileSync(path.join(dir, 'manifest.webmanifest'), 'utf8'));
  assert.equal(manifest.start_url, './', "l'application installée démarre sur la page d'accueil");
  for (const ic of manifest.icons) assert.ok(fs.existsSync(path.join(dir, ic.src)), 'icône ' + ic.src);
  const sw = fs.readFileSync(path.join(dir, 'sw.js'), 'utf8');
  new Function(sw); // syntaxe valide
  assert.doesNotMatch(sw, /football-agent-8-2-20/, "le service worker ne vise plus l'ancien nom du fichier");
  const core = JSON.parse(sw.match(/const CORE = (\[.*\]);/)[1]);
  for (const f of core) if (f !== './') assert.ok(fs.existsSync(path.join(dir, f)), 'fichier mis en cache présent : ' + f);
  assert.match(sw, /const CACHE = 'football-agent-[a-z0-9]+';/, 'cache renouvelé à chaque version publiée');
  const page = fs.readFileSync(DIST, 'utf8');
  for (const ref of [...page.matchAll(/<link[^>]+href="([^"]+)"/g)].map(m => m[1]).filter(h => !/^https?:/.test(h)))
    assert.ok(fs.existsSync(path.join(dir, ref)), 'fichier référencé par la page présent : ' + ref);
  assert.ok(fs.existsSync(path.join(dir, 'confidentialite.html')), 'page Mentions et confidentialité');
  assert.match(siteHeaders()['content-security-policy'] || '', /default-src 'self'/, 'politique de sécurité du contenu');
  assert.match(fs.readFileSync(path.join(dir, '_redirects'), 'utf8'), /football-agent-8-2-20\.html\s+\/\s+301/, 'ancienne adresse redirigée');
  assert.ok(!fs.readdirSync(dir).some(f => /football-agent-8-2-20|\.src\.js$/.test(f)), 'aucun code source lisible publié');
});
