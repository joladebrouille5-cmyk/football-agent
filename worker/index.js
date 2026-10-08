// Football Agent — petit programme Cloudflare (V8.51) : sert le site (dist/) et reçoit les statistiques anonymes.
//   POST /api/e      événements anonymes du jeu (session, écrans, saison, moments clés, erreurs, signalements)
//   GET  /api/stats  tableau de bord privé (stats.html), protégé par le secret STATS_KEY
// Les événements vont dans Workers Analytics Engine (jeu de données « football_agent ») : aucune adresse IP, aucun
// nom ; un identifiant aléatoire tiré par le navigateur sert seulement à compter les joueurs qui reviennent.
const TYPES = new Set(['session', 'screen', 'feature', 'season', 'moment', 'error', 'report']);
const MAX_BODY = 8000, MAX_POINTS = 40;
const clip = (v, n) => String(v == null ? '' : v).slice(0, n);
const num = v => (Number.isFinite(+v) ? +v : 0);

function json(data, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' } });
}

// un événement → un point Analytics Engine
//   index1 : identifiant anonyme ; blobs : type, version, langue, appareil, mode, scénario, détail 1, détail 2, pays
//   doubles : trois valeurs numériques selon le type
export function toPoint(e, country) {
  if (!e || !TYPES.has(e.t)) return null;
  const d = Array.isArray(e.n) ? e.n : [];
  return {
    indexes: [clip(e.u, 32) || 'anon'],
    blobs: [e.t, clip(e.v, 12), clip(e.l, 5), clip(e.d, 10), clip(e.m, 12), clip(e.s, 20), clip(e.a, e.t === 'report' || e.t === 'error' ? 500 : 60), clip(e.b, e.t === 'error' ? 300 : 60), clip(country, 4)],
    doubles: [num(d[0]), num(d[1]), num(d[2])],
  };
}

async function ingest(request, env) {
  const len = +(request.headers.get('content-length') || 0);
  if (len > MAX_BODY) return new Response(null, { status: 413 });
  let body;
  try { const txt = await request.text(); if (txt.length > MAX_BODY) return new Response(null, { status: 413 }); body = JSON.parse(txt); }
  catch (e) { return new Response(null, { status: 400 }); }
  const list = (Array.isArray(body) ? body : [body]).slice(0, MAX_POINTS);
  const country = request.cf && request.cf.country;
  let n = 0;
  for (const e of list) {
    const p = toPoint(e, country);
    if (!p) continue;
    if (env.STATS) env.STATS.writeDataPoint(p);
    n++;
  }
  return n ? new Response(null, { status: 204 }) : new Response(null, { status: 400 });
}

// requêtes du tableau de bord (API SQL d'Analytics Engine) ; _sample_interval compense l'échantillonnage
export const STATS_QUERIES = {
  daily: d => `SELECT toDate(timestamp) AS day, SUM(_sample_interval) AS sessions, SUM(_sample_interval * if(blob7 = 'new', 1, 0)) AS newcomers FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY day ORDER BY day`,
  players: d => `SELECT COUNT(DISTINCT index1) AS players FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY`,
  returning: d => `SELECT blob8 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC`,
  countries: d => `SELECT blob9 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 12`,
  devices: d => `SELECT blob4 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC`,
  langs: d => `SELECT blob3 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC`,
  versions: d => `SELECT blob2 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 8`,
  modes: d => `SELECT blob5 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC`,
  scenarios: d => `SELECT blob6 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'session' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 15`,
  duration: d => `SELECT SUM(_sample_interval * double1) / SUM(_sample_interval) AS minutes, SUM(_sample_interval * double2) / SUM(_sample_interval) AS months FROM football_agent WHERE blob1 = 'screen' AND blob7 = '_total' AND timestamp > NOW() - INTERVAL '${d}' DAY`,
  screens: d => `SELECT blob7 AS k, SUM(_sample_interval * double1) AS n FROM football_agent WHERE blob1 = 'screen' AND blob7 != '_total' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 20`,
  features: d => `SELECT blob7 AS k, SUM(_sample_interval * double1) AS n FROM football_agent WHERE blob1 = 'feature' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 20`,
  seasons: d => `SELECT double1 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'season' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY k LIMIT 40`,
  moments: d => `SELECT blob7 AS k, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'moment' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k ORDER BY n DESC LIMIT 20`,
  errors: d => `SELECT blob7 AS k, blob2 AS v, SUM(_sample_interval) AS n FROM football_agent WHERE blob1 = 'error' AND timestamp > NOW() - INTERVAL '${d}' DAY GROUP BY k, v ORDER BY n DESC LIMIT 20`,
  reports: d => `SELECT timestamp AS at, blob7 AS text, blob8 AS ref, blob2 AS v, blob4 AS dev, blob9 AS country FROM football_agent WHERE blob1 = 'report' AND timestamp > NOW() - INTERVAL '${d}' DAY ORDER BY timestamp DESC LIMIT 30`,
};

// jeton tel que collé dans le tableau de bord : espaces, retours à la ligne, guillemets ou « Bearer » en trop retirés
export function cleanToken(t) { return String(t || '').replace(/[\s"'`]+/g, ' ').trim().replace(/^Bearer\s+/i, '').replace(/\s+/g, ''); }
async function sql(env, query) {
  const r = await fetch(`https://api.cloudflare.com/client/v4/accounts/${String(env.CF_ACCOUNT_ID).trim()}/analytics_engine/sql`, {
    method: 'POST', headers: { Authorization: `Bearer ${cleanToken(env.CF_API_TOKEN)}` }, body: query,
  });
  const txt = await r.text();
  if (!r.ok) { const e = new Error(txt.slice(0, 200)); e.status = r.status; e.auth = r.status === 401 || r.status === 403 || /"code":\s*(9106|9109|10000|10001)\b/.test(txt); throw e; }
  return JSON.parse(txt).data || [];
}

async function stats(request, env) {
  const key = request.headers.get('x-stats-key') || '';
  if (!env.STATS_KEY) return json({ error: 'setup', missing: 'STATS_KEY' }, 503);
  if (key !== env.STATS_KEY) return json({ error: 'key' }, 401);
  if (!env.CF_ACCOUNT_ID || !env.CF_API_TOKEN) return json({ error: 'setup', missing: !env.CF_API_TOKEN ? 'CF_API_TOKEN' : 'CF_ACCOUNT_ID' }, 503);
  const days = Math.max(1, Math.min(90, Math.round(+new URL(request.url).searchParams.get('days') || 30)));
  // un premier appel vérifie le jeton : s'il est refusé, un seul message clair plutôt que seize erreurs
  try { await sql(env, "SELECT count() AS n FROM football_agent WHERE timestamp > NOW() - INTERVAL '1' DAY"); }
  catch (e) { if (e.auth) return json({ error: 'token', status: e.status || 0, detail: String(e.message || e).slice(0, 200), length: cleanToken(env.CF_API_TOKEN).length }, 502); }
  const out = {};
  await Promise.all(Object.entries(STATS_QUERIES).map(async ([k, q]) => {
    try { out[k] = await sql(env, q(days)); } catch (e) { out[k] = { error: String(e.message || e) }; }
  }));
  return json({ days, data: out });
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (url.pathname === '/api/e') return request.method === 'POST' ? ingest(request, env) : new Response(null, { status: 405 });
    if (url.pathname === '/api/stats') return request.method === 'GET' ? stats(request, env) : new Response(null, { status: 405 });
    if (url.pathname.startsWith('/api/')) return new Response(null, { status: 404 });
    return env.ASSETS.fetch(request);
  },
};
