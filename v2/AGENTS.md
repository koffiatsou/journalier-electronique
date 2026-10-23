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
- Tout est facultatif : on ne note que ce qui a été observé (pas de liste « à renseigner »). Panneau Feuille = texte en puces + rappel de la dernière séance ; tiroir sur petit écran.
- Vocabulaire : à l'écran, seul le mot « aide » (plus de « médiation » à la saisie). La nature (adaptation / médiation) est déduite du nom de l'aide (`natureAide`, domain/types.ts) et n'apparaît que dans les documents Word/PIA : blocs « Adaptations mises en place » et « Médiations mises en place », aides inconnues sous « Autres aides ». Statut des aides : Déjà en place / Nouvelles / Piste pour plus tard.
- Suite : « Laisser plus d'autonomie », « Format de la prochaine séance », « Mettre une stratégie en commun » (validé).
- Transfert : plus d'étape à part (5 étapes). Question facultative « Utilisé ailleurs que pendant la séance ? » (Oui / Pas encore / Pas observé) en fin d'étape « Ce qui a aidé » ; ligne dans le document seulement pour Oui et Pas encore.

## Référentiel / étape « Compétence travaillée » (en cours, rien d'intégré dans l'app)
- Principe : Q2 (Fonctionnement) = transversal ; Q3 (Compétence) = contenu disciplinaire précis tiré des référentiels, sans doublon avec Q2. Nom de l'étape inchangé (« Compétence travaillée », au sens large : savoirs + savoir-faire + compétences ; ces mots techniques ne s'affichent pas).
- Source de vérité : PDF officiels FWB du zip de l'utilisateur (les plus récents par matière). 2022 = tronc commun P1–S3 ; 2014/2017 = S4–S6 (pas encore traités). Matières prioritaires : maths, français, néerlandais.
- Moteur voulu : filtre par matière (+ langue du dossier de l'élève) + niveau + mots de l'objectif de la leçon → 4 pistes, reste sur demande, texte libre toujours possible, rien si objectif vague. Ancien moteur V75 : src/app/sessions-core.js (scoreLearningIndicator) + public/bibliotheque_indicateurs_v0_5_1.json (à ne pas reprendre tel quel).
- Extraction fiable : pdfplumber `find_tables()` (le texte brut mélange les 2 colonnes). Résultats provisoires (hors dépôt) : maths 1250, français 1695, langues modernes 406 (tableaux), néerlandais grammaire 119. À valider avec l'utilisateur avant intégration.
- Secondaire supérieur (S4–S6, fichiers 2014/2017) : structure différente du tronc commun. Maths HGT (41 UAA, 412 éléments) et maths qualifiant (19 UAA, 286) extraits (provisoire). Français HGT/HPT = « unités » par degré (U0 Justifier/expliciter, U1 Rechercher l'info, U2 Résumer, U3-U4 Défendre une opinion) : extraction partielle ; ATTENTION doublon avec Q2 (U0 = « identifier et comprendre les consignes »). Langues 2017 = niveaux CECRL A1–B2 + tableau grammaire néerlandais par niveau (non extrait). Sciences à ajouter ensuite.
