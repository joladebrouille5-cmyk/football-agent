# football-agent
Football Agent - jeu de gestion et carrière d'agent de football

## Jouer

Ouvrir `football-agent-8-2-20.html` dans un navigateur récent. La partie est sauvegardée automatiquement dans le
navigateur (format compressé) ; l'export/import `.json` se fait depuis le menu « Sauvegarde ».

## Tests

```bash
npm test            # moteur de jeu (Node >= 18, sans dépendance)
npm install         # une fois, pour Playwright
npx playwright install chromium
npm run test:e2e    # parcours réel dans le navigateur, desktop et mobile 390×844
```
