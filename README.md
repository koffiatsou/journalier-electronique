# Journalier électronique

Application web **local-first** pour les agents des Pôles territoriaux WBE : planifier, encoder les séances, tenir le Journalier, préparer les réunions et rédiger le PIA.

Les données d'élèves mineurs restent dans le navigateur (stockage chiffré) et peuvent être synchronisées vers l'espace OneDrive de l'utilisateur.

## Où est le code

Tout le code vit dans [`v2/`](v2/) (React + TypeScript). Pour travailler dessus, commencer par :

- [`v2/README.md`](v2/README.md) : principes, commandes (`npm run dev`, `npm run check`…), état d'avancement ;
- [`v2/AGENTS.md`](v2/AGENTS.md) : mémoire du projet et règles de travail ;
- [`v2/docs/plan-de-travail.md`](v2/docs/plan-de-travail.md) et [`v2/docs/etat-des-lieux.md`](v2/docs/etat-des-lieux.md) : lots faits et à faire.

Le site publié (GitHub Pages) est le dossier `v2/dist`, compilé par `.github/workflows/main.yml`.

## Ancienne version (V75)

La V75 a été retirée du dépôt le 11/11/2026. Elle reste consultable dans l'historique Git, à l'étiquette `v75-archive`.

Sécurité : voir [`SECURITY.md`](SECURITY.md). Licence : voir [`LICENSE`](LICENSE).
