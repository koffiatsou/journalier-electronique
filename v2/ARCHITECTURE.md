# Architecture

Application web sans serveur : tout tourne dans le navigateur. Le site publié est `v2/dist`.

## Dossiers de `src/`

- `domain/` : types et règles métier pures, sans dépendance au navigateur ni à React. Sous-dossiers par sujet (`redaction` : faits → bloc → contrôles, texte français déterministe ; `journalier`, `eleves`, `pia`, `reunion`, `agenda`, `accueil`, `export`, `referentiel`, `lexique`…). Deux sous-dossiers portent la sécurité :
  - `domain/coffre/` : chiffrement AES-GCM, clé non extractable, copie de secours protégée par mot de passe (PBKDF2).
  - `domain/synchro/` : format des fichiers envoyés à OneDrive, schémas zod, plan de synchronisation, empreintes, conflits.
- `data/` : interface `Depot` (IndexedDB chiffré par `depot-chiffre.ts`, mémoire pour les tests et le mode essai), migration depuis l'ancienne base, données d'essai fictives (`demo.ts`), référentiel de compétences (`data/referentiel/*.json`).
- `synchro/` : branchements avec Microsoft. `connexion.ts` (PKCE), `graph.ts` (OneDrive et Outlook via Microsoft Graph), `simule.ts` (faux OneDrive et faux Outlook du mode essai et des tests), `synchroniser.ts` (envoi et réception), `service.ts` (assemble le tout pour l'interface), `schemas-microsoft.ts` (validation des réponses).
- `state/` : store externe lu par React avec `useSyncExternalStore`.
- `features/<fonction>/` : une fonctionnalité = ses écrans et son brouillon (`accueil`, `agenda`, `eleves`, `journalier`, `pia`, `seance`, `synchro`, `verrou`).
- `ui/` : composants réutilisables et CSS (`ui/styles/`, jetons dans `tokens.css`).
- `app/` : coque, routage par hash (`useRoute.ts`), session. `retour-microsoft.ts` gère la page de retour de la connexion Microsoft.

## Règles

- Dépendances : `ui` ← `features` ← `app` ; `domain` ne dépend de rien.
- Toute donnée entrante (fichier, stockage, réponse Microsoft) est validée par zod avant usage.
- Aucun script ni gestionnaire d'événement en ligne : la CSP impose `script-src 'self'`.
- Le détail de la sécurité est dans `../SECURITY.md`.

## Outils et tests

- `tests/` : tests unitaires et d'intégration (`node --test` via tsx), avec un faux Microsoft (`fauxMicrosoft.ts`) et des données fictives (`fabrique.ts`).
- `tools/navigateur/` : parcours dans un vrai navigateur (Playwright, Chromium et WebKit), dont l'audit d'accessibilité ; `npm run navigateur` les rejoue tous.
- `tools/referentiel/` : outils de préparation du référentiel (voir son `README.md`).
- `scripts/` : compilation (`build.mjs`) et serveur de développement (`dev.mjs`).
