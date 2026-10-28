# Plan de bascule : de la V75 à la V2

> **État au 28/10/2026 : la bascule est faite.** La demande #37 a été fusionnée le 27/10/2026 à 22 h 51 ; la #39 (lot SP, sécurité, verrou npm) l'a été le 28/10/2026. Les passages ci-dessous qui parlent « d'avant la fusion » restent valables pour l'historique et le retour arrière.

Document pour l'utilisateur, à adapter avant de le donner à l'équipe. Rien n'est supprimé dans la V75 : elle reste utilisable en secours, à une autre adresse (lot S).

## Ce qui change le jour de la mise en service (lot S)
| | Avant | Après la fusion de la demande #37 |
|---|---|---|
| Adresse habituelle du site (celle des marque-pages) | la V75 | **la V2** |
| La V75 | à l'adresse habituelle | **en secours, à la même adresse suivie de `/v75/`** |
| Adresse de retour Microsoft de la V2 | — | `<adresse du site>/msal-redirect.html` : **la même que celle déjà déclarée pour la V75 aujourd'hui** (même inscription Microsoft) |
| Adresse de retour Microsoft de la V75 | `<adresse du site>/msal-redirect.html` | `<adresse du site>/v75/msal-redirect.html` : **à déclarer** (voir ci-dessous) |

- **Fusionner la demande #37 sur GitHub, c'est faire la bascule** : dès que le site est republié (quelques minutes), l'adresse habituelle ouvre la V2. Avant ce lot, la fusion aurait seulement ajouté la V2 à côté ; ce n'est plus le cas.
- Les deux versions sont sur le **même site** : les données restées dans le navigateur (celles de la V75 comme celles de la V2) ne bougent pas, et la V2 peut toujours lire celles de la V75.
- Le contrôle automatique de GitHub (sur la demande #37) **assemble et vérifie maintenant le site complet avant toute fusion** : si la V75 n'est pas correctement installée dans `/v75/`, il devient rouge. Ne fusionnez pas tant qu'il n'est pas vert.

## Ce qui a été vérifié (lot 9)
- La V2 sait lire les données de la V75 **sur le même ordinateur et dans le même navigateur** (élèves, séances, agenda), ou **dans OneDrive** (dossiers de la V75, lot 9b), les convertir, les contrôler élève par élève, puis les ajouter au coffre chiffré de la V2.
- Reprise **sans danger** : la V75 n'est jamais modifiée ; rien n'est supprimé ni remplacé dans la V2 ; on peut recommencer sans créer de doublons.
- Vérifié par des tests automatiques (47 pour la lecture sur l'appareil, 22 de plus pour OneDrive et « Repartir de OneDrive ») et des essais dans un vrai navigateur (la connexion Microsoft est simulée : **le premier essai avec un vrai compte reste à faire**).

## Ce qui reste à faire par vous avant la mise en service
1. **Déclarer chez Microsoft (Entra) l'adresse de retour de la V75 de secours** : `<adresse du site>/v75/msal-redirect.html`, type « Application monopage (SPA) » (voir plus bas). **Sans cela, la V75 en secours ne s'ouvre pas** (elle exige la connexion Microsoft pour ouvrir ses données). Ajouter cette adresse ne change rien à la V75 actuelle : vous pouvez la déclarer tout de suite.
2. Faire **une première vraie connexion** avec la V2 (lots 7 et 8) : fait le 27/10/2026 (en local).
3. Essayer la reprise **avec vos vraies données** (voir ci-dessous), d'abord depuis OneDrive puis, si des séances manquent, depuis l'appareil, et comparer quelques séances avec la V75.
4. Faire **une dernière synchronisation dans la V75** (à l'adresse habituelle, **avant** la fusion) sur chaque ordinateur et tablette.
5. Relire le message à l'équipe, choisir la date de bascule, regarder que le contrôle GitHub de la demande #37 est vert, puis fusionner.

## Connexion Microsoft : quelles adresses déclarer chez Entra
- Connexion = votre **compte Microsoft** (celui qui a OneDrive), pas un compte GitHub. GitHub ne fait qu'héberger le site.
- Les deux versions utilisent **la même inscription d'application** chez Entra : leurs adresses de retour se trouvent donc dans la même liste (« Authentification », type **Application monopage (SPA)**).
- **V2 à l'adresse habituelle : rien à ajouter.** Son adresse de retour est `<adresse du site>/msal-redirect.html`, déjà déclarée pour la V75. (Vérifié dans un navigateur par le parcours `tools/navigateur/site.mjs`.)
- **V75 en secours : une adresse à ajouter** : `<adresse du site>/v75/msal-redirect.html`, c'est-à-dire l'adresse déjà déclarée avec « v75/ » avant « msal-redirect.html ». Ne retirez pas l'ancienne : c'est maintenant celle de la V2.
- **Essai en local, avant la fusion** (connexion et synchronisation seulement) : télécharger la branche, dans le dossier `v2` lancer `npm install` puis `npm run dev`, ouvrir `http://localhost:5173/` et déclarer `http://localhost:5173/msal-redirect.html`. Même port, `localhost` (pas `127.0.0.1`). À retirer quand vous n'en avez plus besoin.
- L'adresse `<adresse du site>/v2/msal-redirect.html`, si vous l'aviez déclarée au lot 8, ne sert plus : la V2 n'est jamais publiée dans `/v2/`. Vous pouvez la retirer.
- **Lire l'appareil ne marche qu'en ligne** (même adresse de site que la V75) : en local, la V2 ne voit pas le stockage de la V75. **Lire OneDrive marche aussi en local** (essai avant la fusion), une fois la connexion Microsoft faite avec le compte utilisé dans la V75.
- L'aperçu dans Claude ne permet pas la connexion Microsoft (adresse non déclarée).

## Après la fusion : vérifier en 5 minutes
1. Ouvrir l'adresse habituelle : l'écran « Journalier verrouillé » de la V2 doit s'afficher. Si l'ancienne version apparaît encore, attendre une dizaine de minutes et recharger la page (le site peut mettre ce temps à se renouveler ; il n'y a pas de mise en mémoire hors ligne à vider). Se connecter avec Microsoft.
2. Ouvrir `<adresse du site>/v75/` : la V75 doit s'ouvrir (se connecter avec le même compte) et montrer ses élèves.
3. Dans la V2, ouvrir un Journalier, un PIA, l'agenda : tout doit s'afficher.

**Si la V2 ne s'ouvre pas à l'adresse habituelle** : sur GitHub, ouvrir la demande de fusion #37 déjà fusionnée et cliquer « Revert » : GitHub prépare une demande qui annule la bascule ; la fusionner remet la V75 à l'adresse habituelle en quelques minutes. Les données, elles, ne sont pas touchées (elles vivent dans les navigateurs et dans OneDrive, pas dans le site).

## Étapes pour un agent (sur son ordinateur habituel)
1. **Avant la date de bascule**, dans la V75 (adresse habituelle, **même navigateur** que d'habitude) : vérifier que tout s'affiche et faire une dernière synchronisation.
2. À partir de la date de bascule, l'adresse habituelle ouvre la V2. Se connecter avec le compte Microsoft.
3. Écran « Reprendre mes données de la V75 » (lien sur l'accueil quand il n'y a encore aucun élève, ou dans l'écran Synchro).
4. Cliquer « Lire le OneDrive de la V75 » (si vos données de la V75 sont anciennes sur l'ordinateur, c'est le plus sûr) ou « Chercher mes données de la V75 sur cet appareil », lire le résumé. Si des séances manquent après un premier import, cliquer « Lire une autre source » et lire l'autre : rien n'est dupliqué. (Pour lire l'appareil, il n'est pas nécessaire d'ouvrir la V75 : la V2 lit son stockage directement.)
5. **Vérifier élève par élève** : ouvrir « Voir les séances » et comparer avec la V75 (dates, matières, présences). La V75 reste consultable à `<adresse du site>/v75/`.
6. Cocher les élèves à reprendre, cliquer « Importer ».
7. Lire le tableau de contrôle (« En place » pour chaque élève). Ouvrir deux ou trois séances au Journalier.
8. Retaper les PIA : ils ne sont pas convertis (la V2 les organise autrement). L'écran montre, élève par élève, le texte de la V75 avec un bouton « Copier ».
9. Garder la V75 en secours quelques jours si besoin ; ne rien supprimer tant que l'agent n'est pas sûr.

## Points d'attention (à dire à l'équipe)
- **Les marque-pages et l'écran d'accueil de la tablette** : l'adresse habituelle ouvre la V2. Celui qui veut retrouver la V75 ajoute `/v75/` à la fin de l'adresse (et s'y connecte avec son compte Microsoft).
- **Même ordinateur, même navigateur** : les données de la V75 ne vivent que là. Autre ordinateur ou navigateur vidé : la reprise ne trouvera rien.
- **OneDrive de la V75 peut être incomplet** : d'après la lecture du code, la V75 refuse d'envoyer sur OneDrive les séances qui contiennent la présence ou des notes de classe, et certains profils d'élèves. À vérifier avec votre compte : comparez le nombre de séances par élève avec la V75, puis lisez aussi l'appareil si besoin. (À signaler comme défaut de la V75 une fois confirmé.)
- **Nouvel ordinateur, ou données de la V2 dépassées** : écran Synchro → « Repartir de OneDrive » : l'ordinateur reprend exactement ce que contient OneDrive (rien n'est fusionné ; OneDrive n'est jamais modifié ; un aperçu et une case à cocher avant tout remplacement). Pensez à enregistrer d'abord une copie de secours si vous hésitez.
- **Noms** : la V75 n'avait qu'une case ; le nom est repris entier dans « Nom » (prénom vide).
- **Écoles** : avant de saisir les premières séances, ouvrir Agenda → « Horaires » et déclarer vos écoles (nom + heures). Les horaires de la V75 ne servent que tant qu'aucune école n'est enregistrée ; les élèves reprennent l'école du même nom.
- **Agenda** : les séries simples restent des séries ; les autres répétitions sont posées jour par jour jusqu'à fin juillet ; les rendez-vous de week-end ne sont pas repris (la liste est affichée).
- **Mode essai** : la reprise y est refusée (jamais de vraies données en essai).
- Après l'import, la synchronisation habituelle envoie tout vers OneDrive.
- **La V75 en secours** : elle fonctionne comme avant. Au premier chargement à sa nouvelle adresse, la console du navigateur peut montrer quelques lignes « 404 » : elle essaie d'abord un ancien chemin pour ses fichiers de référence, puis trouve le bon. Sans conséquence.
- **Une seule version à la fois pour écrire** : une fois la V2 adoptée, ne plus saisir de séances dans la V75 (elles ne seraient pas reprises automatiquement dans la V2).

## Message type pour l'équipe
> Bonjour à toutes et à tous,
> La nouvelle version du Journalier (V2) est prête et prend la place de l'ancienne **à l'adresse habituelle** à partir du [date]. Vos données de l'ancienne version peuvent y être reprises en quelques minutes, sur votre ordinateur habituel et avec le même navigateur. Rien n'est supprimé : l'ancienne version reste disponible en secours en ajoutant `/v75/` à la fin de l'adresse.
> Marche à suivre : **avant le [date]**, ouvrez l'ancienne version et faites une dernière synchronisation. À partir du [date], ouvrez l'adresse habituelle (c'est la nouvelle version), connectez-vous avec votre compte Microsoft et suivez « Reprendre mes données de la V75 ». Vérifiez vos élèves (le résumé vous aide), puis importez. Les PIA sont à recopier avec le bouton « Copier » prévu.
> En cas de doute ou de différence, ne supprimez rien et écrivez-moi.
