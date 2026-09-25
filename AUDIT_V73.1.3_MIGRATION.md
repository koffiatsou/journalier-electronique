# Audit V73.1.3 — migration legacy et intégration — 25 septembre 2026

## Base

- Source : package `journalier-electronique-main` fourni pour correction du bug de migration.
- Correction ciblée : `graphGetAppRoot is not defined` lors de l'ouverture de l'espace sécurisé.
- Architecture conservée : SPA GitHub Pages + Entra ID + Microsoft Graph + OneDrive AppFolder + IndexedDB/DataStore.

## Correction technique

- `src/v73/v73-migration.js` reste un module ES.
- Les dépendances auparavant recherchées dans le scope privé de `index.html` passent par `window.JournalierMigrationBridge`.
- Le bridge expose uniquement les fonctions nécessaires à la migration.
- `msAccount` est exposé par getter dynamique.
- Aucun accès Graph supplémentaire n'est ajouté.

## Migration

- Source legacy attendue : `AppFolder/Journalier-legacy`.
- Import vers : `AppFolder/Journalier`.
- `studentId` historique conservé.
- `ownerId` normalisé vers l'identité Entra courante.
- Validation/normalisation des élèves, séances et agenda.
- Conflits bloquants.
- Source legacy conservée.
- Aucune suppression distante.
- Les anciennes données PIA ne sont pas converties automatiquement en PIA annuel validé.

## CSP

Les trois scripts inline de `index.html` ont été recalculés après la modification du bridge.

Hashes actuels :

```text
sha256-r71q19ylX2SSs9dktu0dGYcJSzEwLh9Cq16Mm94MHL0=
sha256-cYvJqioownLez+GTZaWtubXH4lcoDBJ0hPqAe7Ct2pc=
sha256-2VXoqkGo/SnASYZTjVZiVP4KwV4Lw7ZSmqgOUESRh/I=
```

`unsafe-inline` reste absent de `script-src`.

## Validation à effectuer dans le Codespace

- `node --check src/v73/v73-migration.js`
- `git diff --check`
- `npm ci`
- `npm run build`
- contrôle exact des hashes CSP
- test navigateur sur GitHub Pages après déploiement
- test de migration avec une copie `Journalier-legacy`

## Limites

La validation fonctionnelle de la migration nécessite une copie réelle ou de test de l'ancien dossier. Tant que cette copie n'est pas fournie dans l'AppFolder, le bouton d'analyse doit indiquer qu'aucune copie legacy n'a été trouvée.

Cet audit ne constitue pas une certification de sécurité.
