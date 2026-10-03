// Football Agent — service worker (V8.12) : le jeu fonctionne hors connexion une fois ouvert depuis son site.
// Le jeu (HTML) est servi « réseau d'abord » pour recevoir les mises à jour ; les fichiers lourds (portraits,
// icônes) « cache d'abord ». Changer CACHE à chaque version qui modifie les portraits.
const CACHE = 'football-agent-v8-29';
const CORE = ['./', 'football-agent-8-2-20.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(CORE)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  const isPage = req.mode === 'navigate' || req.url.endsWith('.html');
  if (isPage) {
    // V8.28 : sans le cache HTTP du navigateur, pour toujours recevoir la dernière version publiée
    // V8.36 : l'hébergeur redirige « page.html » vers « page » (et « index.html » vers « / ») ; une réponse
    // redirigée ne peut pas servir une navigation (page blanche « impossible d'ouvrir ») : on renvoie la redirection
    // au navigateur, qui redemande la bonne adresse.
    e.respondWith(fetch(req.url, { cache: 'no-cache', credentials: 'same-origin' }).then(res => {
      if (res.redirected) return req.mode === 'navigate' ? Response.redirect(res.url, 302) : res;
      if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
      return res;
    })
      .catch(() => caches.match(req).then(r => r || caches.match('football-agent-8-2-20.html'))));
    return;
  }
  e.respondWith(caches.match(req).then(hit => hit || fetch(req).then(res => {
    if (res.ok) { const copy = res.clone(); caches.open(CACHE).then(c => c.put(req, copy)); }
    return res;
  })));
});
