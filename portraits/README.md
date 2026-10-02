# Portraits des joueurs (photo ou 2D)

Chaque joueur fictif a un visage, gardé en image (en mémoire et dans IndexedDB `football_agent_portraits`, jamais dans la sauvegarde). Le réglage « Portraits » du jeu choisit le style :
**Photo** (visages photoréalistes, par défaut), **2D** (dessin vectoriel) ou **Aucun** (silhouettes). Procédures : `.claude/skills/portraits/SKILL.md`.

## Photo

- **Banque** : `photos.webp`, planche de visages fictifs générés par IA (lots de 40, prompts écrits pour Football Agent), une case de 128 px par visage, 12 cases par ligne. Les visages ressemblant à un vrai footballeur, les doublons et les ratés (lunettes…) ont été écartés.
- **Origines** : `PHOTO_FACES` (dans le jeu) donne, dans l'ordre de la planche, la ou les origines de chaque visage (`waf`, `naf`, `neu`, `seu`, `bal`, `mea`, `eas`, `lat`, `mix` — les mêmes que `NAT_ORIGINS`). Un joueur reçoit un visage de son origine (ou de l'origine principale de sa nationalité).
- **Déterministe** : identifiant du joueur → toujours le même visage. Plusieurs joueurs du monde partagent un visage ; chaque nouveau lot réduit les répétitions.
- **Repli** : si la planche ne se charge pas, la 2D prend le relais.

### Ajouter un lot
1. Découper chaque case de la planche reçue en carré centré sur le visage (128 px), écarter les ressemblances et les doublons.
2. Ajouter les cases à la suite dans `photos.webp` (WebP qualité ~82) et leurs origines à la suite dans `PHOTO_FACES`, dans le même ordre.
3. Mettre le nombre de visages dans le `?v=` de `PHOTO_SHEET` et changer `CACHE` dans `sw.js` ; la clé `ph1:` des portraits peut rester (l'index d'un visage existant ne change pas). Les joueurs de l'origine concernée peuvent changer de visage une fois (le choix dépend de la taille du groupe).

## 2D

- Module `faces2d.js` (facesjs inclus, minifié, ~110 Ko compressés), source `src/faces2d.src.js`.
- `src/genome.js` : id + nationalité + âge → traits du visage (table `NAT_PROFILES` des origines). Le même visage mûrit avec l'âge.

```sh
npm install --no-save facesjs esbuild
npx esbuild portraits/src/faces2d.src.js --bundle --format=esm --minify --platform=browser --define:global=globalThis --outfile=portraits/faces2d.js
```

## Licences

- **facesjs** (dessins 2D) : licence Apache-2.0 — https://github.com/zengm-games/facesjs
- Photos : images générées pour le projet ; personnes entièrement fictives.
