// Planche de contrôle des portraits : 48 joueurs (12 nationalités, âges variés), en 2D ou en 3D.
//   NODE_PATH=$(npm root -g) node tools/portrait-sheet.js 2d [taille] [sortie.png]
//   NODE_PATH=$(npm root -g) node tools/portrait-sheet.js 3d 128 /tmp/planche-3d.png
// La 3D utilise WebGL logiciel (SwiftShader) : compter 1 à 5 s par visage.
const http = require('http'), fs = require('fs'), path = require('path');
const { chromium } = require('playwright');
const root = path.join(__dirname, '..', 'portraits');
const mode = process.argv[2] === '3d' ? '3d' : '2d', size = +process.argv[3] || (mode === '3d' ? 128 : 110);
const out = process.argv[4] || `planche-${mode}.png`;
const nats = ['SN', 'GH', 'CI', 'FR', 'EN', 'BR', 'MA', 'EG', 'JP', 'ES', 'US', 'TR'];
const page = `<!doctype html><body style="margin:0;background:#222"><div id=g style="display:grid;grid-template-columns:repeat(8,110px);gap:4px;font:10px sans-serif;color:#fff"></div><script type=module>
const m = await import('./${mode === '3d' ? 'portraits.js' : 'faces2d.js'}'); const nats = ${JSON.stringify(nats)};
for (let i = 0; i < 48; i++) { const p = { id: 'p' + (3000 + i * 13), nat: nats[i % nats.length], age: 19 + (i * 5) % 16 };
  const { url } = await m.renderPortrait(p, ${size}); const d = document.createElement('div');
  d.innerHTML = '<img src="' + url + '" style="width:110px;height:110px;display:block;border-radius:8px">' + p.nat + ' ' + p.age; g.appendChild(d); }
window.DONE = 1;</script>`;
const TYPES = { '.js': 'text/javascript', '.json': 'application/json', '.webp': 'image/webp' };
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]).replace(/^\/+/, ''));
  if (f.startsWith(root) && fs.existsSync(f) && fs.statSync(f).isFile()) { r.writeHead(200, { 'content-type': TYPES[path.extname(f)] || 'application/octet-stream' }); return fs.createReadStream(f).pipe(r); }
  r.writeHead(200, { 'content-type': 'text/html' }); r.end(page);
});
srv.listen(0, async () => {
  const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader'] });
  const pg = await b.newPage({ viewport: { width: 910, height: 800 } });
  pg.on('pageerror', e => console.error('Erreur :', e.message));
  await pg.goto(`http://127.0.0.1:${srv.address().port}/`);
  await pg.waitForFunction(() => window.DONE, null, { timeout: 900000 });
  await pg.screenshot({ path: out, fullPage: true });
  console.log('Planche écrite :', out);
  await b.close(); srv.close();
});
