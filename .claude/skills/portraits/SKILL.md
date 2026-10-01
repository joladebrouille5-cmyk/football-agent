---
name: portraits
description: Football Agent — travailler sur les portraits des joueurs (2D facesjs, 3D MakeHuman/three.js), les origines et noms des joueurs, ou ajouter une nationalité ou un championnat. À utiliser avant de modifier portraits/, NAME_POOLS, NAT_ORIGINS, LEAGUES ou CLUB_RAW.
---

# Portraits, nationalités et championnats — Football Agent

## Où sont les choses
- `football-agent-8-2-20.html` : le jeu (un seul fichier). Moteur entre `<script>` et le bloc `INTERFACE`.
  - Noms : `NAME_POOLS` (48 pays), `NAME_EXTRA` (réservoirs d'emprunt), `ORIGIN_NAMES` (origine → pays dont on emprunte les noms).
  - Origines : `NAT_ORIGINS` (pays → profils de population). **Doit rester identique** à `NAT_PROFILES` dans `portraits/src/genome.js` (test).
  - Identité d'un joueur : `pickOrigin`, `genName`, `uniqueName` (noms complets uniques dans le monde), `assignIdentity`.
  - Championnats : `LEAGUES` + `LEAGUES_V89` (champ `zone` : `europe` / `monde`), clubs `CLUB_RAW` + `CLUB_RAW_V89` (`[id, nom, court, ville, couleur1, couleur2, tier 1-5]`), montées/descentes `COUNTRY_PAIRS`, coupes `CUP_DEFS`, places européennes `EURO_QUALIFY_SLOTS` / `updateClubAndLeagueReputation`.
  - Parties en cours : `integrateMissingLeagues` (au chargement, même en cours de saison : calendrier resserré via `generateCatchUpFixtures`, coupes via `createCup` au prochain tour jouable) et `addMissingLeagues` (secours à l'intersaison). Un championnat qui n'a pas joué n'a ni titre, ni montée, ni place européenne (`leagueHasPlayed`) ; la Ligue des Champions est toujours complétée à 32 (`qualifyForEurope`).
  - Noms célèbres : `FAMOUS_PLAYERS` (liste d'exclusion, ~2 900 footballeurs connus) refusés par `uniqueName` ; `renameFamousPlayers` nettoie une fois les parties existantes (hors clients). À compléter quand un nouveau nom célèbre apparaît.
  - Grammaire : `inCountry` (« au Japon », « aux États-Unis ») et `ofCountry` (« loin du Japon ») — `NAT_GENDER` pour tout nouveau pays masculin ou pluriel.
  - Économie et affinités : `LEAGUE_WEALTH` (richesse d'un championnat, ex. Arabie saoudite ×3,5), `LEAGUE_ATTRACTION` (attrait d'un championnat pour les autres nationalités), `DREAM_PRESTIGE`.
  - Portraits dans l'interface : `portraitHTML`, `hydratePortraits`, `pumpPortraits` (clé de cache `v3:` / `v3-2d:` — à incrémenter si le rendu change).
- `portraits/` : modules chargés à la demande. `src/genome.js` (identité du visage, commun 2D/3D), `src/portraits.src.js` (3D), `src/faces2d.src.js` (2D), `src/build_assets.py` et `src/build_extras.py` (données MakeHuman).

## Règles
- Joueurs **100 % fictifs** : jamais de nom de footballeur célèbre dans les réservoirs (un prénom + un nom courants du pays), et `FAMOUS_PLAYERS` en filet de sécurité.
- Peau, nom et origine cohérents : un Sénégalais est d'origine ouest-africaine ; un Français peut être d'origine européenne, maghrébine, africaine…
- `PLAYER_SAVE_FIELDS` : toujours **ajouter en fin de liste**.
- Identifiants de clubs **uniques** dans tout `CLUB_RAW`. Codes de pays : éviter les collisions avec les identifiants de championnats (d'où `POL`, `SUI`, `KSA`).

## Ajouter une nationalité (check-list)
1. `NAME_POOLS[XX]` : 25 à 60 prénoms, 25 à 60 noms courants (pas de célébrités) ; `NAT_FLAG`, `NAT_NAME` sont générés à côté.
2. `NAT_ORIGINS[XX]` **et** `NAT_PROFILES[XX]` (genome.js), mêmes valeurs ; `ORIGIN_NAMES[XX]` si une origine porte des noms d'ailleurs.
3. `COUNTRY_AFFINITY[XX]` : affinités avec les pays qui ont un championnat (défaut 22, son propre pays 92) ; `NAT_GENDER` si le pays est masculin (« au ») ou pluriel (« aux ») ; `NAT_CONTINENT` pour l'écran de scouting.
4. La région de scouting et la liste de l'écran de création se génèrent seules.
5. `npm test` (le test « Chaque nationalité du jeu a sa répartition d'origines » échoue si une table est oubliée).

## Ajouter un championnat (check-list)
1. Entrée dans `LEAGUES_V89` (`id` unique, `nat`, `zone`) et clubs dans `CLUB_RAW_V89` (tiers réalistes : 3 pour un grand club local, 1 pour le bas de tableau).
2. Coupe dans `CUP_DEFS` (32, 16 ou 8 clubs selon la taille ; `underdogs` pour tirer au sort quelques petits clubs). Deuxième ou troisième division : `COUNTRY_PAIRS` (les paires s'enchaînent, ex. L1/L2 puis L2/L3 : `applyPromotionRelegation` fige tous les classements avant de déplacer les clubs). Division inférieure aux moyens réduits : `LOWER_DIVISION` (richesse, niveau des joueurs générés, réputation de départ, selon la division où joue le club).
3. Pays de rêve : `DREAM_PRESTIGE` ; attrait pour les étrangers : `LEAGUE_ATTRACTION` ; richesse : `LEAGUE_WEALTH`. Coupe d'Europe : automatique pour les championnats européens de première division.
4. `npm test` (dont « partie commencée avant les nouveaux championnats ») et une saison simulée : effectifs ≥ 15, pas de contrat expiré.

## Contrôler les visages
- Planche de 48 joueurs : `NODE_PATH=$(npm root -g) node tools/portrait-sheet.js 2d` (ou `3d 128 planche.png`). Regarder : cadrage (menton entier), peau cohérente avec le pays, variété des têtes, cheveux, barbes, artefacts.
- Reconstruire les modules (dépendances dans un dossier temporaire) :
  `npm install --no-save three facesjs esbuild` puis
  `npx esbuild portraits/src/portraits.src.js --bundle --format=esm --minify --platform=browser --outfile=portraits/portraits.js` et
  `npx esbuild portraits/src/faces2d.src.js --bundle --format=esm --minify --platform=browser --define:global=globalThis --outfile=portraits/faces2d.js`.
- Données 3D : voir l'en-tête de `portraits/src/build_assets.py` et `build_extras.py`.
- Tests : `npm test` puis `NODE_PATH=$(npm root -g) npm run test:e2e` (WebGL logiciel SwiftShader).

## Pistes non disponibles ici
- Modèles d'IA d'images (Hugging Face) : bloqués par la politique réseau de l'environnement ; il faut autoriser `huggingface.co` pour générer une banque de portraits photoréalistes (licence OpenRAIL/Apache-2.0 uniquement).
