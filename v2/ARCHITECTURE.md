# Architecture

- `src/domain` : types et moteur de rédaction pur (faits → bloc → contrôles). Aucune dépendance UI. Texte français déterministe.
- `src/data` : interface `Depot` (IndexedDB, mémoire) ; coffre chiffré AES-GCM prévu.
- `src/state` : store externe (`useSyncExternalStore`).
- `src/features/<fonction>` : une fonctionnalité = ses écrans, son brouillon, ses tests.
- `src/ui` : composants réutilisables et CSS.
- `src/app` : coque, routage par hash.
Règle de dépendance : ui ← features ← app ; domain ne dépend de rien.
Données entrantes (import, stockage) validées par zod avant usage.
Tests : le moteur et les brouillons en priorité ; un parcours de bout en bout (Playwright) par grande fonction.
