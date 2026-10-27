# Sécurité (V2)

- Données d'élèves : restent sur l'appareil, **chiffrées** (AES‑GCM 256 bits, clé du navigateur impossible à exporter, un enregistrement lié à son propriétaire, sa table et son identifiant). Elles s'ouvrent par la connexion Microsoft ; « Verrouiller » ou la déconnexion referment le Journalier. Seul un identifiant technique (le lien élève → séances) est lisible dans la base.
- Ce que le coffre ne couvre pas : quelqu'un qui ouvre le Journalier alors que vous êtes connecté, un script malveillant injecté dans la page (d'où la CSP stricte), la perte du profil du navigateur (repartir d'un espace vide puis resynchroniser). Pas d'ouverture sans session Microsoft.
- OneDrive : les fichiers synchronisés sont protégés par Microsoft (compte professionnel, dossier privé de l'application), **pas chiffrés en plus** par l'application (décision du lot 7) ; un mot de passe OneDrive reste possible plus tard (point d'accroche `Scelleur`).
- Mode essai : espace séparé, jamais relié à un vrai compte Microsoft ; données fictives seulement.
- Copie de secours : fichier chiffré par mot de passe (PBKDF2 600 000 tours + AES‑GCM) ; sans mot de passe, le fichier est lisible par quiconque l'ouvre (l'écran le dit).
- CSP stricte : `script-src 'self'`, aucun script inline, aucune ressource tierce hors polices déclarées.
- React échappe le texte ; `innerHTML`/`dangerouslySetInnerHTML` interdits.
- Entrées externes (fichiers, stockage) validées par schéma avant utilisation.
- Aucune donnée personnelle dans les journaux, tests ou captures ; données de démonstration fictives.
- Dépendances : peu, versions fixées, vérifiées par CI et CodeQL.
- Export « dé-identifié » disponible pour partager sans identité.
- Signalement : prévenir le propriétaire du dépôt ; ne jamais publier de données réelles dans une issue.
