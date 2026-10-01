# football-agent
Football Agent - jeu de gestion et carrière d'agent de football

## Jouer

Ouvrir `football-agent-8-2-20.html` dans un navigateur récent. La partie est sauvegardée automatiquement dans le
navigateur (format compressé) ; l'export/import `.json` se fait depuis le menu « Sauvegarde ».

Les portraits des joueurs (3D ou 2D, au choix dans « Paramètres ») viennent du dossier `portraits/` : servez le dossier entier (GitHub Pages ou un petit
serveur local, par exemple `npx serve .`) pour les voir ; en ouvrant le fichier seul, le jeu garde des silhouettes.
Détails et licences : [portraits/README.md](portraits/README.md).

## Application et parties

- **Plusieurs parties** : jusqu'à 3 emplacements dans le même navigateur (Paramètres → Parties).
- **Application installable** : servi en https (GitHub Pages), le jeu s'installe sur l'écran d'accueil et fonctionne
  hors connexion (`manifest.webmanifest`, `sw.js`, icônes). Dans la visionneuse claude.ai, seul le raccourci est possible.
- **Mode clair / sombre / auto** et page **Comment jouer** (menu Plus).

## Tests

```bash
npm test            # moteur de jeu (Node >= 18, sans dépendance)
npm install         # une fois, pour Playwright
npx playwright install chromium
npm run test:e2e    # parcours réel dans le navigateur, desktop et mobile 390×844
```
