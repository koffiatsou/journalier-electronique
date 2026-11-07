# Démarrage : audit, lots 5 et 6 (cohérence, puis fonctionnel) et chantier « importer un PIA »

> Fichier de passage entre deux conversations. À lire en entier avant de toucher au code. Rédigé le 7 novembre 2026, à la fin du lot 2. **À lancer après les lots 3 et 4** (`docs/demarrage-lots-3-4.md`) : l'environnement, la méthode et les pièges Windows y sont décrits une fois pour toutes ; **les relire**.

## Texte à coller pour démarrer la nouvelle conversation

```
Lis v2/AGENTS.md, puis v2/docs/demarrage-lots-3-4.md (section « Environnement Windows » et « Outils de vérification »), puis v2/docs/demarrage-lots-5-6.md en entier, puis v2/docs/plan-de-travail.md (section « Audit du 6-7 novembre 2026 »).
Reprends l'audit du Journalier : lots 5 puis 6, sur la branche locale v2/audit-lot1-donnees, sans jamais pousser sur GitHub.
Avant de coder, pose-moi les trois décisions listées en tête du lot 5. Annonce ton plan en quelques lignes, puis travaille en petits lots testés (un sujet par modification).
```

## Où en est-on (à vérifier avec `git log --oneline -8` : d'autres commits des lots 3 et 4 doivent s'y trouver)

- Branche locale **`v2/audit-lot1-donnees`**. Commits locaux, **jamais poussés** : lot 1 (`8aeff23`, protéger les données), lot 2 (`ae68827`, défilement natif), lot 2b (gestes tactiles et position au retour), puis les lots 3 et 4 s'ils sont faits.
- **Rien n'est poussé ni fusionné sans l'accord explicite de l'utilisateur** (la fusion vers `main` publie le site).
- Méthode : tout en local, l'utilisateur essaie dans le volet navigateur (serveur `journalier-v2`, `.claude/launch.json`), puis décide.
- À chaque lot : écrire le parcours navigateur d'abord (il doit **échouer avant**), corriger, `npm run check`, tous les parcours, documentation à jour, commit local, message en français simple (ce qu'il peut essayer, ce qui n'est pas vérifié, ce qu'il doit décider).

## Décisions déjà prises (ne pas rediscuter)

- Pas de Lenis, pas de GSAP ScrollTrigger.
- **Filets d'un seul côté colorés : voulus par l'utilisateur** (c'est une demande explicite de sa part).
- Export Word : jamais d'erreur vue en conditions réelles ; le toast d'erreur reste une amélioration mineure.
- **Il n'existe plus de réinitialisation du PIA** et l'utilisateur pense que c'est normal (« il n'y a pas de brouillon qui se sauvegarde » : en réalité le PIA s'enregistre seul, 400 ms après la frappe). Ne pas la recréer sans demande.
- Il faut **ajouter une fonction pour importer un PIA** de l'année précédente ou en cours : voir le chantier en fin de fichier (non planifié dans un lot, à concevoir avec l'utilisateur).

---

## LOT 5 : cohérence (design, jetons, vocabulaire)

### Trois décisions à poser à l'utilisateur AVANT de coder

1. **Titres en petites majuscules espacées** (`reunion.css:15` `.reunion-rubrique h3`, `seance.css:169` `.journalier-apercu h4` ; probablement aussi les « POINTS D'APPUI / À TRAVAILLER / AIDES UTILISÉES » du PIA, non mesurés) : les passer en casse normale, ou les **autoriser dans `DESIGN.md`** comme pour les filets ? (`DESIGN.md` les interdit aujourd'hui.)
2. **Vocabulaire du mode sans compte** : l'interface dit « mode essai », « démonstration », « données fictives », « données de démonstration » pour le même état. Proposer un seul mot (« Mode essai » est le plus répandu : bandeau, verrouillage) et l'appliquer partout. À l'accueil : « Essayer la synchronisation » ; à l'écran Synchro : « Essayer en démonstration (sans compte) » ; « faux OneDrive », « faux Outlook », « V75 » (jargon).
3. **Ordre des noms** : « Élève Alpha » (agenda) contre « Alpha Élève » (listes, sélecteurs). Choisir un ordre pour l'affichage (nom puis prénom, comme dans les listes ?).

### 5.1 `DESIGN.md` : inscrire les filets d'un seul côté

Retirer « filets colorés d'un seul côté » de la ligne **Interdits** de `DESIGN.md` et la réécrire (« autorisés : repère de couleur d'un bloc ; garder le contraste et le texte en toutes lettres »). Les emplacements : `agenda.css:60`, `:65`, `:136`, `:158`, `:165`, `pia.css:31`, `reunion.css:14`, `seance.css:162`. **Ne pas oublier** `AGENTS.md` (lot SP : « Interdits (DESIGN.md) : filets d'un seul côté… »), `PRODUCT.md` si cité, et signaler l'écart du détecteur : le hook impeccable (règle `side-tab`) les signale à chaque modification ; l'ignorer par `/impeccable hooks ignore-rule side-tab` (hook local, `.claude/` n'est pas versionné). Un faux positif : `accueil.css:9` (chevron fait de deux bordures).

### 5.2 Graisses hors échelle

Le projet utilise 400, 450, 550, 600, 650 et 700, alors que la police système n'a que 400/600/700 (le navigateur arrondit). Aligner : **450** `components.css:20` ; **550** `components.css:39`, `:57`, `seance.css:17`, `:69` ; **650** `base.css:13`, `:14`, `accueil.css:32`, `:35`, `agenda.css:22`, `:62`, `components.css:76`, `:80`, `seance.css:43`, `:103`, `:121`, `:167`. Vérifier visuellement (captures avant/après : `tools/navigateur/captures.mjs`) que rien ne change de façon visible, ou le dire.

### 5.3 Jetons manquants (`reprise.css`)

`reprise.css:2`, `:6`, `:10`, `:11`, `:13` utilisent `var(--bordure, #d0d5dd)` et `var(--fond-doux, #f5f6f8)` : **ces deux jetons n'existent pas dans `tokens.css`**. Conséquence mesurée (simulation) : en thème sombre, le texte de `.reprise-pia` devient **illisible (1,12:1)** et les filets sont blancs. Utiliser `--line` / `--surface-2` (jetons existants dans les DEUX blocs sombres). L'écran n'est accessible qu'avec un compte Microsoft : le tester en construisant le DOM avec les classes (voir `tools/navigateur/reprise.mjs`) ou via la couleur calculée.

### 5.4 Couleurs codées en dur hors `tokens.css`

- `agenda.css:2-4` : 14 couleurs hexadécimales de la palette des élèves (`.c-0…c-9`) et des types (`.t-*`), non reliées aux jetons ; `agenda.css:6-7`, `:11-17` mélangent avec `#fff`, `#000`, `#141b2e` ; `agenda.css:60` : `rgb(22 35 63 / 10%)` à la place de `--shadow-1` ; `components.css:102` : voile des dialogues `rgb(13 20 36 / 45%)` ; `pia.css:6` (repli `#b3261e`), `pia.css:52`, `:64`, `agenda.css:198-201` (impression : noir et blanc voulus, laisser).
- Ne pas casser les contrastes calculés du lot 3 : **refaire les mesures** (clair et sombre, 14 classes d'agenda) après.

### 5.5 Autres incohérences de présentation

- Titre d'impression de l'agenda : `text-transform: capitalize` (`agenda.css:199`) met une majuscule au mois (« Novembre ») : en français le mois n'en prend pas. Même défaut possible dans `.semaine-type-liste dt` (`agenda.css:184`, jour de la semaine, à voir).
- Pas de `description`, d'icône `apple-touch-icon`, ni de manifeste ; `<meta name="theme-color" content="#f5f7fb">` est une valeur claire unique qui ne correspond ni au fond de la palette (`#f3f0ea`) ni au thème sombre : donner deux valeurs (`media="(prefers-color-scheme: …)"`). **Pas de service worker** (décision du lot S : ne pas en ajouter sans en parler).
- Titre d'onglet : pas de titre distinct pour la fiche élève, l'onglet du PIA ni le mode « Modifier la séance » (P3).
- Le logo SVG est chargé deux fois (menu et barre du haut) (P3).

### 5.6 Critères de fin du lot 5

- Parcours `tools/navigateur/lot5-coherence.mjs` : plus aucune graisse hors 400/600/700 dans les styles calculés ; `--bordure` et `--fond-doux` n'apparaissent plus ; contraste de `.reprise-pia` ≥ 4,5:1 en sombre ; vocabulaire unique (aucun des anciens libellés dans les pages) ; `DESIGN.md` à jour. Doit échouer avant.
- `npm run check`, tous les parcours, `accessibilite.mjs` à 0 défaut, documentation, commit local.

---

## LOT 6 : fonctionnel

À traiter par ordre d'importance, **en petits lots séparés** (un sujet par modification). Pour chacun : lire le code, annoncer le plan, parcours qui échoue avant.

### 6.0 Reste du lot 1 (« lot 1b ») : les deux autres brouillons

Le brouillon de séance existe (lot 1, `domain/brouillons/`, `state/store.ts`, `SeancePage.tsx`). **Même mécanisme** à appliquer à :
- **Nouvel élève** (`features/eleves/FicheEleve.tsx`, `ElevesPage.tsx`) : un rechargement perd le formulaire à moitié rempli.
- **Nouvelle activité** de l'agenda (`features/agenda/Panneau.tsx`, ≈ 20 états) : idem.
Règle déjà posée : proposer « Reprendre » / « Repartir de zéro », **ne rien appliquer sans accord**, ne rien écrire avant la première saisie, ne jamais synchroniser (`REGLAGES_SYNCHRONISES`), effacer au premier enregistrement. Un réglage local par formulaire (`brouillon-eleve`, `brouillon-activite`) ou une généralisation propre du module `domain/brouillons`. **Décision à poser** : la copie de secours (`SynchroPage.tsx:105`, case « Protéger la copie par un mot de passe », décochée par défaut alors que le fichier contient noms et observations d'élèves mineurs) : la cocher par défaut ? (comportement visible : demander à l'utilisateur).

### 6.1 Date de naissance : impasse entre PIA et Élèves

Le PIA (onglet Identité) affiche « Date de naissance : Non renseignée » et renvoie à l'écran Élèves pour la changer ; **la fiche élève n'a aucun champ pour la saisir** alors que `Eleve.dateNaissance` existe (type, exports Word `domain/export/journalier.ts:100` et `pia.ts:92`) : la date sort vide dans le Word et l'impression. Ajouter le champ (`type="date"`, facultatif, jamais obligatoire), le montrer dans la fiche, vérifier qu'elle part bien dans les exports et la synchronisation (schéma `domain/synchro/schemas.ts`), et que la version dé-identifiée l'efface (`deIdentifier…`).

### 6.2 PIA : ouvrir une nouvelle année scolaire

Le sélecteur d'année de `features/pia/PiaPage.tsx` (≈ ligne 79) n'offre que les années qui ont des séances ou un PIA, plus l'année en cours. **Aucun bouton « Nouvelle année »** : la seule voie vers 2027-2028 est le paramètre d'URL `&annee=2027-2028` (vérifié : PIA vierge, « Rien d'enregistré pour l'instant »). Ajouter « Nouvelle année scolaire » (liste des années suivantes). Vérifier aussi qu'il n'y a pas **deux sélecteurs d'année** qui divergent (en-tête et « Période » de l'onglet Préparer) ; en liaison avec le chantier d'import ci-dessous.

### 6.3 Agenda : séries hebdomadaires, doublons, vacances, absences

- **Série** : `Panneau.tsx:206-212` affiche déjà « appliquer à… cette date seulement / toute la série » (défaut : cette date), mais **en bas du panneau**, sous la couleur, et l'audit ne l'a pas vu : modifier un lieu n'a changé que ce jour sans que l'agent le comprenne. Rendre le choix **découvrable** (près du bouton « Enregistrer », phrase de rappel sur le bouton : « Enregistrer cette date » / « Enregistrer toute la série »).
- **Doublons** : enregistrer une séance pour le même élève, la même date et la même période qu'une séance existante ne prévient pas ; l'agenda superpose 3 blocs identiques. « Dupliquer à la semaine suivante » sur une activité d'une série crée un doublon sur l'occurrence existante. Prévenir (sans bloquer) et nommer la séance en conflit.
- **Vacances** : les séries s'affichent pendant les congés (21-23 décembre « Remédiation fractions » sur des cases « Vacances d'hiver ») : prévenir (déjà noté dans les idées du plan, lot 5 agenda). **Re-vérifier les dates** de `ANNEES_SCOLAIRES_FWB` (`domain/agenda/calendrier.ts`) contre une source officielle : le site affiche « Congé d'automne » du 19 au 30 octobre (deux semaines) ; ne jamais écrire une date de mémoire.
- **Absences** : une séance « Élève absent — séance non tenue » a le même aspect (et la coche « réalisé ») que les séances normales dans l'agenda ; lui donner un style (couleur d'absence `--danger`, icône) sans la couleur seule.
- **Légende** : elle ne liste que les élèves ; expliquer aussi réalisé (✓), annulé (hachures + barré), fériés, vacances, types d'activité (3 teintes proches pour collaboration, formation, administratif : forme ou libellé).
- Nom accessible du type « libre » (bordure pointillée) etc. déjà couverts par du texte : vérifier seulement.

### 6.4 Séance : après l'enregistrement, et sorties sans filet

- Après « Enregistrer la séance », le formulaire se vide et la notification n'a ni lien ni geste : **utiliser le geste de notification du lot 1** (`useToast().annoncer(texte, { libelle, faire })`) pour proposer « Voir dans le Journalier » (et/ou « Annuler »).
- « Annuler » en mode modification (`SeancePage.tsx`) et « Fermer » du panneau d'agenda perdent des modifications **sans question** : demander seulement s'il y a eu des modifications.
- Enregistrer une séance vide (aucun point observé) est possible : décider avec l'utilisateur s'il faut confirmer.
- Vocabulaire : le formulaire dit « aides » ; la Feuille et le Journalier écrivent « Médiations mises en place » (décision d'`AGENTS.md` : la nature n'apparaît que dans les documents Word) ; le statut « Déjà en place » choisi n'apparaît pas dans la Feuille ni dans « Voir » ; l'étiquette « Objectif pour la prochaine séance » se perd. **Ne pas toucher au texte du Journalier sans passer par le moteur de rédaction** (`domain/redaction/`, tests `tests/redaction.test.ts`).
- La **« Précision » libre de la rubrique 3** réapparaît dans le PIA (Préparer) et dans le texte de réunion comme « Compétence notée sans niveau » : un commentaire libre devient un objectif proposé. À discuter (moteur `domain/reunion/`).

### 6.5 PIA : détails

- Les dépliés « Idées » sont **vides** pour Physique, Autonomie et Communication (riches seulement pour Cognitif et Comportemental) : masquer le déplié sans contenu.
- Aménagements : la description tient sur **une ligne** et se tronque (« Temps supplémentaire pour les évaluati… ») : zone de texte à plusieurs lignes ; « : » orphelin devant le libellé (« : Support visuel (Mathématiques) »).
- Nom de fichier du Word : `PIA - Alpha - 2026-2027.docx` ne reprend que le nom de famille : deux élèves de même nom donnent le même nom.
- Tablette : l'en-tête (élève, année, statut, export, « Choisir les parties à exporter ») occupe ≈ 590 px avant le contenu et n'est pas collé ; téléphone : la liste d'onglets défile (« Procès-verbal 2 » et « Aménagements » hors écran, onglet actif non ramené) : réutiliser `positionCentree` du lot 2 (`features/seance/defilement.ts`).
- **Texte de réunion** (onglet Préparer) : aucun export Word ni impression ; le bouton principal « Exporter en Word » en haut exporte le **PIA**, pas ce texte. Clarifier ou ajouter. Le bouton « Préparer la réunion » mène à l'écran « PIA ».
- Fenêtre « enregistrer 60 ms après la frappe » : un rechargement ou une fermeture d'onglet **immédiatement après la saisie** perd la dernière frappe (le délai d'écriture est 400 ms ; `viderEnregistrements` est déjà appelé à `pagehide` et au changement d'écran, voir `Racine.tsx`) : vérifier que `pagehide` couvre bien le cas d'une fermeture brutale ; sinon l'améliorer.

### 6.6 Accueil sans données, fiche élève, aide

- **Accueil sans élève** (`AccueilPage.tsx:137`) : le bouton principal est « Charger les données de démonstration ». Pour un **vrai** utilisateur connecté à son compte, c'est charger des élèves fictifs dans son vrai coffre. Proposer « **Ajouter mon premier élève** » en action principale ; la démonstration devient un lien secondaire, ou n'est proposée que dans le mode essai (la nature de session est connue de `Racine`).
- Fiche élève : six boutons de même poids (Voir le Journalier, Préparer la réunion, Ouvrir le PIA, Modifier le dossier, Archiver, Supprimer…) ; « Supprimer… » rouge à 8 px d'« Archiver » ; aucune adresse propre (la fiche ouverte n'est pas dans l'URL : retour arrière ou rechargement la perdent). Couleur d'agenda : 10 pastilles sans nom visible. Avatar : cinq styles et cinq rangs de réglages, à garder repliés.
- **Aucune aide, page « À propos », version, contact ni mention RGPD** dans l'application. Proposer une page courte (3 parcours, « vos données » en 5 lignes : où elles sont, qui les voit, que faire si la tablette est perdue ; version ; contact). **Décision à poser** : c'est un nouvel écran (fonction), à confirmer avant de le faire.
- Journalier : séances d'un même jour distinguées seulement par période et objectif ; aucun « Copier le texte » ni export d'une seule séance (à proposer).

### 6.7 Critères de fin du lot 6

- Un parcours par sujet traité (`tools/navigateur/lot6-<sujet>.mjs`), chacun **échouant avant**.
- `npm run check`, tous les parcours, `accessibilite.mjs` à 0 défaut, documentation, commit local.
- Message final : ce qui est fait, ce qui est reporté (arrière-plan, idées en attente du plan), ce qui n'est pas vérifié (tablette, lecteur d'écran).

---

## CHANTIER À PART (après les lots) : importer un PIA

> Besoin exprimé par l'utilisateur : « ajouter une fonction pour importer un PIA de l'année précédente ou un PIA en cours ». **Il n'existe aujourd'hui aucune voie** pour cela. À concevoir **avec l'utilisateur** avant de coder (proposer 2 ou 3 maquettes ou un artefact cliquable, comme pour la maquette « Séance : repères et progression »), en une conversation dédiée.

### Voies d'import déjà présentes (aucune ne convertit un PIA)

| Où | Format | Ce que ça fait | PIA ? |
|---|---|---|---|
| Synchro > « Restaurer une copie… » | fichier `.json` de « Enregistrer une copie » (50 Mo max, mot de passe 8 caractères au moins si chiffré) | aperçu « N manquent ici, N différents, N identiques, N abîmés » ; « Ajouter ce qui manque » (primaire), « Ajouter et remplacer les différents », « Annuler » ; **rien n'est jamais supprimé** | oui, mais tout ou rien |
| Lien « Reprendre mes données de la V75 » (`#/reprise`) | stockage de la V75 sur l'appareil, ou OneDrive de la V75 (lecture seule) | vérification élève par élève, import `v75-…` sans doublon, tableau de contrôle | **non converti** : texte du PIA V75 dans un déplié, bouton « Copier ce texte » |
| Synchro > « Repartir de OneDrive » (compte Microsoft) | dossier `v2` de OneDrive | remplace tout l'appareil (confirmation par case) | oui, mais efface ce qui manque |
| Dans le PIA : « Reprendre les objectifs retenus », « Reprendre les présents du PV 1 », « Reprendre les aménagements de l'année », « D'après vos séances » | données de l'application | ajoute dans les champs, jamais de remplissage automatique | **dans un même PIA et une même année seulement** |

### Trois chemins plausibles, du moins cher au plus cher

1. **« Reprendre le PIA de l'année précédente »** (interne, sans fichier) : à l'ouverture d'une année vierge, proposer de copier depuis l'année N-1 **par blocs cochables** : profil (ressources, difficultés, objectifs à poursuivre), aménagements (ceux du PV 2 « pour la rentrée » deviennent les aménagements de départ), identité (option, CPMS, responsable). **Ne pas reporter** les objectifs et retours des PV 1 et PV 2 de l'ancienne année (ils se rapportent à la période passée). Nécessite 6.2 (nouvelle année).
2. **Importer un .docx** (PIA fait hors application, ou export d'avant) : lire les tableaux T1 à T8 du modèle officiel (`docs/PIA_MODELE_STRUCTURE.md` à la racine du dépôt, `domain/export/pia.ts`). Échoue sur un modèle modifié (l'export lui-même lève « Le modèle PIA est inattendu »).
3. **Coller du texte** : zone de texte + proposition de découpage, validée champ par champ.

### Principes à garder (déjà dans `AGENTS.md`)

- **Rien n'est jamais rempli automatiquement dans le profil** : l'import remplit des **brouillons visibles** que l'agent relit, pas un PIA final.
- Réutiliser le motif de « Restaurer une copie » : **aperçu avant tout**, comptes « nouveaux / différents / identiques », cases par élément, bouton principal « Ajouter ce qui manque », « Annuler », **jamais d'écrasement silencieux** (si un champ est déjà rempli, montrer le conflit).
- Modèle de données : un PIA = `eleveId|année` (`domain/pia/types.ts`, `normaliserPia`) ; un PIA vierge n'est **pas stocké** tant qu'on n'a rien tapé.
- **Écueils** : prévoir « Vider ce PIA » (avec confirmation) si l'import doit pouvoir partir d'un PIA non vide ; la date de naissance (6.1) doit être saisissable avant d'importer un .docx ; vérifier l'élève cible (la copie de secours ne contrôle pas le nom) et reprendre la détection de quasi-doublons de la reprise V75 ; ne pas importer un PIA **dé-identifié** par erreur ; **tester en mode essai** avec des données fictives (la reprise V75 y est refusée : l'import de PIA doit y être démontrable).
- Où le placer : onglet Identité ou Préparer du PIA (« Démarrer à partir de… ») pour l'année en cours, et dans le sélecteur d'année (« Nouvelle année… » + « Reprendre de 2025-2026 »). **Pas** dans Synchro (réservé aux sauvegardes).

---

## Hors audit, à garder en réserve (inscrit dans `docs/plan-de-travail.md`, « Idées en attente »)

- Filet d'erreur global (`ErrorBoundary`) : aujourd'hui une exception de rendu démonte tout l'arbre (écran blanc sans message) ; aucun `window.onerror` ; verrouillage automatique après inactivité ; application installable / hors ligne (manifeste, service worker : **décision du lot S, ne pas ajouter sans en parler**) ; sourcemaps publiés (3,7 Mo, dépôt public : sans conséquence de confidentialité) ; en-têtes de sécurité (GitHub Pages n'en pose pas : `frame-ancestors` impossible par `<meta>`) ; lecteur d'écran réel jamais essayé ; essai sur tablette réelle de tous les lots (le lot 2b a été vérifié avec de vrais événements tactiles et WebKit, pas sur un iPad).

## Fin de conversation (à faire à chaque lot)

1. `npm run check` (dans `v2/`), puis `npm run navigateur` ou au moins les parcours touchés ; `accessibilite.mjs` à 0 défaut.
2. Mettre à jour : `docs/plan-de-travail.md`, `docs/etat-des-lieux.md`, `AGENTS.md`, `docs/decisions.md`, `README.md`.
3. **Commit local** (jamais de push) ; dire à l'utilisateur ce qu'il peut essayer, ce qui n'est pas vérifié, ce qu'il doit décider, **et si l'on peut proposer la publication** (push de la branche + demande de fusion, uniquement s'il le demande).
