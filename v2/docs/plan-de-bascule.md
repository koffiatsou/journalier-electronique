# Plan de bascule : de la V75 à la V2

Document pour l'utilisateur, à adapter avant de le donner à l'équipe. Rien n'est supprimé dans la V75 : elle reste utilisable tant que l'équipe en a besoin.

## Ce qui a été vérifié (lot 9)
- La V2 sait lire les données de la V75 **sur le même ordinateur et dans le même navigateur** (élèves, séances, agenda), les convertir, les contrôler élève par élève, puis les ajouter au coffre chiffré de la V2.
- Reprise **sans danger** : la V75 n'est jamais modifiée ; rien n'est supprimé ni remplacé dans la V2 ; on peut recommencer sans créer de doublons.
- Vérifié par 47 tests automatiques et un essai dans un vrai navigateur.

## Ce qui reste à faire par vous avant la mise en service
1. Déclarer l'adresse de retour de la V2 chez Microsoft (Entra), puis faire **une première vraie connexion** (lots 7 et 8).
2. Essayer la reprise **avec vos vraies données** (voir ci-dessous) et comparer quelques séances avec la V75.
3. Relire le message à l'équipe et choisir la date de bascule.

## Connexion Microsoft : quelle adresse déclarer chez Entra
- Connexion = votre **compte Microsoft** (celui qui a OneDrive), pas un compte GitHub. GitHub ne fait qu'héberger le site.
- Chez Entra (inscription de l'application, « Authentification »), ajouter une adresse de retour de type **Application monopage (SPA)**, sans toucher à celles de la V75.
- **Essai en local, avant la fusion** (connexion et synchronisation seulement) : télécharger la branche, dans le dossier `v2` lancer `npm install` puis `npm run dev`, ouvrir `http://localhost:5173/` et déclarer `http://localhost:5173/msal-redirect.html`. Même port, `localhost` (pas `127.0.0.1`). À retirer ensuite.
- **En ligne, après la fusion de la PR** : la V2 est publiée dans `/v2/` du même site que la V75 ; déclarer `<adresse du site>/v2/msal-redirect.html` (l'adresse exacte est affichée dans l'écran Synchro, sous « adresse de retour »).
- **La reprise V75 ne marche qu'en ligne** (même adresse de site que la V75) : en local, la V2 ne voit pas les données de la V75.
- L'aperçu dans Claude ne permet pas la connexion Microsoft (adresse non déclarée).

## Étapes pour un agent (sur son ordinateur habituel)
1. Ouvrir la V75 une dernière fois, **dans le même navigateur** que d'habitude, et vérifier que tout s'affiche.
2. Ouvrir la V2, se connecter avec le compte Microsoft.
3. Écran « Reprendre mes données de la V75 » (lien sur l'accueil quand il n'y a encore aucun élève, ou dans l'écran Synchro).
4. Cliquer « Chercher mes données de la V75 », lire le résumé.
5. **Vérifier élève par élève** : ouvrir « Voir les séances » et comparer avec la V75 (dates, matières, présences).
6. Cocher les élèves à reprendre, cliquer « Importer ».
7. Lire le tableau de contrôle (« En place » pour chaque élève). Ouvrir deux ou trois séances au Journalier.
8. Retaper les PIA : ils ne sont pas convertis (la V2 les organise autrement). L'écran montre, élève par élève, le texte de la V75 avec un bouton « Copier ».
9. Continuer à utiliser la V75 en parallèle quelques jours si besoin ; ne rien supprimer tant que l'agent n'est pas sûr.

## Points d'attention (à dire à l'équipe)
- **Même ordinateur, même navigateur** : les données de la V75 ne vivent que là. Autre ordinateur ou navigateur vidé : la reprise ne trouvera rien.
- **OneDrive de la V75** : d'après la lecture du code, la V75 risque de ne plus envoyer sur OneDrive les séances qui contiennent la présence ou des notes de classe. Ne comptez donc pas sur OneDrive comme source : la reprise lit l'appareil. (Voir « Idées en attente » du plan.)
- **Noms** : la V75 n'avait qu'une case ; le nom est repris entier dans « Nom » (prénom vide).
- **Agenda** : les séries simples restent des séries ; les autres répétitions sont posées jour par jour jusqu'à fin juillet ; les rendez-vous de week-end ne sont pas repris (la liste est affichée).
- **Mode essai** : la reprise y est refusée (jamais de vraies données en essai).
- Après l'import, la synchronisation habituelle envoie tout vers OneDrive.

## Message type pour l'équipe
> Bonjour à toutes et à tous,
> La nouvelle version du Journalier (V2) est prête. Vos données de l'ancienne version peuvent y être reprises en quelques minutes, sur votre ordinateur habituel et avec le même navigateur. Rien n'est supprimé : l'ancienne version reste disponible pendant la transition.
> Marche à suivre : ouvrez une dernière fois l'ancienne version, puis la nouvelle, connectez-vous avec votre compte Microsoft et suivez « Reprendre mes données de la V75 ». Vérifiez vos élèves (le résumé vous aide), puis importez. Les PIA sont à recopier avec le bouton « Copier » prévu.
> En cas de doute ou de différence, ne supprimez rien et écrivez-moi.
