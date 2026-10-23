# Guide du Référentiel des Aménagements WBE & de l'Assistant IA Local

> Ce document détaille le fonctionnement, l'ergonomie et l'architecture des fonctionnalités introduites en V74 pour le référentiel des aménagements raisonnables et l'assistant de rédaction local.

---

## 1. Principes clés

1. **Local-First & Souveraineté des données :**
   - 0 octet émis sur un serveur d'IA ou une API tierce.
   - Conforme aux règles RGPD les plus strictes applicables aux données scolaires et pédagogiques en Fédération Wallonie-Bruxelles.
   - Fonctionne à 100 % hors-ligne, même sans connexion réseau active.

2. **Non-intrusion & Discrétion :**
   - Pas de barre latérale omniprésente ni de bouton criard dans l'en-tête global.
   - Les aides apparaissent là où le professionnel en a besoin : dans la **Synthèse**, dans le **PIA annuel** et lors de l'encodage des **séances**.

3. **Contrôle humain absolu :**
   - L'application suggère, le professionnel décide.
   - Aucune case n'est cochée et aucun texte n'est validé sans une action volontaire de l'utilisateur.

---

## 2. Le Référentiel des Aménagements WBE

### 2.1 Sources documentaires
Le référentiel unifie deux sources de terrain validées par les Pôles Territoriaux WBE :
- **Guide des aménagements raisonnables WBE Wapi A (498 fiches) :** Axé sur le fondamental, couvrant les 33 domaines (aménagements universels, langage oral, langage écrit, mathématiques, motricité fine, fonctions exécutives, organisation, autonomie, socio-affectif, sensoriel).
- **Kit Outils Secondaire WBE (49 fiches) :** Axé sur le secondaire (outils de compensation, matériel adapté, fiches mémos de synthèse et stratégies d'autonomie).

### 2.2 Rapprochement contextuel automatique
Dans le **PIA annuel** et la **Synthèse** :
- Le système analyse la formulation de la proposition (ex. *« Développer les stratégies de géométrie »*).
- Il détecte immédiatement le domaine (*Mathématiques & Géométrie*) et fait remonter 2 à 3 outils éprouvés (ex. *« Thamographe »*, *« Compas ergonomique Twist'n Safe »*, *« Flashcards des formules »*).
- Un clic sur la pastille insère la mention directement dans la proposition ou la note.

### 2.3 Recherche manuelle ciblée
Un bouton sobre `📚 Référentiel WBE` permet d'ouvrir la bibliothèque de recherche :
- Filtrage par niveau (*Fondamental*, *Secondaire*, *Universel*).
- Filtrage par domaine (*Lecture*, *Écriture*, *Mathématiques*, *Attention*, etc.).
- Recherche instantanée par mot-clé (*dyslexie, timer, surlignage, règle, fatigue*).
- Bouton *« Insérer »* ou *« Copier »*.

---

## 3. L'Assistant Pédagogique Local (IA 100 % Navigateur)

### 3.1 Compatibilité iPad & Safari
L'assistant est optimisé pour les processeurs Apple Silicon des iPad (Safari mobile). Il s'exécute de manière instantanée (< 10 ms) sans geler l'interface ni vider la batterie de l'appareil.

### 3.2 Fonctionnalités
- **✨ Reformulation professionnelle :** Transforme les notes prises rapidement en séance en phrases claires, bienveillantes, rédigées au style professionnel du PIA.
- **✏️ Correction orthographique & syntaxique :** Corrige les accords, les espaces et la typographie sans modifier le sens clinique.
- **📝 Synthèse en 3 points :** Condense les observations longues en 3 axes structurés (Situation, Démarche, Piste d'action).
- **🎯 Croisement avec les aides WBE :** Détecte les difficultés exprimées et propose les outils matériels ou pédagogiques correspondants.

### 3.3 Modalité de décision
À chaque action, une fenêtre comparative présente :
- Le texte initial (à gauche).
- La proposition de l'assistant (à droite, modifiable au clavier).
- Trois choix clairs :
  - `✓ Remplacer le texte`
  - `+ Ajouter à la suite`
  - `Annuler`


### 3.4 Connexion au dictionnaire local — prototype de test

L'assistant local normalise désormais les accents et la ponctuation avant de comparer le texte au dictionnaire thématique. Avant de proposer des fiches, il attend le chargement du référentiel WBE local puis combine les correspondances thématiques avec les fiches réellement retournées par ce référentiel.

La reformulation déterministe ne doit pas ajouter automatiquement une recommandation pédagogique absente du texte source. Les suggestions restent séparées du texte reformulé et nécessitent une insertion volontaire.

**Limite importante :** cette intégration permet de tester le dictionnaire et le rapprochement au référentiel, mais elle ne connecte pas encore les fichiers Gemma téléchargés à un moteur d'inférence. Les reformulations restent déterministes sur Safari si aucune API IA native compatible n'est disponible.
