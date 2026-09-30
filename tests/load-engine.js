// Charge le moteur de jeu (partie « pur JS ») directement depuis le fichier HTML, sans le dupliquer :
// on extrait le script entre la balise <script> et le bloc « INTERFACE », puis on l'exécute comme un module.
const fs = require('fs');
const path = require('path');
const Module = require('module');

const GAME_FILE = path.join(__dirname, '..', 'football-agent-8-2-20.html');

function loadEngine() {
  const html = fs.readFileSync(GAME_FILE, 'utf8');
  const start = html.indexOf('<script>') + '<script>'.length;
  const end = html.indexOf('/* ============================================================\n   INTERFACE');
  if (start < 8 || end < 0) throw new Error('Impossible de localiser le moteur dans ' + GAME_FILE);
  const m = new Module(GAME_FILE);
  m.paths = Module._nodeModulePaths(path.dirname(GAME_FILE));
  m._compile(html.slice(start, end), GAME_FILE);
  return m.exports;
}

module.exports = { loadEngine, GAME_FILE };
