// Portraits 2D (dessin vectoriel) des joueurs : même génome que les portraits 3D (genome.js), dessiné avec facesjs.
// Identité 100 % déterministe : id joueur -> graine -> apparence ; le visage mûrit avec l'âge.
import { generate, display, faceToSvgString } from 'facesjs';
import { rng, clamp, genome } from './genome.js';
export { genome };

const pick = (r, a) => a[Math.floor(r() * a.length)];
const hex = c => [1, 3, 5].map(i => parseInt(c.slice(i, i + 2), 16));
const mix = (a, b, t) => '#' + hex(a).map((v, i) => Math.round(v + (hex(b)[i] - v) * t).toString(16).padStart(2, '0')).join('');
// carnation continue (du plus clair au plus foncé), alignée sur les teintes des portraits 3D
const SKIN = ['#f3d2bd', '#e8b996', '#d29b6f', '#ad7448', '#8a5532', '#64391f', '#45261a'];
function skinColor(mel, undertone) {
  const x = clamp(mel, 0, 1) * (SKIN.length - 1), i = Math.min(SKIN.length - 2, Math.floor(x));
  const c = mix(SKIN[i], SKIN[i + 1], x - i);
  return undertone > 0 ? mix(c, '#c8a060', Math.min(0.12, undertone * 0.1)) : mix(c, '#e09a90', Math.min(0.1, -undertone * 0.08));
}
const HAIR = {
  shaved: ['short-bald'], buzz: ['crop', 'short-fade'], fade: ['short-fade', 'short-fade-2', 'tall-fade', 'crop-fade', 'crop-fade2'],
  waves: ['short-fade-2', 'crop-fade'], afro: ['afro', 'afro2'], curlytop: ['curlyFade1', 'curlyFade2', 'curly', 'curly2'],
  short: ['short', 'short2', 'short3', 'crop', 'parted'], slick: ['parted', 'middle-part', 'juice'],
  textured: ['messy-short', 'spike', 'spike2', 'fauxhawk-fade'], medium: ['messy', 'shaggy1', 'shaggy2', 'middle-part'],
};
const BEARD = {
  short: ['beard1', 'beard2', 'beard3'], goatee: ['goatee1', 'goatee2', 'goatee4-stache', 'fullgoatee2'],
  moustache: ['mustache1', 'mustache-thin'], chinstrap: ['chin-strap', 'chin-strapStache'], full: ['beard4', 'beard5', 'beard6', 'logan'],
};
const STUBBLE = { stubble: 0.2, shadow: 0.11 };

export function faceConfig(p) {
  const g = genome(p), r = rng('face2d:' + p.id);
  const race = g.anc[1] > 0.5 ? 'asian' : g.mel > 0.6 ? 'black' : g.mel > 0.3 ? 'brown' : 'white';
  // facesjs tire au hasard avec Math.random : on le remplace le temps de la génération par la graine du joueur
  const saved = Math.random; Math.random = r;
  let f; try { f = generate(undefined, { gender: 'male', race }); } finally { Math.random = saved; }
  const hairColor = mix(g.hairColor, '#b9b6b0', g.grey);
  let hair = pick(r, HAIR[g.hairStyle] || HAIR.short);
  if (g.recede > 0.75 && p.age >= 30 && g.hairStyle !== 'afro') hair = 'short-bald';
  const lines = clamp((p.age - 24) / 12, 0, 1);
  return Object.assign(f, {
    fatness: clamp((g.weight - 0.25) / 0.45, 0, 1) * 0.6,
    teamColors: [g.jersey, mix(g.jersey, '#000000', 0.35), mix(g.jersey, '#ffffff', 0.45)],
    hairBg: { id: 'none' },
    body: { ...f.body, color: skinColor(g.mel, g.undertone), size: 0.95 + g.muscle * 0.1 },
    jersey: { id: 'football' },
    head: { ...f.head, shave: `rgba(0,0,0,${STUBBLE[g.beard] || 0})` },
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

// tête et épaules dans un cadre carré, sur le même fond gris neutre que les portraits 3D
export async function renderPortrait(p, size = 256) {
  const f = faceConfig(p);
  const inner = faceSvg(f).replace(/^<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-10 50 420 420">` +
    `<defs><radialGradient id="bg" cx="50%" cy="38%" r="75%"><stop offset="0" stop-color="#9da1a6"/><stop offset="1" stop-color="#5e6268"/></radialGradient></defs>` +
    `<rect x="-50" y="0" width="500" height="600" fill="url(#bg)"/>${inner}</svg>`;
  return { url: 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svg))), g: f };
}
export function portraitsSupported() { return true; }
export function loadAssets() { return Promise.resolve(); }
export const PORTRAIT_VERSION = 1;
