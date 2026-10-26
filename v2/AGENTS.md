# Journalier V2 — mémoire du projet (à lire en premier)

> État d’avancement : `docs/etat-des-lieux.md` · **Liste des lots : `docs/plan-de-travail.md`**.

## Méthode : un lot = une conversation
- Au démarrage d'une conversation : lire ce fichier, `docs/plan-de-travail.md` et `docs/etat-des-lieux.md`, puis ne traiter QUE le lot demandé (ou le lot « 🔜 conseillé » si l'utilisateur dit « lot suivant »). Ne pas relire tout le dépôt : ouvrir seulement les fichiers du lot.
- Toute idée hors lot va dans « Idées en attente » du plan, pas dans le code.
- Fin de lot obligatoire (liste dans le plan) : vérifs vertes, docs à jour (état des lieux, plan, AGENTS, decisions, README), commit + push sur `v2/react-ts`, message final en français simple avec le lot suivant conseillé.

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
- Prototype moteur (Python, hors dépôt : /home/claude/referentiels-extraits/prototype_moteur.py) validé sur ~21 objectifs réels de maths (journaux Séfora S1 / Nicoleta S3) : normalisation sans accents, racine à 6 lettres, poids IDF, bonus niveau (même année 1.0, ±1 an 0.8-0.85, sinon 0.4-0.6), table d'alias de terrain (« règle des signes », « SOHCAHTOA »…), mots administratifs ignorés (révisions, interro…), 1 piste par intitulé, seuil 60 % du meilleur score. À porter en TypeScript (domain/referentiel) avec tests. Journaux réels = ~1/3 sciences et économie/droit : référentiels Sciences (2022) et Sciences économiques (zip) à traiter ensuite.

## Référentiel de compétences (moteur de pistes) — NON FINALISÉ, voir docs/etat-des-lieux.md
- Données : `src/data/referentiel/*.json` (maths, français, langues modernes, sciences, sciences économiques — tronc commun 2022 + compétences terminales du secondaire supérieur 2014/2017/2000 ; un référentiel de degré = `n` à `nf`), générées par `tools/referentiel/` depuis les PDF officiels. Chargées à la demande (esbuild `splitting`).
- Moteur : `src/domain/referentiel/` (normalisation, alias de terrain, poids IDF, facteur d'année, forme G/TTR/TQ/P, langue du dossier, anti-doublon avec Q2). 4 pistes max, « Voir d'autres pistes » = 8, rien si objectif vague, saisie libre toujours possible.
- Limites connues : langues du secondaire supérieur = niveaux du CECRL (pas d'année), grammaire par langue extraite des annexes (heuristique) ; sciences/éco du secondaire supérieur = compétences d'unité (peu fines) ; histoire-géographie, technique, droit détaillé non faits. Anglais/allemand du tronc commun absents.
- Niveau, niveau d’étude (primaire, secondaire général, technique transition/qualification, professionnel, CEFA ; CEFA → forme P) et langues : champs optionnels de `Eleve` (préremplissent la séance, modifiables) ; la vue Élèves (features/eleves) les saisit.

## Élèves (lot 2)
- `src/domain/eleves/` (pur, testé dans `tests/eleves.test.ts`) : `languesDe` / `normaliserEleve` (l'ancien champ `langue` devient `langues` au chargement ET à l'enregistrement), `archiver` / `reactiver` / `elevesProposes`, `effetSuppression`, `rechercherEleves` (accents ignorés, tous les mots), `initiales`, `bilanSeances`, passage d'année (`planPassage`, `appliquerPassage`, `classeSuivante`, `niveauSuivant`).
- `Eleve.archiveLe` (AAAA-MM-JJ) = archivé : retiré des choix de séance et d'agenda (`elevesProposes` garde l'élève déjà choisi), séances conservées et exportables. `Eleve.anneeDossier` = année scolaire pour laquelle classe/titulaire sont à jour (posée par le passage d'année).
- Suppression d'un élève : `magasin.supprimerEleve(id)` → `depot.supprimerEleve(id)` supprime élève + séances + activités d'agenda dans UNE transaction (IndexedDB) ; ne jamais supprimer un élève par un autre chemin (séances orphelines).
- Passage d'année : jamais appliqué sans validation ; dossier sans `anneeDossier` ou déjà à jour = « Ne pas changer » par défaut ; titulaire effacé par défaut ; les séances ne sont jamais modifiées.
- Langues : `LANGUES_MODERNES` ; les langues du dossier sont proposées comme matières (séance, agenda) ; `cibleDeSeance(matière, langues)` choisit le jeu du référentiel (plusieurs langues + « Langues modernes » = ambigu → message).
- Écran : `ElevesPage` (liste en cartes, dossier, fiche, passage), `FicheEleve`, `PassageAnnee` ; `src/ui/Avatar.tsx` = pastille ronde (avatar dessiné, sinon initiales) ; styles dans `eleves.css`. Journalier : `rechercherSeances` (la recherche ne restreint jamais l'export).
- Avatars (lot 2b) : `Eleve.avatar` = `AvatarEleve` (style + 5 rangs : teint, cheveux, coiffure, visage, accessoire) ; JAMAIS de photo ni d'image stockée. `src/domain/avatar/` (pur, testé dans `tests/avatar.test.ts`) : `dessiner(avatar)` → liste de formes SVG (viewBox 64), `normaliserAvatar` (relit le stockage : style inconnu = pas d'avatar, option illisible = première valeur ; appelé par `normaliserEleve`), `avatarAuHasard`. Rendu : `src/ui/AvatarDessin.tsx` (éléments SVG, jamais d'`innerHTML` ni de style en ligne : la CSP interdit `style-src` hors fichier ; couleurs `fond`/`haut` = classes `av-fond`/`av-haut` sur `--c-fond`/`--c-bord`). Sélecteur : `features/eleves/ChoixAvatar.tsx` (dans `FicheEleve`). Pour ajouter une option (coiffure, accessoire…) : l'ajouter dans `types.ts` (libellés) et `dessin.ts` (vectoriel ET pixel) ; les tests refusent une option sans effet visible ou hors de la zone 64 × 64.
- Teint le plus foncé : yeux et bouche en traits clairs (`encreDe`), sinon illisibles.
- Tests navigateur : `tools/navigateur/eleves.mjs`, `avatars.mjs` (vérifie aussi le contenu réel d'IndexedDB). Dans les parcours, utiliser `getByLabel(..., { exact: true })` : des `aria-label` de fenêtres cachées contiennent « élève ».

## Réunion (lot 3)
- `src/domain/reunion/` (pur, testé dans `tests/reunion.test.ts`) : `proposerObjectifs(synthese)` → `Proposition[]` (id stable matière|genre|texte d'origine ; au plus 3 observations, 2 compétences, 2 aides à garder, 1 à revoir par matière ; le DERNIER niveau noté décide : « Totalement » = rien à proposer) ; `retenir` / `retirer` / `reecrire` / `ajouterLibre` / `retenusParMatiere` ; `texteReunion` (texte brut en puces ; « sans nom » = `masquer` + `deIdentifier`, l'en-tête est ajouté APRÈS le masquage).
- La synthèse (`redaction/synthese.ts`) garde aussi `suivis` (niveaux par date, effets des aides, niveau des compétences) : les propositions s'appuient dessus, jamais sur les phrases. Une séance d'absence ne compte pas.
- Écran : `src/features/pia/Preparer.tsx` (onglet « Préparer » du PIA), styles `reunion.css` (classes `reunion-*`, zone ortho = sarcelle). Ancienne route `#/reunion?eleve=<id>` → `#/pia?eleve=<id>&onglet=preparer`. `construirePeriode` (domain/journalier) est partagé avec le Journalier.
- Objectifs retenus : enregistrés dans le PIA (`Pia.retenus`, lot 4a). Cadrage du PIA (profil, PV 1 / PV 2, aménagements P/O/M) : voir « Cadrage du PIA » dans `docs/plan-de-travail.md`.
- Test navigateur : `tools/navigateur/pia.mjs` (séances injectées dans IndexedDB). Avec des élèves fictifs (prénom « Élève »), le masquage de noms peut tout remplacer : ne pas s'en inquiéter.

## Journalier (écran, lot 1)
- `src/domain/journalier/` (pur, testé) : `Periode` = année scolaire (1er août → 31 juillet, même découpage que `anneeScolaire`) / état à ce jour / dates libres ; `bornes`, `seancesDuJournalier` (élève ou tous, plus récentes d'abord), `libellePeriode` (version fichier sans « / »).
- `src/features/journalier/JournalierPage.tsx` : seul endroit avec le bouton d'export Word (l'écran Élèves renvoie vers lui : `#/journalier?eleve=<id>`). Tous les élèves → un .docx par élève dans un .zip (`construireJournaliers`) ; dé-identifié → noms distincts par classe. Noms d'entrées zip en UTF-8 (bit 11).
- Modifier une séance : `magasin.preparerSeance(seance complète)` puis `#/seance` ; l'écran Séance reconnaît une séance existante (même id), titre « Modifier la séance du … », retour au Journalier après enregistrement.
- Routes : `useRoute` renvoie `[page, aller, parametres]` ; `aller(page, { clé: valeur })`.
- Vérification navigateur : `tools/navigateur/*.mjs` (Playwright hors dépendances, `LANG=C.UTF-8` pour les noms de fichiers accentués).

- CSS : `.grille` = grille de l'agenda uniquement (cadre arrondi qui coupe le débordement). Les rangées de champs de formulaire s'appellent `.champs .champs-2/-3`. Éviter les noms de classe génériques partagés entre écrans.

## Agenda V2
- Domaine pur dans `src/domain/agenda/` (dates, couleurs, planning : occurrences, disposer, déplacer/redimensionner/dupliquer/annuler/éditer/supprimer renvoient un `Changement`). Stockage : IndexedDB version 2, magasin `activites` ; `magasin.changerAgenda(changement)`.
- Une activité = date + périodes (index 0–7) + répétition hebdomadaire ; modifier « cette date » détache une occurrence (exceptions de la série). Réalisé = séance du même élève sur le créneau (calculé), sinon état manuel.
- Couleurs : `Eleve.couleur` (0–9) sinon déduite de l'identifiant ; classes CSS `.c-0…c-9` et `.t-<type>` (agenda.css, clair/sombre via color-mix).
- « Encoder » : `magasin.preparerSeance(partiel)` puis hash `/seance` (consommé à l'ouverture).

## PIA (lot 4a)
- `src/domain/pia/` (pur, testé : `tests/pia.test.ts`, `tests/export-pia.test.ts`) : `types.ts` (Pia, Profil 5 aspects × 3 colonnes, IdentitePia, ProcesVerbal1, Amenagement P/O/M), `pia.ts` (`piaVierge`, `normaliserPia`, modificateurs purs), `indices.ts` (exemples, phrases cliquables, `rapprocher(seances)` : Cognitif, Autonomie, Comportemental seulement, ≥ 2 séances, 3 max par case), `amenagements.ts` (`proposerAmenagements`, `TYPE_DE_AIDE`). Id d'un PIA = `eleveId|année`.
- Rien n'est jamais rempli automatiquement dans le profil : les indices se cochent / se cliquent, l'agent garde la main. Textes des indices et correspondance aide → P/O/M = propositions de départ, à relire avec l'utilisateur.
- Stockage : IndexedDB version 3, magasin `pia` ; `magasin.enregistrerPia(p)` (affichage immédiat, écriture après 400 ms, file en série) et `magasin.viderEnregistrements()` (changement d'écran, `pagehide`, export). `supprimerEleve` supprime aussi les PIA et annule les écritures en attente.
- Écran : `src/features/pia/PiaPage.tsx` (route `#/pia?eleve=…&annee=…&onglet=preparer|identite|profil|pv1|amenagements`, flèches du clavier entre onglets), un composant par onglet, styles `pia.css` (classes `pia-*`). `changer(modif)` applique la modification au PIA le plus récent du magasin.
- Export : `src/domain/export/pia.ts` modifie le XML du modèle `public/modeles/PIA_modele_officiel_2025-09-11.docx` (structure : `docs/PIA_MODELE_STRUCTURE.md` à la racine) sans le reconstruire ; erreur « Le modèle PIA est inattendu » si les libellés changent. PV 2 (tableaux T6–T8) laissé intact : lot 4b.
- Test navigateur : `tools/navigateur/pia.mjs` (`PLAYWRIGHT=<chemin>/playwright/index.mjs` si besoin).
