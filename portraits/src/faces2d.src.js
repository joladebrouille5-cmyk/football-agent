// Portraits 2D (dessin vectoriel) des joueurs : même génome que les portraits 3D (genome.js), dessiné avec facesjs.
// Identité 100 % déterministe : id joueur -> graine -> apparence ; le visage mûrit avec l'âge.
import { generate, display, faceToSvgString, svgsIndex } from 'facesjs';
import { rng, clamp, genome, ARCHETYPES } from './genome.js';
export { genome };

const pick = (r, a) => a[Math.floor(r() * a.length)];
const pickW = (r, items) => { const tot = items.reduce((s, x) => s + x[1], 0); let u = r() * tot; for (const [v, w] of items) { if ((u -= w) <= 0) return v; } return items[items.length - 1][0]; };
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// carnation continue : mel 0 (très clair) -> 1 (très foncé), une teinte tous les 0,1
const SKIN = ['#f7ddcc', '#f1d0b8', '#e9c1a0', '#ddae88', '#cf9c74', '#bd8660', '#a2694a', '#87543a', '#6e432e', '#573424', '#43281c'];
function skinColor(mel, undertone) {
  const x = clamp(mel, 0, 1) * (SKIN.length - 1), i = Math.min(SKIN.length - 2, Math.floor(x));
  const c = mix(SKIN[i], SKIN[i + 1], x - i);
  return undertone > 0 ? mix(c, '#c9a35c', Math.min(0.14, undertone * 0.12)) : mix(c, '#e3a197', Math.min(0.1, -undertone * 0.1));
}
// coiffures par texture de cheveux (toutes les coupes masculines de facesjs, sauf « high », trop carrée)
const HAIR = {
  coily: [['afro', 2], ['afro2', 2], ['blowoutFade', 2], ['cornrows', 1.3], ['dreads', 1.3], ['curly', 1.2], ['curly2', 1.2], ['curlyFade1', 2], ['curlyFade2', 2], ['short-fade', 2], ['short-fade-2', 1.5], ['crop-fade', 1], ['spike4', 0.5]],
  curly: [['curly', 2], ['curly2', 2], ['curly3', 2], ['curlyFade1', 1.5], ['curlyFade2', 1.5], ['messy', 1], ['shaggy1', 0.8], ['hair', 1], ['crop-fade', 1], ['short3', 1], ['spike3', 0.8], ['blowoutFade', 0.8]],
  straight: [['short', 2], ['short2', 2], ['short3', 1.5], ['crop', 1.5], ['crop-fade', 1.5], ['crop-fade2', 1.5], ['parted', 1.3], ['middle-part', 1], ['juice', 1], ['messy-short', 1.5], ['messy', 0.8],
    ['spike', 1], ['spike2', 1], ['spike3', 0.8], ['faux-hawk', 0.8], ['fauxhawk-fade', 1], ['emo', 0.5], ['shaggy1', 0.6], ['shaggy2', 0.6], ['shortBangs', 0.8], ['tall-fade', 1.2], ['hair', 0.8], ['longHair', 0.35]],
};
HAIR.wavy = HAIR.straight.concat([['curly3', 1], ['messy', 1], ['shaggy1', 0.8], ['shaggy2', 0.8]]);
const LONG = { coily: ['dreads', 'afro', 'afro2', 'cornrows'], curly: ['curly3', 'messy', 'shaggy1'], straight: ['shaggy1', 'shaggy2', 'longHair', 'emo', 'middle-part'] };
LONG.wavy = LONG.straight;
const BEARD = {
  short: ['beard1', 'beard2', 'beard3', 'fullgoatee', 'logan'], goatee: ['goatee1', 'goatee2', 'goatee4-stache', 'fullgoatee2', 'goatee-thin-stache', 'soul-stache'],
  moustache: ['mustache1', 'mustache-thin', 'mustache1SB1'], chinstrap: ['chin-strap', 'chin-strapStache', 'wilt-sideburns-short'], full: ['beard4', 'beard5', 'beard6', 'loganGoatee2Stache', 'fullgoatee3'],
};
const STUBBLE = { stubble: 0.2, shadow: 0.11 };
// traits du visage reliés aux archétypes du génome : chaque type pioche dans sa propre famille de dessins
const male = f => svgsIndex[f].filter(id => !id.startsWith('female'));
const bins = (ids, n) => Array.from({ length: n }, (_, k) => ids.filter((_, i) => i % n === k));
const HEADS = male('head'), EYES = bins(male('eye'), 5), NOSES = bins(male('nose').filter(id => id !== 'pinocchio'), 6),
  MOUTHS = bins(male('mouth').filter(id => !['angry', 'side'].includes(id)), 4), BROWS = bins(male('eyebrow'), 4);
const EYE_T = ['amande', 'ronds', 'enfoncés', 'écartés', 'rapprochés'], NOSE_T = ['fin', 'droit', 'large', 'aquilin', 'court', 'long'], BROW_T = ['épais', 'fins', 'droits', 'arqués'];
const NOSE_SIZE = { fin: 0.7, droit: 0.9, large: 1.2, aquilin: 1.05, court: 0.75, long: 1.1 };

export function faceConfig(p) {
  const g = genome(p), r = rng('face2d:' + p.id), a = g.arch, ai = ARCHETYPES.indexOf(a);
  // facesjs tire au hasard avec Math.random : on le remplace le temps de la génération par la graine du joueur
  const saved = Math.random; Math.random = r;
  let f; try { f = generate(undefined, { gender: 'male', race: 'white' }); } finally { Math.random = saved; }
  const hairColor = mix(g.hairColor, '#b9b6b0', g.grey);
  const tex = HAIR[g.hairTex] ? g.hairTex : 'straight';
  let hair = g.hairStyle === 'shaved' ? (r() < 0.5 ? 'short-fade' : 'bald') : g.hairStyle === 'buzz' || g.hairStyle === 'waves' ? pick(r, ['short-fade', 'short-fade-2', 'crop-fade'])
    : g.hairStyle === 'medium' || (p.age <= 26 && r() < 0.12) ? pick(r, LONG[tex]) : pickW(r, HAIR[tex]);
  if (g.recede > 0.75 && p.age >= 30 && !LONG[tex].includes(hair)) hair = r() < 0.6 ? 'short-bald' : 'bald';
  const lines = clamp((p.age - 24) / 12, 0, 1);
  const lips = a.lips < -0.2 ? 0 : a.lips < 0.2 ? 1 : a.lips < 0.7 ? 2 : 3;
  return Object.assign(f, {
    fatness: clamp((g.weight - 0.25) / 0.45 * 0.5 + (a.face === 'round' ? 0.25 : a.face === 'square' ? 0.12 : 0) + (g.m['head-fat'] || 0) * 0.2, 0, 0.85),
    teamColors: [g.jersey, mix(g.jersey, '#000000', 0.35), mix(g.jersey, '#ffffff', 0.45)],
    hairBg: { id: hair === 'longHair' ? 'longHair' : hair === 'shaggy1' || hair === 'shaggy2' ? 'shaggy' : 'none' },
    body: { ...f.body, color: skinColor(g.mel, g.undertone), size: 0.95 + g.muscle * 0.1 },
    jersey: { id: 'football' },
    head: { id: HEADS[(ai * 7 + Math.floor(r() * 3)) % HEADS.length], shave: `rgba(0,0,0,${STUBBLE[g.beard] || 0})` },
    ear: { ...f.ear, size: clamp(0.8 + (g.m['ear-scale'] || 0) * 0.4, 0.5, 1.3) },
    eye: { id: pick(r, EYES[EYE_T.indexOf(a.eyes)]), angle: clamp((g.m['eye-corner2'] || 0) * 10 + (g.anc[1] > 0.5 ? 6 : 0), -8, 12) },
    eyebrow: { id: pick(r, BROWS[BROW_T.indexOf(a.brows)]), angle: clamp(g.browArch * 18 - 6, -8, 12) },
    nose: { ...f.nose, id: pick(r, NOSES[NOSE_T.indexOf(a.nose)]), size: clamp(NOSE_SIZE[a.nose] + (g.m['nose-scale-horiz'] || 0) * 0.15 + g.anc[0] * 0.1, 0.55, 1.3) },
    mouth: { ...f.mouth, id: pick(r, MOUTHS[lips]) },
    hair: { ...f.hair, id: hair, color: hairColor },
    facialHair: { id: BEARD[g.beard] ? pick(r, BEARD[g.beard]) : 'none' },
    eyeLine: { id: lines > 0.3 ? f.eyeLine.id : 'none' },
    smileLine: { ...f.smileLine, id: lines > 0.15 && f.smileLine.id !== 'none' ? f.smileLine.id : 'none', size: 0.4 + lines * 1.4 },
    miscLine: { id: lines > 0.6 && r() < 0.6 ? pick(r, ['forehead1', 'forehead2', 'chin1']) : g.freckles > 0.3 ? 'freckles1' : 'none' },
    glasses: { id: 'none' }, accessories: { id: 'none' },
  });
}

// dans le navigateur, facesjs dessine dans un vrai élément SVG (il mesure les formes) ; ailleurs, il simule le DOM
function faceSvg(f) {
  if (typeof document === 'undefined' || !document.body) return faceToSvgString(f);
  const box = document.createElement('div');
  box.style.cssText = 'position:fixed;left:-9999px;top:0;width:400px;height:600px;visibility:hidden;pointer-events:none';
  document.body.appendChild(box);
  try { display(box, f); return box.innerHTML; } finally { box.remove(); }
}

// cadre carré : du haut des cheveux (afro compris) au haut des épaules, sur le fond gris neutre des portraits 3D
export const FRAME = { x: -45, y: 15, s: 490 };
export async function renderPortrait(p, size = 256) {
  const f = faceConfig(p);
  const inner = faceSvg(f).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="${FRAME.x} ${FRAME.y} ${FRAME.s} ${FRAME.s}">` +
    `<defs><radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#9da1a6"/><stop offset="1" stop-color="#5e6268"/></radialGradient></defs>` +
    `<rect x="-100" y="-100" width="600" height="800" fill="url(#bg)"/>${inner}</svg>`;
  return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), g: f };
}
export function portraitsSupported() { return true; }
export function loadAssets() { return Promise.resolve(); }
export const PORTRAIT_VERSION = 2;
