# football-agent
Football Agent - jeu de gestion et carrière d'agent de football

## Jouer

Ouvrir `football-agent-8-2-20.html` dans un navigateur récent. La partie est sauvegardée automatiquement dans le
navigateur (format compressé) ; l'export/import `.json` se fait depuis le menu « Sauvegarde ».

**Publier (site)** : toujours la version protégée. `npm install` puis `npm run build` produit `dist/`, le **site complet** : `index.html` (le jeu protégé), `manifest.webmanifest`, `sw.js` (hors connexion), icônes, `portraits/`, `confidentialite.html`, `_headers` (sécurité) et `_redirects`. Le fichier source lisible reste dans le dépôt privé.

**En ligne : https://play.footagent.workers.dev** (projet Cloudflare « play », voir `wrangler.jsonc`).

**Héberger sur Cloudflare Pages** (gratuit, dépôt privé accepté, mise en ligne automatique à chaque fusion sur `main`) : Workers & Pages → Create → Pages → *Connect to Git* → `football-agent` ; *Framework preset* : None ; *Build command* : `npm run build` ; *Build output directory* : `dist` ; variable d'environnement `PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD` = `1`. Node 22 est fixé par `.node-version`. Netlify fonctionne de la même façon (mêmes `_headers` et `_redirects`).

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
- **8.41** : président à plein temps (fermer l'agence : clients libérés, plus de loyer ni de personnel, réouverture possible) ; propriétaire — recruter au nom du club depuis la fiche d'un joueur (prix du vendeur, accord du joueur, niveau exigé), entraîneur (qualité et style, effet sur l'équipe, indemnités), sponsor maillot (3 offres par saison), comptes du mois, prolonger ses joueurs, lancer un jeune ; réglage « Scores à découvrir » (résultats de vos matchs masqués jusqu'à les regarder en direct) ; clubs intéressés classés par pertinence ; rôle dans l'équipe (titulaire, rotation, remplaçant) ; reconversion des clients retraités (jubilé, consultant télé, entraîneur de votre club).
- **8.42** : Panthéon cliquable (fiche complète de chaque carrière : chiffres, clubs, meilleurs clients) ; 8 avantages de départ à débloquer par des objectifs plus ou moins difficiles, un seul activable par partie ; fiche détaillée des offres reçues (indemnité, salaire et sa progression, commission estimée, avis du joueur — veut y aller, hésite ou préfère rester — et position de son club) avec possibilité de négocier une contre-proposition.
- **8.40** (retour de testeur) : intérêt des clubs plus réaliste — aucun intérêt spontané (liste « Clubs intéressés », offres reçues, recruteurs, événements) tant qu'un joueur n'a pas montré quelque chose sur le terrain, ni dans les 6 mois qui suivent son arrivée dans un club ; démarcher un club ou chercher un prêt reste possible. « Recruteur en tribune » sur environ un match sur cinq au lieu de chaque journée.
- **8.39** (retours de testeurs) : attributs sur 100 ; recrutement cohérent — un club ne signe que des joueurs au niveau de son effectif (plancher = son 18e joueur, aussi pour les clauses libératoires, les libres, l'IA et les rivaux) ; potentiels plus rares (jeunes à 85+ : 19 % → 4 %) ; potentiel évolutif (saison pleine et bonnes notes = hausse, saison blanche ou grave blessure = baisse). Sur 20 saisons, le niveau du monde reste stable au lieu de s'envoler.
- **8.38** (retours de Will) : suivre n'importe quel joueur (☆ Suivre sur sa fiche, 30 au plus) — onglet « Suivis » dans Mes joueurs, filtre « Suivis » dans les actualités, leurs transferts et blessures font l'actualité ; vue rapide « Attributs » (ATT, DÉF, TEC, MEN, PHY, VIT) à côté des performances sur les cartes.
- **8.37** : 479 nouveaux visages photo (1 029 au total) ; fenêtre « Quoi de neuf ? » après chaque mise à jour (une fois, pour les joueurs qui ont déjà une partie) et « Nouveautés » dans les Paramètres — chaque version ajoute son entrée à `CHANGELOG` (vérifié par les tests).
- **8.36** : « Mentions et confidentialité » s'ouvre de nouveau sur le site (le service worker cassait la redirection de l'hébergeur, aussi pour l'ancienne adresse index.html) ; libellé de spécialité traduit à la création.
- **8.35** : 113 nouveaux visages photo (550 au total), joueurs métis et d'Amérique latine (Amérique du Sud, Mexique, Amérique centrale, Caraïbes).
- **8.34** : 143 nouveaux visages photo (437 au total) — Maghreb et Moyen-Orient, Europe du Sud et Amérique latine, Asie de l'Est et joueurs métis, vétérans de 30 à 37 ans ; les visages trop proches de vrais joueurs ont été écartés.
- **8.33** : guide du jeu en 7 étapes à la première carrière (le métier, le temps, les clients, la négociation à plusieurs, le recrutement, l'agence, le premier pas), à revoir depuis l'accueil, les Paramètres et « Comment jouer ».
- **8.32** : vraie négociation à plusieurs — le joueur (salaire espéré, rôle, projet sportif, pays rêvé), le club qui paie (salaire juste, plafond, durée, commission) et, pour un transfert, le club vendeur (prix demandé selon contrat restant et statut) doivent tous dire oui ; indemnité de transfert négociable, carte et demandes de chaque partie, quatre tours de patience avant rupture et compromis qui satisfait tout le monde. Les discussions ne remplissent plus l'histoire du joueur.
- **8.31** : hauts faits de nouveau alignés ; confiance du client enfin vivante — elle suit son moral et votre réputation, monte avec transferts (surtout vers plus huppé), prolongations et promesses tenues, baisse s'il reste sans club ou si une négociation échoue ; elle compte en négociation et contre le débauchage des rivaux. Relation avec le club et confiance expliquées sur la fiche, avec leurs dernières variations.
- **8.30** (réalisme) : les petits championnats comptent surtout des joueurs du pays, et leurs étrangers viennent de la même région (Maliens et Guinéens au Sénégal, Équatoriens en Colombie, Scandinaves en Suède) ; parties existantes corrigées une fois (jamais les clients). Un club plus huppé ne s'intéresse qu'à un joueur qui a déjà le niveau ou qui le prouve (notes de match, sélection) ; un petit championnat est moins scruté.
- **8.29** : 24 petits championnats à travers le monde (Suède, Norvège, Pologne, Croatie, Serbie, Ukraine, Tchéquie, Irlande, Maroc, Égypte, Algérie, Tunisie, Sénégal, Nigeria, Ghana, Côte d'Ivoire, Mexique, Colombie, Chili, Uruguay, Équateur, Corée du Sud, Australie, Canada) avec leurs coupes — 50 championnats, sélecteur groupé par continent. Personnel utile (effets chiffrés, vrai salaire par poste, 5 au plus par poste, départ possible ; les analystes signalent des pépites) et spécialités aux effets réels, affichés au choix et dans « Effets actuels ». Économie : commission plafonnée à 15 % et dégressive au-delà de 20 M€ d'indemnité, impôt à 70 % au-delà de 30 M€. Audit 8.28 : polices hébergées (plus de Google Fonts), aperçu de partage (image + description), zoom autorisé, gardiens garantis pour l'IA, module 2D versionné, accès clavier, CI à jour.
- **8.28** : l'application installée reçoit les mises à jour : vérification à chaque retour au premier plan et toutes les 30 min ; mise à jour immédiate quand c'est sans risque (en arrière-plan, accueil), sinon bandeau « Mettre à jour » (partie sauvegardée avant rechargement). Version affichée dans les Paramètres. Testé par `npm run test:release` (service worker réel en https local).
- **8.27** : crédits (« Une création de Florian Deconinck », depuis l'accueil et les Paramètres) et œuf de Pâques : toucher 5 fois le nom dans les crédits ou 7 fois le blason de l'accueil (blason doré, haut fait honorifique « Œuf de Pâques ») ; un agent nommé Florian Deconinck est accueilli spécialement. Correctifs : un joueur intransférable n'est plus prêté ni libéré en fin de contrat ; plus de sélection nationale sans gardien. Statistiques de visites (Cloudflare Web Analytics, sans cookie) sur le site.
- **8.26** : site. `npm run build` produit un site complet prêt à héberger (page d'accueil = jeu protégé, application installable et hors connexion, page « Mentions et confidentialité » accessible depuis les Paramètres, en-têtes de sécurité, redirection des anciennes adresses). Testé par `npm run test:release`.
- **8.25** : protection. Sauvegardes signées (une sauvegarde ou un fichier exporté modifié à la main est détecté : « Partie modifiée », plus de Panthéon ni de records). Version publiée protégée (`npm run build` → `dist/`) : code obfusqué et enfermé (l'état de la partie est inaccessible depuis la console), protection contre le débogueur et contre le reformatage, empreinte du code (une copie modifiée de la page se sait modifiée et ses sauvegardes sont refusées par le vrai jeu). Testé par `npm run test:release` (partie jouée par l'interface + attaques : console, sauvegarde modifiée, signature retirée, copie modifiée avec sonde, lecture du code usurpée).
- **8.24** (audit 8.23 + chasse aux tricheries) : la liste « Clubs intéressés », la recherche de clubs et le démarchage respectent le niveau exigé par le club ; prêt : tri qui tient compte des refus ; clause libératoire activée par un club qui veut vraiment le joueur. Triches corrigées, trouvées par un joueur automatique sur 10 saisons (`tools/cheat-bot.js`) : clause de revente de l'agent sur son propre client (rien avant un an, 5 % au plus), salaire gonflé repris par un nouveau club, offres de club qui faisaient grimper le salaire, prêt d'un titulaire en boucle.
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
