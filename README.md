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
- **Avancer par semaine ou par mois** : petit bouton à droite du gros bouton (ou Paramètres → Avancer le temps).
  Par semaine, chaque appui joue les journées de championnat de la semaine (`advanceWeek`) ; la 4e semaine boucle le
  mois (finances, mercato) comme « mois suivant ». Les sélections jouent en semaine 1, la Ligue des Champions en semaine 2,
  les coupes en semaine 3 (`runMonthComp`, une seule fois par mois) ; l'intersaison passe d'un coup.
- **Avancer jusqu'à…** (même petit bouton) : prochain match de vos joueurs, prochain mercato, saison suivante.
- **Calendrier** de vos joueurs (tableau de bord et fiche joueur) et **match en direct** à revivre minute par minute.
- **Mode clair / sombre / auto** et page **Comment jouer** (menu Plus).
- **Langues** : français (par défaut), anglais et espagnol (Paramètres → Langue). Le jeu est écrit en français ;
  à l'affichage, chaque texte est traduit grâce au dictionnaire `I18N_ROWS` ([français, anglais, espagnol], avec des
  gabarits « {} » pour les parties variables). Tout nouveau texte du jeu doit y recevoir sa ligne ;
  `tests/i18n.test.js` vérifie la cohérence du dictionnaire.

## Tests

```bash
npm test            # moteur de jeu (Node >= 18, sans dépendance)
npm install         # une fois, pour Playwright
npx playwright install chromium
npm run test:e2e    # parcours réel dans le navigateur, desktop et mobile 390×844
```
