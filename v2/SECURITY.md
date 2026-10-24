# Sécurité (V2)

- Données d'élèves : restent sur l'appareil ; coffre chiffré AES-GCM (mot de passe) prévu avant tout usage réel ; synchronisation OneDrive uniquement chiffrée.
- CSP stricte : `script-src 'self'`, aucun script inline, aucune ressource tierce hors polices déclarées.
- React échappe le texte ; `innerHTML`/`dangerouslySetInnerHTML` interdits.
- Entrées externes (fichiers, stockage) validées par schéma avant utilisation.
- Aucune donnée personnelle dans les journaux, tests ou captures ; données de démonstration fictives.
- Dépendances : peu, versions fixées, vérifiées par CI et CodeQL.
- Export « dé-identifié » disponible pour partager sans identité.
- Signalement : prévenir le propriétaire du dépôt ; ne jamais publier de données réelles dans une issue.
