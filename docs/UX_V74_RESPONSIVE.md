# Audit et refonte UX/UI responsive — Journalier électronique

**Date : 29 septembre 2026**  
**Périmètre : UX/UI uniquement — aucune modification du contenu métier ou du modèle de données.**

## 1. Objectif

Cette passe améliore l'utilisation du Journalier sur **PC, tablette et téléphone** tout en conservant les données, les libellés métier, les parcours fonctionnels et l'architecture V74.

La direction visuelle recherchée est :

- **Apple-friendly** : surfaces claires, profondeur légère, transitions courtes, navigation tactile et hiérarchie calme ;
- **colorée mais sémantique** : bleu pour l'action/navigation, violet pour le PIA, vert pour le confirmé, ambre pour l'examen, rouge pour l'erreur/refus ;
- **visuelle** : icônes SVG déjà présentes, emojis conservés lorsqu'ils servent de repère, badges et surfaces fonctionnelles ;
- **ARU** : lisibilité, cibles tactiles, focus visible, contraste et réduction des mouvements ;
- **contenu avant décoration** : la couche UX ne doit pas modifier ni interpréter les données.

## 2. Invariants explicitement protégés

Cette refonte ne modifie pas :

- les élèves ;
- les séances ;
- les observations ;
- les matières ;
- l'agenda et ses données ;
- le PIA et ses structures ;
- les exports ;
- IndexedDB / DataStore ;
- Microsoft Entra ID / MSAL ;
- Microsoft Graph / OneDrive AppFolder ;
- SyncManager ;
- les identifiants techniques historiques `v72*` ;
- les schémas JSON ou les permissions Graph.

Le nouveau fichier `src/styles/journalier-ux-responsive.css` est une **couche de présentation** chargée après le CSS historique. Il ne contient aucune règle de persistance ou de métier.

## 3. Audit réalisé

### 3.1 Fondation de défilement

Le CSS historique utilisait `height: 100vh` sur `body`, `overflow: hidden` sur le document et un défilement interne sur `.main-container`. Cette architecture restait utilisable sur desktop mais était fragile sur mobile/tablette, notamment avec les barres de navigateur et les éléments fixes.

Corrections :

- passage à `100dvh` pour la hauteur dynamique ;
- conservation d'un seul conteneur de défilement principal ;
- `scroll-padding` pour que les extrémités restent atteignables ;
- `viewport-fit=cover` pour les zones sûres iOS ;
- padding inférieur adapté à la navigation tactile mobile ;
- suppression du `top:-18px` de la barre agenda collante.

### 3.2 Navigation

Avant : les cinq destinations étaient conservées sur une seule ligne horizontale sur petit écran, ce qui coupait visuellement « Rapports & PIA ».

Après :

- PC : navigation supérieure complète ;
- tablette : navigation supérieure compacte, avec défilement horizontal uniquement si nécessaire ;
- téléphone : navigation basse fixe avec les cinq destinations, icône + libellé ;
- aucune destination n'est représentée uniquement par sa couleur.

### 3.3 Agenda

La vue Jour reste privilégiée sur téléphone. Les vues Semaine et Mois conservent leur contenu mais peuvent défiler horizontalement **à l'intérieur de leur composant**, sans provoquer de défilement horizontal de la page.

La barre de contrôle devient tactile :

- sélecteur Jour/Semaine/Mois ;
- navigation précédente/suivante ;
- bouton Aujourd'hui ;
- date ;
- légende lisible.

### 3.4 Séance

La saisie devient une colonne lisible sur téléphone. Les choix structurés existants sont conservés.

Le sélecteur de période reste présenté comme un couple début → fin, sans que le deuxième champ tombe sous le premier de manière ambiguë.

Les boutons et champs tactiles ont une cible minimale de 44 px dans la couche UX responsive.

### 3.5 Élèves

Les actions des dossiers restent associées au dossier mais passent en groupe vertical sur téléphone pour éviter les boutons trop étroits.

Les recherches et textes longs peuvent se contracter sans créer de débordement horizontal.

### 3.6 Rapports & PIA

Le problème le plus visible de la version précédente était l'en-tête Rapports : l'action **Exporter** pouvait se retrouver au bord de l'écran et devenir difficile à lire sur petit écran.

Corrections :

- en-tête empilé sur téléphone ;
- contextes élève/période en largeur complète ;
- dates en blocs lisibles ;
- Exporter en largeur complète ;
- panneau d'export sous forme de surface fixe accessible sur téléphone ;
- sous-navigation conservée comme bande de tabs horizontale interne ;
- synthèse et préparation de réunion passent en colonne sur petit écran.

### 3.7 Historique

Le modèle maître-détail existant est conservé :

- grand écran : liste + détail côte à côte ;
- tablette : proportion ajustée ;
- téléphone : liste puis détail, sans écrasement des colonnes.

### 3.8 PIA généré par le runtime V74

Le contenu du PIA est inchangé. La couche responsive adapte uniquement :

- grille des domaines ;
- navigation des domaines ;
- navigation des sections PIA ;
- détails des domaines ;
- propositions ;
- réunions et suivi.

Les règles responsive déjà injectées par le runtime sont conservées ; la nouvelle couche les complète pour le téléphone et la tablette.

## 4. Direction visuelle

La couche utilise les éléments déjà présents dans V74 :

- surfaces blanches et fond doux ;
- profondeur légère ;
- bleu d'action ;
- violet PIA ;
- vert confirmé ;
- ambre examen ;
- icônes SVG de navigation ;
- emojis déjà présents dans les actions et repères pédagogiques.

Aucune nouvelle bibliothèque d'icônes ou de police externe n'est introduite.

## 5. Accessibilité et ARU

Contrôles ajoutés :

- cibles tactiles ≥ 44 × 44 px pour les contrôles principaux ;
- focus visible ;
- `prefers-reduced-motion` ;
- support des zones sûres iOS ;
- taille de saisie mobile d'au moins 16 px pour éviter le zoom automatique iOS ;
- libellés et états conservés en texte ;
- aucun statut ne dépend uniquement de la couleur.

## 6. Simulations automatiques

Une simulation navigateur hors authentification a été utilisée pour tester la couche de présentation avec le DOM réel du dépôt.

Résolutions simulées :

- 390 × 844 ;
- 375 × 667 ;
- 768 × 1024 ;
- 1024 × 768 ;
- 1440 × 900.

Vues simulées :

- Accueil ;
- Agenda ;
- Séance ;
- Élèves ;
- Rapports & PIA.

Contrôles automatisés :

- absence de débordement horizontal de la page ;
- présence des conteneurs de scroll attendus ;
- visibilité des éléments fixes ;
- atteignabilité du bouton final « Enregistrer la séance » en bas du formulaire ;
- taille des contrôles tactiles ;
- comportement du panneau Export sur téléphone ;
- rendu des éléments de navigation mobile.

Résultat de la passe finale :

- **0 débordement horizontal de page** sur les cinq résolutions testées ;
- **0 contrôle visible < 40 px** dans la simulation Rapports ;
- le bouton final de séance reste au-dessus de la navigation mobile lors du scroll maximal sur 390 × 844 et 375 × 667 ;
- le panneau d'export mobile reste dans la fenêtre ;
- les cinq destinations restent identifiables sur téléphone.

## 7. Limites de validation

Cette simulation est une validation de présentation avec le DOM et les styles du dépôt. Le `npm run build` n'a pas pu être exécuté dans cet environnement de travail car les dépendances `node_modules` du ZIP ne sont pas présentes et l'environnement n'a pas d'accès au registre npm pour les réinstaller. Aucun code JavaScript applicatif n'a été modifié dans cette passe.

Elle ne remplace pas :

- un parcours authentifié Entra réel ;
- un test Graph/OneDrive ;
- un test avec les données pédagogiques réelles ;
- un test sur Safari iOS et Safari iPadOS physiques ;
- un test avec clavier virtuel réel ;
- un test de rotation physique et de multitâche iPad.

Ces validations restent recommandées avant publication définitive.
