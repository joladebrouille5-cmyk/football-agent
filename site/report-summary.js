// Football Agent — synthèse des signalements (tableau de bord /stats)
// Range chaque message dans un thème (mots-clés en français, anglais et espagnol), regroupe les messages qui décrivent
// le même problème (mots en commun) et classe les thèmes et les problèmes du plus signalé au moins signalé.
// Aucun appel extérieur : tout se fait dans la page, sur les signalements déjà affichés.
(function (root) {
  var THEMES = [
    { id: 'agence', label: 'Agence, places et loyer', words: ['agence', 'agency', 'agencia', 'place', 'places', 'bureau', 'portefeuille', 'demenag', 'loyer', 'rent', 'alquiler', 'niveau agence', 'internationale', 'europeenne', 'nationale'] },
    { id: 'argent', label: 'Argent et finances', words: ['argent', 'solde', 'tresorerie', 'cash', 'money', 'dinero', 'million', 'impot', 'tax', 'dette', 'debt', 'faillite', 'bankrupt', 'sponsor', 'commission', 'salaire', 'budget', 'euros'] },
    { id: 'sauvegarde', label: 'Sauvegarde et chargement', words: ['sauvegard', 'save', 'guardar', 'partida perdida', 'perdu ma partie', 'disparu', 'efface', 'charg', 'import', 'export', 'reset', 'recommenc', 'progression', 'perdu tout'] },
    { id: 'transferts', label: 'Transferts et négociations', words: ['transfert', 'transfer', 'traspaso', 'negoc', 'offre', 'offer', 'oferta', 'contrat', 'contract', 'pret', 'loan', 'mercato', 'prolong', 'indemnite', 'clause', 'refuse'] },
    { id: 'joueurs', label: 'Joueurs et clients', words: ['joueur', 'player', 'jugador', 'client', 'blessure', 'injur', 'lesion', 'retraite', 'potentiel', 'note', 'moral', 'confiance', 'promesse', 'scout'] },
    { id: 'president', label: 'Mode président et club', words: ['president', 'proprietaire', 'owner', 'club', 'stade', 'stadium', 'entraineur', 'coach', 'formation', 'academie', 'academy', 'supporters', 'conseil'] },
    { id: 'matchs', label: 'Matchs et compétitions', words: ['match', 'partido', 'classement', 'standing', 'championnat', 'league', 'liga', 'coupe', 'cup', 'copa', 'ligue des champions', 'selection', 'score', 'but ', 'goal'] },
    { id: 'interface', label: 'Affichage et interface', words: ['bouton', 'button', 'boton', 'ecran', 'screen', 'pantalla', 'affich', 'display', 'page', 'menu', 'texte', 'text', 'coupe ', 'deborde', 'mobile', 'telephone', 'zoom', 'scroll', 'defil', 'traduction', 'translat', 'traduc', 'langue', 'anglais', 'espagnol', 'illisible', 'couleur', 'portrait', 'photo'] },
    { id: 'plantage', label: 'Lenteur, blocages et plantages', words: ['lent', 'slow', 'lento', 'bloqu', 'stuck', 'freeze', 'fige', 'plant', 'crash', 'bug', 'beug', 'erreur', 'error', 'marche pas', 'fonctionne pas', 'charge pas', 'page blanche', 'blanc', 'rien ne se passe', 'impossible de'] },
    { id: 'equilibre', label: 'Équilibre et difficulté', words: ['trop facile', 'trop dur', 'too easy', 'too hard', 'difficile', 'facile', 'equilibr', 'injuste', 'unfair', 'abus', 'triche', 'cheat', 'pas normal', 'irrealiste', 'realiste'] },
    { id: 'idees', label: 'Idées et suggestions', words: ['serait bien', 'faudrait', 'ajouter', 'add ', 'anadir', 'idee', 'idea', 'propos', 'j\'aimerais', 'jaimerais', 'pourquoi pas', 'possibilite', 'option', 'would be nice', 'suggest'] },
  ];
  var STOP = ' a au aux avec ce ces cette dans de des du elle en est et il ils je la le les leur lui ma mais me mes mon ne nous on ou par pas pour qu que qui sa se ses son sur ta te tes toi ton tu un une vos votre vous y the and is it to of in my on i was a el la los las de que y en un una es mi no ca ya tout tres plus fait faire avoir etre jai cest quand comme alors donc encore toujours rien bien '.split(' ').reduce(function (o, w) { if (w) o[w] = 1; return o; }, {});
  function norm(s) { return String(s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[’']/g, '\'').replace(/\s+/g, ' ').trim(); }
  function themeOf(text) {
    var t = ' ' + norm(text) + ' ', best = null, bestScore = 0;
    for (var i = 0; i < THEMES.length; i++) {
      var sc = 0;
      for (var j = 0; j < THEMES[i].words.length; j++) if (t.indexOf(THEMES[i].words[j]) >= 0) sc++;
      if (sc > bestScore) { bestScore = sc; best = THEMES[i]; }
    }
    return best || { id: 'autre', label: 'Autre' };
  }
  function wordsOf(text) {
    var out = {}, list = norm(text).replace(/[^a-z0-9 ]/g, ' ').split(' ');
    for (var i = 0; i < list.length; i++) { var w = list[i]; if (w.length > 2 && !STOP[w]) out[w.length > 6 ? w.slice(0, 6) : w] = 1; }
    return out;
  }
  function similarity(a, b) {
    var inter = 0, union = 0, k;
    for (k in a) { union++; if (b[k]) inter++; }
    for (k in b) if (!a[k]) union++;
    return union ? inter / union : 0;
  }
  // reports : [{ text, timestamp, ref, v, dev, country, uid }]
  function summarize(reports, opts) {
    opts = opts || {};
    var threshold = opts.threshold || 0.34, themes = {}, i;
    for (i = 0; i < (reports || []).length; i++) {
      var r = reports[i], text = String(r.text || '').trim();
      if (!text) continue;
      var th = themeOf(text), w = wordsOf(text);
      var T = themes[th.id] = themes[th.id] || { id: th.id, label: th.label, count: 0, players: {}, versions: {}, saves: 0, last: '', problems: [] };
      T.count++; if (r.uid) T.players[r.uid] = 1; if (r.v) T.versions[r.v] = (T.versions[r.v] || 0) + 1;
      if (/\+save$/.test(String(r.ref || ''))) T.saves++;
      if (String(r.timestamp || '') > T.last) T.last = String(r.timestamp || '');
      // même problème qu'un groupe existant ?
      var group = null, bestSim = threshold;
      for (var g = 0; g < T.problems.length; g++) { var s = similarity(w, T.problems[g].words); if (s >= bestSim) { bestSim = s; group = T.problems[g]; } }
      if (!group) { group = { words: w, examples: [], count: 0, players: {}, refs: [], last: '' }; T.problems.push(group); }
      group.count++; if (r.uid) group.players[r.uid] = 1;
      if (group.examples.length < 3) group.examples.push(text);
      group.refs.push(String(r.ref || '').slice(0, 6));
      if (String(r.timestamp || '') > group.last) group.last = String(r.timestamp || '');
      for (var k in w) group.words[k] = 1;
    }
    var list = Object.keys(themes).map(function (id) {
      var T = themes[id];
      T.playerCount = Object.keys(T.players).length;
      T.problems = T.problems.map(function (p) { return { count: p.count, players: Object.keys(p.players).length, examples: p.examples, refs: p.refs, last: p.last }; })
        .sort(function (a, b) { return b.count - a.count || (b.last > a.last ? 1 : -1); });
      T.repeated = T.problems.filter(function (p) { return p.count > 1; }).length;
      delete T.players;
      return T;
    });
    list.sort(function (a, b) { return b.count - a.count || b.playerCount - a.playerCount || (b.last > a.last ? 1 : -1); });
    return { total: (reports || []).length, themes: list };
  }
  // texte prêt à coller dans une conversation avec Claude
  function toText(reports, days) {
    var lines = ['Signalements Football Agent (' + (reports || []).length + ' sur ' + days + ' jours) :'];
    for (var i = 0; i < (reports || []).length; i++) {
      var r = reports[i];
      lines.push('- ' + String(r.timestamp || '').slice(0, 16) + ' · réf. ' + String(r.ref || '').slice(0, 6) + (/\+save$/.test(String(r.ref || '')) ? ' (partie jointe)' : '') + ' · v' + (r.v || '?') + ' · ' + (r.dev || '?') + ' · ' + (r.country || '?') + ' : ' + String(r.text || '').replace(/\s+/g, ' ').trim());
    }
    lines.push('', 'Classe ces problèmes du plus fréquent au moins fréquent, regroupe ceux qui décrivent la même chose et propose des corrections.');
    return lines.join('\n');
  }
  var api = { THEMES: THEMES, themeOf: themeOf, summarize: summarize, toText: toText, similarity: similarity, wordsOf: wordsOf };
  root.FAReports = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof self !== 'undefined' ? self : this);
