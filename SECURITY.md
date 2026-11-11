# Sécurité

> Référence de sécurité du Journalier électronique (V2, React + TypeScript). Mise à jour le 11/11/2026, après le retrait de la V75.

Les contrôles décrits ici portent sur le code et la configuration versionnés dans ce dépôt. Les paramètres du tenant Microsoft Entra, les règles actives du dépôt GitHub et l'état courant des alertes GitHub ne se vérifient pas à partir du seul dépôt : à contrôler dans GitHub et dans Entra avant de s'y fier.

L'ancienne version (V75) et sa documentation de sécurité ont été retirées du dépôt ; elles restent lisibles à l'étiquette Git `v75-archive`.

## 1. Signaler un problème

Ne pas ouvrir de ticket public pour une faille ni y joindre des données d'élèves. Écrire directement à la personne responsable du projet (propriétaire du dépôt) ou utiliser le signalement privé de GitHub (« Report a vulnerability », onglet Security) s'il est activé.

## 2. Ce qu'il faut protéger

L'application manipule des données d'élèves mineurs (séances, observations, PIA) : confidentialité stricte, RGPD.

- **Aucune donnée réelle d'élève** dans le dépôt, les tests, les exemples ou les captures. Les exemples et les tests utilisent des données fictives (voir `v2/docs/exemples/`).
- Les données restent **sur l'appareil de l'agent** (navigateur) ; l'application n'a **aucun serveur**. La seule sortie de données est la synchronisation vers **l'espace OneDrive de l'agent** (et son agenda Outlook), avec son propre compte Microsoft.

## 3. Stockage local

- Base IndexedDB du navigateur, **chiffrée enregistrement par enregistrement** : AES-GCM 256 bits, IV aléatoire de 12 octets par enregistrement, données authentifiées liées au propriétaire, à la table et à l'identifiant (un enregistrement recopié ailleurs ne se déchiffre plus). Code : `v2/src/domain/coffre/`.
- La clé est créée **non extractable** : l'application s'en sert, personne ne peut la lire ni l'exporter.
- L'écran est **verrouillé** tant que l'agent n'est pas connecté ; « Verrouiller » ferme la session. Le mode essai (données fictives) est à part et ne se synchronise jamais avec un vrai compte.
- **Copie de secours** : fichier `.json` que l'agent garde lui-même. Avec un mot de passe (8 caractères au moins), le fichier est chiffré (PBKDF2-SHA256, 600 000 tours, puis AES-GCM). Sans mot de passe, il est **en clair** : à ranger comme un dossier d'élève.
- Limite connue : un appareil partagé ou non verrouillé, un navigateur compromis ou une extension malveillante restent hors de portée de ce chiffrement.

## 4. Connexion Microsoft

- Flux « code d'autorisation avec PKCE » (méthode recommandée pour une application web sans serveur). **Aucun mot de passe** ne passe par l'application ; aucun secret client (inscription Entra de type application monopage).
- Les jetons restent dans l'onglet (`sessionStorage`) : fermer le navigateur déconnecte.
- Droits demandés, et pas d'autres : `openid`, `profile`, `offline_access`, **`Files.ReadWrite.AppFolder`** (dossier propre à l'application, pas tout OneDrive) et **`Calendars.ReadWrite`** (liaison avec l'agenda Outlook, seulement si l'agent l'accepte).
- Les identifiants de l'inscription (`clientId`, `tenantId`) sont publics, pas des secrets. L'adresse de retour déclarée chez Entra est `<site>/msal-redirect.html` ; toute autre adresse devenue inutile (par exemple `<site>/v75/msal-redirect.html`) doit être retirée de l'inscription.

## 5. OneDrive et Outlook

- Les fichiers sont écrits dans le dossier de l'application sous `v2/` (`eleves`, `seances`, `agenda`, `reglages`) ; protégés par Microsoft, **pas par un mot de passe supplémentaire** (décision validée).
- Aucun écrasement silencieux : les conflits sont présentés à l'agent. Les données `demo-…` ne partent jamais vers un vrai compte. Un événement Outlook qui ne porte pas le repère de l'application n'est jamais modifié.
- Les réponses de Microsoft Graph et le contenu des fichiers lus sont **validés par des schémas zod** avant usage (`v2/src/domain/synchro/schemas.ts`, `v2/src/synchro/schemas-microsoft.ts`) : une réponse inattendue donne une erreur claire, pas un comportement indéfini. Un fichier abîmé est signalé, jamais ignoré en silence.

## 6. Application web

- **Politique de sécurité du contenu (CSP)** dans `v2/index.html` : `default-src 'self'`, `script-src 'self'`, `style-src 'self'`, `object-src 'none'`, `base-uri 'none'`, `form-action 'none'` ; `connect-src` limité à `login.microsoftonline.com`, `graph.microsoft.com`, `*.sharepoint.com` et `*.files.1drv.com`.
- **Aucun script ni gestionnaire d'événement en ligne.** React échappe le texte ; aucun HTML construit à la main.
- Pas de service worker, pas de statistiques, pas de pistage, pas de ressource externe (polices, scripts) chargée depuis un tiers.
- Les exports Word (Journalier, PIA) sont produits dans le navigateur ; une version **dé-identifiée** existe pour les partager hors du cercle des professionnels concernés.

## 7. Dépendances

- Trois dépendances d'exécution seulement (`react`, `react-dom`, `zod`), **versions exactes** (sans `^`) et `v2/package-lock.json` versionné ; installation par `npm ci`.
- Dependabot surveille `/v2` (npm) et les actions GitHub, chaque semaine (`.github/dependabot.yml`). Une mise à jour se relit avant fusion : elle passe par une PR et par la CI.
- `npm audit` doit rester à 0 faille avant fusion d'une mise à jour de sécurité.

## 8. GitHub, CI et déploiement

- **Pages** : le site est servi en HTTPS depuis GitHub Pages ; le dossier publié est `v2/dist`, compilé par `.github/workflows/main.yml`.
- **Actions** : permissions explicites et minimales (`contents: read` ; le déploiement ajoute `pages: write` et `id-token: write`). Les actions sont **épinglées par leur empreinte complète** (SHA de commit).
- **CI** (`.github/workflows/ci.yml`, sur chaque PR vers `main`) : `npm run check` (types, tests, compilation) puis les parcours dans un vrai navigateur (Playwright : Chromium et WebKit), dont l'audit d'accessibilité.
- **Analyse de code** : CodeQL (réglage par défaut) sur le code JavaScript/TypeScript, les actions GitHub et Python.
- **`main`** : la protection (PR obligatoire, statut CI exigé, pas de force push) est un paramètre GitHub, non vérifiable ici ; à revalider dans les réglages du dépôt.
- **Secrets** : aucun secret dans le dépôt ni dans l'historique récent ; `.env*` est ignoré par Git. Ne jamais committer un jeton, un mot de passe ou une clé.

## 9. Règles pour les prochaines modifications

1. Ne jamais ajouter de donnée réelle d'élève (code, tests, exemples, captures, messages de commit).
2. Ne pas affaiblir la CSP (pas de `unsafe-inline`, pas de nouvel hôte dans `connect-src` sans décision explicite) ; le parcours `tools/navigateur/site.mjs` et les tests la surveillent.
3. Ne pas élargir les droits Microsoft (`DROITS` dans `v2/src/synchro/connexion.ts`) sans décision explicite.
4. Toute nouvelle dépendance se discute avant ; version exacte, lockfile mis à jour.
5. Aucune erreur avalée en silence, surtout dans le chiffrement et la synchronisation.
6. Ne pas renommer la base locale ni le dossier OneDrive `v2/` : ce serait perdre le lien avec les données déjà enregistrées.

## 10. Limites

Ce document n'est ni un audit indépendant, ni une certification, ni une analyse RGPD complète, ni une garantie d'absence de vulnérabilité. La sécurité réelle dépend aussi du compte Microsoft 365, du navigateur, du poste utilisé, des règles de l'établissement et de la configuration Entra.
