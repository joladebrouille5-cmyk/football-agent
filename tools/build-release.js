// Version publiée protégée (V8.25) : le code lisible reste dans le dépôt (privé) ; la page publiée est minifiée et
// obfusquée — chaînes chiffrées, noms internes illisibles, autodéfense (le code cesse de fonctionner si on le
// reformate ou le modifie) et protection contre le débogueur du navigateur.
//   npm install --no-save javascript-obfuscator   (une fois)
//   node tools/build-release.js [sortie]          (défaut : dist/football-agent.html)
// Rien n'est inviolable côté navigateur : le but est que lire, copier ou trafiquer le jeu demande un vrai effort.
const fs = require('fs'), path = require('path');
const JavaScriptObfuscator = require('javascript-obfuscator');
const SRC = path.join(__dirname, '..', 'football-agent-8-2-20.html');
const ROOT = path.join(__dirname, '..');
// V8.26 : dist/ est le site complet à héberger (Cloudflare Pages, Netlify…) ; le jeu y est la page d'accueil
const OUT = process.argv[2] || path.join(ROOT, 'dist', 'index.html');
const html = fs.readFileSync(SRC, 'utf8');
const a = html.indexOf('<script>'), b = html.lastIndexOf('</script>');
if (a < 0 || b < a) throw new Error('script principal introuvable');
let js = html.slice(a + '<script>'.length, b);
// le crochet pour les tests Node n'a rien à faire dans la page publiée
js = js.replace(/if \(typeof module !== 'undefined'\) \{\s*module\.exports = \{[\s\S]*?\};\s*\}/, '');
// Le jeu entier est enfermé dans une fonction : l'état de la partie, les réglages, la signature et l'écriture des
// sauvegardes ne sont plus accessibles depuis la console du navigateur. Seules les fonctions appelées par les boutons
// (onclick="…", y compris dans des chaînes construites dynamiquement) sont exposées, sous leur nom, avec « ui » ;
// le moteur (simulation, sauvegardes, argent) reste entièrement à l'intérieur.
const SENSITIVE = ['saveSignature', 'serializeState', 'deserializeState', 'packPlayersForSave', 'unpackPlayersFromSave',
  'saveToLocalStorage', 'loadFromLocalStorage', 'saveGame', 'scheduleSave', 'flushPendingSaveOnUnload', 'gzipToBase64', 'base64ToGunzip', 'saveIdb'];
const topFns = [...js.matchAll(/^(?:async\s+)?function\s+([A-Za-z_$][\w$]*)/gm)].map(m => m[1]);
const handlerText = [...js.matchAll(/\bon[a-z]+="([^"]*)"/g)].map(m => m[1]).join(' ') + ' ' + [...js.matchAll(/cta:\s*`([^`]*)`/g)].map(m => m[1]).join(' ');
for (const f of SENSITIVE) if (new RegExp('\\b' + f + '\\(').test(handlerText)) throw new Error(f + ' est appelée par un bouton : impossible de la cacher');
const called = new Set([...handlerText.matchAll(/(?<![.\w$])([A-Za-z_$][\w$]*)\s*\(/g)].map(m => m[1]));
const exposed = topFns.filter(f => !SENSITIVE.includes(f) && called.has(f));
js = '(function () {\n' + js + '\n;Object.assign(window, {' + exposed.map(n => `'${n}': ${n}`).join(', ') + ", 'ui': ui });\n})();";
const t0 = Date.now();
const obf = JavaScriptObfuscator.obfuscate(js, {
  target: 'browser',
  compact: true,
  renameGlobals: false,
  identifierNamesGenerator: 'hexadecimal',
  stringArray: true, stringArrayThreshold: 0.25, stringArrayEncoding: ['base64'],
  stringArrayRotate: true, stringArrayShuffle: true, stringArrayWrappersCount: 1, stringArrayWrappersType: 'variable',
  splitStrings: false,
  forceTransformStrings: ['Kp7vQ2mZ9wR4tL8xB1nJ6sF3'], // clé de signature des sauvegardes : toujours chiffrée
  reservedStrings: ['^__CODE_HASH__$'],                  // emplacement de l'empreinte du code, rempli ci-dessous
  controlFlowFlattening: false,    // coûteux pour la simulation : laissé de côté
  deadCodeInjection: false,
  numbersToExpressions: false,    // trop coûteux dans les boucles de simulation
  selfDefending: true,             // reformater ou modifier le code le casse
  debugProtection: true, debugProtectionInterval: 4000, // ouvrir les outils de développement fige la page
  disableConsoleOutput: true,
  transformObjectKeys: false, unicodeEscapeSequence: false,
}).getObfuscatedCode();
// empreinte du code publié : calculée sur le script final (emplacement vide), puis inscrite dedans ; le jeu refait le
// calcul au lancement et se sait modifié si le résultat diffère (même algorithme que codeFingerprint dans le jeu)
function codeFingerprint(txt) {
  let x = 0x811c9dc5, y = 0x050c5d1f;
  for (let i = 0; i < txt.length; i++) { const c = txt.charCodeAt(i); x = Math.imul(x ^ c, 16777619); y = Math.imul(y ^ c, 2246822519); }
  return (x >>> 0).toString(36) + (y >>> 0).toString(36);
}
if (obf.split('__CODE_HASH__').length !== 2) throw new Error("emplacement de l'empreinte introuvable (ou en double) dans le code obfusqué");
const fp = codeFingerprint(obf);
const finalJs = obf.replace('__CODE_HASH__', fp);
let page = html.slice(0, a) + '<script>' + finalJs + '</script>' + html.slice(b + '</script>'.length);
page = page.replace(/<!--[\s\S]*?-->/g, '');                         // commentaires HTML
page = page.replace(/<style>([\s\S]*?)<\/style>/g, (m, css) =>          // CSS : commentaires et blancs
  '<style>' + css.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\s*\n\s*/g, '\n').replace(/[ \t]{2,}/g, ' ') + '</style>');
fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, page);
// fichiers chargés à côté de la page (portraits) : copiés pour que la version publiée soit complète
const DIR = path.dirname(OUT);
const pdir = path.join(DIR, 'portraits');
fs.mkdirSync(pdir, { recursive: true });
for (const f of ['photos.webp', 'faces2d.js']) fs.copyFileSync(path.join(ROOT, 'portraits', f), path.join(pdir, f));
// Le reste du site (V8.26) : icônes, manifeste (l'application démarre sur la page d'accueil), service worker (hors
// connexion ; son cache change à chaque version publiée pour que les joueurs reçoivent la mise à jour), page
// « Mentions et confidentialité », en-têtes de sécurité et redirections des anciennes adresses.
for (const f of ['icon-192.png', 'icon-512.png']) fs.copyFileSync(path.join(ROOT, f), path.join(DIR, f));
const manifest = JSON.parse(fs.readFileSync(path.join(ROOT, 'manifest.webmanifest'), 'utf8'));
manifest.id = './'; manifest.start_url = './';
fs.writeFileSync(path.join(DIR, 'manifest.webmanifest'), JSON.stringify(manifest, null, 2) + '\n');
const CORE = ['./', 'index.html', 'manifest.webmanifest', 'icon-192.png', 'icon-512.png'];
let sw = fs.readFileSync(path.join(ROOT, 'sw.js'), 'utf8');
const swParts = [/^const CACHE = .*$/m, /^const CORE = .*$/m, /caches\.match\('football-agent-8-2-20\.html'\)/];
for (const re of swParts) if (!re.test(sw)) throw new Error('sw.js : motif introuvable ' + re);
sw = sw.replace(swParts[0], `const CACHE = 'football-agent-${fp}';`)
  .replace(swParts[1], `const CORE = ${JSON.stringify(CORE)};`)
  .replace(swParts[2], "caches.match('index.html')");
fs.writeFileSync(path.join(DIR, 'sw.js'), sw);
for (const f of fs.readdirSync(path.join(ROOT, 'site'))) fs.copyFileSync(path.join(ROOT, 'site', f), path.join(DIR, f));
for (const f of CORE) if (f !== './' && !fs.existsSync(path.join(DIR, f))) throw new Error('fichier du site manquant : ' + f);
console.log(`${exposed.length} fonctions exposées aux boutons sur ${topFns.length}`);
console.log(`Empreinte du code : ${fp}`);
console.log(`Version protégée : ${OUT} (${Math.round(page.length / 1024)} Ko, source ${Math.round(html.length / 1024)} Ko, ${Date.now() - t0} ms)`);
