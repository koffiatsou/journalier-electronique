# Audit V73.1.3 — stabilisation PIA, migration et sécurité

Date : 25 septembre 2026

## Évolution depuis V73.1.2

- Correction du module de migration legacy après l'erreur `graphGetAppRoot is not defined`.
- Ajout de `window.JournalierMigrationBridge`.
- Migration non destructive vers l'AppFolder actif.
- Conservation du `studentId` historique.
- Détection des conflits avant import.
- Aucune nouvelle permission Graph.
- Conservation de la copie `Journalier-legacy`.

## Contrôle de cohérence documentaire

Les documents de référence sont :

- `README.md`
- `ARCHITECTURE.md`
- `SECURITY.md`
- `CHANGELOG.md`
- `V73_README.md`
- `AUDIT_V73.1_FINAL.md`

Le présent package ajoute également `AUDIT_V73.1.3_MIGRATION.md` pour détailler spécifiquement la correction de migration.

## Contrôles sécurité

- CSP `script-src` : 3 hashes calculés sur les scripts inline de `index.html`.
- Correspondance exacte entre les hashes déclarés et les scripts présents.
- `unsafe-inline` absent de `script-src`.
- Aucun nouveau endpoint réseau externe.
- Aucune nouvelle permission Graph.
- Migration limitée à l'AppFolder.
- Source legacy conservée.
- Conflits bloquants avant import.

## Présentation / test terrain

Séquence prévue :

1. connexion Entra ;
2. vérification de l'espace sécurisé ;
3. copie manuelle de l'ancien dossier dans l'AppFolder ;
4. renommage en `Journalier-legacy` ;
5. analyse de la migration ;
6. contrôle du rapport ;
7. import ;
8. vérification des élèves, séances et agenda ;
9. contrôle que la source legacy est toujours présente.

Le test réel reste nécessaire avant de considérer la migration comme validée sur données historiques.
