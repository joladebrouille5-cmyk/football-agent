# football-agent
Football Agent - jeu de gestion et carrière d'agent de football

## Jouer

Ouvrir `football-agent-8-2-20.html` dans un navigateur récent. La partie est sauvegardée automatiquement dans le
navigateur (format compressé) ; l'export/import `.json` se fait depuis le menu « Sauvegarde ».

Les portraits des joueurs (photo ou 2D, au choix dans « Paramètres ») viennent du dossier `portraits/` : servez le dossier entier (GitHub Pages ou un petit
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
- **8.18, plus léger et plus vivant** : 9 pages (Messages = conversations + négociations, Finances dans l'Agence,
  Clubs dans le Monde, nouvelle page Carrière : objectifs, ennemi juré, hauts faits, classement, Panthéon) ; actualités
  « Mon agence » par défaut ; Marché « Recommandés pour vous » ; parts de clubs débloquées au rang « Agent international ».
  Moments forts : dernier jour du mercato (offres de dernière minute), cérémonie de fin de saison, jalons des joueurs
  (`checkMilestones`), enjeu des matchs à venir, confettis. Profondeur : pépites rares au scouting, ennemi juré,
  histoire de chaque client (`p.story`), Panthéon des carrières avec héritage, scénarios de départ (`SCENARIOS`).
- **8.23** (audit 8.22) : un joueur libre ou un jeune est jugé sur son niveau par le club acheteur (un libre noté 57 ne signe plus au PSG ; un jeune passe s'il est une vraie pépite) ; l'intérêt du club pèse dans la négociation ; hors mercato, le choix du club se prépare sans négocier ; pas de démarchage juste après un transfert ; choix du club aussi pour les prêts. À savoir : depuis la 8.21, chaque joueur garde son visage photo pour toujours (les joueurs affichés avant la 8.21 en ont changé une fois).
- **8.22** : choisir soi-même le club d'un client : liste de tous les clubs avec temps de jeu, indemnité estimée face au budget, intérêt du club, pays rêvé, pas en avant ou en arrière, avis du club et du client ; recherche, filtre par pays, tris ; négociation ou démarchage (« Proposer ») de n'importe quel club à portée, directement depuis la liste.
- **8.21** : les visages 3D sont remplacés par une banque de visages photoréalistes fictifs (294 depuis le lot 7 : jeunes) (`portraits/photos.webp`), choisis selon l'origine de chaque joueur ; la 2D et les silhouettes restent au choix.
- **8.20** : la page de démarrage s'affiche à chaque lancement (bouton « Continuer », « Menu principal » dans Plus et Réglages) ; nationalités triées selon la langue ; chaque scénario a un objectif suivi, une échéance et une fin (victoire au Panthéon, mode difficile débloqué) ; Amiens, Zéro et Brésil refondus ; 8 nouveaux scénarios (héritier, pépite, chute, dernier jour du mercato, filière africaine, ennemi juré, président malgré lui, carrière express).
- **8.19** : page de démarrage (reprendre, nouvelle carrière, scénario avec difficulté, langue) ; la fenêtre de message
  dit qui écrit (client, directeur sportif, club, presse, fédération, réseau, marque, agent rival — `EVENT_FROM`) et de
  qui on parle ; plus d'onglet Conversations (les échanges restent dans l'histoire du joueur et sur la carte de
  l'ennemi juré) ; « Relancer Amiens » à crédit (`agent.loan`) ; ennemi juré déclaré dès la 1re saison.
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
