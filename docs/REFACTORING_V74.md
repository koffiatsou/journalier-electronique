# Refactoring V74

Refactorisation structurelle conservatrice. Aucune fonctionnalité métier n’est volontairement modifiée dans ce chantier.

## Organisation
- `index.html` : structure HTML et points d’entrée uniquement.
- `src/styles/journalier.css` : styles extraits des blocs `<style>` inline.
- `src/app/indicators.js` : bibliothèque et diagnostic des indicateurs.
- `src/app/journalier-core.js` : cœur applicatif principal précédemment inline.
- `src/app/microsoft-core.js` : couche Microsoft Graph/OneDrive/SyncManager précédemment inline.
- `src/v74/v74-runtime.js` : runtime PIA.
- `src/v74/v74-migration.js` : migration legacy.
- `public/referentiel_pia_v74_0_3.json` : référentiel PIA actif.
- `docs/archive/` : historique, non chargé par l’application.

## Compatibilité
Les identifiants techniques `v72` du stockage IndexedDB et du registre de synchronisation sont conservés volontairement. Leur migration/purge fera l’objet d’un chantier séparé afin de ne pas modifier le comportement ni les données pendant ce refactoring.

## CSP
Les scripts applicatifs sont maintenant des fichiers externes servis par l’origine de l’application. Les hashes CSP des anciens scripts inline ont donc été retirés. `style-src 'unsafe-inline'` est conservé temporairement car l’interface utilise encore des attributs `style` dynamiques.
