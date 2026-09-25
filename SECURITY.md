# Security

> Référence de sécurité du Journalier électronique — état au 24 septembre 2026.

## 1. Objet

Ce document décrit les mécanismes de sécurité actuellement présents dans le projet, les contrôles effectués et les limites connues.

Il ne constitue pas une certification de sécurité ni une garantie d'absence de vulnérabilité.

---

## 2. Modèle de sécurité

Le Journalier traite des données potentiellement sensibles relatives à des élèves.

L'architecture actuelle repose sur plusieurs principes :

- identité fournie par Microsoft Entra ID ;
- isolation des données par utilisateur ;
- stockage local chiffré ;
- synchronisation explicite vers l'AppFolder OneDrive ;
- permissions Microsoft Graph limitées au besoin actuel ;
- validation des données avant synchronisation ;
- détection des conflits lors des écritures distantes ;
- séparation entre données pédagogiques et couche de synchronisation.

L'application fonctionne selon un modèle **local-first**.

---

## 3. Identité et authentification

L'authentification est assurée par Microsoft Entra ID avec MSAL Browser.

Configuration actuellement utilisée :

- `openid`
- `profile`
- `Files.ReadWrite.AppFolder`

La permission Microsoft Graph utilisée pour le stockage est :

```text
Files.ReadWrite.AppFolder
```

L'application n'utilise pas de `client_secret` dans le frontend.

L'identité Entra est utilisée pour isoler les données locales. L'application ne doit pas adopter automatiquement une identité propriétaire provenant des données distantes.

---

## 4. Stockage local

Les données locales sont stockées dans IndexedDB.

Elles sont protégées par un mécanisme de chiffrement AES-GCM.

Le modèle de stockage est associé à l'identité de l'utilisateur afin d'éviter qu'un compte puisse récupérer directement les données locales d'un autre compte.

Le fonctionnement détaillé du stockage local est décrit dans `ARCHITECTURE.md`.

---

## 5. Données PIA

Le traitement du PIA est conçu pour être réalisé localement dans le navigateur.

Le document PIA original n'est pas supposé être automatiquement envoyé vers Microsoft Graph pendant son analyse.

Il faut distinguer :

- anonymisation ;
- pseudonymisation ;
- données directement identifiantes.

Le fait qu'une donnée soit traitée localement ne constitue pas à lui seul une garantie générale de conformité : la gestion des données introduites dans l'application doit rester conforme aux règles institutionnelles applicables.

---

## 6. Microsoft Graph et OneDrive

L'application utilise l'AppFolder OneDrive de l'utilisateur.

Structure actuelle :

```text
AppFolder
└── Journalier/
    ├── profil/
    ├── eleves/
    ├── agenda/
    └── system/
```

Les opérations Graph sont réalisées avec les permissions prévues pour l'AppFolder.

Les écritures utilisent les ETags lorsque le mécanisme de synchronisation l'exige.

Un conflit `HTTP 412 Precondition Failed` est traité comme un conflit de synchronisation et non comme une autorisation d'écraser silencieusement la donnée distante.

---

## 7. Téléchargement des fichiers Graph

Pour la lecture du contenu JSON distant, l'application utilise l'URL de téléchargement pré-authentifiée fournie par Microsoft Graph via :

```text
@microsoft.graph.downloadUrl
```

L'application vérifie notamment :

- que l'URL utilise HTTPS ;
- que le domaine appartient aux domaines attendus ;
- que le contenu retourné peut être interprété comme JSON.

Cette approche évite d'utiliser directement une requête navigateur vers l'endpoint `/content` avec le jeton d'autorisation.

---

## 8. Validation des données

Les données utilisées par le système de synchronisation sont validées avant leur prise en compte.

Les validations portent notamment sur :

- la structure attendue des objets ;
- l'identité du propriétaire ;
- les identifiants ;
- les types de données ;
- les éléments de synchronisation ;
- les contenus JSON.

Les données de test du mécanisme AppFolder disposent d'un traitement distinct afin de ne pas être confondues avec les données métier.

---

## 9. Protection contre les écritures concurrentes

La synchronisation utilise les ETags Microsoft Graph.

Lorsqu'une version distante a changé entre la lecture et l'écriture, l'application peut recevoir :

```text
HTTP 412 Precondition Failed
```

Ce mécanisme permet de détecter une modification concurrente plutôt que d'effectuer une écriture aveugle.

La résolution du conflit reste une opération explicite.

---

## 10. Content Security Policy et sécurité du frontend

L'application utilise une Content Security Policy.

La CSP limite notamment les origines autorisées pour les connexions nécessaires au fonctionnement de l'application.

Les scripts inline protégés par la CSP utilisent des hashes SHA-256 correspondant aux scripts autorisés.

Le code comporte également des mécanismes de protection contre certaines injections HTML/XSS.

---

## 11. Sécurité GitHub

### GitHub Pages

Le projet est déployé sur GitHub Pages.

Le dépôt utilise HTTPS pour le site publié.

Aucun domaine personnalisé n'est actuellement utilisé.

### Protection de `main`

La branche `main` est protégée par un Ruleset actif.

Les règles actuellement configurées comprennent notamment :

- Pull Request obligatoire avant fusion ;
- vérification du statut CI ;
- restriction des suppressions ;
- blocage des force pushes.

Le contrôle CI `build` est requis avant la fusion.

---

## 12. GitHub Actions

Les workflows disposent de permissions explicites.

Le workflow de déploiement utilise notamment :

```text
contents: read
pages: write
id-token: write
```

Le workflow CI utilise :

```text
contents: read
```

La création et l'approbation automatique de Pull Requests par les workflows ne sont pas autorisées dans les paramètres actuellement audités.

Les Actions utilisées dans les workflows sont référencées par leur SHA complet.

Cela concerne actuellement :

- `actions/checkout`
- `actions/setup-node`
- `actions/configure-pages`
- `actions/upload-pages-artifact`
- `actions/deploy-pages`

Cette configuration limite le risque lié au déplacement ultérieur d'un tag d'Action.

---

## 13. Secrets et historique Git

Un contrôle GitHub Secret Scanning a été effectué.

Résultat observé :

```text
0 Open
0 Closed
No secrets found
```

Un audit complémentaire de l'historique Git a également été effectué.

Les recherches ont porté notamment sur des motifs correspondant à :

- `client_secret`
- mots de passe ;
- access tokens ;
- refresh tokens ;
- bearer tokens ;
- clés privées ;
- API keys ;
- secret keys.

Aucun secret exploitable n'a été identifié lors de cet audit.

Une occurrence de `accessToken` a été retrouvée dans `index.html`, mais elle correspond à un terme de programmation et non à une valeur de token exposée.

Ces contrôles ne constituent pas une preuve mathématique de l'absence de tout secret historique ou futur.

---

## 14. Dépendances

Le projet utilise npm.

Le lockfile est versionné dans Git.

La dépendance Vite a été mise à niveau vers :

```text
vite 8.3.0
```

Un `npm ci` et un build de production ont été exécutés après cette mise à jour.

Le résultat observé était :

```text
0 vulnerabilities
```

La surveillance automatisée des dépendances est maintenant configurée avec Dependabot.

La configuration couvre :

- les dépendances npm ;
- les GitHub Actions ;
- une fréquence hebdomadaire ;
- jusqu'à 5 Pull Requests Dependabot ouvertes par écosystème.

Les alertes de sécurité et les mises à jour de sécurité Dependabot sont également activées dans les paramètres du dépôt.

Cette automatisation constitue un mécanisme de surveillance continue, mais ne garantit pas l'absence de vulnérabilité future.

---

## 15. CI et déploiement

Le workflow CI vérifie le build lors des Pull Requests vers `main`.

Le workflow de déploiement construit ensuite l'application et la publie sur GitHub Pages après fusion sur `main`.

La protection de `main` et le contrôle CI réduisent le risque qu'une modification non vérifiée soit directement publiée.

---

## 16. Code scanning / CodeQL

Le dépôt utilise GitHub CodeQL avec le **Default setup**.

La configuration actuelle analyse notamment :

- JavaScript / TypeScript ;
- GitHub Actions.

La première analyse CodeQL effectuée après l'activation s'est terminée avec succès.

Résultat observé :

```text
0 code scanning alerts
```

Ce résultat correspond à l'état du dépôt au moment de l'analyse et ne constitue pas une garantie d'absence de vulnérabilité future.

---

## 17. Diagnostic AppFolder

Le projet possède un mécanisme de diagnostic permettant de vérifier le fonctionnement de l'AppFolder.

Le test :

1. crée temporairement un dossier ;
2. écrit un fichier JSON de test ;
3. relit le fichier ;
4. vérifie son contenu ;
5. supprime le fichier ;
6. supprime le dossier temporaire.

Ce test ne constitue pas une opération métier et ne doit pas être confondu avec la synchronisation normale du Journalier.

Le test AppFolder a été validé après correction du mécanisme de lecture Graph.

---

## 18. Contrôles effectués

À la date de rédaction de ce document :

### 🟢 Contrôlé

- authentification Entra ID ;
- fonctionnement MSAL ;
- accès AppFolder ;
- écriture / lecture / suppression du test AppFolder ;
- permissions Graph utilisées ;
- protection de `main` ;
- CI sur Pull Request ;
- SHA pinning des GitHub Actions ;
- Secret Scanning ;
- audit de l'historique Git ;
- build Vite ;
- `npm ci` ;
- absence de vulnérabilités npm lors du dernier audit effectué ;
- configuration Dependabot Alerts ;
- configuration Dependabot Security Updates ;
- configuration Dependabot Version Updates ;
- surveillance hebdomadaire des dépendances npm ;
- surveillance hebdomadaire des GitHub Actions ;
- CodeQL / Code scanning ;
- première analyse CodeQL ;
- absence d'alerte CodeQL lors de cette analyse ;
- vérification du parcours prévision → formulaire → sauvegarde → rapprochement ;
- validation de `getEncodedForEvent()` ;
- tests E2E déjà réalisés sur le parcours réel de l'application ;
- déploiement GitHub Pages ;
- HTTPS du site publié.

### 🟠 À maintenir / surveiller

- évolution des dépendances npm ;
- évolution des runtimes GitHub Actions ;
- évolution de l'environnement `ubuntu-latest` ;
- politique générale des GitHub Actions ;
- règles de sécurité GitHub ;
- évolution des permissions Entra / Graph ;
- évolution des mécanismes de synchronisation ;
- nouvelles alertes Dependabot ;
- nouvelles alertes CodeQL.

### 🔵 À traiter ultérieurement

- éventuelle restriction de la politique « Allow all actions » ;
- tests de sécurité complémentaires ;
- éventuelle mise en place d'une revue automatisée des dépendances dans les Pull Requests ;
- évolution vers une architecture institutionnelle partagée si les besoins du projet changent.

---

## 19. Limites

Les contrôles décrits dans ce document ne constituent pas :

- un audit de sécurité indépendant ;
- une certification ;
- une analyse juridique ou RGPD complète ;
- une garantie d'absence de vulnérabilité ;
- une garantie que les données introduites dans l'application sont appropriées pour tout contexte institutionnel.

La sécurité réelle dépend également de l'environnement Microsoft 365, du compte utilisateur, du navigateur, du poste utilisé, des politiques institutionnelles et de la configuration Entra.

---

## 20. Règles pour les futures modifications

Toute modification touchant :

- l'authentification ;
- les permissions Graph ;
- le stockage local ;
- le chiffrement ;
- la synchronisation ;
- la CSP ;
- les workflows GitHub Actions ;
- les dépendances ;
- le déploiement ;

doit entraîner une réévaluation de ce document.

Une modification de sécurité importante doit être testée avant fusion dans `main`.

Les nouveaux secrets ne doivent jamais être placés dans le frontend, le dépôt Git ou les fichiers publiés par GitHub Pages.

---

## 21. Principe directeur

Le Journalier doit appliquer le principe suivant :

> **Minimiser les données exposées, limiter les permissions, vérifier les données avant synchronisation et ne jamais remplacer silencieusement une donnée distante lors d'un conflit.**

La sécurité doit être considérée comme une propriété évolutive du projet et non comme un état définitif.


# 22. Contrôles spécifiques V73

## 22.1 Périmètre

V73 est une extension côté navigateur. Elle ne doit pas contourner l’authentification, le DataStore ou le SyncManager existants.

## 22.2 Données pédagogiques

Les séances et PIA sont des données potentiellement sensibles. V73 doit conserver les mêmes protections que V72 : identité Entra, isolation par utilisateur, stockage local protégé et synchronisation vers l’AppFolder.

## 22.3 Continuité et validation

Le PIA précédent est utilisé comme source de continuité. Il n’est jamais considéré comme une vérité automatiquement validée. Les objectifs générés par V73 restent à l’état `PROPOSITION` jusqu’à une action du professionnel.

## 22.4 Dé-identification

L’export modèle dé-identifié retire au minimum les champs directement identifiants utilisés par le PIA généré (`eleve`, `studentId`, `ecole`, `classe`) et neutralise la continuité nominative. La dé-identification doit continuer à être auditée si le schéma PIA évolue.

## 22.5 Causalité

V73 ne doit pas transformer la co-présence d’une observation, d’une aide et d’un effet dans une séance en relation causale. Les relations sont documentaires et longitudinales.

## 22.6 Journalisation / traçabilité

Le PIA généré conserve les identifiants de séances et les états de convergence nécessaires à l’explication des propositions. Cette traçabilité est professionnelle et ne doit pas être publiée dans un corpus dé-identifié si elle contient des identifiants.

## 22.7 Règle pour les prochaines évolutions

Toute nouvelle fonction V73/V74 doit vérifier au minimum :

- authentification Entra ;
- périmètre Graph/AppFolder ;
- persistance DataStore ;
- dé-identification des exports ;
- absence de secret dans le frontend ou le dépôt ;
- CSP/XSS ;
- validation des entrées ;
- conflits/ETag ;
- absence de causalité ou de décision pédagogique automatique ;
- cohérence avec le modèle PIA existant.


### V73.0.1 — continuité et validation
- Les données du PIA restent dans le même périmètre de stockage par compte/agent.
- La validation des propositions est une action explicite du professionnel.
- Le PIA précédent n’est jamais promu automatiquement au rang de vérité ; il est conservé comme source de continuité.
- Les exports dé-identifiés retirent les identifiants élève connus par le moteur.
- Les relations entre questions de séance restent documentaires et non causales.
