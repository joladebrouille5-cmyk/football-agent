// Portraits réalistes de footballeurs fictifs — prototype (hors jeu).
// Base anatomique : maillage et cibles morphologiques MakeHuman (CC0). Tout le reste (peau, yeux, sourcils,
// barbe, cheveux, maillot, éclairage) est procédural. Identité 100 % déterministe : id joueur -> graine -> apparence.
import * as THREE from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';

// ---------- hasard déterministe ----------
export function rng(seedStr) {
  let h1 = 1779033703 ^ seedStr.length, h2 = 3144134277, h3 = 1013904242, h4 = 2773480762;
  for (let i = 0; i < seedStr.length; i++) { const k = seedStr.charCodeAt(i); h1 = h2 ^ Math.imul(h1 ^ k, 597399067); h2 = h3 ^ Math.imul(h2 ^ k, 2869860233); h3 = h4 ^ Math.imul(h3 ^ k, 951274213); h4 = h1 ^ Math.imul(h4 ^ k, 2716044179); }
  let a = (h1 ^ h2 ^ h3 ^ h4) >>> 0;
  return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; };
}
const clamp = (x, a, b) => Math.max(a, Math.min(b, x));
const lerp = (a, b, t) => a + (b - a) * t;
const gauss = r => { let s = 0; for (let i = 0; i < 4; i++) s += r(); return (s - 2) / 0.577; }; // ~N(0,1)
const pickW = (r, items) => { const tot = items.reduce((s, x) => s + x[1], 0); let u = r() * tot; for (const [v, w] of items) { if ((u -= w) <= 0) return v; } return items[items.length - 1][0]; };

// ---------- données MakeHuman ----------
let DATA = null;
let LOADING = null;
const ASSET_BASE = new URL('./', import.meta.url).href;
async function fetchBin(url) {
  const res = await fetch(url); if (!res.ok) throw new Error('portraits: ' + url + ' ' + res.status);
  if (url.endsWith('.gz')) return new Response(res.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  return res.arrayBuffer();
}
export function loadAssets(base = ASSET_BASE) { return LOADING || (LOADING = loadAssetsNow(base)); }
async function loadAssetsNow(base) {
  if (DATA) return DATA;
  const [info, buf] = await Promise.all([fetch(base + 'heads.json').then(r => r.json()), fetchBin(base + 'heads.bin.gz')]);
  const arr = key => { const [off, len, fmt] = info.idx[key]; const T = { f: Float32Array, H: Uint16Array, I: Uint32Array, h: Int16Array }[fmt]; return new T(buf, off, len); };
  const T = {};
  for (const key of Object.keys(info.idx)) { const m = key.match(/^t:(.+):i$/); if (m) T[m[1]] = { i: arr(key), d: arr('t:' + m[1] + ':d') }; }
  const D = { info, n: info.n, base: arr('pos'), tri: arr('tri'), eyeV: arr('eyeV'), eyeF: arr('eyeF'), T, Q: info.Q };
  // masques anatomiques statiques : zone d'influence des cibles (lèvres, nez, oreilles, pommettes…)
  const support = names => { const m = new Float32Array(D.n); for (const nm of names) { const t = T[nm]; if (!t) continue; for (let k = 0; k < t.i.length; k++) { const d = Math.hypot(t.d[k * 3], t.d[k * 3 + 1], t.d[k * 3 + 2]); m[t.i[k]] += d; } } let mx = 0; for (const v of m) mx = Math.max(mx, v); for (let i = 0; i < m.length; i++) m[i] = Math.min(1, m[i] / (mx * 0.55)); return m; };
  D.mask = {
    lip: support(['mouth/mouth-upperlip-volume-incr', 'mouth/mouth-lowerlip-volume-incr']),
    nose: support(['nose/nose-volume-incr', 'nose/nose-scale-horiz-incr']),
    ear: support(['ears/r-ear-scale-incr', 'ears/l-ear-scale-incr']),
    cheek: support(['cheek/r-cheek-volume-incr', 'cheek/l-cheek-volume-incr']),
    eyebag: support(['eyes/r-eye-bag-incr', 'eyes/l-eye-bag-incr']),
    laugh: support(['mouth/mouth-laugh-lines-out']),
    forehead: support(['forehead/forehead-scale-vert-incr']),
    brow: support(['eyebrows/eyebrows-trans-up']),
  };
  // voisinage pour la courbure (cavités : orbites, narines, commissures, plis de l'oreille)
  const nb = Array.from({ length: D.n }, () => new Set());
  for (let k = 0; k < D.tri.length; k += 3) { const a = D.tri[k], b = D.tri[k + 1], c = D.tri[k + 2]; nb[a].add(b).add(c); nb[b].add(a).add(c); nb[c].add(a).add(b); }
  D.nb = nb.map(s => Uint16Array.from(s));
  const smooth = (m, it) => { let a = m; for (let k = 0; k < it; k++) { const b = new Float32Array(a.length); for (let i = 0; i < a.length; i++) { const n = D.nb[i]; let s = a[i]; for (const j of n) s += a[j]; b[i] = s / (n.length + 1); } a = b; } return a; };
  for (const k of Object.keys(D.mask)) D.mask[k] = smooth(D.mask[k], 6);
  DATA = D; return D;
}

// ---------- génome d'un joueur ----------
// 8 traits « de structure » à plusieurs types : leurs combinaisons forment les archétypes (48), chacun ensuite
// varié en continu pour chaque joueur. La nationalité n'oriente que légèrement les probabilités d'ascendance.
const FACE_TYPES = ['oval', 'round', 'rectangular', 'square', 'triangular', 'invertedtriangular', 'diamond'];
const NAT_PRIOR = { // [africaine, asiatique, européenne] — volontairement large : tout reste possible partout
  FR: [.25, .07, .68], EN: [.18, .08, .74], ES: [.08, .04, .88], IT: [.06, .03, .91], DE: [.08, .06, .86], PT: [.15, .03, .82],
  BR: [.35, .04, .61], AR: [.05, .05, .9], SN: [.92, .01, .07], NG: [.94, .01, .05], CI: [.92, .01, .07], CM: [.92, .01, .07], MA: [.25, .05, .7], DZ: [.22, .05, .73],
  JP: [.02, .93, .05], KR: [.02, .94, .04], NL: [.18, .06, .76], BE: [.2, .05, .75], US: [.3, .1, .6], CO: [.3, .08, .62], MX: [.12, .12, .76], UY: [.08, .03, .89],
};
const ARCHETYPES = (() => { const r = rng('archetypes-v1'), out = []; for (let i = 0; i < 48; i++) out.push({
  face: FACE_TYPES[i % FACE_TYPES.length], jaw: [-0.6, -0.2, 0.25, 0.65][Math.floor(r() * 4)], chin: [-0.5, 0, 0.5][Math.floor(r() * 3)],
  cheekBones: [-0.4, 0.1, 0.6][Math.floor(r() * 3)], nose: ['fin', 'droit', 'large', 'aquilin', 'court', 'long'][Math.floor(r() * 6)],
  eyes: ['amande', 'ronds', 'enfoncés', 'écartés', 'rapprochés'][Math.floor(r() * 5)], lips: [-0.5, 0, 0.5, 0.9][Math.floor(r() * 4)],
  forehead: [-0.5, 0, 0.5][Math.floor(r() * 3)], brows: ['épais', 'fins', 'droits', 'arqués'][Math.floor(r() * 4)] }); return out; })();
export const ARCHETYPE_COUNT = ARCHETYPES.length;

export function genome(p) {
  const r = rng('face:' + p.id);
  const arch = ARCHETYPES[Math.floor(r() * ARCHETYPES.length)];
  const prior = NAT_PRIOR[p.nat] || [.3, .1, .6];
  // ascendance : tirage d'une composante principale selon le prior, puis métissage continu
  const main = pickW(r, prior.map((w, i) => [i, w + 0.04]));
  const anc = [0, 0, 0]; anc[main] = 0.55 + r() * 0.45; const rest = 1 - anc[main]; const o1 = (main + 1 + Math.floor(r() * 2)) % 3; anc[o1] = rest * r(); anc[3 - main - o1] = rest - anc[o1];
  // carnation : surtout liée à l'ascendance mais avec de la variation individuelle
  const mel = clamp(anc[0] * 0.78 + anc[1] * 0.3 + anc[2] * 0.08 + gauss(r) * 0.09, 0, 1);
  const undertone = gauss(r) * 0.5; // <0 rosé, >0 olive/doré
  const hairTex = clamp(anc[0] * 0.95 + gauss(r) * 0.18, 0, 1) > 0.55 ? (r() < 0.75 ? 'coily' : 'curly') : pickW(r, [['straight', 0.5 + anc[1]], ['wavy', 0.35], ['curly', 0.15]]);
  const hairDark = mel > 0.35 || anc[1] > 0.5 ? 1 : r();
  const hairColor = hairDark > 0.62 ? pickW(r, [['#120c09', 4], ['#1d140e', 3], ['#2b1d14', 2]]) : pickW(r, [['#3a271a', 3], ['#5a3d25', 3], ['#7a5634', 2], ['#a77f4c', 1.2], ['#c9a46c', 0.7], ['#8a4a24', 0.5]]);
  const eyeColor = mel > 0.4 ? pickW(r, [['#2a1a10', 5], ['#3b2416', 3]]) : pickW(r, [['#3b2416', 4], ['#5a3a1c', 2], ['#4f6b4a', 1.2], ['#5d7d9a', 1.4], ['#7b8c95', 0.6]]);
  const st = id => r();
  // coiffure : variée, cohérente avec la texture de cheveux et l'âge
  const youngish = p.age <= 24;
  const styles = hairTex === 'coily'
    ? [['buzz', 3], ['fade', 4], ['afro', 1.6], ['waves', 2.2], ['shaved', 1.2], ['curlytop', 2]]
    : hairTex === 'curly' ? [['curlytop', 3], ['fade', 2], ['short', 2], ['medium', 1.5], ['buzz', 1], ['shaved', 0.6]]
    : [['short', 4], ['fade', 3], ['textured', 2.5], ['buzz', 1.5], ['medium', youngish ? 1.2 : 0.8], ['slick', 1.4], ['shaved', 0.7]];
  const hairStyle = pickW(r, styles);
  // barbe : jamais systématique, rare chez les plus jeunes
  const beardP = p.age < 19 ? 0.08 : p.age < 23 ? 0.35 : 0.55;
  const beard = r() < beardP ? pickW(r, [['stubble', 4], ['short', 3], ['goatee', 1.2], ['moustache', 0.7], ['chinstrap', 0.6], ['full', p.age >= 24 ? 1.6 : 0.3]]) : (p.age >= 19 && r() < 0.3 ? 'shadow' : 'none');
  const g = {
    id: p.id, age: p.age, arch, anc, mel, undertone, hairTex, hairStyle, hairColor, eyeColor, beard,
    hairline: gauss(r) * 0.12, recede: clamp((p.age - 27) / 14 + gauss(r) * 0.35, 0, 1) * (r() < 0.55 ? 1 : 0.25),
    browThick: arch.brows === 'épais' ? 0.75 + r() * 0.25 : arch.brows === 'fins' ? 0.3 + r() * 0.2 : 0.45 + r() * 0.3,
    browArch: arch.brows === 'arqués' ? 0.55 + r() * 0.35 : arch.brows === 'droits' ? r() * 0.2 : 0.2 + r() * 0.35,
    browGap: gauss(r) * 0.06, freckles: mel < 0.25 && r() < 0.18 ? r() : 0, moles: r(),
    yaw: (r() - 0.5) * 0.32, tilt: (r() - 0.5) * 0.05, jersey: pickW(r, [['#3a3f46', 3], ['#26344a', 2], ['#e4e4e1', 2], ['#7b8088', 2], ['#4a5040', 0.7], ['#1d1f22', 1.2]]),
    shellSeed: r() * 100, grey: clamp((p.age - 31) / 12, 0, 1) * r(),
    m: {}, // valeurs de modificateurs morphologiques
  };
  const m = g.m, J = s => gauss(r) * s * 1.35;
  m.shape = arch.face; m.shapeW = 0.3 + r() * 0.35; m.shape2 = FACE_TYPES[Math.floor(r() * FACE_TYPES.length)]; m.shape2W = r() * 0.25;
  const set = (k, v) => { m[k] = clamp(v, -1, 1); };
  set('head-scale-vert', J(0.25)); set('head-scale-horiz', J(0.22)); set('head-scale-depth', J(0.2)); set('head-fat', J(0.2) - 0.1); set('head-back-scale-depth', J(0.25));
  set('chin-width', arch.jaw * 0.45 + J(0.2)); set('chin-bones', arch.jaw * 0.7 + J(0.2)); set('chin-prominent', arch.chin + J(0.25)); set('chin-height', J(0.3)); set('chin-prognathism', J(0.2)); set('chin-cleft', r() < 0.15 ? r() * 0.7 : 0);
  set('cheek-bones', arch.cheekBones + J(0.25)); set('cheek-volume', J(0.3) - 0.15); set('cheek-inner', J(0.3)); set('cheek-trans', J(0.3));
  set('forehead-scale-vert', arch.forehead + J(0.25)); set('forehead-trans', J(0.3)); set('forehead-nubian', J(0.3)); set('forehead-temple', J(0.3));
  const N = { fin: [-0.5, -0.1, 0, 0], droit: [0, 0, 0.1, 0], large: [0.6, 0, -0.1, 0.3], aquilin: [0, 0.3, 0.6, 0], court: [0, -0.5, 0, 0.2], long: [-0.1, 0.5, 0.2, -0.1] }[arch.nose];
  set('nose-scale-horiz', N[0] + J(0.2)); set('nose-scale-vert', N[1] + J(0.2)); set('nose-hump', N[2] + J(0.2)); set('nose-nostrils-width', N[3] + J(0.25)); set('nose-point-width', J(0.3)); set('nose-scale-depth', J(0.25)); set('nose-curve', J(0.25)); set('nose-greek', J(0.25)); set('nose-volume', J(0.2)); set('nose-flaring', N[3] * 0.5 + J(0.25)); set('nose-septumangle', J(0.25)); set('nose-point', J(0.3)); set('nose-base', J(0.25)); set('nose-trans-up', J(0.2));
  const E = { amande: [0, 0, 0.2], ronds: [0.2, 0, -0.2], 'enfoncés': [-0.1, 0, 0], 'écartés': [0, 0.45, 0], 'rapprochés': [0, -0.45, 0] }[arch.eyes];
  set('eye-scale', E[0] * 0.6 + J(0.18) - 0.15); set('eye-trans-in', E[1] + J(0.2)); set('eye-trans-up', J(0.2)); set('eye-height2', E[2] + J(0.25)); set('eye-height1', 0.55 + J(0.12)); set('eye-height3', 0.35 + J(0.12)); set('eye-bag', J(0.25)); set('eye-push1', arch.eyes === 'enfoncés' ? -0.6 : J(0.25)); set('eye-eyefold', J(0.3)); set('eye-epicanthus', anc[1] * 0.6 + J(0.15)); set('eye-corner1', J(0.25)); set('eye-corner2', J(0.25));
  set('mouth-scale-horiz', J(0.25)); set('mouth-scale-vert', J(0.2)); set('mouth-upperlip-volume', arch.lips * 0.35 + anc[0] * 0.3 - 0.15 + J(0.12)); set('mouth-lowerlip-volume', arch.lips * 0.35 + anc[0] * 0.3 - 0.1 + J(0.12)); set('mouth-trans-back', 0.25 + J(0.1)); set('mouth-cupidsbow', J(0.3)); set('mouth-trans-up', J(0.2)); set('mouth-angles', -0.15 + J(0.1)); set('mouth-philtrum-volume', J(0.3)); set('mouth-dimples', r() < 0.2 ? r() * 0.6 : 0);
  set('ear-scale', J(0.25)); set('ear-lobe', J(0.35)); set('ear-wing', J(0.35)); set('ear-shape', J(0.35)); set('ear-rot', J(0.3)); set('ear-flap', J(0.3));
  set('neck-scale-horiz', 0.1 + J(0.15)); set('neck-scale-depth', 0.1 + J(0.15));
  g.muscle = clamp(0.62 + gauss(r) * 0.12, 0.45, 0.9); g.weight = clamp(0.42 + gauss(r) * 0.1, 0.25, 0.7);
  g.asym = { l: gauss(r) * 0.07, r: gauss(r) * 0.07, ey: gauss(r) * 0.05 };
  return g;
}

// ---------- morphologie ----------
function ageWeights(age) { // âge MakeHuman : enfant ≈ 11 ans, jeune adulte ≈ 25 ans, âgé ≈ 90 ans
  if (age < 25) { const c = clamp((25 - age) / 14, 0, 1) * 0.6; return { child: c, young: 1 - c, old: 0 }; }
  const o = clamp((age - 25) / 65, 0, 1) * 1.15; return { child: 0, young: 1 - o, old: o };
}
function modWeights(g) {
  const W = new Map(), add = (k, v) => { if (v) W.set(k, (W.get(k) || 0) + v); };
  const aw = ageWeights(g.age), races = ['african', 'asian', 'caucasian'];
  for (let i = 0; i < 3; i++) for (const a of ['child', 'young', 'old']) add(`macrodetails/${races[i]}-male-${a}`, g.anc[i] * aw[a]);
  // musculature / poids (interpolation bilinéaire comme MakeHuman)
  const tri = v => v < 0.5 ? [['min', 1 - v * 2], ['average', v * 2]] : [['average', 1 - (v - 0.5) * 2], ['max', (v - 0.5) * 2]];
  for (const a of ['young', 'old']) { const aw2 = a === 'young' ? aw.young + aw.child : aw.old; for (const [mu, wm] of tri(g.muscle)) for (const [we, ww] of tri(g.weight)) add(`macrodetails/universal-male-${a}-${mu}muscle-${we}weight`, aw2 * wm * ww); }
  const m = g.m, pm = (name, v, lo, hi) => { if (v > 0) add(name + '-' + hi, v); else if (v < 0) add(name + '-' + lo, -v); };
  add('head/head-' + m.shape, m.shapeW); if (m.shape2 !== m.shape) add('head/head-' + m.shape2, m.shape2W);
  for (const k of ['head-scale-vert', 'head-scale-horiz', 'head-scale-depth', 'head-fat', 'head-back-scale-depth']) pm('head/' + k, m[k], 'decr', 'incr');
  for (const k of ['chin-width', 'chin-bones', 'chin-prominent', 'chin-height', 'chin-prognathism']) pm('chin/' + k, m[k], 'decr', 'incr'); add('chin/chin-cleft-incr', m['chin-cleft']);
  for (const s of ['l', 'r']) { const a = s === 'l' ? g.asym.l : g.asym.r;
    pm(`cheek/${s}-cheek-bones`, m['cheek-bones'] + a, 'decr', 'incr'); pm(`cheek/${s}-cheek-volume`, m['cheek-volume'] + a * 0.5, 'decr', 'incr'); pm(`cheek/${s}-cheek-inner`, m['cheek-inner'], 'decr', 'incr'); pm(`cheek/${s}-cheek-trans`, m['cheek-trans'], 'down', 'up');
    pm(`eyes/${s}-eye-scale`, m['eye-scale'] + a * 0.5, 'decr', 'incr'); pm(`eyes/${s}-eye-trans`, m['eye-trans-in'] * -1, 'in', 'out'); add(`eyes/${s}-eye-trans-${m['eye-trans-up'] + g.asym.ey * (s === 'l' ? 1 : -1) > 0 ? 'up' : 'down'}`, Math.abs(m['eye-trans-up'] + g.asym.ey * (s === 'l' ? 1 : -1)));
    pm(`eyes/${s}-eye-height2`, m['eye-height2'], 'decr', 'incr'); pm(`eyes/${s}-eye-height1`, m['eye-height1'], 'decr', 'incr'); pm(`eyes/${s}-eye-height3`, m['eye-height3'], 'decr', 'incr'); pm(`eyes/${s}-eye-bag`, m['eye-bag'], 'decr', 'incr'); pm(`eyes/${s}-eye-push1`, m['eye-push1'], 'in', 'out'); pm(`eyes/${s}-eye-eyefold`, m['eye-eyefold'], 'down', 'up'); pm(`eyes/${s}-eye-epicanthus`, m['eye-epicanthus'], 'in', 'out'); pm(`eyes/${s}-eye-corner1`, m['eye-corner1'], 'down', 'up'); pm(`eyes/${s}-eye-corner2`, m['eye-corner2'], 'down', 'up');
    pm(`ears/${s}-ear-scale`, m['ear-scale'] + a, 'decr', 'incr'); pm(`ears/${s}-ear-lobe`, m['ear-lobe'], 'decr', 'incr'); pm(`ears/${s}-ear-wing`, m['ear-wing'] + a, 'decr', 'incr'); pm(`ears/${s}-ear-shape`, m['ear-shape'], 'square', 'round'); pm(`ears/${s}-ear-rot`, m['ear-rot'], 'backward', 'forward'); pm(`ears/${s}-ear-flap`, m['ear-flap'], 'decr', 'incr');
  }
  for (const k of ['forehead-scale-vert', 'forehead-nubian', 'forehead-temple']) pm('forehead/' + k, m[k], 'decr', 'incr'); pm('forehead/forehead-trans', m['forehead-trans'], 'backward', 'forward');
  for (const k of ['nose-scale-horiz', 'nose-scale-vert', 'nose-scale-depth', 'nose-nostrils-width', 'nose-point-width', 'nose-hump', 'nose-greek', 'nose-volume', 'nose-flaring', 'nose-septumangle']) pm('nose/' + k, m[k], 'decr', 'incr');
  pm('nose/nose-curve', m['nose-curve'], 'concave', 'convex'); pm('nose/nose-point', m['nose-point'], 'down', 'up'); pm('nose/nose-base', m['nose-base'], 'down', 'up'); pm('nose/nose-trans', m['nose-trans-up'], 'down', 'up');
  for (const k of ['mouth-scale-horiz', 'mouth-scale-vert', 'mouth-upperlip-volume', 'mouth-lowerlip-volume', 'mouth-cupidsbow', 'mouth-philtrum-volume']) pm('mouth/' + k, m[k], 'decr', 'incr');
  pm('mouth/mouth-trans', m['mouth-trans-up'], 'down', 'up'); add('mouth/mouth-trans-backward', m['mouth-trans-back']); pm('mouth/mouth-angles', m['mouth-angles'], 'down', 'up'); add('mouth/mouth-dimples-out', m['mouth-dimples']);
  // âge : sillons naso-géniens et cernes discrets à partir de 30 ans
  const ageLines = clamp((g.age - 29) / 10, 0, 1); add('mouth/mouth-laugh-lines-out', ageLines * 0.45); add('eyes/l-eye-bag-incr', ageLines * 0.25); add('eyes/r-eye-bag-incr', ageLines * 0.25);
  pm('neck/neck-scale-horiz', m['neck-scale-horiz'], 'decr', 'incr'); pm('neck/neck-scale-depth', m['neck-scale-depth'], 'decr', 'incr');
  return W;
}
function morph(D, W) {
  const P = new Float32Array(D.base), s0 = 1 / D.Q;
  for (const [name, w] of W) { const t = D.T[name]; if (!t || !w) continue; const s = w * s0, I = t.i, d = t.d; for (let k = 0; k < I.length; k++) { const v = I[k] * 3; P[v] += d[k * 3] * s; P[v + 1] += d[k * 3 + 1] * s; P[v + 2] += d[k * 3 + 2] * s; } }
  return P;
}
const centroid = (P, ids) => { const c = new THREE.Vector3(); for (const i of ids) c.add(new THREE.Vector3(P[i * 3], P[i * 3 + 1], P[i * 3 + 2])); return c.multiplyScalar(1 / ids.length); };

// ---------- shaders ----------
const NOISE = /* glsl */`
float h31(vec3 p){ p=fract(p*vec3(.1031,.1030,.0973)); p+=dot(p,p.yxz+33.33); return fract((p.x+p.y)*p.z); }
float vnoise(vec3 p){ vec3 i=floor(p), f=fract(p); f=f*f*(3.-2.*f);
  return mix(mix(mix(h31(i),h31(i+vec3(1,0,0)),f.x),mix(h31(i+vec3(0,1,0)),h31(i+vec3(1,1,0)),f.x),f.y),
             mix(mix(h31(i+vec3(0,0,1)),h31(i+vec3(1,0,1)),f.x),mix(h31(i+vec3(0,1,1)),h31(i+vec3(1,1,1)),f.x),f.y),f.z); }
float fbm(vec3 p){ float s=0., a=.5; for(int i=0;i<4;i++){ s+=a*vnoise(p); p*=2.03; a*=.5; } return s; }
float cell(vec3 p, out vec3 id){ vec3 i=floor(p), f=fract(p); float d=9.; for(int x=-1;x<=1;x++)for(int y=-1;y<=1;y++)for(int z=-1;z<=1;z++){ vec3 o=vec3(x,y,z); vec3 r=o+vec3(h31(i+o),h31(i+o+11.1),h31(i+o+27.3))-f; float dd=dot(r,r); if(dd<d){d=dd; id=i+o;} } return sqrt(d); }
`;
// masques de pilosité dans l'espace « visage » (q : origine entre les yeux, unité = écart inter-pupillaire)
const HAIRMASKS = /* glsl */`
uniform float uEarZ, uHairline, uRecede, uSideburn, uNeckLine, uEarTop, uBrowY, uNoseY, uMouthY, uChinY, uLipTop, uLipBot, uBeardType, uBeardDens, uMouthW;
float scalpMask(vec3 q, vec3 n){
  float ax=abs(q.x);
  float line = uHairline + uRecede*0.55*smoothstep(0.25,0.9,ax) + uRecede*0.25 - 0.05*smoothstep(0.6,0.0,ax)*(1.-uRecede);
  float front = smoothstep(line-0.06, line+0.1, q.y);
  float side = smoothstep(0.85, 1.0, ax) * smoothstep(uEarTop-0.05, uEarTop+0.1, q.y) * smoothstep(-0.05, -0.3, q.z);
  float sideburn = smoothstep(0.95,1.05,ax)*smoothstep(uEarTop-uSideburn-0.05,uEarTop-uSideburn+0.05,q.y)*smoothstep(uEarTop+0.1,uEarTop-0.1,q.y)*smoothstep(-0.1,-0.3,q.z)*smoothstep(uEarZ-0.1,uEarZ+0.15,q.z);
  float back = smoothstep(uEarZ+0.05, uEarZ-0.3, q.z) * smoothstep(uNeckLine-0.05, uNeckLine+0.12, q.y);
  return clamp(max(max(front, side), max(back, sideburn*0.)), 0., 1.);
}
float beardMask(vec3 q, vec3 n){
  if (uBeardType < 0.5) return 0.;
  float ax=abs(q.x);
  float lowerFace = smoothstep(uNoseY+0.02, uNoseY-0.2, q.y);
  float cheekLine = mix(uNoseY-0.22, uEarTop-0.6, smoothstep(0.3,1.0,ax));
  float cheeks = smoothstep(cheekLine+0.1, cheekLine-0.16, q.y);
  float jaw = smoothstep(uChinY-0.55, uChinY-0.25, q.y) * smoothstep(-0.2, 0.15, q.z+0.25*ax);
  float sideOk = smoothstep(1.12, 0.88, ax);
  float lips = smoothstep(uMouthW, uMouthW-0.12, ax) * smoothstep(uLipBot-0.04, uLipBot+0.02, q.y) * smoothstep(uLipTop+0.04, uLipTop-0.02, q.y);
  float mous = smoothstep(uMouthW+0.06, uMouthW-0.08, ax) * smoothstep(uLipTop-0.01, uLipTop+0.04, q.y) * smoothstep(uNoseY-0.03, uNoseY-0.1, q.y);
  float full = max(lowerFace*cheeks*jaw*sideOk*(1.-lips), mous);
  float goat = smoothstep(0.42, 0.3, ax) * smoothstep(uLipBot-0.02, uLipBot-0.1, q.y) * jaw;
  float strap = full * (smoothstep(uChinY+0.3, uChinY+0.1, q.y) + smoothstep(0.7,0.95,ax));
  if (uBeardType < 1.5) return full;            // barbe pleine / courte / ombre
  if (uBeardType < 2.5) return max(goat, mous); // bouc
  if (uBeardType < 3.5) return mous;            // moustache
  return clamp(strap,0.,1.);                    // collier
}
`;

function skinMaterial(g, U) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.52, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0.9, 0.55, 0.45), clearcoat: 0.04, clearcoatRoughness: 0.5 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 maskA; attribute vec4 maskB; attribute float cav; uniform vec3 uMid; uniform float uIOD;
      varying vec3 vQ; varying vec3 vN0; varying vec4 vMA; varying vec4 vMB; varying float vCav; varying vec3 vAx; varying vec3 vAy; varying vec3 vAz;`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      vQ=(position-uMid)/uIOD; vN0=normal; vMA=maskA; vMB=maskB; vCav=cav; vAx=normalMatrix*vec3(1,0,0); vAy=normalMatrix*vec3(0,1,0); vAz=normalMatrix*vec3(0,0,1);`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      ${NOISE}${HAIRMASKS}
      uniform vec3 uSkin, uSkinRed, uSkinDark, uLip, uHair, uJersey, uEyeL, uEyeR; uniform float uFade, uWaves, uDbgBump, uEyeR3, uMel, uAge, uFreckles, uBrowThick, uBrowArch, uBrowGap, uScalpPaint, uStubble, uSeed, uCollarY, uGrey, uEyeRad;
      varying vec3 vQ; varying vec3 vN0; varying vec4 vMA; varying vec4 vMB; varying float vCav; varying vec3 vAx; varying vec3 vAy; varying vec3 vAz;
      float gJersey; float gHair; vec3 gBumpN;
      float browMask(vec3 q){
        float s=sign(q.x); float ax=abs(q.x)+uBrowGap; float u=(ax-0.13)/0.62;
        if(u<-0.15||u>1.15) return 0.;
        float cy = uBrowY + uBrowArch*0.07*sin(3.1416*clamp(u*0.85+0.08,0.,1.)) - 0.05*smoothstep(0.65,1.1,u);
        float th = (0.08 + 0.09*uBrowThick)*mix(1.0,0.5,smoothstep(0.35,1.1,u))*mix(1.15,1.,smoothstep(0.,0.3,u));
        float m = smoothstep(th*0.6, th*0.25, abs(q.y-cy)) * smoothstep(-0.12,0.06,u) * smoothstep(1.12,0.9,u) * smoothstep(0.0,0.3,vN0.z);
        float strands = vnoise(vec3((q.x*s*0.9 + (q.y-cy)*1.6)*70., (q.y-cy)*12., 3.));
        return m * (0.65 + 0.35*strands) * (0.8+0.2*vnoise(q*25.));
      }`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 q=vQ;
      // maillot : sous la ligne du col
      float collar = uCollarY + 0.25*smoothstep(0.3,1.2,abs(q.x)) - 0.22*smoothstep(0.1,0.7,q.z)*smoothstep(0.9,0.2,abs(q.x));
      gJersey = smoothstep(collar+0.04, collar-0.04, q.y);
      // peau : variations de teinte (rougeurs, lèvres, cernes, zones plus sombres)
      vec3 skin = uSkin;
      float blot = fbm(q*3.1+uSeed); float mot = fbm(q*11.+uSeed*1.7);
      skin *= 0.94 + 0.1*blot + 0.06*(mot-0.5); skin = mix(skin, uSkinRed, 0.12*smoothstep(0.55,0.8,fbm(q*6.+uSeed*0.3))*(1.-uMel*0.6));
      skin = mix(skin, uSkinRed, clamp(vMA.y*0.35 + vMA.w*0.25 + vMA.z*0.4 + 0.15*smoothstep(0.55,0.,abs(q.y+0.75))*smoothstep(1.1,0.5,abs(q.x)), 0., 1.) * mix(0.55,0.25,uMel));
      skin = mix(skin, uSkinDark, clamp(vMB.y*0.35, 0., 0.5));
      float lipM = smoothstep(0.5,0.85,vMA.x); skin = mix(skin, uLip, lipM*0.9); skin *= 1. - 0.12*smoothstep(0.45,0.6,vMA.x)*smoothstep(0.75,0.6,vMA.x);
      // taches de rousseur, grains de beauté discrets
      vec3 fid; float fc = cell(q*vec3(26.,26.,26.), fid);
      skin *= 1. - uFreckles*0.18*smoothstep(0.35,0.1,fc)*step(0.55,h31(fid))*smoothstep(0.,-0.8,q.y-0.4)*step(0.2,vN0.z);
      vec3 mid; float mc = cell(q*7.+uSeed, mid); skin *= 1. - 0.35*smoothstep(0.07,0.03,mc)*step(0.93,h31(mid+3.));
      // sourcils, ombre de rasage / barbe peinte, cheveux ras peints sur le crâne
      vec3 hairC = mix(uHair, vec3(0.55,0.53,0.5), uGrey*step(0.5,h31(floor(q*80.))));
      float brow = browMask(q);
      float bm = beardMask(q, vN0);
      vec3 sid; float sc = cell(q*vec3(95.,95.,95.), sid);
      float fwq = length(fwidth(q)); float stub = bm * uStubble * mix(smoothstep(0.42,0.18,sc)*(0.5+0.5*h31(sid)), 0.38, smoothstep(0.006,0.014,fwq));
      float shadowTone = bm * uStubble * 0.55;
      float scalp = scalpMask(q, vN0) * uScalpPaint * (1.-smoothstep(0.08,0.3,vMA.z));
      vec3 kid; float kc = cell(q*vec3(110.), kid);
      scalp *= mix(1.0, mix(0.35, 1.0, smoothstep(uEarTop+0.05, uHairline+0.2, q.y)), uFade);
      float wv = uWaves * 0.35 * sin(length(q.xz - vec2(0.,-0.9))*38. + atan(q.z+0.9, q.x)*2.);
      float scalpDots = scalp * (mix(0.55 + 0.45*smoothstep(0.5,0.15,kc), 0.8, smoothstep(0.006,0.012,fwq)) + wv*step(0.5,scalp));
      skin = mix(skin, skin*mix(vec3(0.62,0.62,0.66), vec3(0.8), uMel), shadowTone*0.6);
      skin = mix(skin, hairC, clamp(stub*0.9 + scalpDots*0.92, 0., 1.));
      skin = mix(skin, hairC*0.9, clamp(brow*1.05,0.,1.));
      // cils : liseré sombre sur la paupière supérieure
      for(int e=0;e<2;e++){ vec3 ec = e==0?uEyeL:uEyeR; float d3=length(q-ec)/uEyeR3; float up=smoothstep(-0.05,0.08,q.y-ec.y);
        float lash = smoothstep(1.16,1.02,d3)*up*smoothstep(abs(q.x-ec.x), 0., 0.3); skin = mix(skin, vec3(0.03,0.025,0.02), clamp(lash,0.,1.)*0.8); }
      // maillot neutre : maille fine
      vec3 knit = uJersey * (0.9 + 0.12*vnoise(q*vec3(160.,60.,160.)) );
      float rib = gJersey * smoothstep(collar-0.16, collar-0.04, q.y);
      knit = mix(knit, uJersey*0.78, rib);
      diffuseColor.rgb = mix(skin, knit, gJersey) * (1. - 0.55*vCav);
      gHair = max(brow, scalpDots);
      `)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      float tz = smoothstep(0.55,0.,abs(q.x))*smoothstep(-1.1,-0.3,q.y)*smoothstep(1.2,0.6,q.y);
      roughnessFactor = mix(mix(0.52, 0.34, tz*0.7) + 0.08*(fbm(q*14.)-0.5), 0.33, smoothstep(0.5,0.85,vMA.x));
      roughnessFactor = mix(roughnessFactor, 0.72, gHair); roughnessFactor = mix(roughnessFactor, 0.9, gJersey);`)
      .replace('#include <normal_fragment_maps>', `#include <normal_fragment_maps>
      { // micro-relief : gradient d'un bruit en espace objet, projeté sur le plan tangent
        float fw = length(fwidth(q));
        float amp = (1.-smoothstep(0.2,0.6,vMA.x))*(1.-gJersey)*mix(0.05,0.09,clamp(vMA.y+vMA.w,0.,1.)) + gJersey*0.06 + gHair*0.05;
        float fq = mix(26., 9., smoothstep(0.004,0.02,fw));
        float e = 0.02;
        vec3 p0 = q*fq;
        float h0 = vnoise(p0);
        vec3 gr = vec3(vnoise(p0+vec3(e,0,0))-h0, vnoise(p0+vec3(0,e,0))-h0, vnoise(p0+vec3(0,0,e))-h0)/e;
        if (gJersey > 0.5) { vec3 pj=q*vec3(70.,22.,70.); float j0=vnoise(pj); gr = vec3(vnoise(pj+vec3(e,0,0))-j0, vnoise(pj+vec3(0,e,0))-j0, vnoise(pj+vec3(0,0,e))-j0)/e; }
        vec3 gv = gr.x*vAx + gr.y*vAy + gr.z*vAz;
        float aw = clamp((uAge-28.)/10., 0., 1.);
        if (aw > 0.) {
          float fh = smoothstep(0.5, 0.7, q.y) * smoothstep(uHairline-0.05, uHairline-0.25, q.y) * smoothstep(0.75, 0.3, abs(q.x));
          float lines = sin(q.y*58. + 2.*vnoise(q*4.)) ;
          float cf = 0.;
          for (int e=0;e<2;e++){ vec3 ec = e==0?uEyeL:uEyeR; vec2 d = q.xy - ec.xy - vec2(sign(ec.x)*0.3, 0.); float rr = length(d); cf += smoothstep(0.22,0.05,rr) * step(0., d.x*sign(ec.x)) * sin(atan(d.y,abs(d.x))*14.); }
          gr += aw * (vec3(0., 1., 0.) * lines * fh * 1.6 + vec3(sign(q.x), 0., 0.) * cf * 1.2);
          gv = gr.x*vAx + gr.y*vAy + gr.z*vAz;
        }
        if (uDbgBump < 0.5) normal = normalize(normal - amp*(gv - dot(gv,normal)*normal));
      }`)
      .replace('#include <emissivemap_fragment>', `#include <emissivemap_fragment>
      // diffusion sous-cutanée approximée : légère lueur chaude sur les bords et les zones fines (oreilles, nez)
      float ndv = clamp(dot(normalize(vNormal), normalize(vViewPosition)),0.,1.);
      totalEmissiveRadiance += (1.-gJersey) * uSkinRed * (pow(1.-ndv, 3.)*0.06 + vMA.z*0.035) * (1.-uMel*0.5);`);
  };
  mat.customProgramCacheKey = () => 'skin-v1';
  return mat;
}

function shellMaterial(U, kind) {
  const mat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.62, metalness: 0, side: THREE.DoubleSide });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec4 maskA; varying float vEar; uniform vec3 uMid; uniform float uIOD, uLen, uDroop, uBack, uLayers, uStyle, uKind; varying vec3 vRootQ; varying float vT;
      ${HAIRMASKS}
      float lenProfile(vec3 q){
        float top = smoothstep(uNeckLine, uHairline+0.3, q.y);
        float crown = smoothstep(uEarTop, uHairline+0.5, q.y);
        if (uKind > 0.5) return mix(0.55, 1.0, smoothstep(uLipBot, uChinY-0.1, q.y)) ;   // barbe : plus fournie au menton
        if (uStyle < 1.5) return 1.;
        if (uStyle < 2.5) return mix(0.06, 1.0, smoothstep(uEarTop+0.15, uHairline+0.35, q.y));               // dégradé
        if (uStyle < 3.5) return mix(0.45, 1.0, crown) + 0.3*smoothstep(0.1,0.8,q.z)*crown;                    // texturé, plus long devant
        if (uStyle < 4.5) return mix(0.55, 1.0, smoothstep(uNeckLine, uHairline, q.y)) * mix(1.0, 0.75, smoothstep(0.3,1.0,q.z)); // afro arrondi
        if (uStyle < 5.5) return mix(0.12, 1.0, smoothstep(uEarTop+0.1, uHairline+0.4, q.y));               // boucles dessus
        if (uStyle < 6.5) return mix(0.6, 1.0, crown);                                                         // mi-long / twists
        return mix(0.5, 1.0, crown);                                                                           // plaqué
      }`)
      .replace('#include <begin_vertex>', `#include <begin_vertex>
      float t = (float(gl_InstanceID)+1.)/uLayers; vT=t; vRootQ=(position-uMid)/uIOD; vEar=maskA.z;
      float L = uLen*lenProfile(vRootQ)*uIOD;
      transformed += normal*L*t + vec3(0.,-1.,0.)*uDroop*L*t*t*1.5 + vec3(0.,0.,-1.)*uBack*L*t;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      ${NOISE}${HAIRMASKS}
      uniform vec3 uHair; uniform float uCurl, uDens, uStrand, uClump, uCore, uGrey, uSeed, uStyle, uKind, uRows; varying vec3 vRootQ; varying float vT; varying float vEar;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 q=vRootQ;
      float m = (uKind>0.5 ? beardMask(q, vec3(0,0,1)) : scalpMask(q, vec3(0,0,1))) * (1.-smoothstep(0.08,0.3,vEar));
      if (m < 0.04) discard;
      if (uRows > 0.5){ float row = abs(fract(q.x*3.4+0.5)-0.5); if (row > 0.2) discard; m *= smoothstep(0.2,0.1,row); }
      vec3 cid; float cc = cell(q*uClump + uSeed*0.1, cid); float cr = h31(cid);
      float ph = cr*6.283 + vT*uCurl*14.;
      vec3 p = q*uStrand + uCurl*0.5*vec3(sin(ph), cos(ph), sin(ph*0.7));
      vec3 sid; float sc = cell(p + uSeed, sid); float sr = h31(sid);
      float edge = smoothstep(0.04, 0.45, m);
      if (vT > uCore) {
        float tt = (vT-uCore)/max(1.-uCore, 1e-3);
        if (sc > mix(0.62, 0.1, tt) || sr > uDens*edge) discard;
        if (tt > 0.25 + 0.75*h31(sid+5.)) discard;
      } else {
        if (h31(floor(q*150.)+uSeed) > edge*1.15) discard;
      }
      vec3 hc = uHair * (0.72 + 0.4*sr) * (0.85 + 0.3*cr);
      hc = mix(hc, vec3(0.62,0.6,0.57), uGrey*step(1.-uGrey*0.85, h31(sid+9.)));
      if (uKind > 0.5) hc = max(hc*2.2, vec3(0.03,0.024,0.02)) * (0.8 + 0.4*sr);
      float ao = mix(0.32, 1.0, smoothstep(0., 1., vT)) * mix(0.8, 1.0, sr);
      diffuseColor.rgb = hc * ao;`)
      .replace('#include <roughnessmap_fragment>', `#include <roughnessmap_fragment>
      roughnessFactor = mix(0.5, 0.75, h31(sid+2.));`);
  };
  mat.customProgramCacheKey = () => 'shell2-' + kind;
  return mat;
}

function eyeMaterial(U) {
  const mat = new THREE.MeshPhysicalMaterial({ color: 0xffffff, roughness: 0.25, clearcoat: 1, clearcoatRoughness: 0.03 });
  mat.onBeforeCompile = sh => {
    Object.assign(sh.uniforms, U);
    sh.vertexShader = sh.vertexShader.replace('#include <common>', `#include <common>
      attribute vec3 eyeLocal; varying vec3 vEL;`).replace('#include <begin_vertex>', `#include <begin_vertex>
      vEL = eyeLocal;`);
    sh.fragmentShader = sh.fragmentShader.replace('#include <common>', `#include <common>
      ${NOISE} uniform vec3 uIris; uniform vec3 uGaze; varying vec3 vEL;`)
      .replace('#include <color_fragment>', `#include <color_fragment>
      vec3 d = normalize(vEL); float a = acos(clamp(dot(d, normalize(uGaze)), -1., 1.));
      float iris = smoothstep(0.62, 0.56, a), pupil = smoothstep(0.24, 0.2, a), limbal = smoothstep(0.42,0.6,a)*iris;
      float ang = atan(d.y, d.x);
      vec3 ic = uIris * 1.35 * (0.7 + 0.6*vnoise(vec3(ang*11., a*16., 1.))) * mix(1.,0.4,limbal);
      ic = mix(ic, ic*1.6+vec3(0.05,0.04,0.0), smoothstep(0.42,0.26,a)*0.4);
      vec3 sclera = vec3(0.86,0.82,0.78) * (0.92 + 0.08*vnoise(d*12.));
      sclera = mix(sclera, vec3(0.75,0.5,0.45), smoothstep(0.9,1.6,a)*0.25);
      diffuseColor.rgb = mix(mix(sclera, ic, iris), vec3(0.01), pupil);`);
  };
  mat.customProgramCacheKey = () => 'eye-v1';
  return mat;
}

// ---------- rendu ----------
let R = null;
function renderer(size) {
  if (R) { if (R.size !== size) { R.r.setSize(size, size); R.size = size; } return R; }
  const r = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true });
  r.setPixelRatio(1); r.setSize(size, size); r.outputColorSpace = THREE.SRGBColorSpace; r.toneMapping = THREE.AgXToneMapping; r.toneMappingExposure = 1.05;
  r.shadowMap.enabled = true; r.shadowMap.type = THREE.PCFShadowMap;
  const scene = new THREE.Scene();
  const pm = new THREE.PMREMGenerator(r); scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture; scene.environmentIntensity = 0.42;
  // fond de studio gris neutre, très léger dégradé
  const cv = document.createElement('canvas'); cv.width = cv.height = 256; const cx = cv.getContext('2d');
  const gr = cx.createRadialGradient(128, 95, 10, 128, 128, 190); gr.addColorStop(0, '#8b8e91'); gr.addColorStop(1, '#5a5d61'); cx.fillStyle = gr; cx.fillRect(0, 0, 256, 256);
  const bg = new THREE.CanvasTexture(cv); bg.colorSpace = THREE.SRGBColorSpace; scene.background = bg;
  const key = new THREE.DirectionalLight(0xfff4ea, 3.0); key.position.set(-6, 7, 9); key.castShadow = true; key.shadow.mapSize.set(1024, 1024); key.shadow.radius = 4; key.shadow.bias = -0.0015; key.shadow.normalBias = 0.06;
  const fill = new THREE.DirectionalLight(0xeaf0ff, 0.45); fill.position.set(8, 2, 6);
  const rim = new THREE.DirectionalLight(0xffffff, 1.1); rim.position.set(3, 6, -9);
  scene.add(key, key.target, fill, rim);
  const cam = new THREE.PerspectiveCamera(17, 1, 1, 400);
  R = { r, scene, cam, key, size };
  return R;
}

export function buildHead(D, g) {
  const W = modWeights(g); const P = morph(D, W); const I = D.info;
  const eyeLc = centroid(P, I.remap.eyeL), eyeRc = centroid(P, I.remap.eyeR);
  const mid = eyeLc.clone().add(eyeRc).multiplyScalar(0.5), iod = eyeLc.distanceTo(eyeRc);
  const toQ = i => new THREE.Vector3((P[i * 3] - mid.x) / iod, (P[i * 3 + 1] - mid.y) / iod, (P[i * 3 + 2] - mid.z) / iod);
  // repères mesurés sur le visage déformé
  const wavg = (mask, f = () => 1) => { const c = new THREE.Vector3(); let s = 0; for (let i = 0; i < D.n; i++) { const w = mask[i] * f(i); if (w > 0.3) { c.add(toQ(i).multiplyScalar(w)); s += w; } } return c.multiplyScalar(1 / Math.max(s, 1e-6)); };
  const lip = D.mask.lip; let lipTop = -9, lipBot = 9, mouthW = 0;
  for (let i = 0; i < D.n; i++) if (lip[i] > 0.45) { const q = toQ(i); if (q.z > 0) { lipTop = Math.max(lipTop, q.y); lipBot = Math.min(lipBot, q.y); mouthW = Math.max(mouthW, Math.abs(q.x)); } }
  const nose = D.mask.nose; let noseY = 9; for (let i = 0; i < D.n; i++) if (nose[i] > 0.4) { const q = toQ(i); if (q.z > 0.3) noseY = Math.min(noseY, q.y); }
  const ear = wavg(D.mask.ear, i => P[i * 3] > mid.x ? 1 : 0);
  let chinY = 9, topY = -9; for (let i = 0; i < D.n; i++) { const q = toQ(i); if (Math.abs(q.x) < 0.25 && q.z > 0.2 && q.y < lipBot) chinY = Math.min(chinY, q.y); if (Math.abs(q.x) < 0.3) topY = Math.max(topY, q.y); }
  const neckQ = toQ(I.joints['joint-neck'][0]);
  // géométrie
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(P, 3)); geo.setIndex(new THREE.BufferAttribute(D.tri, 1));
  geo.computeVertexNormals();
  const N = geo.attributes.normal.array, cav = new Float32Array(D.n);
  for (let i = 0; i < D.n; i++) { const nb = D.nb[i]; if (!nb.length) continue; let ax = 0, ay = 0, az = 0, el = 0; for (const j of nb) { ax += P[j * 3]; ay += P[j * 3 + 1]; az += P[j * 3 + 2]; el += Math.hypot(P[j * 3] - P[i * 3], P[j * 3 + 1] - P[i * 3 + 1], P[j * 3 + 2] - P[i * 3 + 2]); } const k = nb.length; const lx = ax / k - P[i * 3], ly = ay / k - P[i * 3 + 1], lz = az / k - P[i * 3 + 2]; cav[i] = clamp((lx * N[i * 3] + ly * N[i * 3 + 1] + lz * N[i * 3 + 2]) / (el / k) * 2.2, 0, 0.35); }
  { let S = new Float32Array(P); for (let it = 0; it < 10; it++) { const T2 = new Float32Array(S.length); for (let i = 0; i < D.n; i++) { const nb = D.nb[i]; let x = S[i * 3], y = S[i * 3 + 1], z = S[i * 3 + 2]; for (const j of nb) { x += S[j * 3]; y += S[j * 3 + 1]; z += S[j * 3 + 2]; } const k = nb.length + 1; T2[i * 3] = x / k; T2[i * 3 + 1] = y / k; T2[i * 3 + 2] = z / k; } S = T2; }
    for (let i = 0; i < D.n; i++) { const d = (S[i * 3] - P[i * 3]) * N[i * 3] + (S[i * 3 + 1] - P[i * 3 + 1]) * N[i * 3 + 1] + (S[i * 3 + 2] - P[i * 3 + 2]) * N[i * 3 + 2]; cav[i] = clamp(cav[i] * 0.5 + d / (iod * 0.09), 0, 0.85); }
    let c2 = new Float32Array(cav); for (let it = 0; it < 2; it++) { const b = new Float32Array(D.n); for (let i = 0; i < D.n; i++) { const n = D.nb[i]; let s2 = c2[i]; for (const j of n) s2 += c2[j]; b[i] = s2 / (n.length + 1); } c2 = b; } cav.set(c2); }
  const M = D.mask, mA = new Float32Array(D.n * 4), mB = new Float32Array(D.n * 4);
  for (let i = 0; i < D.n; i++) { mA.set([M.lip[i], M.nose[i], M.ear[i], M.cheek[i]], i * 4); mB.set([M.brow[i], M.eyebag[i], M.forehead[i], M.laugh[i]], i * 4); }
  geo.setAttribute('maskA', new THREE.BufferAttribute(mA, 4)); geo.setAttribute('maskB', new THREE.BufferAttribute(mB, 4)); geo.setAttribute('cav', new THREE.BufferAttribute(cav, 1));
  // couleurs
  const mel = g.mel;
  const skinLight = new THREE.Color().setRGB(0.93, 0.76, 0.66), skinMid = new THREE.Color().setRGB(0.72, 0.5, 0.36), skinDeep = new THREE.Color().setRGB(0.29, 0.18, 0.12), skinDeepest = new THREE.Color().setRGB(0.16, 0.1, 0.07);
  const skin = mel < 0.45 ? skinLight.clone().lerp(skinMid, mel / 0.45) : mel < 0.8 ? skinMid.clone().lerp(skinDeep, (mel - 0.45) / 0.35) : skinDeep.clone().lerp(skinDeepest, (mel - 0.8) / 0.2);
  skin.offsetHSL(g.undertone * 0.012, g.undertone * 0.04, 0); skin.convertSRGBToLinear();
  const skinRed = skin.clone().lerp(new THREE.Color(0.75, 0.22, 0.18).convertSRGBToLinear(), 0.45);
  const skinDark = skin.clone().multiplyScalar(0.55); skinDark.r *= 0.95; skinDark.b *= 1.05;
  const lipC = skin.clone().lerp(new THREE.Color(0.62, 0.36, 0.34).convertSRGBToLinear(), mel > 0.6 ? 0.18 : 0.32).multiplyScalar(mel > 0.6 ? 0.8 : 0.93);
  const hair = new THREE.Color(g.hairColor).convertSRGBToLinear();
  const eyeLq = toQ(I.remap.eyeL[0]).set((eyeLc.x - mid.x) / iod, (eyeLc.y - mid.y) / iod, (eyeLc.z - mid.z) / iod);
  const eyeRq = new THREE.Vector3((eyeRc.x - mid.x) / iod, (eyeRc.y - mid.y) / iod, (eyeRc.z - mid.z) / iod);
  let eyeRad = 0, eyeR3 = 0; for (const i of I.remap.eyeL) { eyeRad = Math.max(eyeRad, Math.hypot(P[i * 3] - eyeLc.x, P[i * 3 + 1] - eyeLc.y) / iod); eyeR3 += Math.hypot(P[i * 3] - eyeLc.x, P[i * 3 + 1] - eyeLc.y, P[i * 3 + 2] - eyeLc.z) / iod / I.remap.eyeL.length; }
  // style capillaire -> paramètres
  // coupes : [profil, longueur (écarts inter-pupillaires), part pleine, touffes, mèches, frisure, retombée, vers l'arrière, densité]
  const HS = {
    shaved: null, buzz: [1, 0.035, 0.0, 30, 160, 0, 0, 0, 0.8], waves: [1, 0.03, 0.0, 30, 170, 0, 0, 0, 0.8], cornrows: [1, 0.09, 0.55, 10, 90, 0.2, 0, 0.3, 0.95],
    short: [1, 0.13, 0.45, 12, 95, 0.3, 0.05, 0.1, 0.92], fade: [2, 0.16, 0.45, 12, 95, 0.3, 0.05, 0.1, 0.92], slick: [7, 0.12, 0.6, 10, 110, 0.1, 0.1, 0.9, 0.95], long: [7, 0.14, 0.6, 10, 110, 0.1, 0.1, 0.9, 0.95],
    textured: [3, 0.24, 0.45, 9, 80, 0.4, 0.25, 0.15, 0.92], curlytop: [5, 0.34, 0.5, 8, 45, 1.0, 0.05, 0, 0.95], afro: [4, 0.3, 0.5, 8, 48, 1.2, 0, 0, 0.97],
    medium: [6, 0.42, 0.5, 7, 70, 0.35, 0.55, 0.1, 0.93], twists: [6, 0.4, 0.15, 14, 16, 0.25, 0.45, 0, 1.0],
  };
  const hs = HS[g.hairStyle];
  const S = hs ? hs[0] : 1;
  const recede = g.recede * (['afro', 'medium', 'twists'].includes(g.hairStyle) ? 0.3 : 1);
  const beardType = { none: 0, shadow: 1, stubble: 1, short: 1, full: 1, goatee: 2, moustache: 3, chinstrap: 4 }[g.beard];
  const U = {
    uMid: { value: mid }, uIOD: { value: iod }, uSkin: { value: skin }, uSkinRed: { value: skinRed }, uSkinDark: { value: skinDark }, uLip: { value: lipC }, uHair: { value: hair },
    uJersey: { value: new THREE.Color(g.jersey).convertSRGBToLinear() }, uMel: { value: mel }, uAge: { value: g.age }, uFreckles: { value: g.freckles },
    uBrowThick: { value: g.browThick }, uBrowArch: { value: g.browArch }, uBrowGap: { value: g.browGap }, uBrowY: { value: 0.27 + eyeRad * 0.35 },
    uScalpPaint: { value: g.hairStyle === 'shaved' ? 0.25 : g.hairStyle === 'buzz' || g.hairStyle === 'waves' ? 0.85 : 0.95 },
    uStubble: { value: { none: 0, shadow: 0.35, stubble: 0.75, short: 0.95, full: 1, goatee: 0.9, moustache: 0.9, chinstrap: 0.95 }[g.beard] },
    uSeed: { value: g.shellSeed }, uCollarY: { value: neckQ.y - 0.55 }, uGrey: { value: g.grey }, uEyeL: { value: eyeLq }, uEyeR: { value: eyeRq }, uEyeRad: { value: eyeRad }, uEyeR3: { value: eyeR3 },
    uHairline: { value: 1.02 + g.hairline }, uRecede: { value: recede }, uSideburn: { value: 0.35 }, uNeckLine: { value: ear.y - 0.45 }, uEarTop: { value: ear.y + 0.3 }, uEarZ: { value: ear.z },
    uNoseY: { value: noseY }, uMouthY: { value: (lipTop + lipBot) / 2 }, uChinY: { value: chinY }, uLipTop: { value: lipTop }, uLipBot: { value: lipBot }, uMouthW: { value: mouthW + 0.05 },
    uBeardType: { value: beardType }, uFade: { value: g.hairStyle === 'fade' ? 1 : 0 }, uWaves: { value: g.hairStyle === 'waves' ? 1 : 0 }, uDbgBump: { value: 0 },
  };
  const group = new THREE.Group();
  const skinMesh = new THREE.Mesh(geo, skinMaterial(g, U)); skinMesh.castShadow = true; skinMesh.receiveShadow = true; group.add(skinMesh);
  // yeux : ajustés par le fichier mhclo (barycentriques + décalages mis à l'échelle)
  const cs = I.cloScale, sc = k => Math.abs(P[cs[k][0] * 3 + (k === 'x_scale' ? 0 : k === 'y_scale' ? 1 : 2)] - P[cs[k][1] * 3 + (k === 'x_scale' ? 0 : k === 'y_scale' ? 1 : 2)]) / cs[k][2];
  const sx = sc('x_scale'), sy = sc('y_scale'), sz = sc('z_scale');
  const EV = new Float32Array(I.clo.length * 3), EL = new Float32Array(I.clo.length * 3);
  I.clo.forEach((c, k) => { for (let a = 0; a < 3; a++) EV[k * 3 + a] = P[c[0] * 3 + a] * c[3] + P[c[1] * 3 + a] * c[4] + P[c[2] * 3 + a] * c[5] + c[6 + a] * [sx, sy, sz][a]; });
  for (let k = 0; k < I.clo.length; k++) { const c = EV[k * 3] < mid.x ? eyeRc : eyeLc; EL[k * 3] = EV[k * 3] - c.x; EL[k * 3 + 1] = EV[k * 3 + 1] - c.y; EL[k * 3 + 2] = EV[k * 3 + 2] - c.z; }
  const eg = new THREE.BufferGeometry(); eg.setAttribute('position', new THREE.BufferAttribute(EV, 3)); eg.setAttribute('eyeLocal', new THREE.BufferAttribute(EL, 3)); eg.setIndex(new THREE.BufferAttribute(D.eyeF, 1)); eg.computeVertexNormals();
  const gaze = new THREE.Vector3(Math.sin(-g.yaw) * 0.9, 0.02, 1).normalize(); // regard vers l'objectif malgré la tête légèrement tournée
  const eyes = new THREE.Mesh(eg, eyeMaterial({ uIris: { value: new THREE.Color(g.eyeColor).convertSRGBToLinear() }, uGaze: { value: gaze } })); group.add(eyes);
  // cheveux et barbe en coques superposées, uniquement sur les triangles concernés
  const subset = test => { const out = []; for (let k = 0; k < D.tri.length; k += 3) { const a = D.tri[k], b = D.tri[k + 1], c = D.tri[k + 2]; if (test(a) || test(b) || test(c)) out.push(a, b, c); } return out; };
  const addShells = (kind, test, len, layers, x) => {
    const idx = subset(test); if (!idx.length || len <= 0) return;
    const sg = new THREE.BufferGeometry(); sg.setAttribute('position', geo.attributes.position); sg.setAttribute('normal', geo.attributes.normal); sg.setAttribute('maskA', geo.attributes.maskA); sg.setIndex(idx);
    const SU = Object.assign({}, U, { uLen: { value: len }, uLayers: { value: layers }, uDroop: { value: x.droop || 0 }, uBack: { value: x.back || 0 }, uStyle: { value: x.style || 1 }, uKind: { value: kind === 'beard' ? 1 : 0 },
      uCurl: { value: x.curl || 0 }, uDens: { value: x.dens || 0.9 }, uStrand: { value: x.strand || 70 }, uClump: { value: x.clump || 10 }, uCore: { value: x.core || 0 }, uRows: { value: x.rows || 0 } });
    const im = new THREE.InstancedMesh(sg, shellMaterial(SU, kind), layers); for (let i = 0; i < layers; i++) im.setMatrixAt(i, new THREE.Matrix4()); im.castShadow = false; im.receiveShadow = true; im.frustumCulled = false; group.add(im);
  };
  const qAt = i => toQ(i);
  if (hs) {
    const texCurl = { coily: 1.1, 'tightly curly': 0.9, curly: 0.7, wavy: 0.35, straight: 0.08 }[g.hairTex] ?? 0.3;
    const curl = Math.max(hs[5], g.hairStyle === 'twists' || g.hairStyle === 'cornrows' ? hs[5] : texCurl * (hs[1] > 0.1 ? 1 : 0.3));
    addShells('hair', i => { const q = qAt(i); return q.y > 0.3 || (q.z < 0.2 && q.y > -1.8); }, hs[1], Math.round(10 + hs[1] * 48),
      { style: hs[0], core: hs[2], clump: hs[3], strand: hs[4], curl, droop: hs[6], back: hs[7], dens: hs[8], rows: g.hairStyle === 'cornrows' ? 1 : 0 });
  }
  const BS = { short: [0.045, 0], full: [0.1, 0], goatee: [0.06, 0], moustache: [0.045, 0], chinstrap: [0.045, 0] }[g.beard];
  if (BS) addShells('beard', i => { const q = qAt(i); return q.y < 0 && q.z > -0.6 && Math.abs(q.x) < 1.25; }, BS[0], 12, { core: BS[1], clump: 18, strand: 140, curl: g.hairTex === 'coily' ? 0.9 : 0.35, dens: 0.8 });
  group.userData = { mid, iod, topY, chinY, neckQ };
  return group;
}

export async function renderPortrait(p, size = 256, over) {
  const D = await loadAssets();
  const g = Object.assign(genome(p), over || {});
  const head = buildHead(D, g);
  const { r, scene, cam, key } = renderer(size * 2);
  const { mid, iod } = head.userData;
  head.position.set(-mid.x, -mid.y, -mid.z); const holder = new THREE.Group(); holder.add(head); holder.rotation.set(0, g.yaw, g.tilt, 'YXZ');
  scene.add(holder);
  // cadrage constant (en écarts inter-pupillaires) : tête, cou, épaules
  const cy = -1.05 * iod, span = 5.9 * iod, dist = (span / 2) / Math.tan(THREE.MathUtils.degToRad(cam.fov / 2));
  cam.position.set(0, cy + 0.2 * iod, dist); cam.lookAt(0, cy, 0);
  key.target.position.set(0, 0, 0); key.shadow.camera.left = key.shadow.camera.bottom = -6 * iod; key.shadow.camera.right = key.shadow.camera.top = 6 * iod; key.shadow.camera.near = 0.5; key.shadow.camera.far = 60; key.shadow.camera.updateProjectionMatrix();
  r.render(scene, cam);
  const out = document.createElement('canvas'); out.width = out.height = size; const ox = out.getContext('2d'); ox.imageSmoothingQuality = 'high'; ox.drawImage(r.domElement, 0, 0, size, size);
  const url = out.toDataURL('image/webp', 0.86);
  scene.remove(holder); holder.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
  return { url, g };
}

// La 3D est-elle disponible sur cet appareil ? (sinon le jeu garde la silhouette)
export function portraitsSupported() {
  try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')) && typeof DecompressionStream === 'function'; } catch (e) { return false; }
}
export const PORTRAIT_VERSION = 1;
