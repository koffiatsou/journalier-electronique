# Index de la documentation

> Projet : Journalier électronique — Pôle territorial WBE BXL
> Version active : **V75** (octobre 2026)
> Modèle d'exécution : application web statique, local-first (navigateur, iPadOS, PC)

Ce document oriente tout développeur ou agent IA vers le bon guide.

## 1. Vue d'ensemble

Le Journalier électronique soutient les agents des Pôles territoriaux WBE qui accompagnent des élèves à besoins spécifiques en intégration :

- agenda des séances (planification récurrente, Planifié / Réalisé / Annulé) ;
- encodage des séances en deux zones (pédagogique, orthopédagogique) ;
- Journalier (historique des séances) avec export Word fidèle au papier ;
- préparation de réunion en langage simple et propositions d'objectifs ;
- PIA annuel et export Word/PDF officiel, identifié ou dé-identifié ;
- référentiel d'aménagements WBE (544 fiches) et assistant de rédaction local, 100 % dans le navigateur.

## 2. Code source

```text
src/
├── app/
│   ├── storage-vault.js            # Coffre chiffré IndexedDB (AES-GCM), DataStore
│   ├── students-core.js            # Dossiers élèves, matières, Journalier (liste et détail)
│   ├── agenda-core.js              # Agenda, récurrences, statuts, absences
│   ├── sessions-core.js            # Formulaire de séance, enregistrement, modification
│   ├── session-levels.js           # V75 : choix de niveau (aucun d'office, repli après choix)
│   ├── redaction-engine.js         # V75 : moteur de rédaction déterministe
│   ├── journalier-seances-docx.js  # V75 : export Word du Journalier (modèle papier)
│   ├── reports-core.js             # Périodes, propositions, exports
│   ├── reunion-view.js             # V75 : vue Réunion, export PIA visible
│   ├── journalier-core.js          # Orchestration, navigation, statistiques de présence
│   ├── microsoft-core.js           # Entra ID (MSAL), synchronisation OneDrive AppFolder
│   ├── apple-ux-enhancements.js    # Accordéons de la séance, barre d'enregistrement, gestes
│   ├── indicators.js, html-escape.js
│   ├── referentiel-amenagements.js # Recherche dans les 544 fiches
│   └── local-ai-assistant.js       # « Ajuster le texte » (règles locales)
├── v74/                            # Moteur PIA, exports Word/PDF officiels
└── styles/
```

Les scripts **classiques** (non modules) doivent être déclarés dans `index.html` **et** dans `copyClassicAppScripts()` de `vite.config.js`.

## 3. Données statiques (`public/`)

- `modeles/Journalier_modele_papier.docx` : modèle du Journalier papier (V75).
- `modeles/PIA_modele_officiel_2025-09-11.docx` : modèle officiel du PIA.
- `referentiel_amenagements_wbe.json` : 544 fiches d'aménagements (498 fondamental, 49 secondaire).
- `bibliotheque_indicateurs_v0_5_1.json`, `referentiel_pia_v74_0_3.json` : indicateurs et règles PIA (rapprochement WBE masqué dans la séance depuis V75).

## 4. Guides par sujet (`docs/`)

| Fichier | Sujet |
| :--- | :--- |
| `PARCOURS_V75.md` | Parcours utilisateur du planning au PIA, statuts, ce qui est mis de côté |
| `MOTEUR_REDACTION_ET_EXPORT_V75.md` | Moteur de rédaction, modèle de séance, export Word du Journalier |
| `AGENDA_V74.md` | Modèle d'agenda, périodes, récurrences, statuts |
| `STOCKAGE_LOCAL_V74.md` | Coffre granulaire `journalier-secure-v74`, chiffrement, récupération |
| `UX_V74_RESPONSIVE.md` | Principes responsive (100dvh, zones sûres iOS, cibles tactiles) |
| `PIA_MODELE_STRUCTURE.md` | Structure du modèle PIA officiel |
| `REFERENTIEL_ET_IA_LOCALE_V74.md` | Référentiel d'aménagements et assistant local |
| `LOCAL_AI_QUALITATIVE_ANALYSIS_CONTRACT.md` | Contrat d'analyse qualitative locale |
| `v74-design/` | Cahier des charges UX et maquettes V74 (référence historique) |
| `exemples/` | Exemples de PIA fictifs |
| `archive/` | Rapports de chantiers terminés (non maintenus) |

## 5. Documents racine

- `README.md` : présentation et commandes.
- `ARCHITECTURE.md` : architecture complète, données, synchronisation, PIA.
- `SECURITY.md` : sécurité, permissions, CSP, RGPD.
- `CHANGELOG.md` : journal des évolutions.
- `AGENTS.md` : règles pour les IA de codage.

## 6. Invariants

1. **Local-first** : aucun service tiers d'IA en ligne. Le moteur de rédaction et l'assistant s'exécutent dans le navigateur.
2. **Contrôle humain** : toute proposition est validée par l'agent ; le moteur de rédaction ne modifie jamais un texte saisi.
3. **CSP** : aucun script ni gestionnaire inline dans `index.html` ; `script-src 'self'`.
4. **Tests** : `npm test`, `npm run lint` et `npm run build` doivent réussir avant toute livraison.
5. **Compatibilité des données** : les clés `q2` à `q6` des séances et l'identifiant de base `journalier-secure-v74` ne changent pas sans migration.
