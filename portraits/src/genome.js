// Génome d'un joueur : id + nationalité + âge -> traits du visage (sans dépendance).
// Partagé par les portraits 3D (portraits.src.js) et 2D (faces2d.src.js) : un même joueur garde la même carnation,
// les mêmes cheveux et la même barbe dans les deux styles.

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
export { clamp, lerp, gauss, pickW };

// ---------- génome d'un joueur ----------
// 8 traits « de structure » à plusieurs types : leurs combinaisons forment les archétypes (48), chacun ensuite
// varié en continu pour chaque joueur. La nationalité n'oriente que légèrement les probabilités d'ascendance.
const FACE_TYPES = ['oval', 'round', 'rectangular', 'square', 'triangular', 'invertedtriangular', 'diamond'];
// Origines : chaque nationalité est un mélange explicite de profils de population, sans plancher artificiel.
// Un profil fixe l'ascendance morphologique [africaine, asiatique, européenne] et une plage de carnation stricte
// (mel : 0 très clair -> 1 très foncé). Un Sénégalais est toujours à peau foncée, un Marocain à peau mate, etc.
export const PROFILES = {
  waf: { anc: [0.92, 0, 0.08], mel: [0.68, 0.95], lightHair: 0, lightEyes: 0 },     // Afrique de l'Ouest et centrale
  naf: { anc: [0.12, 0, 0.88], mel: [0.34, 0.52], lightHair: 0.04, lightEyes: 0.06, olive: 1 }, // Maghreb, Égypte
  seu: { anc: [0.02, 0, 0.98], mel: [0.12, 0.3], lightHair: 0.18, lightEyes: 0.2, olive: 0.5 }, // Europe du Sud, Río de la Plata
  neu: { anc: [0, 0, 1], mel: [0.02, 0.18], lightHair: 0.55, lightEyes: 0.6 },        // Europe du Nord et de l'Ouest
  eas: { anc: [0, 0.95, 0.05], mel: [0.16, 0.32], lightHair: 0, lightEyes: 0 },       // Asie de l'Est
  mix: { anc: [0.5, 0, 0.5], mel: [0.45, 0.68], lightHair: 0, lightEyes: 0.03 },      // métis afro-européens
  lat: { anc: [0.08, 0.18, 0.74], mel: [0.26, 0.44], lightHair: 0.03, lightEyes: 0.04, olive: 0.7 }, // métis latino-américains
};
export const NAT_PROFILES = {
  FR: { neu: 0.32, seu: 0.28, waf: 0.17, naf: 0.14, mix: 0.06, eas: 0.03 },
  EN: { neu: 0.72, waf: 0.12, mix: 0.1, seu: 0.02, eas: 0.04 },
  ES: { seu: 0.9, naf: 0.04, waf: 0.03, lat: 0.03 }, IT: { seu: 0.94, waf: 0.03, naf: 0.03 },
  DE: { neu: 0.85, seu: 0.06, naf: 0.04, waf: 0.03, mix: 0.02 }, PT: { seu: 0.82, waf: 0.08, mix: 0.1 },
  NL: { neu: 0.78, mix: 0.1, waf: 0.06, naf: 0.06 }, BE: { neu: 0.72, seu: 0.06, waf: 0.12, naf: 0.1 },
  BR: { seu: 0.4, mix: 0.38, waf: 0.17, lat: 0.05 }, AR: { seu: 0.85, lat: 0.15 }, UY: { seu: 0.82, lat: 0.12, mix: 0.06 },
  US: { neu: 0.45, waf: 0.27, mix: 0.1, lat: 0.13, eas: 0.05 }, CO: { lat: 0.6, mix: 0.25, seu: 0.15 }, MX: { lat: 0.8, seu: 0.2 },
  SN: { waf: 1 }, NG: { waf: 1 }, CI: { waf: 1 }, CM: { waf: 1 }, GH: { waf: 1 },
  MA: { naf: 1 }, DZ: { naf: 1 }, TN: { naf: 1 }, EG: { naf: 1 }, JP: { eas: 1 }, KR: { eas: 1 },
};
const NAT_DEFAULT = { seu: 0.45, neu: 0.25, waf: 0.15, naf: 0.1, eas: 0.05 };
export const ARCHETYPES = (() => { const r = rng('archetypes-v1'), out = []; for (let i = 0; i < 48; i++) out.push({
  face: FACE_TYPES[i % FACE_TYPES.length], jaw: [-0.6, -0.2, 0.25, 0.65][Math.floor(r() * 4)], chin: [-0.5, 0, 0.5][Math.floor(r() * 3)],
  cheekBones: [-0.4, 0.1, 0.6][Math.floor(r() * 3)], nose: ['fin', 'droit', 'large', 'aquilin', 'court', 'long'][Math.floor(r() * 6)],
  eyes: ['amande', 'ronds', 'enfoncés', 'écartés', 'rapprochés'][Math.floor(r() * 5)], lips: [-0.5, 0, 0.5, 0.9][Math.floor(r() * 4)],
  forehead: [-0.5, 0, 0.5][Math.floor(r() * 3)], brows: ['épais', 'fins', 'droits', 'arqués'][Math.floor(r() * 4)] }); return out; })();
export const ARCHETYPE_COUNT = ARCHETYPES.length;

export function genome(p) {
  const r = rng('face2:' + p.id);
  const arch = ARCHETYPES[Math.floor(r() * ARCHETYPES.length)];
  const prof = pickW(r, Object.entries(NAT_PROFILES[p.nat] || NAT_DEFAULT)), P = PROFILES[prof];
  // ascendance morphologique : celle du profil, légèrement variée
  const anc = P.anc.map(v => Math.max(0, v + (v > 0 && v < 1 ? gauss(r) * 0.05 : 0))); const sA = anc.reduce((a, b) => a + b, 0); for (let i = 0; i < 3; i++) anc[i] /= sA;
  // carnation : toujours dans la plage du profil
  const mel = lerp(P.mel[0], P.mel[1], clamp(0.5 + gauss(r) * 0.3, 0, 1));
  const undertone = (P.olive || 0) * 0.6 + gauss(r) * 0.35; // <0 rosé, >0 olive/doré
  const hairTex = clamp(anc[0] * 0.95 + gauss(r) * 0.18, 0, 1) > 0.55 ? (r() < 0.75 ? 'coily' : 'curly') : pickW(r, [['straight', 0.5 + anc[1] * 3], ['wavy', 0.35], ['curly', 0.15 + (prof === 'naf' || prof === 'lat' ? 0.3 : 0)]]);
  const hairColor = r() >= P.lightHair ? pickW(r, [['#120c09', 4], ['#1d140e', 3], ['#2b1d14', 2], ['#3a271a', prof === 'neu' || prof === 'seu' ? 3 : 0.5]])
    : prof === 'neu' || prof === 'seu' ? pickW(r, [['#5a3d25', 3], ['#7a5634', 2.5], ['#a77f4c', 1.6], ['#c9a46c', 1], ['#8a4a24', 0.6]]) : pickW(r, [['#4a3220', 2], ['#5a3d25', 1]]);
  const eyeColor = r() >= P.lightEyes ? pickW(r, [['#2a1a10', 5], ['#3b2416', 3], ['#5a3a1c', mel < 0.5 ? 2 : 0]]) : pickW(r, [['#4f6b4a', 1.2], ['#5d7d9a', 1.4], ['#7b8c95', 0.6]]);
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
    id: p.id, age: p.age, arch, prof, anc, mel, undertone, hairTex, hairStyle, hairColor, eyeColor, beard,
    hairline: gauss(r) * 0.12, recede: clamp((p.age - 27) / 14 + gauss(r) * 0.35, 0, 1) * (r() < 0.55 ? 1 : 0.25),
    browThick: arch.brows === 'épais' ? 0.75 + r() * 0.25 : arch.brows === 'fins' ? 0.3 + r() * 0.2 : 0.45 + r() * 0.3,
    browArch: arch.brows === 'arqués' ? 0.55 + r() * 0.35 : arch.brows === 'droits' ? r() * 0.2 : 0.2 + r() * 0.35,
    browGap: gauss(r) * 0.06, freckles: mel < 0.25 && r() < 0.18 ? r() : 0, moles: r(),
    yaw: (r() - 0.5) * 0.32, tilt: (r() - 0.5) * 0.05, jersey: pickW(r, [['#3a3f46', 3], ['#26344a', 2], ['#e4e4e1', 2], ['#7b8088', 2], ['#4a5040', 0.7], ['#1d1f22', 1.2]]),
    shellSeed: r() * 100, grey: clamp((p.age - 31) / 12, 0, 1) * r(),
    m: {}, // valeurs de modificateurs morphologiques
  };
  const m = g.m, J = s => gauss(r) * s * 1.7;
  m.shape = arch.face; m.shapeW = 0.45 + r() * 0.45; m.shape2 = FACE_TYPES[Math.floor(r() * FACE_TYPES.length)]; m.shape2W = r() * 0.25;
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

