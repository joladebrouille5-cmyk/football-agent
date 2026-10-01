# Portraits des joueurs (3D ou 2D)

Chaque joueur fictif a un visage, dessiné dans le navigateur puis gardé en image. Le réglage « Portraits » du jeu choisit le style :
**3D** (visage réaliste, WebGL), **2D** (dessin vectoriel, plus léger) ou **Aucun** (silhouettes). Les deux styles partagent le même
génome (`src/genome.js`) : un joueur garde la même carnation, les mêmes cheveux et la même barbe en 3D comme en 2D.

- **Déterministe** : identifiant du joueur + nationalité + âge → toujours le même visage. Rien n'est ajouté à la sauvegarde.
- **Vieillissement** : le même visage mûrit avec l'âge du joueur (morphologie, rides, cheveux gris, recul de la ligne des cheveux).
- **Diversité** : 48 archétypes (forme du visage, mâchoire, menton, pommettes, nez, yeux, lèvres, front, sourcils), chacun varié en continu sur une quarantaine de réglages, avec une légère asymétrie. L'ascendance est un mélange continu, seulement orienté par la nationalité.
- **Poids** : environ 1 Mo au premier chargement (module 150 Ko compressé + données), ensuite en cache.
- **Cache** : chaque portrait est dessiné une fois, puis gardé en mémoire et dans IndexedDB (`football_agent_portraits`).
- **Repli** : sans WebGL ou sur un appareil trop lent, la 3D passe d'elle-même en 2D ; si aucun module ne se charge, ou avec le réglage « Aucun », le jeu garde les silhouettes.
- **Poids de la 2D** : environ 110 Ko compressés, sans données supplémentaires.

## Fichiers

| Fichier | Rôle |
|---|---|
| `portraits.js` | Module 3D prêt à l'emploi (three.js inclus, minifié). Chargé par le jeu à la demande. |
| `faces2d.js` | Module 2D prêt à l'emploi (facesjs inclus, minifié). |
| `heads.json` | Maillage tête-cou-épaules et cibles morphologiques (compressés en gzip, encodés en base64), repères anatomiques, ajustement des yeux. |
| `src/genome.js` | Génome commun : id + nationalité + âge → traits du visage. |
| `src/portraits.src.js` | Source lisible du module 3D. |
| `src/faces2d.src.js` | Source lisible du module 2D. |
| `src/build_assets.py` | Fabrique `heads.bin` / `heads.json` à partir des fichiers MakeHuman. |

## Reconstruire

```sh
# données (fichiers MakeHuman dans ./mh, voir build_assets.py)
python3 portraits/src/build_assets.py && gzip -9 assets/heads.bin
# puis intégrer assets/heads.bin.gz en base64 dans le champ « bin » de heads.json
# module
npm install --no-save three facesjs esbuild
npx esbuild portraits/src/portraits.src.js --bundle --format=esm --minify --platform=browser --outfile=portraits/portraits.js
npx esbuild portraits/src/faces2d.src.js --bundle --format=esm --minify --platform=browser --define:global=globalThis --outfile=portraits/faces2d.js
```

## Licences

- Maillage de base, cibles morphologiques et yeux : **MakeHuman**, publiés sous **CC0 1.0** (domaine public) — https://github.com/makehumancommunity/makehuman
- **three.js** : licence MIT — https://github.com/mrdoob/three.js
- **facesjs** (dessins 2D) : licence Apache-2.0 — https://github.com/zengm-games/facesjs
- Peau, sourcils, barbe, cheveux, maillot et éclairage : procéduraux, écrits pour Football Agent.
