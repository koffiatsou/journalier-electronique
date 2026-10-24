# Design

**Couleurs** : encre #1b2a41 · fond #f4f5f8 · bleu #2f5bd8 (pédagogique) · sarcelle #0f7a6e (ortho) · ambre #b36b00 (à préciser) · rouge (absence, erreur). Niveaux : Partiellement ambre clair, Suffisamment bleu clair, Totalement sarcelle clair — toujours accompagnés du mot, jamais la couleur seule. Mode sombre via variables.
**Typographie** : Instrument Sans, chiffres tabulaires pour dates et compteurs.
**Mouvement** : 140–280 ms, `cubic-bezier(0.23,1,0.32,1)`, appui `scale(.97)`, jamais `transition: all`, `prefers-reduced-motion` coupe tout.
**Interdits** : titres en petites majuscules espacées, cartes dans des cartes, dégradés sur texte, filets colorés d'un seul côté, emojis comme icônes.
**Composants** : zones ≥ 44 px, focus visible, `<dialog>` natif, icônes SVG dessinées.
**Téléphone d'abord** : aucune barre de défilement horizontale ; le panneau de feuille devient un tiroir.
Jetons : `src/ui/styles/tokens.css` (source de vérité).
