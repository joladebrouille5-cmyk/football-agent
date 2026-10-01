# Portraits 3D des joueurs

Chaque joueur fictif a un visage réaliste, dessiné en 3D dans le navigateur puis gardé en image.

- **Déterministe** : identifiant du joueur + nationalité + âge → toujours le même visage. Rien n'est ajouté à la sauvegarde.
- **Vieillissement** : le même visage mûrit avec l'âge du joueur (morphologie, rides, cheveux gris, recul de la ligne des cheveux).
- **Diversité** : 48 archétypes (forme du visage, mâchoire, menton, pommettes, nez, yeux, lèvres, front, sourcils), chacun varié en continu sur une quarantaine de réglages, avec une légère asymétrie. L'ascendance est un mélange continu, seulement orienté par la nationalité.
- **Poids** : environ 1 Mo au premier chargement (module 150 Ko compressé + données), ensuite en cache.
- **Cache** : chaque portrait est dessiné une fois, puis gardé en mémoire et dans IndexedDB (`football_agent_portraits`).
- **Repli** : sans WebGL, si le module ne se charge pas, sur un appareil trop lent, ou avec le réglage « Portraits : Simples », le jeu garde les silhouettes.

## Fichiers

| Fichier | Rôle |
|---|---|
| `portraits.js` | Module prêt à l'emploi (three.js inclus, minifié). Chargé par le jeu à la demande. |
| `heads.json` | Maillage tête-cou-épaules et cibles morphologiques (compressés en gzip, encodés en base64), repères anatomiques, ajustement des yeux. |
| `src/portraits.src.js` | Source lisible du module. |
| `src/build_assets.py` | Fabrique `heads.bin` / `heads.json` à partir des fichiers MakeHuman. |

## Reconstruire

```sh
# données (fichiers MakeHuman dans ./mh, voir build_assets.py)
python3 portraits/src/build_assets.py && gzip -9 assets/heads.bin
# puis intégrer assets/heads.bin.gz en base64 dans le champ « bin » de heads.json
# module
npm install --no-save three esbuild
npx esbuild portraits/src/portraits.src.js --bundle --format=esm --minify --platform=browser --outfile=portraits/portraits.js
```

## Licences

- Maillage de base, cibles morphologiques et yeux : **MakeHuman**, publiés sous **CC0 1.0** (domaine public) — https://github.com/makehumancommunity/makehuman
- **three.js** : licence MIT — https://github.com/mrdoob/three.js
- Peau, sourcils, barbe, cheveux, maillot et éclairage : procéduraux, écrits pour Football Agent.
