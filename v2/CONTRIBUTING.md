# Contribuer

1. Une nouvelle branche par travail précis, créée depuis `main` à jour (`git switch main && git pull --ff-only && git switch -c v2/<nom>`), jamais de commit direct sur `main`.
2. `cd v2 && npm run check` doit être vert.
3. Un changement = un objectif ; ajouter ou mettre à jour un test si le moteur change.
4. Respecter DESIGN.md et le vocabulaire de AGENTS.md.
5. Noter toute décision durable dans `docs/decisions.md`.
6. PR décrite en français simple : quoi, pourquoi, comment vérifier.
7. Travail par lots : un lot par conversation, fin de lot décrite dans `docs/plan-de-travail.md`.
