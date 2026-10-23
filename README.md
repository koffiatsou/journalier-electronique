# Journalier électronique

> Application web qui accompagne le travail des agents des Pôles territoriaux WBE : planifier, encoder les séances, tenir le Journalier, préparer les réunions et rédiger le PIA.

**Version actuelle : V75** (octobre 2026, `package.json` 0.75.0).

Le Journalier électronique est **local-first** : les données de travail sont gérées dans le navigateur (stockage local granulaire chiffré), puis synchronisées vers l'espace OneDrive de l'utilisateur via Microsoft Graph (bidirectionnel, repli manuel possible).

## Ce que fait la V75

Un seul fil, du planning au PIA : **on encode une fois dans la séance**, et ce contenu alimente le Journalier Word, la préparation de réunion et le PIA.

1. **Agenda** : planification récurrente (Planifié → Réalisé automatique, Annulé), matières issues du dossier de l'élève.
2. **Séance** : deux zones comme la feuille papier (partie pédagogique, partie orthopédagogique), une échelle unique (partiellement, suffisamment, totalement) sans niveau coché d'office, statuts de présence dont « Agent du pôle absent ».
3. **Journalier** (ex-Historique) : séances affichées comme sur le papier, période modulable (année scolaire, état à ce jour, dates libres), export Word identifié ou dé-identifié.
4. **Réunion** : synthèse en langage simple, matière par matière, et propositions automatiques d'objectifs à valider.
5. **PIA** : cases du modèle officiel, procès-verbal, export Word officiel visible.

Détail du parcours : [`docs/PARCOURS_V75.md`](docs/PARCOURS_V75.md). Moteur de rédaction et export Word : [`docs/MOTEUR_REDACTION_ET_EXPORT_V75.md`](docs/MOTEUR_REDACTION_ET_EXPORT_V75.md).

### Identifiants techniques « v74 » conservés

Le dossier `src/v74/`, la base chiffrée `journalier-secure-v74`, l'objet global `JournalierV74` et les fichiers `*_V74.md` gardent leur nom : les renommer ferait perdre les données déjà stockées sur les appareils. Le numéro de version de l'application est V75.

### Modification des séances

Une séance enregistrée reste modifiable depuis le Journalier, le dossier Élève et l'Agenda. Le formulaire reprend les données de la séance et permet de changer l'élève rattaché (l'identifiant de la séance est conservé ; si elle était déjà synchronisée, le SyncManager la déplace entre dossiers `eleves/{studentId}/seances/` avec contrôle d'ETag).

### Stockage et sécurité

La V75 conserve l'architecture local-first, l'authentification Entra ID et la synchronisation Graph/OneDrive. Le **stockage local granulaire** vit dans un coffre IndexedDB chiffré ; l'ancien coffre `journalier-secure-v72` reste conservé pour la migration et la récupération. Voir [`docs/STOCKAGE_LOCAL_V74.md`](docs/STOCKAGE_LOCAL_V74.md), [`ARCHITECTURE.md`](ARCHITECTURE.md) et [`SECURITY.md`](SECURITY.md).

### Mis de côté

Le rapprochement avec le référentiel WBE (indicateurs d'apprentissage) est masqué dans la séance : il n'était pas assez fiable hors mathématiques. Il sera retravaillé avec les référentiels fournis par les utilisateurs.

---

## 1. Objectifs

Le projet vise notamment à permettre :

- l'encodage structuré des observations et séances ;
- la gestion des élèves et de leurs informations de suivi ;
- la gestion d'un agenda de travail ;
- l'exploitation de repères et indicateurs WBE ;
- l'import local de PIA précédents au format Word (`.docx`) ou PDF (`.pdf`) sans transmettre ni conserver le document original ;
- la génération de rapports et de synthèses ;
- un tableau de bord d’accueil avec tendances descriptives, suivi PIA et mémos personnels ;
- la conservation locale chiffrée des données ;
- la synchronisation contrôlée des données vers OneDrive ;
- la détection des conflits lors des synchronisations.

L'application doit rester un **outil d'appui au professionnel**. Les suggestions produites par le système ne constituent pas automatiquement des décisions pédagogiques.

---

## Migration sécurisée des anciennes données

La migration (introduite en V74) corrige l'intégration du module de migration legacy avec le code Graph/DataStore existant.

### Migration des données historiques

La migration est volontairement **contrôlée et non destructive** :

1. l'ancien dossier `Mes fichiers/Journalier` n'est pas lu directement par l'application ;
2. l'utilisateur copie manuellement ce dossier dans l'AppFolder ;
3. la copie est renommée `Journalier-legacy` ;
4. Journalier analyse cette copie ;
5. les profils, séances et l'agenda sont validés et normalisés ;
6. les conflits avec les données déjà présentes sont bloquants ;
7. les données validées sont importées dans `Journalier/` ;
8. la copie `Journalier-legacy` et le dossier original ne sont pas supprimés.

La migration ne demande **aucune permission Graph supplémentaire**. Elle reste limitée à `Files.ReadWrite.AppFolder`.

Le module de migration utilise un pont explicite (`JournalierMigrationBridge`) pour accéder uniquement aux fonctions de compatibilité historique nécessaires. Ce pont évite de dépendre directement du scope privé du script principal.

## PIA annuel et synthèse des séances

L'application comprend une couche de synthèse PIA directement dans l’application sans modifier le modèle métier ni le protocole de synchronisation OneDrive ; la persistance locale granulaire reste portée par le DataStore sécurisé.

### Cycle PIA

- **Réunion 1 — décembre** : réévaluation du PIA précédent lorsqu’il existe, ou construction d’un premier projet lorsqu’il n’existe pas.
- Les objectifs déjà présents peuvent être maintenus, reformulés, ajustés, remplacés ou complétés ; l'application ne choisit pas à la place du professionnel.
- **Pendant l’année** : les séances alimentent les éléments de preuve et les évolutions observées.
- **Réunion 2 — fin d’année** : réévaluation des objectifs à partir des nouvelles séances et définition des suites.

### Sources exploitées

Les observations de classe proviennent des **séances**. L'application exploite les données structurées de la séance (clés `q2` à `q6` : fonctionnement observé, compétence, aides, transfert, suite) ainsi que les champs `precision` et les autres textes renseignés. Les objectifs de leçon restent du contexte de séance et ne deviennent pas automatiquement des objectifs PIA.

### États de synthèse

La synthèse des propositions utilise des états explicables : `OBSERVATION`, `SIGNAL`, `TENDANCE`, `TENDANCE_QUALIFIEE` et `PROPOSITION`. Une `PROPOSITION` doit être validée par le professionnel pour devenir un élément du PIA annuel.

Les rapprochements entre ces rubriques sont documentaires et ne permettent pas au moteur d’affirmer une causalité.

### Exports

L'application organise la production documentaire en deux niveaux complémentaires :

1. **Document Officiel PIA WBE (Annexe 2)** :
   - Génération Word (`.docx`) et PDF (`.pdf`) strictement conformes au modèle officiel WBE (`public/modeles/PIA_modele_officiel_2025-09-11.docx`), sans recomposition destructrice et avec préservation intégrale des styles, logos vectoriels institutionnels et métadonnées (`Pôle Territorial WBE BXL`).
   - **Version de décembre (Réunion 1)** : remplissage du cartouche d'identité T1 (date de naissance `jj/mm/aaaa`, titulaire et coordonnées CPMS issus du dossier élève), du tableau des 5 aspects T2 (16 pt), du procès-verbal 1 (date en `jj/mm/aaaa`, tableau des présents T3 avec clonage au-delà de 9 personnes, retours des 6 partenaires avec fusion Direction + Équipe pédagogique, axe, objectifs et ressources) et du premier tableau d'aménagements T5 (marquage « X » centré, colonnes N°|P|O|M|Description, renumérotation automatique si > 10).
   - **Version de fin d'année (Réunion 2)** : reconduction intégrale et fidèle de la version de décembre (PV1 et T5 inchangés) complétée du procès-verbal 2 (PV2 / T7 avec retours, évaluation) et du tableau d'aménagements de rentrée (T8).
   - **Variante dé-identifiée (RGPD)** : neutralisation stricte de l'identité administrative T1 (cellules vides), conversion automatique des personnes présentes en rôles génériques (« Directeur », « Parent », « Titulaire », « CPMS », etc. sans patronyme), neutralisation des dates de réunion et retours individuels, métadonnées neutres et nommage anonymisé (`PIA - Élève 1 - ...`).
   - Le bouton « Exporter le PIA officiel (Word) » est visible en haut de l'onglet PIA annuel (réunion de décembre ou fin d'année, avec ou sans le nom de l'élève). Boutons d'exportation intégrés au bas de chaque écran de réunion : « 📄 Exporter en Word (.docx) », « 📑 Exporter en PDF (.pdf) », « 🛡️ Word dé-identifié » et « 🛡️ PDF dé-identifié » avec nommage automatique normalisé.
2. **Dossier de travail détaillé (usage interne)** :
   - Export Word (`.docx`) ou PDF (`.pdf`) reprenant l'ensemble des observations, séances et synthèses.
3. **Journalier (V75)** :
   - Word fidèle au Journalier papier (un bloc par séance), généré depuis l'onglet Journalier, identifié ou « sans le nom de l'élève ».
4. **Exports dé-identifiés & techniques** :
   - Modèle dé-identifié Word ou PDF (sans données directement identifiantes) et exports techniques JSON.

---

## Chronologie et Nomenclature des Chantiers

Afin d'assurer une traçabilité rigoureuse sans aucune ambiguïté, la désignation par **« Lots 1 à 6 »** est réservée au chantier en cours : **Modèle Officiel PIA WBE (2025-2026)**.

| Chantier | Dates | Thème majeur | Étapes / Contenu |
| :--- | :--- | :--- | :--- |
| **Chantier 0** | Septembre 2026 | **Socle V74 Initial** | Cycle annuel PIA, 5 domaines, persistance chiffrée, responsive mobile, réattribution des séances. |
| **Chantier 1** | 10–12 oct. 2026 | **Modularisation (M1 à M8)** | Extraction de `journalier-core.js` en 8 modules autonomes (`storage-vault`, `docx`, `pdf`, `reports`, `students`, `agenda`, `sessions`, `journalier-core` < 650 l.). |
| **Chantier 2** | 12–13 oct. 2026 | **Sécurité & Intégrité (SEC-1 à SEC-5)** | Chiffrement granulaire (SEC-1), hygiène de code (SEC-2), échappement HTML unifié (SEC-3), échappement XML 1.0 (SEC-4), échappement d'attributs et sanitisation des noms de fichiers (SEC-5). |
| **Chantier 3** | 15 oct. 2026 | **Ergonomie Locale (ERG-A à ERG-C)** | Retrait du prototype IA (ERG-A), introduction du bouton « Ajuster le texte » (ERG-B), agrégation stricte par matière en synthèse (ERG-C). |
| **Chantier 4** | 17–21 oct. 2026 | **Modèle Officiel PIA WBE (Lots 1 à 6)** | **Achevé** : Intégration du modèle officiel WBE en Word et PDF :<br>• *Lot 1* : Chaîne de données PIA (achevé)<br>• *Lot 2* : Profil élève & champs administratifs T1 (achevé)<br>• *Lot 3* : Modèle Word base OpenXML T1/T2 (achevé)<br>• *Lot 4A* : Remplissage officiel PV1, PV2, T5, T8 (achevé)<br>• *Lot 4B* : Interface d'export officiel réunions 1 & 2 (achevé)<br>• *Lot 5* : Export PDF officiel (achevé)<br>• *Lot 6* : Dé-identification modèle officiel Word & PDF (achevé) |
| **Chantier 5** | 21–23 oct. 2026 | **V75 : refonte séance → Journalier → PIA** | Moteur de rédaction déterministe, export Word du Journalier, page séance en deux zones, échelle unique, statut « Agent du pôle absent », période modulable, vue Réunion en langage simple, export PIA visible. |

## 2. Architecture générale

L'application est une SPA (Single Page Application) construite avec :

- **Vite** pour le développement et le build ;
- **JavaScript côté navigateur** ;
- **Microsoft Entra ID** pour l'identité et l'authentification ;
- **Microsoft Graph** pour l'accès au stockage OneDrive AppFolder ;
- **IndexedDB** pour le stockage local ;
- **AES-GCM** pour le chiffrement des données locales ;
- **GitHub Pages** pour l'hébergement de l'application.

L'architecture détaillée est décrite dans [`ARCHITECTURE.md`](ARCHITECTURE.md).

---

## 3. Authentification

L'application utilise Microsoft Entra ID avec MSAL Browser.

L'identité Entra sert notamment à :

- authentifier l'utilisateur ;
- isoler les données locales par identité ;
- autoriser l'accès à l'AppFolder OneDrive de l'utilisateur.

Les permissions Graph utilisées par l'application sont limitées au besoin actuel :

- `openid`
- `profile`
- `Files.ReadWrite.AppFolder`

Aucun secret client n'est embarqué dans l'application web.

---

## 4. Stockage local

Le fonctionnement est **local-first**. Depuis le chantier du 30 septembre 2026, le coffre local utilise une architecture granulaire `journalier-secure-v74` : les élèves, séances, événements Agenda, PIA et registres de synchronisation sont persistés séparément. Cela évite qu'une seule valeur IndexedDB volumineuse rende tout l'état local illisible.

Chaque enregistrement est protégé par AES-GCM avec une clé `CryptoKey` non extractible, un IV unique et des données authentifiées liées au compte, au type et à l'identifiant de l'objet. Les écritures critiques utilisent des transactions IndexedDB à durabilité stricte lorsque le navigateur le permet.

L'ancien coffre `journalier-secure-v72` n'est pas supprimé automatiquement : il sert de source de migration non destructive. Si son enregistrement historique est illisible, Journalier conserve la source et peut tenter une récupération depuis OneDrive AppFolder.

La conception détaillée est documentée dans [`docs/STOCKAGE_LOCAL_V74.md`](docs/STOCKAGE_LOCAL_V74.md).


Le modèle local comprend notamment les élèves, les séances, l'agenda, les informations de synchronisation et les éléments nécessaires au fonctionnement de l'application.

Le stockage local est strictement associé à l'identité de l'utilisateur. L'application ne doit pas adopter automatiquement une identité propriétaire provenant d'un fichier OneDrive.

---

## 5. Synchronisation OneDrive

La synchronisation utilise Microsoft Graph et l'**AppFolder OneDrive** de l'utilisateur.

L'application crée et utilise une structure dédiée :

```text
AppFolder
└── Journalier/
    ├── profil/
    ├── eleves/
    ├── agenda/
   ├── pia/{studentId}/pia.json
    └── system/
```

Les données métier ne sont pas écrites arbitrairement à la racine du OneDrive.

La synchronisation est gérée séparément du modèle pédagogique par le `SyncManager`.

Elle est déclenchée automatiquement après chaque sauvegarde locale, au retour au premier plan, à la reconnexion réseau, à la connexion Microsoft et par cycle périodique en arrière-plan; les actions manuelles (« Analyser », « Synchroniser ») restent disponibles et suivent le même parcours.

Elle comprend notamment :

- la comparaison entre données locales et distantes ;
- le suivi des modifications, y compris pour les PIA ;
- le rapatriement automatique des modifications distantes non conflictuelles avant l'envoi des modifications locales ;
- l'utilisation des ETags ;
- la détection des conflits HTTP 412 ;
- la validation des données JSON ;
- la gestion des éléments distants absents ;
- des diagnostics de synchronisation sans écriture distante.

---

## 6. PIA

Le traitement d'un PIA est conçu pour être effectué localement dans le navigateur.

Le document original n'est pas supposé être automatiquement transmis à Microsoft Graph pendant cette opération.

Les informations utiles peuvent ensuite être intégrées aux données de travail du Journalier selon les mécanismes prévus par l'application.

Il faut distinguer :

- **anonymisation**, qui supprime le caractère permettant d'identifier une personne ;
- **pseudonymisation**, qui conserve une possibilité de rattachement indirect.

Le détail du traitement PIA est documenté dans `ARCHITECTURE.md`.

---

## 7. Bibliothèque d'indicateurs et repères

Le dépôt contient deux référentiels JSON utilisés par l'application :

```text
public/
├── bibliotheque_indicateurs_v0_5_1.json
└── referentiel_pia_v74_0_3.json
```

La bibliothèque d'indicateurs servait au rapprochement entre observations, objectifs, matières et indicateurs. Depuis la V75, ce rapprochement est masqué dans la séance (voir « Mis de côté ») ; les fichiers restent dans le dépôt. Le référentiel PIA fournit les règles et seuils utilisés par le runtime V74.

Le fonctionnement pédagogique détaillé est décrit dans `ARCHITECTURE.md`.

---

## 8. Rapports et traitement pédagogique

L'espace **Rapports & PIA** réunit quatre onglets : **Journalier** (séances de la période, comme sur le papier), **Réunion** (synthèse en langage simple par matière), **Propositions** (propositions d'objectifs à valider) et **PIA annuel**. Le choix de période en haut de page (année scolaire par défaut) s'applique à l'ensemble.

Le traitement pédagogique est volontairement séparé de la couche de synchronisation.

Les fonctions de suggestion doivent rester des outils d'aide à l'analyse et à la préparation du travail professionnel.

---

## 9. Sécurité

Les principes de sécurité actuellement mis en œuvre comprennent notamment :

- authentification via Microsoft Entra ID ;
- permissions Graph limitées à l'AppFolder ;
- absence de secret client dans le frontend ;
- stockage local chiffré ;
- isolation des données par identité ;
- validation des données JSON ;
- protection contre certaines injections HTML/XSS ;
- contrôle des ETags lors des écritures distantes ;
- détection des conflits ;
- Content Security Policy ;
- validation des URL de téléchargement Graph ;
- pagination contrôlée des réponses Graph.

Le dépôt fait également l'objet de contrôles GitHub concernant les secrets et les workflows.

Les éléments de sécurité détaillés sont regroupés dans `SECURITY.md`.

---

## 10. Développement local

### Prérequis

Le projet utilise Node.js et npm.

Installation des dépendances :

```bash
npm ci
```

Lancer le serveur de développement :

```bash
npm run dev
```

Le serveur Vite est configuré pour utiliser le port `8000`.

Build de production :

```bash
npm run build
```

Prévisualisation du build :

```bash
npm run preview
```

---

## 11. Build et déploiement

Le projet est hébergé sur GitHub Pages.

Le déploiement est automatisé par GitHub Actions.

Le workflow de production :

1. récupère le dépôt ;
2. installe les dépendances ;
3. construit l'application avec Vite ;
4. prépare l'artefact GitHub Pages ;
5. déploie l'artefact sur GitHub Pages.

Le dépôt utilise également un workflow CI qui vérifie le build lors des Pull Requests.

Les Actions utilisées dans les workflows sont actuellement référencées par **SHA complet** afin de limiter le risque lié au déplacement ultérieur d'un tag d'action.

Le dépôt utilise également les mécanismes GitHub suivants pour la surveillance du code et des dépendances :

- Dependabot Alerts ;
- Dependabot Security Updates ;
- Dependabot Version Updates, avec une vérification hebdomadaire des dépendances npm et des GitHub Actions ;
- CodeQL / Code scanning pour JavaScript/TypeScript et GitHub Actions.

La première analyse CodeQL réalisée après son activation n'a signalé aucune alerte.


---

## 12. Structure du dépôt

```text
.
├── index.html                  # Point d'entrée SPA (CSP : script-src 'self')
├── msal-redirect.html
├── src/
│   ├── app/                    # Modules applicatifs (scripts classiques et modules)
│   │   ├── storage-vault.js, students-core.js, agenda-core.js, sessions-core.js,
│   │   │   reports-core.js, journalier-core.js
│   │   ├── redaction-engine.js, journalier-seances-docx.js     # V75 : texte et Word du Journalier
│   │   ├── session-levels.js, reunion-view.js                  # V75 : niveaux de la séance, vue Réunion
│   │   ├── html-escape.js, indicators.js
│   │   └── microsoft-core.js, apple-ux-enhancements.js,
│   │       referentiel-amenagements.js, local-ai-assistant.js  # modules
│   ├── v74/                    # Moteur PIA et exports officiels Word/PDF
│   ├── styles/
│   ├── msal-bridge.js, msal-redirect.js
├── public/
│   ├── modeles/                # Modèles Word : Journalier papier, PIA officiel
│   └── *.json, logo            # Référentiels et logo
├── tests/                      # Suites de tests (npm test)
├── scripts/build-zip.py        # Archive du projet (journalier-electronique-v75.zip)
├── docs/                       # Documentation détaillée (voir docs/README.md)
├── ARCHITECTURE.md, SECURITY.md, CHANGELOG.md, AGENTS.md
└── package.json, vite.config.js, eslint.config.js
```

Tout nouveau script classique doit être ajouté **à la fois** dans `index.html` et dans la liste `copyClassicAppScripts()` de `vite.config.js`.

---

## 13. Documentation du projet

| Document | Contenu |
| :--- | :--- |
| `README.md` | Point d'entrée : rôle, parcours V75, commandes |
| `ARCHITECTURE.md` | Référence technique détaillée (stockage, données, synchronisation, PIA, V75) |
| `SECURITY.md` | Principes et contrôles de sécurité |
| `CHANGELOG.md` | Historique des évolutions |
| `AGENTS.md` | Règles pour les IA de codage |
| `docs/README.md` | Index des guides par sujet |
| `docs/PARCOURS_V75.md` | Parcours utilisateur, du planning au PIA |
| `docs/MOTEUR_REDACTION_ET_EXPORT_V75.md` | Moteur de rédaction, modèle de séance, export Word |
| `docs/archive/` | Rapports de chantiers terminés (historique, non maintenus) |

Le cahier d'intégration UX V74 est [CAHIER_DES_CHARGES_V74_UX.md](docs/v74-design/CAHIER_DES_CHARGES_V74_UX.md), à titre de référence historique ; les écrans de séance, d'historique et de réunion ont changé en V75 (voir `docs/PARCOURS_V75.md`).

---

## 14. État actuel

Le projet dispose actuellement d'une chaîne fonctionnelle :

```text
Navigateur
   ↓
Journalier SPA
   ↓
Microsoft Entra ID / MSAL
   ↓
Microsoft Graph
   ↓
OneDrive AppFolder
```

La synchronisation AppFolder a été testée avec un mécanisme de diagnostic qui crée temporairement un dossier et un fichier JSON, vérifie leur écriture et leur lecture, puis les supprime.

Ce test est distinct du fonctionnement métier normal de l'application.

Le parcours de rapprochement entre un événement prévisionnel et une séance réelle a également été vérifié : lorsqu'une séance réelle correspondante est encodée, l'événement prévisionnel peut être reconnu comme enregistré via `getEncodedForEvent()`.


---

## 15. Architecture actuelle et évolutions futures

L'architecture actuelle est adaptée à un fonctionnement où chaque utilisateur dispose de son propre espace de données dans OneDrive.

Une architecture institutionnelle partagée, par exemple fondée sur un espace SharePoint commun, pourrait être étudiée ultérieurement si les besoins évoluent vers :

- des données partagées entre plusieurs professionnels ;
- une gestion centralisée ;
- des droits d'accès institutionnels ;
- une gouvernance documentaire commune.

Cette possibilité ne doit pas être confondue avec l'architecture actuelle.

---

## 16. Principe de documentation

Toute modification importante de l'architecture, de la sécurité, du modèle de données ou de la synchronisation doit être accompagnée d'une mise à jour de la documentation correspondante.

La documentation doit distinguer explicitement :

- ce qui est **actuellement implémenté** ;
- ce qui est **testé mais expérimental** ;
- ce qui est **prévu** ;
- ce qui est **hypothétique ou à étudier**.

L'objectif est de permettre à un futur développeur, auditeur ou assistant technique de comprendre rapidement l'état réel du projet sans devoir reconstruire toute son histoire à partir des commits.

---

## 17. Référentiel des Aménagements WBE et Assistant IA Local

### Référentiel des Aménagements Raisonnables WBE (Fondamental & Secondaire)

Un référentiel complet compilant **544 fiches d'aménagements et d'outils concrets** a été intégré :
- **Pôle Territorial Wapi A** (Enseignement fondamental, 498 fiches réparties sur les 33 domaines WBE) ;
- **Kit Outils Secondaire WBE** (Enseignement secondaire, 49 fiches d'outils et de stratégies matérielles).

**Principes d'intégration :**
- **Discrétion et non-surcharge :** Aucun bouton intrusif ni compteur criard dans la barre de navigation globale.
- **Rapprochement contextuel quasi-automatique :** Dans l'onglet PIA (PIA annuel et Synthèse), le système analyse le domaine de besoin de chaque proposition d'objectif et présente immédiatement 2 à 3 pastilles d'aménagements pertinentes (`💡 Aides suggérées`). Un clic insère l'aménagement directement.
- **Accès dédié :** Un bouton sobre `📚 Référentiel WBE` dans le PIA permet de faire une recherche par mot-clé (ex. *dyscalculie, compas, temps, casque*) et d'insérer en un clic.

### Assistant Pédagogique Local (IA 100% Hors-ligne & Respect du RGPD)

Conformément à la philosophie **Local-First** du Journalier et aux exigences strictes de protection de la vie privée des élèves :
- **100 % local dans le navigateur :** Aucun serveur distant, 0 octet émis sur Internet. Conforme RGPD et adapté au travail sur iPad (Safari mobile).
- **Aide à la rédaction :** Accessible via le bouton discret `✎ Ajuster le texte` à côté des zones de rédaction manuelle (objectifs PIA, remarques de séance).
- **Actions disponibles :**
  1. *Reformulation professionnelle :* Transforme des notes brutes ou télégraphiques en phrases bienveillantes, actives et centrées sur l'élève.
  2. *Correction orthographique & syntaxique :* Nettoie les coquilles et la ponctuation tout en préservant le vocabulaire spécialisé.
  3. *Synthèse en 3 points :* Dégage les 3 axes prioritaires d'une observation longue.
  4. *Croisement avec les aides WBE :* Suggère des outils concrets en correspondance avec les difficultés notées.
- **Validation humaine systématique :** L'assistant ne remplace jamais le praticien. Une modale comparative permet de visualiser l'ancien et le nouveau texte avec les choix `✓ Remplacer le texte`, `+ Ajouter à la suite` ou `Annuler`.

---

## 18. Référence technique

Pour une description détaillée du fonctionnement interne, consulter :

**[`ARCHITECTURE.md`](ARCHITECTURE.md)**

Pour les règles et contrôles de sécurité :

**[`SECURITY.md`](SECURITY.md)**

Pour le guide du référentiel et de l'IA locale :

**[`docs/REFERENTIEL_ET_IA_LOCALE_V74.md`](docs/REFERENTIEL_ET_IA_LOCALE_V74.md)**

Pour le parcours V75 et le moteur de rédaction :

**[`docs/PARCOURS_V75.md`](docs/PARCOURS_V75.md)** et **[`docs/MOTEUR_REDACTION_ET_EXPORT_V75.md`](docs/MOTEUR_REDACTION_ET_EXPORT_V75.md)**

Pour l'historique des évolutions :

**[`CHANGELOG.md`](CHANGELOG.md)**

---

## 19. Commandes de développement et validation

- **Lancer l'application en développement** :
  ```bash
  npm run dev
  ```
- **Vérifier la syntaxe du code (linter)** :
  ```bash
  npm run lint
  ```
- **Lancer la suite de tests (tests contractuels et fonctionnels)** :
  ```bash
  npm test
  ```
- **Lancer le filet de sécurité comportemental (parcours complet et exports Word/PDF/JSON)** :
  ```bash
  node --test tests/behavioral-safety-net.test.mjs
  ```
- **Construire la version de production** :
  ```bash
  npm run build
  ```
