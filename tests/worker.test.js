// V8.51 : programme Cloudflare (worker/index.js) — réception des statistiques anonymes et tableau de bord privé
const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('path');
const { pathToFileURL } = require('url');
const load = () => import(pathToFileURL(path.join(__dirname, '..', 'worker', 'index.js')).href);

function env(extra) {
  const points = [];
  return Object.assign({ points, STATS: { writeDataPoint: p => points.push(p) }, ASSETS: { fetch: req => new Response('page ' + new URL(req.url).pathname) } }, extra || {});
}
const post = (body, headers) => new Request('https://play.footagent.workers.dev/api/e', { method: 'POST', body: typeof body === 'string' ? body : JSON.stringify(body), headers });

test('V8.51 : le programme reçoit les événements anonymes et les range dans Analytics Engine', async () => {
  const { default: worker } = await load();
  const e = env();
  const ev = { t: 'session', u: 'abc123', v: '8.51', l: 'fr', d: 'mobile', m: 'agent', s: 'classique', a: 'new', b: 'nouveau', n: [3, 2, 7] };
  let r = await worker.fetch(post([ev, { t: 'screen', u: 'abc123', a: 'market', n: [4] }, { t: 'inconnu' }]), e);
  assert.equal(r.status, 204);
  assert.equal(e.points.length, 2, 'type inconnu ignoré');
  assert.deepEqual(e.points[0].indexes, ['abc123']);
  assert.deepEqual(e.points[0].blobs.slice(0, 8), ['session', '8.51', 'fr', 'mobile', 'agent', 'classique', 'new', 'nouveau']);
  assert.deepEqual(e.points[0].doubles, [3, 2, 7]);
  // champs tronqués, valeurs numériques sûres
  e.points.length = 0;
  await worker.fetch(post({ t: 'report', u: 'x'.repeat(100), a: 'y'.repeat(2000), n: ['oops', null, 5] }), e);
  assert.equal(e.points[0].indexes[0].length, 32);
  assert.equal(e.points[0].blobs[6].length, 500);
  assert.deepEqual(e.points[0].doubles, [0, 0, 5]);
  // corps invalide, trop gros, mauvaise méthode
  assert.equal((await worker.fetch(post('pas du json'), e)).status, 400);
  assert.equal((await worker.fetch(post('x'.repeat(9000)), e)).status, 413);
  assert.equal((await worker.fetch(new Request('https://play.footagent.workers.dev/api/e'), e)).status, 405);
  // au plus 40 événements par envoi
  e.points.length = 0;
  await worker.fetch(post(Array.from({ length: 60 }, () => ({ t: 'feature', u: 'a', a: 'scouting', n: [1] }))), e);
  assert.equal(e.points.length, 40);
  // sans jeu de données configuré : pas d'erreur
  assert.equal((await worker.fetch(post(ev), { ASSETS: e.ASSETS })).status, 204);
  // le reste du site est servi par les fichiers statiques
  assert.equal(await (await worker.fetch(new Request('https://play.footagent.workers.dev/confidentialite'), e)).text(), 'page /confidentialite');
  assert.equal((await worker.fetch(new Request('https://play.footagent.workers.dev/api/autre'), e)).status, 404);
});

test('V8.51 : tableau de bord privé — mot de passe, configuration manquante, requêtes SQL', async () => {
  const { default: worker, STATS_QUERIES } = await load();
  const get = key => new Request('https://play.footagent.workers.dev/api/stats?days=7', { headers: key ? { 'x-stats-key': key } : {} });
  assert.equal((await worker.fetch(get('x'), env())).status, 503, 'sans STATS_KEY');
  assert.equal((await worker.fetch(get('mauvais'), env({ STATS_KEY: 'secret' }))).status, 401);
  const r = await worker.fetch(get('secret'), env({ STATS_KEY: 'secret', CF_ACCOUNT_ID: 'acc' }));
  assert.equal(r.status, 503); assert.equal((await r.json()).missing, 'CF_API_TOKEN');
  // avec le jeton : une requête SQL par bloc, l'échec d'un bloc n'empêche pas les autres
  const calls = [], orig = global.fetch;
  global.fetch = async (url, init) => { calls.push({ url, q: init.body }); return /blob1 = 'error'/.test(init.body) ? new Response('boom', { status: 500 }) : new Response(JSON.stringify({ data: [{ k: 'fr', n: 3 }] })); };
  try {
    const res = await worker.fetch(get('secret'), env({ STATS_KEY: 'secret', CF_ACCOUNT_ID: 'acc', CF_API_TOKEN: 'tok' }));
    assert.equal(res.status, 200);
    const j = await res.json();
    assert.equal(j.days, 7);
    assert.equal(calls.length, Object.keys(STATS_QUERIES).length + 1, 'une vérification du jeton, puis une requête par bloc');
    assert.ok(calls.slice(1).every(c => c.url === 'https://api.cloudflare.com/client/v4/accounts/acc/analytics_engine/sql' && /INTERVAL '7' DAY/.test(c.q)));
    assert.deepEqual(j.data.langs, [{ k: 'fr', n: 3 }]);
    assert.ok(j.data.errors.error, 'erreur isolée');
  } finally { global.fetch = orig; }
});

test('V8.51 : jeton refusé — un message clair, et le jeton collé est nettoyé', async () => {
  const { default: worker, cleanToken } = await load();
  assert.equal(cleanToken('  Bearer abc_DEF-123 \n'), 'abc_DEF-123');
  assert.equal(cleanToken('"abc123"'), 'abc123');
  const orig = global.fetch, seen = [];
  global.fetch = async (url, init) => { seen.push(init.headers.Authorization); return new Response('{"success":false,"errors":[{"code":9106,"message":"Authentication failed (status: 400)"}]}', { status: 400 }); };
  try {
    const r = await worker.fetch(new Request('https://play.footagent.workers.dev/api/stats', { headers: { 'x-stats-key': 'k' } }), { STATS_KEY: 'k', CF_ACCOUNT_ID: 'acc', CF_API_TOKEN: ' Bearer tok123\n', ASSETS: {} });
    assert.equal(r.status, 502);
    const j = await r.json();
    assert.equal(j.error, 'token'); assert.equal(j.length, 6);
    assert.equal(seen.length, 1, 'arrêt après la vérification'); assert.equal(seen[0], 'Bearer tok123');
  } finally { global.fetch = orig; }
});
