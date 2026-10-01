# Données complémentaires des portraits 3D (V8.9) : coordonnées de texture de la tête, grain de peau photographique
# et sourcils. Sources : ressources système de MakeHuman 1.1 (domaine public, CC0), telles que reconditionnées dans
# le paquet npm « makehuman-data-v1 » (seuls les fichiers de ressources sont repris, pas le code du paquet).
#
#   npm pack makehuman-data-v1 && tar xzf makehuman-data-v1-*.tgz   ->  ./package/public/data/...
#   python3 portraits/src/build_extras.py ./package/public/data mh portraits
#
# Produit : portraits/skin-detail.webp (atlas en niveaux de gris : 3 origines x 2 âges, rapport peau/peau floutée,
# 128 = neutre), portraits/brows.webp (atlas des 12 sourcils) et le champ « extra » de portraits/heads.json.
import json, sys, os
from PIL import Image, ImageFilter

DATA, MH, OUT = sys.argv[1], sys.argv[2], sys.argv[3]
exec(open(os.path.join(os.path.dirname(__file__), 'build_assets.py')).read().split('# binaire')[0].replace("MH='mh'", f"MH={MH!r}"))  # V, VT, order, remap…

# 1) coordonnées de texture par sommet de la tête (première occurrence dans les faces de base.obj)
uvF = {}
for line in open(f'{MH}/3dobjs/base.obj'):
    if line.startswith('f '):
        for t in line.split()[1:]:
            a = t.split('/'); vi = int(a[0]) - 1
            if len(a) > 1 and a[1] and vi not in uvF: uvF[vi] = int(a[1]) - 1
uv = []
for i in order:
    u = VT[uvF[i]] if i in uvF else (0, 0); uv += [round(u[0], 4), round(u[1], 4)]

# 2) grain de peau : passe-haut de la luminance (peau / peau floutée), limité à l'îlot UV de la tête
SKINS = [('african', 'young', 'young_african_male/textures/young_darkskinned_male_diffuse.png'),
         ('african', 'middle', 'middleage_african_male/textures/middleage_darkskinned_male_diffuse.png'),
         ('asian', 'young', 'young_asian_male/textures/young_lightskinned_male_diffuse3.png'),
         ('asian', 'middle', 'middleage_asian_male/textures/middleage_lightskinned_male_diffuse2.png'),
         ('caucasian', 'young', 'young_caucasian_male/textures/young_lightskinned_male_diffuse.png'),
         ('caucasian', 'middle', 'middleage_caucasian_male/textures/middleage_lightskinned_male_diffuse.png')]
T = 512
atlas = Image.new('L', (T * 3, T * 2), 128)
headMask = Image.new('L', (T, T), 0)
for u0 in range(int(T * 0.62), T):  # îlot de la tête : à droite de la planche UV MakeHuman
    for v0 in range(T): headMask.putpixel((u0, v0), 255)
headMask = headMask.filter(ImageFilter.GaussianBlur(6))
for k, (race, age, path) in enumerate(SKINS):
    im = Image.open(f'{DATA}/skins/{path}').convert('L').resize((T, T), Image.LANCZOS)
    blur = im.filter(ImageFilter.GaussianBlur(10))
    px, pb = im.load(), blur.load(); out = Image.new('L', (T, T)); po = out.load()
    for y in range(T):
        for x in range(T): po[x, y] = max(0, min(255, round(128 * px[x, y] / max(pb[x, y], 8))))
    out = Image.composite(out, Image.new('L', (T, T), 128), headMask)
    col, row = ['african', 'asian', 'caucasian'].index(race), ['young', 'middle'].index(age)
    atlas.paste(out, (col * T, row * T))
atlas.save(f'{OUT}/skin-detail.webp', 'WEBP', quality=82, method=6)

# 3) sourcils : géométrie ajustée sur la tête (comme les yeux) + atlas des textures (4 x 3 cases de 256 px)
def proxy(name):
    d = json.load(open(f'{DATA}/proxies/eyebrows/{name}/{name}.json'))
    refs, ws, offs = d['ref_vIdxs'], d['weights'], d['offsets']
    V, F, UV = d['vertices'], d['faces'], d['uvs'][0]
    verts, ref_out, uv_out, tri = {}, [], [], []
    def vid(v, t):
        if (v, t) not in verts:
            verts[(v, t)] = len(ref_out); r = refs[v]; w = ws[v]
            ref_out.append([remap[r[0]], remap[r[1]], remap[r[2]], round(w[0], 5), round(w[1], 5), round(w[2], 5)] + [round(o, 5) for o in offs[v]])
            uv_out.extend([round(UV[t * 2], 4), round(UV[t * 2 + 1], 4)])
        return verts[(v, t)]
    i = 0
    while i < len(F):
        ty = F[i]; i += 1; n = 4 if ty & 1 else 3
        vs = F[i:i + n]; i += n
        if ty & 2: i += 1
        if ty & 4: i += 1
        ts = F[i:i + n] if ty & 8 else [0] * n
        if ty & 8: i += n
        if ty & 16: i += 1
        if ty & 32: i += n
        if ty & 64: i += 1
        if ty & 128: i += n
        ids = [vid(v, t) for v, t in zip(vs, ts)]
        tri += [ids[0], ids[1], ids[2]] + ([ids[0], ids[2], ids[3]] if n == 4 else [])
    return {'v': ref_out, 'uv': uv_out, 'tri': tri}
BROWS = ['eyebrow%03d' % k for k in range(1, 13)]
brows = {}; batlas = Image.new('RGBA', (256 * 4, 256 * 3), (0, 0, 0, 0))
for k, name in enumerate(BROWS):
    brows[name] = proxy(name)
    im = Image.open(f'{DATA}/proxies/eyebrows/{name}/textures/{name}.png').convert('RGBA').resize((256, 256), Image.LANCZOS)
    batlas.paste(im, ((k % 4) * 256, (k // 4) * 256))
batlas.save(f'{OUT}/brows.webp', 'WEBP', quality=88, method=6)

heads = json.load(open(f'{OUT}/heads.json'))
heads['extra'] = {'uv': uv, 'brows': brows, 'browNames': BROWS, 'skins': [s[0] + '-' + s[1] for s in SKINS]}
json.dump(heads, open(f'{OUT}/heads.json', 'w'), separators=(',', ':'))
print('uv', len(uv) // 2, 'sourcils', len(brows), 'skin-detail', os.path.getsize(f'{OUT}/skin-detail.webp'), 'brows', os.path.getsize(f'{OUT}/brows.webp'))
