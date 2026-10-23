# Changelog

## 2026-10-23 — V75 : refonte séance → Journalier → réunion → PIA

- **Agenda** : les matières proposées viennent du dossier de l’élève (qui accepte désormais de nouvelles matières). « Planifié » passe seul à « Séance enregistrée ». Nouveau motif « Agent du pôle absent ».
- **Séance** : deux zones comme la feuille papier (partie pédagogique / orthopédagogique). Une seule échelle (partiellement / suffisamment / totalement) sans niveau coché d’office ; une fois choisi, seul le niveau reste affiché. Aides avec effet (aucun / partiel / positif). Enregistrement bloqué tant qu’un niveau manque.
- **Moteur de rédaction** (`src/app/redaction-engine.js`) : texte déterministe, voix neutre, évolution, absences, synthèse par matière.
- **Journalier** (ex-Historique) : période par défaut = année scolaire, « état à ce jour », dates libres ; séances affichées comme sur le papier ; bouton « Exporter le Journalier (Word) », identifié ou dé-identifié.
- **Word** : le Journalier est généré dans le modèle papier (un bloc par séance).
- **Réunion** : vue en langage simple par matière (points d’appui, points à travailler, compétence, aides) ; export officiel du PIA visible dans l’onglet PIA.
- Corrections : champs de dates toujours visibles, année par défaut figée dans les exports PIA, débordement de l’en-tête sur mobile.
- Référentiel WBE : mise en veille (à reconstruire avec les référentiels fournis).
- **Version** : application passée en V75 (`package.json` 0.75.0, archive `journalier-electronique-v75.zip`). Identifiants techniques « v74 » conservés (`src/v74/`, base `journalier-secure-v74`, `JournalierV74`) pour la compatibilité des données.
- **Documentation** : README, ARCHITECTURE (chapitres 10 et 32), SECURITY (chapitre 24), AGENTS, `docs/README.md` mis à jour ; nouveaux `docs/PARCOURS_V75.md` et `docs/MOTEUR_REDACTION_ET_EXPORT_V75.md` ; rapports de chantiers terminés déplacés dans `docs/archive/chantiers-v74/`.
- **Nettoyage** : suppression des restes du gabarit AI Studio (`src/App.tsx`, `src/main.tsx`, `src/index.css`, `vite.config.ts`, `tsconfig.json`, `bun.lock`, `metadata.json`, `.env.example`), des archives zip périmées de `public/`, et du réglage `DISABLE_HMR`. Les PIA d'exemple fictifs sont dans `docs/exemples/`. Le script `build-zip.py` inclut désormais `.github/`.


## 2026-10-21 — Chantier 4 (Lot 6) : Dé-identification du modèle officiel (Word et PDF)

- **Anonymisation stricte de la Table 1 (Identité) :**
  - Cellules neutralisées (chaînes vides) pour le nom de l'élève, la date de naissance, l'école, la classe/option, le titulaire, le CPMS et les coordonnées des responsables légaux.
  - Seule la mention institutionnelle du pôle (« Pôle Territorial WBE BXL ») est conservée.
- **Anonymisation des personnes présentes (PV1 & PV2) :**
  - Conversion automatique des participants en rôles / fonctions génériques (« Directeur », « Parent », « Titulaire », « CPMS », etc.) avec exclusion absolue des patronymes et prénoms.
- **Neutralisation des dates de réunions et retours des participants :**
  - Dates de réunion neutralisées (cellules vides dans l'export officiel dé-identifié).
  - Retours nominatifs et observations des partenaires neutralisés pour prévenir toute fuite de données indirectes.
- **Métadonnées de fichiers neutres :**
  - Métadonnées neutralisées dans `docProps/core.xml` (Word) et `/Info` (PDF) avec titre « PIA — Modèle dé-identifié » et auteur institutionnel neutre.
  - Nommage de fichier officiel anonymisé (`PIA - Élève 1 - décembre [année].docx` / `.pdf` ou `PIA - Élève 1 - fin d'année [année].docx` / `.pdf`).
- **Interface utilisateur & conformité CSP :**
  - Boutons dédiés « 🛡️ Word dé-identifié » et « 🛡️ PDF dé-identifié » ajoutés sur les barres d'exportation des réunions 1 et 2.
  - Gestionnaires enregistrés dans `JR_HANDLERS` (`h89`, `h90`, `h91`, `h92`) sans script inline.
- **Tests & validation :**
  - Création de la suite de tests `tests/pia-lot6-deidentification.test.mjs` (7/7 tests validés).

## 2026-10-20 — Chantier 4 (Lot 5) : Export PDF officiel équivalent au Word

- **Moteur PDF officiel autonome (`src/v74/v74-pdf-export.js`) :**
  - Rendu vectoriel natif PDF 1.4 sans dépendance externe ni bibliothèque tierce.
  - Source unique de vérité : exploitation du même modèle intermédiaire `buildOfficialPIADocumentModel`.
  - Page 1 en orientation Paysage (A4 paysage pour T1 Identité et T2 Cinq aspects).
  - Pages suivantes en orientation Portrait (PV1, T5 Aménagements, PV2 Réévaluation, T8 Aménagements rentrée).
  - Tracé vectoriel natif du logo institutionnel des Pôles territoriaux.
  - Boutons d'export PDF officiel intégrés dans les réunions 1 et 2 (`h87` et `h88`).
- **Tests & validation :**
  - Suite de tests contractuels `tests/pia-lot5-export-pdf-officiel.test.mjs` (9/9 tests validés).

## 2026-10-19 — Harmonisation documentaire, assainissement de public/ et chronologie unifiée des chantiers

- **Nomenclature unifiée et suppression définitive des confusions de numérotation :**
  - Le vocable **« Lot [1 à 6] »** est désormais réservé exclusivement au chantier actif en cours : **Chantier 4 — Modèle Officiel PIA WBE (2025-2026)**.
  - Tous les chantiers et étapes antérieurs sont renommés selon une typologie explicite :
    - **Chantier 1 (Modularisation M1 à M8)** : extraction modulaire du cœur applicatif (`storage-vault`, `docx-export`, `pdf-export`, `reports-core`, `students-core`, `agenda-core`, `sessions-core`, `journalier-core`) ;
    - **Chantier 2 (Sécurité & Intégrité SEC-1 à SEC-5)** : audits de persistance chiffrée, hygiène et moteurs d'échappement unifiés (`html-escape.js`) ;
    - **Chantier 3 (Ergonomie & Rédaction Locale ERG-A à ERG-C)** : retrait du prototype IA générative, introduction de « Ajuster le texte » et cloisonnement par matière en synthèse.
- **Hygiène et assainissement de l'espace public/ :**
  - Confirmation du retrait des fichiers de contrôle temporaires générés lors des tests des Lots 3 et 4A.
  - Seul le modèle officiel de référence vierge `public/modeles/PIA_modele_officiel_2025-09-11.docx` est conservé dans `public/modeles/`.
  - Aucun bouton de test résiduel dans l'interface : seuls les boutons officiels intégrés dans les réunions 1 et 2 subsistent.
- **Documentation et alignement :**
  - Mise à jour d'`ARCHITECTURE.md` et `README.md` intégrant le moteur Word complet (`v74-docx-export.js` + `v74-docx-pia-pv.js`), la prise en compte des champs Titulaire et CPMS de la fiche élève, et le tableau chronologique complet.

## 2026-10-18 — Chantier 4 (Lot 4B) : Interface d'export du Word officiel

- **Interface d'export officielle sur les écrans existants :**
  - Ajout du bouton « Exporter la version de décembre » au bas de l'écran de la réunion 1 (décembre).
  - Ajout du bouton « Exporter la version de fin d'année » au bas de l'écran de la réunion 2 (fin d'année, incluant PV1 et PV2).
  - Renommage de l'export détaillé préexistant en « Dossier de travail détaillé (usage interne) » dans `index.html` et `v74-runtime.js`.
  - Aucune nouvelle page ni nouvel écran créé ; pas d'export PDF officiel (réservé au Lot 5).
- **Nommage des fichiers officiels (`buildOfficialPIAFileName`) :**
  - Respect strict du format : « PIA - Nom Prénom - décembre [année] » et « PIA - Nom Prénom - fin d'année [année] ».
  - Déduction automatique de l'année : année de début pour décembre, année de fin pour fin d'année (ex. 2026-2027 : décembre 2026, fin d'année 2027 ; repli 2026/2027 si non renseignée).
  - Retrait automatique des caractères interdits (`/ \ : * ? " < > |`), préservation fidèle des lettres accentuées et des traits d'union, gestion des noms vides ou blancs (« PIA - décembre 2026.docx »).
- **Téléchargement par Blob & compatibilité Safari/iPad :**
  - Téléchargement direct sans serveur via Blob et `URL.createObjectURL` (`downloadBytes`).
  - Fonctionnement garanti sur document partiel ou vide (aucun blocage, aucune erreur).
- **Conformité CSP & Architecture :**
  - Routage exclusif des interactions par le registre `JR_HANDLERS` (`h84` pour réunion 1, `h85` pour réunion 2) sans aucun attribut `onclick` inline.
  - Aucune nouvelle dépendance introduite.
- **Tests et validation :**
  - Création de la suite de test contractuelle `tests/pia-lot4b-export-interface.test.mjs` couvrant le nommage (normal, accents, caractères interdits, nom vide), la présence des boutons, la génération de documents .docx valides complets et vides, et le registre `JR_HANDLERS`.
  - Intégration dans `npm test` ; 100% des 35 suites de tests au vert.

## 2026-10-18 — Chantier 4 (Lot 4A) : Moteur Word officiel pour PV1, PV2 et Tableaux d'aménagements (T5 & T8)

- **Moteur modulaire dédié (`src/v74/v74-docx-pia-pv.js`) :**
  - Remplissage des Procès-verbaux 1 et 2 hors tableaux (« Date : » formatée jj/mm/aaaa sans gras avec police préservée).
  - Gestion dynamique du tableau des personnes présentes (T3 pour PV1, T6 pour PV2) : 9 cases par défaut (3x3), clonage de lignes de 3 cellules si > 9 personnes (ex. 11 personnes = 4 lignes, aucune perte).
  - Remplissage du procès-verbal 1 (T4) et procès-verbal 2 (T7) : ligne qui suit chaque libellé pour les cases pleine largeur (axe, objectifs/critères, ressources/moyens, évaluation) et paires de cellules pour les retours (fusion Direction + École / équipe sans perte de contenu).
  - Remplissage des tableaux d'aménagements (T5 pour décembre, T8 pour fin d'année) : 10 lignes de base avec ordre de colonnes N° | P | O | M | Description, marquage « X » centré, clonage et renumérotation au-delà de 10 aménagements.
  - Préservation intégrale des propriétés `pPr`/`rPr` des paragraphes vides (14 pt dans PV, 16 pt dans T5/T8), des paragraphes vides restants et prise en charge des retours à la ligne multi-lignes.
  - Échappement rigoureux des entités XML (`&`, `<`, `>`, `"`, `'`).
- **Validation d'intégrité et de schéma Word :**
  - Respect scrupuleux de l'ordre du schéma WordprocessingML : positionnement impératif de `<w:jc>` avant `<w:rPr>`.
  - Préservation du modèle officiel `public/modeles/PIA_modele_officiel_2025-09-11.docx` (SHA-256 certifié).
- **Corrections de conformité et validation de schéma Word (Fin du Lot 4A) :**
  - Correction de l'ordre des éléments dans `w:pPr` : insertion impérative de `<w:jc>` AVANT `<w:rPr>` (conformité stricte au schéma WordprocessingML).
  - Complétion du test P6 dans `tests/pia-lot4a-pv-amenagements.test.mjs` vérifiant que l'export de fin d'année conserve l'intégralité du PV1 (date, axe, objectifs, ressources, présents) et T5 identiques à la version de décembre.
  - Ajout du test contractuel P10 vérifiant l'absence absolue de tout `<w:jc>` après un `<w:rPr>` dans les `w:pPr` générés (décembre et fin d'année).
- **Tests et validation :**
  - Suite de tests contractuels `tests/pia-lot4a-pv-amenagements.test.mjs` validant P1 à P10 (100% au vert).
  - Zéro régression sur les 34 suites de tests.

## 2026-10-17 — Chantier 4 (Lot 3) : Modèle de document PIA officiel & Moteur Word (base)

- **Objet intermédiaire « modèle de document PIA » (Section 4) :**
  - Implémentation complète de `buildOfficialPIADocumentModel(pia, deidentified, options)` dans `src/v74/v74-runtime.js`.
  - Normalisation de la cartographie documentaire : cartouche identité T1, 5 aspects T2, procès-verbal PV1, aménagements T5, procès-verbal PV2 et aménagements de rentrée T8.
  - Dé-identification complète et préservation de la neutralité institutionnelle (`Pôle Territorial WBE BXL`).
- **Moteur Word de remplissage du modèle officiel (`src/v74/v74-docx-export.js`) :**
  - Copie et intégration du modèle officiel `public/modeles/PIA_modele_officiel_2025-09-11.docx` et de son alias `PIA_modele_officiel.docx`.
  - Chargement, extraction et réécriture directe de l'archive ZIP sans altérer les binaires ni le logo via `unzipEntries` et `buildZipStoreArchive`.
  - Normalisation stricte des libellés (`normalizeDocxLabel`) éliminant les espaces insécables (`\u00A0`, `\u202F`), apostrophes courbes et deux-points finaux.
  - Injection dans le tableau d'identité T1 (L0-L7) et le tableau des 5 aspects T2 (L1-L5) avec respect strict de la police 16 pt (`w:sz w:val="32"`).
  - Mise à jour de l'année scolaire dans `word/header1.xml` et `word/header2.xml` (préservation de la mention « Annexe 2 »).
  - Neutralisation des métadonnées dans `docProps/core.xml` (`dc:creator` et `cp:lastModifiedBy` fixés à `Pôle Territorial WBE BXL`).
  - Détection et échec explicite (`throw new Error`) si un libellé officiel est introuvable (Test 16).
- **Validation et tests d'acceptation :**
  - Suite dédiée `tests/pia-lot3-modele-moteur-word.test.mjs` validant les tests d'acceptation 1, 2, 3, 4, 9, 10, 11 (partie vérifiable), 15 et 16 (100% PASS).

## 2026-10-15 — Chantier 3 (ERG-C) : Regroupement et affichage par matière dans le profil de synthèse (Piste 1)

- **Cloisonnement strict des compétences et indicateurs par matière (Bloc 1) :**
  - Fin de la fusion transversale inter-matières : la clé d'agrégation prend désormais en compte la matière. Les observations de matières distinctes (ex. Mathématiques et Néerlandais) ne sont plus jamais agrégées ensemble.
  - Préservation stricte du libellé de compétence propre à chaque matière : une compétence transversale en langue ne peut plus hériter par collision de libellé d'une formulation mathématique spécialisée (« pour résoudre une équation »).
  - Calcul individuel des compteurs et des pourcentages (acquis, en cours, fragilités) par matière, évitant les moyennes globales trompeuses.
- **Sélecteur de matière ergonomique (Piste 1) :**
  - Ajout d'une barre de puces en tête de la section 1 : « Toutes les matières » (active par défaut) et une puce par matière observée, avec le décompte des séances.
  - Bascule instantanée sans rechargement permettant d'isoler une matière en un clic ou d'afficher tous les blocs séparés par matière.
  - Ajout des styles Apple HIG pour les puces de filtrage et les panneaux de matière dans `src/styles/apple-premium.css`.
- **Tests et non-régression :**
  - Création du test comportemental `tests/synthesis-subject-aggregation-lot-c.test.mjs` vérifiant le non-croisement entre Mathématiques et Néerlandais, la justesse des compteurs et la présence du sélecteur.
  - Préservation totale des repères textuels et des exports Word/PDF aval.

## 2026-10-15 — Chantier 3 (ERG-B) : Remplacement de « Améliorer avec IA » par « Ajuster le texte »

- **Harmonisation de l'interface des 3 écrans (Réunion, Synthèse, PIA annuel) :**
  - Remplacement des libellés et icônes « ✨ Améliorer avec IA » / « ✨ Reformuler avec IA » par « ✎ Ajuster le texte » dans les chapitres longitudinaux, les 5 domaines et les objectifs du PIA.
  - Connexion directe du bouton « ✎ Ajuster le texte » de Réunion (constats qualitatifs) à la fenêtre d'ajustement.
  - Remplacement des boutons déclencheurs sur les formulaires d'observation et de séance par « ✎ Ajuster le texte ».
- **Modernisation et simplification de la fenêtre modale (#local-ai-modal) :**
  - Titre épuré : « Ajuster le texte », avec sous-titre discret : « Traitement local sur votre appareil ».
  - Retrait du badge encombrant « constat généré par règles déterministes WBE ».
  - Organisation claire des actions locales :
    1. « ✏️ Corriger orthographe & style » (action par défaut, correcteur par dictionnaire) ;
    2. « 📝 Synthétiser en 3 points » (synthèse locale par phrases) ;
    3. « 🎯 Suggérer des aménagements » (recherche dans les 544 fiches du référentiel WBE avec ajout en 1 clic) ;
    4. « ✎ Reformuler en style pro » (conservé avec adoucissement des liaisons verbales).
  - Préservation intégrale de la vue comparative côte à côte (original / proposé) et des boutons d'insertion (« ✓ Remplacer le texte », « + Ajouter à la suite », « Annuler »).
  - Création de la suite de tests de comportement `tests/text-adjuster-modal-contract.test.mjs`.

## 2026-10-15 — Chantier 3 (ERG-A) : Retrait du prototype de modèle génératif local et conservation du moteur déterministe

- **Retrait du modèle génératif et de ses dépendances :**
  - Suppression de la dépendance `@huggingface/transformers` de `package.json`.
  - Suppression des fichiers `src/app/local-ai-model-manager.js`, `src/app/local-ai-pipeline.js`, `src/app/local-ai-worker.js`.
  - Suppression des tests associés `tests/local-ai-model-manager-contract.test.mjs` et `tests/local-ai-feasibility.test.mjs`, et mise à jour du script `npm test`.
  - Suppression des sections associées dans `eslint.config.js`.
- **Nettoyage de l'interface et de la sécurité (CSP) :**
  - Retrait des domaines `https://huggingface.co`, `https://*.huggingface.co`, `https://*.hf.co` et de la directive `'wasm-unsafe-eval'` de la CSP dans `index.html`.
  - Suppression du panneau prototype `ms-ai-model-panel` (téléchargement, statut, boutons h80, h81, h82) dans `index.html` et de ses gestionnaires dans `src/app/journalier-core.js`.
  - Retrait de la case à cocher « Activer le modèle Gemma 3 local » dans la modale `#local-ai-modal`.
  - Retrait de la branche native `window.ai` dans `src/app/local-ai-assistant.js`.
- **Mise à jour des libellés et purge du cache :**
  - Remplacement des promesses publicitaires (« IA 100% Privée », « 0 octet émis », etc.) par des formulations factuelles (« Assistant de rédaction local », « Traitement local »).
  - Ajout d'une purge automatique et sécurisée des anciens caches (`journalier-ai-model-gemma-270m-v1`, `transformers-cache`) et des clés `localStorage` obsolètes.
  - Conservation intégrale du moteur déterministe (reformulation pédagogique, correction par dictionnaire, suggestions d'aménagements WBE).

## 2026-10-13 — Chantier 2 (SEC-5) : Échappement d'attributs HTML et sanitisation des noms de fichiers exportés

- **Sécurisation des attributs DOM et des téléchargements locaux :**
  - Extension du module centralisé `src/app/html-escape.js` avec `escapeAttr(value)` et `sanitizeFilename(name, fallback)`.
  - Harmonisation d'`escapeAttr` : neutralisation complète des délimiteurs d'attributs HTML (`"`, `'`) ainsi que des chevrons et ampersands (`&`, `<`, `>`).
  - Remplacement des fonctions locales dupliquées et incomplètes dans `src/app/referentiel-amenagements.js` et `src/app/local-ai-assistant.js` par la délégation vers `globalThis.escapeAttr`.
  - Implémentation de `sanitizeFilename` protégeant contre les attaques par traversée d'arborescence (path traversal `..`, `/`, `\`), éliminant les caractères interdits sur les systèmes de fichiers (`<>:"/\\|?*` et caractères de contrôle `0x00-0x1F`), et assurant un repli sain.
  - Sécurisation de la fonction centrale de téléchargement `downloadBytes` dans `src/v74/v74-runtime.js` via `sanitizeFilename`.
  - Création de la suite de tests contractuels `tests/attr-filename-contract.test.mjs` validant le comportement unitaire, l'isolation et la délégation.
  - Génération de l'archive dédiée : `journalier-v74-lot5-attr-filename-security.zip`.

## 2026-10-12 — Chantier 2 (SEC-4) : Échappement OpenXML/Word unifié et sanitisation XML 1.0

- **Sécurité et intégrité des exports Word (.docx) :**
  - Extension du module `src/app/html-escape.js` avec la fonction d'échappement XML unifiée `escapeXml(value)` (alias `xmlEsc`).
  - Échappement strict des 5 entités canoniques XML (`&`, `<`, `>`, `"`, `'`) vers `&amp;`, `&lt;`, `&gt;`, `&quot;`, `&apos;`.
  - Neutralisation systématique des caractères de contrôle illégaux en XML 1.0 (`[\x00-\x08\x0B\x0C\x0E-\x1F]`) qui provoquent la corruption des fichiers DOCX générés lors de l'ouverture dans Microsoft Word.
  - Préservation des séparateurs textuels légitimes (`\t`, `\n`, `\r`).
  - Délégation sécurisée dans `src/v74/v74-docx-export.js` et `src/v74/v74-runtime.js` vers `globalThis.escapeXml` avec garde anti-récursion.
  - Suppression définitive du lockfile orphelin `bun.lock`.
  - Création de la suite de tests contractuels `tests/xml-escape-contract.test.mjs` validant l'exposition, les entités, l'élimination des caractères corrupteurs et la délégation.
  - Génération de l'archive dédiée : `journalier-v74-lot4-xml-docx-security.zip`.

## 2026-10-12 — Chantier 2 (SEC-3) : Unification du moteur d'échappement HTML anti-XSS

- **Sécurité et neutralisation des injections HTML/XSS :**
  - Création du module centralisé `src/app/html-escape.js` (moins de 70 lignes, rôle unique) déclarant `escapeHtml(value)` et son alias `esc`.
  - Échappement systématique des 5 caractères sensibles (`&`, `<`, `>`, `"`, `'`) avec traitement robuste des valeurs nulles/indéfinies et primitives.
  - Déclaration ordonnée en tête des scripts classiques dans `index.html` et synchronisation dans `vite.config.js`.
  - Remplacement des fonctions locales dupliquées et disparates dans l'ensemble des modules applicatifs (`sessions-core.js`, `students-core.js`, `reports-core.js`, `agenda-core.js`, `v74-runtime.js`, `pia-lifecycle-engine.js`, `local-ai-assistant.js`, `referentiel-amenagements.js`) par une délégation directe.
  - Création de la suite de tests de contrat `tests/html-escape-contract.test.mjs` (comportement autonome, équivalence avec les anciens moteurs, et conformité de chargement).
  - Génération de l'archive dédiée : `journalier-v74-lot3-escape-html.zip`.

## 2026-10-12 — Chantier 2 (SEC-2) : Hygiène du dépôt et assainissement documentaire

- **Nettoyage et standardisation de l'arborescence :**
  - Mise à jour stricte de `.gitignore` : exclusion des fichiers `.env*` (avec exception pour `.env.example`), `.DS_Store`, `Thumbs.db`, `*.log`, `coverage/` et des fichiers archives `*.zip`.
  - Suppression du lockfile orphelin `bun.lock` (inutilisé, npm étant le gestionnaire standardisé).
  - Assainissement des captures d'écran dans `docs/v74-design/` : suppression des doublons corrompus par encodage non-ASCII (`agenda_vue_journaliÃ...`, etc.) et normalisation en noms ASCII propres (`agenda_vue_journaliere.jpg`, `precision_details.jpg`, `reference_visuelle.jpg`).
  - Alignement exact des références documentaires dans `README.md` et `ARCHITECTURE.md`.
  - Intégration de la suite de tests `tests/chapter-narratives-storage.test.mjs` dans le script `npm test` de `package.json` (20 suites de tests).
  - Génération d'une archive de sauvegarde complète dédiée : `journalier-v74-lot2-hygiene-clean.zip`.

## 2026-10-12 — Chantier 2 (SEC-1) : Éradication de localStorage et persistance chiffrée

- **Sécurité et conformité RGPD (Élèves mineurs) :**
  - Remplacement de l'écriture en texte clair des textes personnalisés de chapitres de synthèse (`journalier_chapter_narrative_*`) dans `localStorage` par une persistance chiffrée AES-GCM dans IndexedDB (`storage-vault.js` / `state.meta.chapterNarratives`).
  - Implémentation de l'API sécurisée `window.DataStore.getChapterNarrative(clusterKey)` et `window.DataStore.saveChapterNarrative(clusterKey, text)`.
  - Migration automatique au premier démarrage : récupération des textes préexistants dans `localStorage`, copie dans le coffre chiffré, et suppression immédiate des clés en clair (`localStorage.removeItem`).
  - Mise à jour de `src/app/reports-core.js` pour consommer exclusivement l'API chiffrée.
  - Ajout de la suite de tests exécutable `tests/chapter-narratives-storage.test.mjs` (test d'absence statique, test d'exécution de migration sans perte, et validation de l'API DataStore).

## 2026-10-12 — Phase 2 : Nettoyage documentaire, unification Vite et intégrité Lot 3.8

- **Hygiène documentaire et arborescence :**
  - Renommage de `Agents.md` en `AGENTS.md` conformément aux spécifications du projet.
  - Suppression des 3 fichiers de données statiques orphelins en double à la racine (`bibliotheque_indicateurs_v0_5_1.json`, `referentiel_amenagements_wbe.json`, `referentiel_pia_v74_0_3.json`) et du logo SVG, déjà présents et servis depuis `/public/`.
  - Archivage du script legacy `src/v74/v74-migration.js` vers `docs/archive/v74-migration.js` en cohérence stricte avec `SECURITY.md`.
- **Unification de la configuration Vite :**
  - Suppression du fichier en doublon `vite.config.ts`.
  - Unification dans `vite.config.js` garantissant le port 3000 requis pour l'aperçu AI Studio et la copie des scripts classiques en build.
- **Validation :**
  - Filet de sécurité de comportement déterministe (`tests/behavioral-safety-net.test.mjs`), 19 suites de tests automatisés, linting et build de production 100 % passants.

## 2026-10-12 — Chantier 1 (M8) : Épuration finale de `journalier-core.js` (< 650 lignes)

- **Épuration de `journalier-core.js` et atteinte du seuil d'architecture (< 800 lignes) :**
  - Transfert des 791 lignes résiduelles de préparation de réunion (`renderMeetingPrep`), d'extraction documentaire (`reportElementText`), de navigation (`setReportsTab`, `setReportView`) et de génération (`generateReport`) vers `src/app/reports-core.js`.
  - `journalier-core.js` passe de 1 430 lignes à **643 lignes**, atteignant pleinement l'objectif des **600 à 800 lignes par fichier** défini par l'architecture Phase 3.
  - Le fichier est désormais strictement dédié au cycle de vie de l'application : initialisation de la page, gestion des bulles de filtres dynamiques, déconnexion/verrouillage d'inactivité et écouteurs d'événements.
  - Mise à niveau coordonnée de `tests/pia-lot1-data-chain.test.mjs` et `tests/agenda-v74-contract.test.mjs`.
- **Validation :**
  - Filet de sécurité comportemental déterministe, 19 suites de tests automatisés, linting, build de production et compilation applet 100 % passants.

## 2026-10-12 — Chantier 1 (M7) : Découpage modulaire du moteur d'encodage des séances (`src/app/sessions-core.js`)

- **Modularité et lisibilité du moteur d'encodage et historique des séances (`src/app/sessions-core.js`) :**
  - Extraction de 1 437 lignes de logique d'encodage des séances pédagogiques hors de `journalier-core.js` (allégé de 2 849 à 1 430 lignes, soit plus de 50 % de code extrait supplémentaire) vers un module dédié `src/app/sessions-core.js`.
  - Encapsulation du modèle de données de séance Q1 à Q6, de la reconnaissance sémantique et prédiction d'indicateurs WBE (Q3), des curseurs d'effets (Q4), des statuts de transfert (Q5), de la persistance sécurisée anti-collisions et de la gestion de l'historique au sein du namespace `JournalierSessions`.
  - Maintien scrupuleux des alias globaux sur `window` (`window.sessionParts`, `window.persistSessionEntry`, `window.clearObservationForm`, `window.q3AssessmentLabel`, etc.) garantissant zéro rupture d'interface.
  - Déclaration ordonnée du script dans `index.html` (ligne 973) et intégration dans la recopie de production de `vite.config.js`.
  - Création de la suite de test unitaire contractuelle `tests/sessions-core-contract.test.mjs` validant en isolation la décomposition de séance, la normalisation des indicateurs, et les libellés officiels d'évaluation Q2 à Q5.
  - Mise à niveau coordonnée des tests dépendants (`tests/agenda-v74-contract.test.mjs`, `tests/session-edit-contract.test.mjs`, `tests/q3-option-b-contract.test.mjs`, `tests/pia-lot1-data-chain.test.mjs`).
- **Validation :**
  - Filet de sécurité comportemental déterministe, 19 suites de tests automatisés, linting, build de production et compilation applet 100 % passants.

## 2026-10-12 — Chantier 1 (M6) : Découpage modulaire du moteur d'Agenda (`src/app/agenda-core.js`)

- **Modularité et lisibilité du moteur d'Agenda Outlook-level (`src/app/agenda-core.js`) :**
  - Extraction de 1 825 lignes de logique d'agenda hors de `journalier-core.js` (allégé de 4 661 à 2 849 lignes) vers un module dédié `src/app/agenda-core.js`.
  - Encapsulation du modèle prévisionnel, des 8 périodes scolaires personnalisables, des récurrences hebdomadaires complexes et exceptions, des vues Jour / Semaine / Mois, du Drag & Drop et du redimensionnement de créneaux au sein de l'espace de noms `JournalierAgenda`.
  - Maintien des alias de compatibilité globale (`window.days`, `window.DEFAULT_AGENDA_PERIODS`, `window.renderAgenda`, `window.getEventsForDate`, etc.) et accesseurs bidirectionnels réactifs (`selectedDateISO`, `agendaMode`).
  - Déclaration ordonnée du script dans `index.html` (ligne 972) et intégration dans la recopie de production de `vite.config.js`.
  - Création du test contractuel unitaire `tests/agenda-core-contract.test.mjs` validant en isolation la conversion horaire/minutes, les calculs de dates scolaires, la normalisation des périodes et le moteur de récurrence.
  - Mise à niveau de `tests/agenda-v74-contract.test.mjs` et `tests/session-edit-contract.test.mjs`.
- **Validation :**
  - Filet de sécurité comportemental déterministe, 18 suites de tests automatisés, linting, build de production et compilation applet 100 % passants.

## 2026-10-11 — Chantier 1 (M5) : Découpage modulaire de la gestion des élèves (`src/app/students-core.js`)

- **Modularité et lisibilité de la gestion des dossiers élèves (`src/app/students-core.js`) :**
  - Extraction de 600+ lignes de gestion des fiches élèves, Bento Cards, groupements par établissement / classe, modales de création / édition / profil, sélection de matières et historique de suivi pédagogique hors de `journalier-core.js` (allégé à 4 662 lignes).
  - Encapsulation des composants d'identité de l'élève (`JournalierStudents`), calcul des initiales et avatars déterministes, statut PIA annuel, filtres de recherche et pagination d'historique.
  - Déclaration ordonnée du script dans `index.html` (ligne 971) et intégration dans la recopie d'actifs de production de `vite.config.js`.
  - Création du test contractuel unitaire `tests/students-core-contract.test.mjs` validant en isolation les options de matières, libellés d'évaluation, le rendu des cartes Bento et la compatibilité de sélection en édition de séance.
  - Mise à jour et validation conjointe des 17 suites de tests automatisés sans régression.
- **Validation :**
  - 17 suites de tests automatisés, linting, build de production et compilation applet 100 % passants.

## 2026-10-11 — Chantier 1 (M4) : Découpage modulaire du moteur de rapports et synthèses (`src/app/reports-core.js`)

- **Modularité et lisibilité du moteur d'analyse pédagogique (`src/app/reports-core.js`) :**
  - Extraction de 2 248 lignes de logique de rapports pédagogiques hors de `journalier-core.js` (réduit de 7 296 à 5 052 lignes) vers un module dédié `src/app/reports-core.js`.
  - Regroupement des rapports naturels multi-profils (V0.1 à V0.8), extraction d'unités probantes, détection de récurrences Q1-Q6, synthèses visuelles Apple HIG et préparation de réunion.
  - Déclaration ordonnée du script dans `index.html` (ligne 971) et intégration dans la recopie de production de `vite.config.js`.
  - Création du test contractuel unitaire `tests/reports-core-contract.test.mjs` validant les fonctions pures de déduplication, la classification thématique et l'extraction de relations.
  - Adaptation coordonnée des tests (`tests/pia-lot1-data-chain.test.mjs`, `tests/synthesis-apple-ux-contract.test.mjs`, `tests/pia-lot3-reevaluation-exports.test.mjs`).
- **Validation :**
  - Filet de sécurité comportemental déterministe, 16 suites de tests automatisés, linting et build de production 100 % passants.

## 2026-10-10 — Chantier 1 (M3) : Découpage modulaire du moteur d'export PDF (`src/v74/v74-pdf-export.js`)

- **Modularité et lisibilité de la génération documentaire PDF (`src/v74/v74-pdf-export.js`) :**
  - Extraction du générateur autonome PDF 1.4 multi-pages (`makePdf`, `makePdfFromModel`, `wrapPdfTextLine`, bannières, KPI, tableaux A4, encodage WinAnsi et pagination) hors de `v74-runtime.js` dans un fichier dédié de 396 lignes.
  - Allègement de plus de 410 lignes au sein de `v74-runtime.js`, désormais centré sur la coordination documentaire sans plomberie binaire PDF.
  - Déclaration du script dans `index.html` et intégration dans la recopie d'actifs de production de `vite.config.js`.
  - Création d'une suite unitaire contractuelle dédiée (`tests/pdf-export-contract.test.mjs`) validant l'encodage WinAnsi, l'échappement des littéraux, le retour à la ligne sans coupure de mots, et l'intégrité binaire PDF.
  - Adaptation transparente des harnais de tests (`tests/behavioral-safety-net.test.mjs`, `tests/pia-lot3-reevaluation-exports.test.mjs`, `tests/pia-lot4-premium-document.test.mjs`).
- **Validation :**
  - Filet de sécurité comportemental déterministe (empreinte SHA-256 rigoureusement identique sur les exports Word et PDF), 15 suites de tests automatisés, linting et build de production 100 % passants.

## 2026-10-10 — Chantier 1 (M2) : Découpage modulaire du moteur d'export Word (.docx) (`src/v74/v74-docx-export.js`)

- **Modularité et lisibilité de la génération documentaire Word (`src/v74/v74-docx-export.js`) :**
  - Extraction du générateur documentaire OpenXML (`makeDocx`, `makeDocxFromModel`, tables, paragraphes et compresseur ZIP local) hors de `v74-runtime.js` dans un fichier dédié de 410 lignes.
  - Allègement significatif de `v74-runtime.js` sans altération des contrats d'exportation ni des interfaces publiques (`window.JournalierV74.makeDocx`).
  - Déclaration du script dans `index.html` et intégration dans la recopie d'actifs de production de `vite.config.js`.
  - Adaptation des harnais de tests (`tests/behavioral-safety-net.test.mjs`, `tests/pia-lot3-reevaluation-exports.test.mjs`, `tests/pia-lot4-premium-document.test.mjs`) pour charger le module de manière robuste.
- **Validation :**
  - Filet de sécurité de comportement (empreinte SHA-256 déterministe sur les exports Word et PDF), 13 suites de tests, linting et build 100 % passants.

## 2026-10-10 — Chantier 1 (M1) : Découpage modulaire du coffre chiffré (`src/app/storage-vault.js`)

- **Modularité et lisibilité du stockage local (`src/app/storage-vault.js`) :**
  - Extraction de la couche de stockage granulaire chiffré (`journalier-secure-v74`) hors de `journalier-core.js` dans un fichier dédié de 528 lignes.
  - Regroupement de la cryptographie AES-GCM 256 bits, dérivation PBKDF2/SHA-256, transactions IndexedDB strictes, persistance granulaire par enregistrement et gestion du verrouillage automatique.
  - Injection ordonnée du script dans `index.html` et intégration dans la recopie d'actifs de `vite.config.js` sans altération des variables globales existantes.
  - Mise à jour des suites de vérification (`tests/storage-v74-contract.test.mjs`, `tests/pia-sync-contract.test.mjs`) pour couvrir le module extrait.
- **Validation :**
  - Filet de sécurité comportemental déterministe, linting, compilation et tests 100 % passants.

## 2026-10-09 — Hygiène de sécurité CSP et harmonisation des libellés d’agenda

- **Sécurité et conformité CSP (`msal-redirect.html`, `SECURITY.md`) :**
  - Retrait de la directive inopérante `frame-ancestors 'none'` dans la balise `<meta>` de redirection MSAL (les navigateurs ignorent systématiquement `frame-ancestors` lorsqu'elle est déclarée dans une balise `<meta>`, générant un avertissement en console).
  - Mise à jour explicite du guide de sécurité `SECURITY.md` rappelant que la protection anti-encadrement doit être assurée par l'en-tête HTTP serveur (`Content-Security-Policy: frame-ancestors 'none'`).
- **Harmonisation des libellés de l’Agenda (`index.html`) :**
  - Harmonisation du libellé de la légende de l'agenda : remplacement de « Proposition » par « Planifié », en cohérence parfaite avec le badge « Planifié » affiché sur les créneaux et dans le détail des événements.
- **Validation technique et comportementale :**
  - Tous les tests de comportement, contrats fonctionnels, linting et build de production restent 100 % au vert sans aucun impact sur les flux utilisateurs.

## 2026-10-09 — Fiabilisation de la gestion des erreurs et transparence des incidents

- **Dictée vocale (`apple-ux-enhancements.js`) :**
  - Correction d'un retour utilisateur trompeur : en cas d'erreur de microphone ou d'interruption, l'application n'affiche plus « ✓ Note complétée », mais un message exact (« Microphone non autorisé », « Microphone ou reconnaissance vocale indisponible »).
- **Synchronisation OneDrive (`microsoft-core.js`) :**
  - Remontée des échecs de téléchargement distant dans les détails de synchronisation : si un élève, une séance, l'agenda ou un PIA distant ne peut pas être récupéré (ex. document distant corrompu ou coupure réseau), l'incident est désormais consigné dans le récapitulatif utilisateur au lieu d'être ignoré silencieusement.
- **Importation et référentiel PIA (`v74-runtime.js`) :**
  - Robustesse de l'import Word (.docx) : repli fluide sur l'extraction de texte brut si la structure des tableaux est atypique, avec alerte technique dans la console.
  - Journalisation explicite des incidents lors du chargement du référentiel PIA et des reports de synchronisation OneDrive hors-ligne.
- **Rapports d'intégration (`journalier-core.js`) :**
  - Remplacement des blocs d'erreurs avalés sans trace par des avertissements précis dans la console pour faciliter le diagnostic.

## 2026-10-09 — Épuration des migrations et volet d'outils de diagnostic technique

- **Retrait du module de migration legacy :**
  - Suppression de `src/v74/v74-migration.js` et de son injection dans `index.html`.
  - Les données d'élèves, séances, agenda et PIA déjà migrées restent intégralement préservées dans le coffre chiffré IndexedDB et sur OneDrive.
  - Conservation du bouton « Importer le PIA » pour la lecture directe des documents Word/PDF dans les dossiers d'élèves.
- **Simplification de la fenêtre Microsoft 365 :**
  - Mise en valeur des actions du quotidien (Connexion, Déconnexion, Synchroniser maintenant, Repartir de OneDrive).
  - Regroupement des actions techniques (« Préparer l'espace Journalier », « Vérifier la structure OneDrive », « Tester l'AppFolder », « Analyser la synchronisation », « Résoudre un conflit ») dans un volet repliable « Outils de diagnostic technique (avancé) ».
- **Validation et conformité :**
  - Maintien des tests contractuels, fonctionnels et du filet de sécurité comportemental à 100% au vert.

## 2026-10-08 — Référentiel des Aménagements WBE & Assistant IA Local (100% Navigateur / RGPD)

- **Référentiel des Aménagements Raisonnables WBE (544 fiches) :**
  - Compilation complète et structurée des 498 fiches du *Guide des aménagements raisonnables Wapi A* (Fondamental) et des 49 fiches du *Kit outils secondaire* WBE.
  - Base de connaissances statique locale stockée dans `public/referentiel_amenagements_wbe.json` (0 octet émis sur un serveur tiers).
  - Rapprochement sémantique contextuel automatique (`findBestMatches`) dans le **PIA annuel** et la **Synthèse** selon le domaine, l'aspect et la formulation des propositions.
  - Insertion en un clic de pastilles d'aménagements (`.pia-chip-item`) directement sous les zones d'objectifs, sans encombrer la vue.
  - Modale de recherche et sélection ciblée accessible discrètement (`📚 Référentiel WBE`) avec filtres par niveau (Fondamental / Secondaire / Universel) et recherche plein texte.
- **Assistant Pédagogique Local (IA 100% On-Device / RGPD) :**
  - Moteur d'IA local-first respectant la souveraineté totale des données scolaires (aucune transmission réseau, 0 API externe).
  - Prise en charge native de l'API `window.ai` (Gemini Nano) si supportée par le navigateur, avec moteur de repli déterministe haute performance (< 10 ms) pour Safari, iPadOS et Firefox.
  - Actions disponibles : Reformulation bienveillante et professionnelle, correction orthographique/typographique, synthèse structurée en 3 axes, croisement avec les aides WBE.
  - Contrôle humain strict (*Human-in-the-Loop*) avec modale comparative avant/après et choix explicite (`✓ Remplacer le texte`, `+ Ajouter à la suite`, `Annuler`).
- **Documentation et Sécurité :**
  - Ajout de la documentation complète dans `docs/REFERENTIEL_ET_IA_LOCALE_V74.md`.
  - Mise à jour des chapitres de sécurité et de conformité RGPD dans `SECURITY.md` (Section 23).
  - Intégration dans `ARCHITECTURE.md` (Section 31) et `README.md` (Section 17).

## 2026-09-30 — Coffre local granulaire et récupération du stockage

- Remplacement de la persistance monolithique `journalier-secure-v72/states` par le coffre granulaire `journalier-secure-v74`.
- Séparation des élèves, séances, événements Agenda, PIA, registre de synchronisation, métadonnées et migration en enregistrements indépendants.
- Conservation volontaire des identifiants techniques `v72` pour la compatibilité historique.
- Chiffrement AES-GCM 256 bits par enregistrement avec IV unique et AAD liée au compte/type/identifiant.
- Ajout d'une empreinte SHA-256 du ciphertext pour les diagnostics d'intégrité.
- Transactions IndexedDB demandant `durability: 'strict'` lorsque disponible.
- Migration V72 → coffre granulaire non destructive et idempotente ; aucune suppression automatique du coffre historique.
- Détection explicite du cas `Failed to read large IndexedDB value` et préparation d'une récupération depuis OneDrive lorsque le coffre historique est illisible.
- La récupération distante est persistée localement avant que l'interface ne considère l'opération terminée.
- Documentation ajoutée dans `docs/STOCKAGE_LOCAL_V74.md`.
- Ajout du contrat `tests/storage-v74-contract.test.mjs`.

## 2026-09-30 — Modification des séances et réattribution d’élève

- Le formulaire de modification d’une séance permet de réattribuer la séance à un autre élève existant.
- Lorsqu’une séance référence un élève supprimé, l’ancien nom reste visible uniquement comme repère historique et l’interface demande explicitement de choisir un élève actuel avant l’enregistrement.
- La sauvegarde conserve l’identifiant de la séance et réécrit le `studentId` selon l’élève actuellement sélectionné.
- Lorsqu’un changement d’élève concerne une séance déjà synchronisée, le SyncManager prépare le déplacement du fichier JSON vers le dossier du nouvel élève et supprime l’ancienne copie après écriture validée.
- Aucun nouveau backend, canal de stockage ou permission Microsoft Graph n’est ajouté.
- Ajout d’un contrat de test dédié aux scénarios de modification et de réattribution.

## 2026-09-30 — Nettoyage et cohérence du modèle Agenda V74

- Modèle d’état unifié : Planifié / Réalisé / Annulé.
- Suppression de la confirmation comme état actif de l’Agenda. Les anciennes valeurs `confirmed` sont converties en `proposed` à la lecture.
- Une séance enregistrée dans l’Historique est projetée comme Réalisé dans les vues Agenda, y compris sans événement planifié correspondant.
- Les actions Modifier/Supprimer de l’Historique restent gérées par le cœur métier, sans dépendance au module Microsoft.
- Contrat de test, validateur Graph, styles et documentation alignés sur ce modèle.

## 2026-09-29 — Agenda V74

- Modèle canonique `agenda.__events` pour permettre plusieurs événements qui se chevauchent.
- États Proposition / Confirmé / Réalisé / Annulé.
- Réalisation indépendante des réunions, GT, formations et missions non liées à une séance.
- Configuration des horaires des 8 périodes, avec pauses entre périodes.
- Rapprochement Agenda ↔ Historique renforcé lors des corrections de séance.
- Préparation des métadonnées nécessaires à une future synchronisation Outlook via Microsoft Graph.
- Validateur OneDrive/Graph et migration V74 adaptés au nouveau modèle.

Historique synthétique des évolutions importantes. Les détails d'architecture et les contrôles de sécurité sont décrits dans [ARCHITECTURE.md](ARCHITECTURE.md) et [SECURITY.md](SECURITY.md). L'historique complet est disponible dans Git.

## V74 — passe UX/UI responsive — 29 septembre 2026

### UX/UI
- Ajout d'une couche responsive dédiée `src/styles/journalier-ux-responsive.css` sans modification du contenu métier.
- Passage du socle de hauteur à `100dvh`, amélioration du scroll principal et prise en compte des zones sûres mobiles.
- Navigation téléphone transformée en barre basse tactile avec les cinq destinations et icônes existantes.
- Adaptation distincte PC/tablette/téléphone de l'Accueil, de l'Agenda, de la Séance, des dossiers Élèves et de Rapports & PIA.
- Correction du formulaire de séance sur petit écran, notamment du couple de périodes début → fin.
- Correction de l'en-tête Rapports & PIA et de l'action Exporter pour éviter les coupures sur téléphone/tablette.
- Modales adaptées au tactile avec comportement de feuille sur petit écran.
- Cibles tactiles, focus visible, réduction des mouvements et taille de saisie mobile harmonisés.
- Adaptation responsive des vues PIA générées dynamiquement, sans modification du modèle PIA.

### Documentation et validation
- Ajout de `docs/UX_V74_RESPONSIVE.md` avec audit, règles responsive, invariants métier et résultats des simulations.
- Simulation automatique à 390×844, 375×667, 768×1024, 1024×768 et 1440×900 sur les cinq vues principales.
- Vérification de l'absence de débordement horizontal de page et de l'atteignabilité de la fin du formulaire de séance.
- La CSP reste fonctionnellement inchangée : aucune nouvelle origine, aucun script inline et aucun hash de script n'a été ajouté ; seul le chargement d'une feuille CSS locale et le viewport mobile ont été modifiés.

## V74 — en cours, non publiée — 27 septembre 2026

### Fonctionnel
- Organisation de l'espace Rapports autour de l'historique, des synthèses à période libre, de la préparation de réunion et des exports.
- Résumé Q2–Q6 conservé dans l'historique avec les commandes existantes de modification et de suppression.
- PIA annuel étendu aux cinq domaines, réunions structurées, décisions professionnelles et suivi jusqu'à la finalisation.
- Exports des séances, synthèses et réunions en Word ou PDF; maintien des exports PIA professionnels et dé-identifiés.
- Refonte visuelle de l’historique en disposition maître-détail, avec filtres et commandes existants préservés.
- Domaines PIA présentés dans une grille adaptative puis un détail éditable par accordéons; préparation de réunion reliée à la saisie des réunions dans le même PIA annuel.
- Accents de couleur sémantiques ajoutés aux sections de synthèse/réunion, aux domaines PIA et aux états de proposition.
- Pastilles typées ajoutées à l’historique et au détail pour Observation Q2, Adaptation Q4 et Effet observé, avec les niveaux et libellés enregistrés.
- Cartes des cinq domaines PIA agrandies avec symboles thématiques et grille responsive; couleurs liées aux domaines plutôt qu’à leur position.
- Rubriques du détail PIA présentées dans des conteneurs teintés et éléments enregistrés en pastilles, dans le même langage visuel que la vue Séance.
- Tableau de bord rafraîchi après activation, hydratation et verrouillage du coffre; cartes Élèves et dossiers enrichis de pastilles et groupes de séances récents.
- Fin de période de séance réalignée automatiquement sur le début lorsqu’elle devient antérieure; périodes impossibles désactivées.
- Niveaux Q2 rendus explicites par observation dans l’historique et l’export; effets Q4 affichés avec leurs libellés plutôt qu’en valeurs numériques.
- Panneau Export affiché au-dessus des vues voisines; cartes Proposition harmonisées sur une surface neutre avec accent/badge d’état.
- Pastille du niveau Q2 séparée du texte de l’observation dans la liste afin d’améliorer le balayage visuel.
- Ajustements de l'agenda et du serveur local Codespaces.
- Synchronisation OneDrive automatique et bidirectionnelle : déclenchement après chaque sauvegarde locale, au retour au premier plan, à la reconnexion réseau, à la connexion Microsoft et par cycle périodique; les modifications distantes non conflictuelles sont désormais rapatriées automatiquement en plus de l'envoi des modifications locales.
- Suivi des PIA intégré au registre de synchronisation (`syncRegistry.pia`) : un envoi échoué vers OneDrive est désormais réessayé automatiquement au lieu de rester bloqué en local.

### Documentation
- Références UX regroupées dans `docs/v74-design/` avec un cahier d’intégration actif, une maquette interactive et six captures de référence.
- README et architecture alignés sur l’inventaire réel; prompts de travail redondants et maquette remplacée retirés.

### Architecture et sécurité
- Réutilisation du DataStore, de Graph/OneDrive et des permissions existantes; aucun backend ajouté.
- Compatibilité conservée avec l'ancien état PIA `ACTIF`.
- Hashes CSP recalculés après modification des scripts inline.
- Hashes CSP recalculés une seconde fois après l'ajout de la synchronisation automatique (scripts inline #2 et #3 modifiés).

### Validation et limites
- `npm run build` passe.
- Hashes CSP des trois scripts inline vérifiés après la refonte.
- Tests visuels automatisés et parcours authentifiés Entra/Graph restent à exécuter; aucun navigateur automatisable n’est disponible dans le Codespace.
- Les parcours Entra/Graph/OneDrive et la migration avec données réelles restent à tester dans un environnement authentifié.
- Le rendu navigateur des derniers changements agenda n'est pas confirmé par l'audit V74.

## V74 — migration legacy — 25 septembre 2026

- Ajout du pont `JournalierMigrationBridge` entre `index.html` et `src/v74/v74-migration.js`.
- Migration contrôlée vers l'AppFolder, avec validation, normalisation et détection bloquante des conflits.
- Conservation de la source `Journalier-legacy`, du `studentId` historique et absence de nouvelle permission Graph.

## V74.1.0 — stabilisation PIA — 25 septembre 2026

- Import local de PIA Word/PDF; le document original et son nom ne sont pas conservés.
- Exports PIA professionnels et dé-identifiés en Word/PDF; retrait des identifiants, dates de preuve et identifiants de séance dans les modèles dé-identifiés.
- Tableau de bord descriptif et mémos personnels stockés via le DataStore local chiffré.
- Limites de taille et de décompression appliquées aux documents importés.

## V74.0.1 — continuité et validation — 25 septembre 2026

- Utilisation du référentiel PIA JSON pour les seuils de convergence.
- PIA précédent traité comme source de continuité, distincte des propositions.
- Validation professionnelle requise; aucune causalité Q2–Q6 affirmée automatiquement.

## V74 — cycle annuel PIA — septembre 2026

- Synthèse des séances et des données structurées Q2–Q6 pour soutenir le cycle annuel PIA.
- Traçabilité des observations, propositions, preuves et contre-évidences.
- Distinction maintenue entre objectifs de séance et objectifs PIA.
- Aucune proposition n'est validée automatiquement.

## 2026-09 — architecture, sécurité et chaîne de livraison

- Stabilisation de l'architecture local-first: Entra ID, IndexedDB chiffré, Microsoft Graph et OneDrive AppFolder.
- Validation des données, contrôle des ETags, détection de conflits et vérification des URL de téléchargement Graph.
- Mise à niveau de Vite et ajout du build CI et du déploiement GitHub Pages.
- Configuration versionnée de Dependabot et référencement des Actions par SHA complet.
- Les règles de protection GitHub, alertes et paramètres Entra sont des réglages externes; voir les limites dans [SECURITY.md](SECURITY.md).

## V72 et versions antérieures

Évolutions progressives de l'agenda, des élèves, des séances, des indicateurs, des rapports, de l'authentification Microsoft et de la synchronisation. Les détails des versions antérieures à V74 restent dans l'historique Git.


## Refactoring V74
Structure du frontend nettoyée sans changement fonctionnel volontaire : CSS et JavaScript extraits de `index.html`, runtime/migration sous `src/v74/` et historique archivé.

## 13 octobre 2026 — Fiabilité de la synthèse PIA et constats IA locale

- Les chapitres canoniques de mathématiques ne sont plus appliqués lorsqu’une autre matière est explicitement indiquée.
- Les critères de la synthèse sont rattachés aux preuves de séance correspondantes ; les critères agrégés ne sont utilisés en repli que lorsqu’un seul chapitre est présent.
- Une matière absente est signalée comme « Matière non précisée » plutôt que supposée mathématique dans l’arbre de contexte.
- Le bouton des constats qualitatifs appelle une fonction dédiée de proposition locale, affiche la proposition dans l’éditeur et conserve le texte source jusqu’à validation. Le moteur local de repli corrige la forme sans ajouter de recommandation.
- Tests ciblés ajoutés dans `tests/pia-subject-context-ai.test.mjs`.
