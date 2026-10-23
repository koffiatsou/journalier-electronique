# Journalier V2 — mémoire du projet (à lire en premier)

Application web pour les agents des Pôles territoriaux (WBE) qui accompagnent des élèves intégrés. Propriétaire : non-développeur, francophone. V75 (`/`) reste intacte ; V2 vit dans `v2/`.

## Décisions validées (ne pas rediscuter sans demande)
- Pile : React 19 + TypeScript strict, esbuild, zod (schémas), tests `node:test`. Pas de Vite. CSS simple avec variables.
- Deux zones : pédagogique / orthopédagogique. Co-enseignement : pas de partie ortho, « Contenu vu en classe ».
- Observation : Partiellement / Suffisamment / Totalement. Effet d'une aide : Aucun effet / Effet partiel / Effet positif. Aucun niveau présélectionné ; seul le niveau choisi s'affiche, un toucher rouvre les trois.
- Présences dont « Agent du pôle absent ». Un seul bouton d'export. Vocabulaire simple, « l'élève » neutre.
- Historique et Word : aides regroupées par effet, en puces (« • Effet positif : … »).
- Disposition de l'étape Fonctionnement : **option A** (puces avec niveau) + panneau « Déjà renseigné / À renseigner » à droite ; sur téléphone, tiroir en bas.
- Design : « Bleu encre », bleu = pédagogique, sarcelle = ortho, ambre = à préciser, rouge = absence/erreur. Mouvement 140–280 ms, ease-out, pas de `transition: all`, mouvement réduit respecté.

## Règles de travail
- Jamais de push sur `main` (déploie GitHub Pages) : branche + PR, l'utilisateur fusionne.
- `npm run check` (typecheck + tests + build) doit passer avant tout commit.
- Pas de `innerHTML`, pas de script inline (CSP stricte). Le moteur de rédaction est pur et testé.
- Réponses à l'utilisateur en français, simples, sans jargon.

## Où trouver quoi
PRODUCT.md (qui, pourquoi) · DESIGN.md (look & mouvement) · ARCHITECTURE.md · SECURITY.md · CONTRIBUTING.md · docs/decisions.md (journal) · README.md (commandes, avancement).
- Composant unique `Point` (src/ui/Point.tsx) pour toute question à niveau (observations, compétences, aides) ; ne pas recréer de variante.
