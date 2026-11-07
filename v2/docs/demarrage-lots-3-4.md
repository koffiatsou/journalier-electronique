# Démarrage : audit, lots 3 et 4 (tactile et lisibilité, puis clavier et accessibilité)

> Fichier de passage entre deux conversations. À lire en entier avant de toucher au code. Rédigé le 7 novembre 2026, à la fin du lot 2.

## Texte à coller pour démarrer la nouvelle conversation

```
Lis v2/AGENTS.md, puis v2/docs/demarrage-lots-3-4.md en entier, puis v2/docs/plan-de-travail.md (section « Audit du 6-7 novembre 2026 »).
Reprends l'audit du Journalier : lots 3 puis 4, sur la branche locale v2/audit-lot1-donnees, sans jamais pousser sur GitHub.
Annonce ton plan en quelques lignes avant de modifier le code, puis travaille en petits lots testés (un sujet par modification).
```

## Où en est-on

- Branche locale **`v2/audit-lot1-donnees`** (partie de `v2/react-ts`). Deux commits locaux, **jamais poussés** : `8aeff23` (lot 1, protéger les données) et `ae68827` (lot 2, défilement natif).
- État vérifié à la fin du lot 2 : `npm run check` vert (614 tests), les 23 parcours navigateur passent (`tools/navigateur/tout.mjs`).
- **Méthode validée par l'utilisateur** : tout se fait d'abord en local ; il essaie dans le volet navigateur de l'application ; **rien n'est poussé ni fusionné sans son accord explicite**. La fusion vers `main` publie le site.
- Le projet impose : un sujet par modification, petits lots, tests qui exécutent le code, documentation mise à jour en fin de lot (`AGENTS.md`, `docs/plan-de-travail.md`, `docs/etat-des-lieux.md`, `docs/decisions.md`, `README.md`).

## Ce qui a été décidé (ne pas rediscuter)

- **Pas de Lenis, pas de GSAP ScrollTrigger** (analyse faite ; voir `docs/decisions.md`).
- **Filets d'un seul côté colorés : voulus** par l'utilisateur. Ne pas les corriger ; ils seront inscrits dans `DESIGN.md` au lot 5.
- Export Word : l'utilisateur n'a jamais vu d'erreur, c'est une amélioration mineure (lot 6).
- Les petits textes de la barre d'onglets et de l'agenda doivent atteindre 12 px au moins ; les zones à toucher 44 px au moins **quand le pointeur est un doigt** (`pointer: coarse`), comme `DESIGN.md` le promet déjà.
- La tablette est l'appareil n° 1, puis l'ordinateur, puis le téléphone (secours).
- **Hors lots, à ne pas commencer ici** : import d'un PIA de l'année précédente ou en cours (chantier à part, voir `demarrage-lots-5-6.md`).

## Environnement Windows : pièges déjà rencontrés

- **Lancer les parcours depuis Git Bash** (`unzip` n'est pas dans le PATH de PowerShell) : `LANG=C.UTF-8 node tools/navigateur/<parcours>.mjs`. `npm run navigateur` rejoue tout (≈ 5 min).
- Le serveur de développement **ne recompile pas** : le relancer après chaque modification (`PORT=5199 node scripts/dev.mjs`, port 5199 pour les parcours ; dans le volet navigateur, `.claude/launch.json` → nom `journalier-v2`, port 5173).
- Git Bash n'a **pas `pkill`** : arrêter les serveurs avec PowerShell (`Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -match 'dev\.mjs' } | Stop-Process`).
- **Ne jamais lancer `npm ci` ni `npm install` pendant qu'un serveur de développement tourne** : `esbuild.exe` est verrouillé (EPERM) et `node_modules` reste à moitié vide. Arrêter le serveur d'abord.
- Playwright est un outil de vérification, pas une dépendance : `npm install --no-save playwright@1.63.0` (déjà fait dans `v2/node_modules`, à refaire après un `npm ci`). Ne jamais l'ajouter à `package.json`.
- Git n'a pas d'identité configurée : committer avec `git -c user.name="Shirokof-BG" -c user.email="shirokof@gmail.com" commit …` (même identité que les commits existants), sans toucher à la configuration. Terminer le message par `Co-Authored-By: Claude Sonnet 5.5 <noreply@anthropic.com>`.
- Python sous Windows écrit en cp1252 : tout appel Python d'un parcours passe par `PYTHONUTF8=1` (déjà fait dans `journalier.mjs`).
- Pour simuler un doigt dans Playwright, quelle que soit la largeur : `newContext({ viewport, hasTouch: true, isMobile: true })` (donne `pointer: coarse`). Le navigateur de bureau seul ne le fait pas.
- Un hook de contrôle du design (impeccable) tourne après chaque modification de fichier : il ne signale que des règles automatiques, il ne remplace pas un regard humain.

## Outils de vérification à réutiliser

- Parcours de référence : `tools/navigateur/lot1-donnees.mjs`, `lot2-defilement.mjs` (modèles à copier : `ok(...)`, contexte tactile, `aller`/`recharger` de `_coffre.mjs`). **Tout nouveau parcours `tools/navigateur/*.mjs` est repris tout seul par la CI** ; il doit accepter `URL_APP`, sortir en code ≠ 0 en cas d'échec, ne pas dépendre des autres.
- `tools/navigateur/accessibilite.mjs` doit rester à **0 défaut**.
- Règle du projet : **tout défaut corrigé reçoit un test qui échoue avant et réussit après** (écrire le parcours d'abord, le lancer sur le code actuel pour voir l'échec, puis corriger). Préférer les tests qui exécutent le code ; un test qui lit seulement du CSS est un repère textuel fragile (à signaler).
- Mesures à refaire avant et après : zones tactiles, tailles de texte, contrastes, à 375, 768, 1024 et 1440 px, thèmes clair, sombre et automatique.

---

## LOT 3 : tactile et lisibilité

**But** : un doigt atteint chaque contrôle sans effort et tout le texte se lit. Les numéros de ligne viennent de l'audit sur le site publié ; **les re-vérifier dans le code local** (le site publié peut différer).

### 3.1 Zones à toucher (< 44 px sous `pointer: coarse`)

Aujourd'hui seules 4 règles `pointer: coarse` existent (`layout.css:62` et `:144`, `accueil.css:50` et `:74`). Rien ne relève les autres. Mesures :

| Élément | Taille mesurée | Fichier (ligne à vérifier) |
|---|---|---|
| `.btn` (tous les boutons de page) | 40 de haut (38 de large pour les flèches de l'agenda) | `components.css:4` |
| `.input`, `.select` | 42 | `components.css:23` |
| `.chip` | 40 | `components.css:37` |
| `.pastille` (« Choisir un niveau ») | 36 | `components.css:60` |
| `.point-retirer` | 36 | `components.css:75` |
| `.barre-etape` | 40 | `seance.css:16` |
| `.journalier-actions .btn` (Voir, Modifier, Supprimer) | 36 | `seance.css:156` |
| `.apercu-fermer` | 36 | `seance.css:124` |
| `.btn-feuille` | 76×40 | `seance.css` |
| `.legende button` (agenda) | 32 | `agenda.css:31` |
| `.creneau-memos label` | 32 | `accueil.css:48` |
| libellés des cases à cocher | 28 (la case elle-même 20×20) | `base.css` / `components.css` |
| pastilles de couleur du panneau d'activité | 28×28 | `agenda.css` |
| `.reunion-apercu summary` | 36 | `reunion.css:38` |
| lien « Reprendre mes données de la V75 » | 20 de haut | `synchro.css` |
| `.mois-evt` | 24×24 | `agenda.css` |
| `.evt-poignee` (étirer une activité) | 174×10 | `agenda.css` / `Grille.tsx` |
| **`.mois-ajout`** (« + » de la vue Mois) | **22×22**, `opacity: 0` sauf survol ou focus clavier | `agenda.css:131-132` |

À faire :
1. Relever ces hauteurs à **44 px sous `@media (pointer: coarse)`** (une règle commune bien placée vaut mieux que 18 retouches ; ne pas casser la mise en page sur ordinateur, où le pointeur reste fin).
2. **`.mois-ajout`** : au toucher il est **invisible mais cliquable** (`elementFromPoint` le trouve) et fait moins de 24 px (échec WCAG 2.5.8). Le rendre visible quand `(hover: none)`, ou le retirer au profit d'un autre geste ; vérifier le clic sur la case entière (`::after { inset: 0 }` sur `.mois-jour`).
3. `.evt-poignee` : agrandir la zone de toucher sans agrandir le dessin (zone invisible plus grande).
4. Les survols (`:hover`) de `.nav-lien`, `.theme-bouton`, `.memo-retirer`, `.mois-case`, `.cellule` restent collés au toucher : les placer sous `@media (hover: hover)`.
5. Vérifier qu'aucun relèvement ne provoque de **défilement horizontal** (à tester à 375, 768, 820 px) ni ne casse l'impression de l'agenda (`agenda-6.mjs` : PDF de la semaine sur **1 page**).

### 3.2 Texte sous 12 px

| Élément | Taille | Fichier |
|---|---|---|
| libellés de la barre d'onglets du téléphone (`.nav-lien span`) | 10,56 px (`0.66rem`) | `layout.css:35` |
| libellés du menu étroit (768-899 px) | 10,9 px (`0.68rem`) | `layout.css:75` |
| sous-titre du logo (`small`) | 11,5 px (`0.72rem`) | `layout.css:23`, `:54` (et `:276`, `:307` du site publié) |
| `.pause-axe` | 11 px | `agenda.css:58` |
| `.marque-jour` | 11 px | `agenda.css:103` |
| `.mois-reste` | 11 px | `agenda.css:143` |
| `.evt small` (2ᵉ ligne d'une activité) | 10,8 px (`small` du navigateur non redéfini) | `agenda.css:60-63` |

Cible : **12 px minimum** (idéalement 12,5-13 px pour la barre d'onglets, la plus lue sur tablette). Vérifier que « Synchro », « Journalier », « Séance » tiennent toujours dans la case de la barre du bas sur 375 px (7 onglets) sans être coupés.

### 3.3 Contrastes

- **Bordures de champs** (`--line-strong` sur `--surface`) : **1,66:1 en clair, 1,71:1 en sombre**. WCAG 1.4.11 demande 3:1 pour la limite d'un champ de saisie (`.input`, `.select`, `.textarea`). Boutons et pastilles s'identifient par leur texte : moins urgent. Créer un jeton dédié (par exemple `--contour-champ`) dans les DEUX blocs sombres de `tokens.css` (automatique ET forcé) plutôt que de durcir `--line-strong` partout.
- **`.evt.annule`** : `opacity: .55` (`agenda.css:66`) donne **2,4 à 3,5:1** sur le texte des activités annulées (échec). Barrer et garder un texte lisible sans baisser l'opacité sous ≈ .75, ou changer de couleur.
- **`.evt small` en thème clair : mesures contradictoires.** Un premier relevé donnait 3,64 / 4,03 / 4,36:1 (heure de séance), un second 4,53:1 au minimum. **À re-mesurer dans le navigateur** (couleur calculée du texte sur le fond réellement rendu, pour les 14 classes `c-0…c-9` + `t-*`, clair et sombre) avant de corriger quoi que ce soit.
- `.evo-progres` (vert sur bleu clair) : 4,52:1 en clair, limite ; à surveiller.
- `.mois-ajout` : bordure à 1,12:1 sur la case (devient visible : prévoir un contraste suffisant).

### 3.4 Critères de fin du lot 3

- Nouveau parcours `tools/navigateur/lot3-tactile.mjs` : en contexte tactile (`hasTouch`, `isMobile`) à 390 et 768 px, **aucun contrôle visible de moins de 44 px** sur Accueil, Agenda (semaine, jour, mois), Séance (5 rubriques), Journalier, Élèves (liste et fiche), PIA (6 onglets), Synchro ; **aucun texte de moins de 12 px** ; pas de défilement horizontal ; contrastes calculés ≥ seuils pour les cas ci-dessus. Il doit **échouer avant** et réussir après.
- `npm run check` vert, les 23+ parcours verts (surtout `accessibilite`, `agenda-6`, `lot-v`, `theme`).
- Documentation à jour ; commit local ; message à l'utilisateur en français simple avec **ce qu'il doit essayer sur sa tablette** (zones, textes).

---

## LOT 4 : clavier et accessibilité

**But** : tout se fait au clavier et se comprend au lecteur d'écran. Règle de `AGENTS.md` à respecter : « **ne jamais déplacer le focus à l'ouverture** d'un écran » (le cadre met le focus sur le `h1` seulement quand l'écran CHANGE) ; elle ne vise pas les fenêtres modales ni les tiroirs ouverts à la demande de la personne.

### 4.1 Tiroir « Feuille » (écran Séance, jusqu'à 1099 px de large)

Fichiers : `features/seance/Apercu.tsx` (≈ ligne 54), `seance.css:125-134`, `SeancePage.tsx`.
- C'est un `<aside aria-label>`, **ni dialogue ni modal**. Constaté : un vrai clic sur « Feuille » laisse **le focus sur le bouton** ; **Échap ne le ferme pas** ; dans l'ordre du DOM l'`aside` est **avant** le bouton, donc depuis « Feuille » la touche Tab va vers « Enregistrer » sans jamais entrer dans le tiroir (on n'y arrive qu'avec Maj+Tab) ; le formulaire derrière reste focalisable (pas d'`inert`).
- Cible : Échap ferme et rend le focus au bouton « Feuille » ; à l'ouverture le focus entre dans le tiroir (ou un ordre de lecture logique) ; le fond est `inert` tant qu'il est ouvert **sur les écrans où il recouvre la page** ; fermé, il reste `visibility: hidden` (déjà le cas). Décider entre `<dialog>` non modal ou `role="dialog"` + gestion à la main ; documenter le choix dans `AGENTS.md`.

### 4.2 Panneau d'activité de l'agenda (jusqu'à 1099 px)

Fichiers : `features/agenda/Panneau.tsx` (≈ ligne 104), `agenda.css:93`.
- `section.panneau.feuille-bas` fixe, `aria-label` mais **pas de rôle de dialogue** ; le focus ne passe pas dans le panneau à l'ouverture ; **Échap ne le ferme pas** ; « Fermer » abandonne les modifications **sans prévenir** (à traiter avec le lot 6 si l'on veut une confirmation).
- Cible : même mécanisme que 4.1 (idéalement un composant commun).

### 4.3 Grille de l'agenda : rôles ARIA orphelins et trop d'arrêts de Tab

Fichier : `features/agenda/Grille.tsx`.
- Les enfants portent `role="row"`, `"columnheader"`, `"gridcell"` **sans ancêtre `grid` ou `table`** (la vue Mois a bien `role="grid"`) : ARIA invalide.
- **46 arrêts de Tab** en vue Semaine (40 `.cellule` + 6 `.evt`, les cellules avant les événements dans le DOM). Cible : un seul arrêt pour la grille, déplacement aux flèches (« roving tabindex »), ou cellules hors de l'ordre de Tab avec un autre moyen clavier de créer une activité.

### 4.4 Noms accessibles répétés

- Journalier : **11 × « Voir / Modifier / Supprimer »** sans `aria-label` : même nom, impossible de savoir lequel. Ajouter l'élève et la date (`aria-label="Supprimer la séance du 06/11/2026, Alpha Élève"`). « Voir » ouvre l'aperçu sans `aria-expanded` ni `aria-controls` : les ajouter.
- Vérifier d'autres listes répétées (élèves archivés, mémos, activités).

### 4.5 Formulaires : erreurs et boutons grisés

- **Séance** : l'erreur de validation (« Indiquez la matière. », `(+1)` cryptique) n'apparaît **que dans la barre du bas**, le champ fautif n'est pas marqué et **le focus ne bouge pas** (et le champ peut rester derrière la barre : voir lot 2, résolu par `scroll-padding`). Cible : marquer le champ (`aria-invalid`, `aria-describedby`), amener le focus sur le premier champ en erreur, liste complète plutôt que « (+1) ».
- **Boutons désactivés muets** : Accueil « Ajouter » (mémo vide), Agenda « Ajouter à l'agenda » (sans élève), Élèves « Enregistrer » (nom/prénom/classe manquants). Remplacer `disabled` par `aria-disabled` + message sous le bouton (« Choisissez d'abord l'élève »). Le produit promet « dire quoi corriger » (`PRODUCT.md`).
- Élèves : « Nom » et « Prénom » sont obligatoires sans l'indiquer (seul « facultatif » est marqué).

### 4.6 Mouvement réduit

Fichiers : `tokens.css:124-127`, `seance.css:52`, `seance.css:172`, `reunion.css:244`, `components.css:95-97`.
- Aujourd'hui un interrupteur global met **toutes** les durées à 1 ms (`animation-duration: 1ms !important`, `--t-*: 1ms`) : il supprime aussi les **fondus d'opacité et de couleur**, inoffensifs, qui portent le retour d'état (apparition des notifications, niveaux, survols).
- Cible (DESIGN.md : « `prefers-reduced-motion` coupe tout » à nuancer avec l'utilisateur) : garder les fondus (≈ 140 ms), supprimer les translations, échelles, rotations et changements de taille ; remplacer `scale(.97)` à l'appui par une teinte ; **supprimer `transition-delay: 60ms`** (`seance.css:52`, hors du kill) ; la durée de `toast-out` en dur (180 ms, `components.css:95`) doit passer par un jeton.
- Écarts à DESIGN.md relevés : les transitions de couleur, fond, bordure et ombre utilisent le mot-clé `ease-out` au lieu de `cubic-bezier(0.23,1,0.32,1)` (`--ease-out`) ; `.nav-lien:active` n'a pas de `transition: transform` ; `.evt`, `.mois-evt`, `.pia-onglet`, `.cellule` n'ont aucun retour d'appui ; animations de propriétés de mise en page (`grid-template-rows`, `width`/`margin` de `.chip .tick`, `width` de `.progres span`). Corriger ce qui est simple, **signaler le reste** à l'utilisateur plutôt que de tout refaire.
- À tester pour de vrai : le navigateur de l'outil n'émule pas la préférence ; **dans Playwright**, `ctx.newPage()` puis `page.emulateMedia({ reducedMotion: 'reduce' })`.

### 4.7 Autres points relevés (à traiter s'ils sont simples, sinon à noter pour plus tard)

- 11 arrêts de Tab avant le contenu de l'accueil (menu 7 + outils + lien « Aller au contenu »).
- Menu réduit : icônes seules avec infobulle `title` (invisible au toucher) : vérifier les noms accessibles (`aria-label`, déjà présents) et envisager une étiquette au toucher.
- Dialogues : `Dialog.tsx` n'a **pas de piège de focus vérifié de bout en bout** (30 Tab consécutifs non fiables avec l'outil) ; à vérifier avec de vraies touches Playwright (`page.keyboard.press('Tab')`).
- Séance : l'écran Journalier appelle « Annuler » sans confirmation même quand des modifications ont été saisies (lot 6).
- Pas de lecteur d'écran réel testé : le dire dans le message final (un audit automatique ne remplace pas un essai au lecteur d'écran, `AGENTS.md`).

### 4.8 Critères de fin du lot 4

- Nouveau parcours `tools/navigateur/lot4-clavier.mjs` (vraies touches Tab, Maj+Tab, Échap, Entrée) : tiroir « Feuille » et panneau d'agenda se ferment à Échap et rendent le focus ; la grille a un arrêt de Tab ; noms accessibles uniques ; champ en erreur annoncé et focalisé ; mouvement réduit émulé : plus aucune translation ni échelle mais le fondu reste. Doit **échouer avant** et réussir après.
- `tools/navigateur/accessibilite.mjs` à **0 défaut**.
- `npm run check` vert, tous les parcours verts, documentation à jour, commit local.

---

## Fin de conversation (à faire à chaque lot)

1. `npm run check` (dans `v2/`), puis `npm run navigateur` ou au moins les parcours touchés.
2. Mettre à jour : `docs/plan-de-travail.md` (statut du lot), `docs/etat-des-lieux.md`, `AGENTS.md` (décisions durables), `docs/decisions.md`, `README.md`.
3. **Commit local** (jamais de push). Lister à l'utilisateur ce qu'il peut essayer dans le volet navigateur, **ce qui reste non vérifié** (tablette réelle, lecteur d'écran), et ce qu'il doit décider.
4. Le lot suivant (5 et 6) se fait dans une autre conversation : `docs/demarrage-lots-5-6.md`.
