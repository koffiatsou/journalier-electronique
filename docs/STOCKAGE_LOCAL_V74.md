# Stockage local granulaire — Journalier V74

> Architecture cible du coffre local après l'incident IndexedDB du 30 septembre 2026.

## 1. Pourquoi cette évolution

Le stockage historique `journalier-secure-v72` regroupait l'ensemble de l'état métier dans un seul enregistrement chiffré du store `states`.

Le diagnostic du 30 septembre 2026 a établi :

- la base IndexedDB historique s'ouvre correctement ;
- le store `keys` reste lisible ;
- la clé du compte reste lisible ;
- le seul enregistrement `states` du compte échoue à la lecture avec `UnknownError: Failed to read large IndexedDB value`.

La cause architecturale confirmée est la concentration de tout l'état dans une valeur unique. Le seuil exact ou le mécanisme interne Chromium à l'origine de l'erreur n'est pas considéré comme déterminé.

## 2. Principe

Le nouveau coffre est `journalier-secure-v74`.

Le coffre historique `journalier-secure-v72` reste conservé comme source de migration et de récupération. Il n'est jamais supprimé automatiquement.

Les stores du nouveau coffre sont :

```text
meta
students
sessions
agenda
pia
sync
keys
migration
```

Les données métier sont stockées par objet :

- un élève = un enregistrement `students` ;
- une séance = un enregistrement `sessions` ;
- un événement Agenda = un enregistrement `agenda` ;
- PIA = un enregistrement `pia` par élève ;
- registre de synchronisation = enregistrements `sync` séparés ;
- identité/état global minimal = `meta` ;
- état de migration = `migration`.

La configuration et les exceptions de l'Agenda sont conservées séparément dans `agenda` sous les identifiants techniques `__config` et `__exceptions`.

## 3. Chiffrement

Chaque enregistrement métier est chiffré séparément avec AES-GCM 256 bits.

La clé est une `CryptoKey` non extractible associée au compte Entra dans le store `keys` du nouveau coffre.

Chaque chiffrement utilise :

- un IV aléatoire de 12 octets ;
- des données authentifiées (AAD) contenant la version du stockage, l'identité du compte, le type et l'identifiant de l'objet ;
- une empreinte SHA-256 du ciphertext pour le diagnostic d'intégrité.

L'AAD empêche notamment qu'un ciphertext valide soit déplacé arbitrairement vers un autre type ou un autre identifiant sans provoquer un échec d'authentification cryptographique.

## 4. Écriture atomique

Les opérations préparées sont appliquées dans une transaction IndexedDB couvrant les stores concernés.

La transaction demande `durability: 'strict'` lorsque le navigateur le permet. Un repli de compatibilité est prévu pour les navigateurs ne supportant pas l'option.

Une modification de séance n'a donc plus besoin de réécrire les élèves, l'agenda et l'ensemble des autres séances.

## 5. Migration V72 → stockage granulaire V74

La migration est non destructive et idempotente :

1. ouverture du nouveau coffre ;
2. récupération/création de la clé locale du nouveau coffre ;
3. recherche du coffre historique v72 ;
4. lecture et déchiffrement de l'état historique si celui-ci est lisible ;
5. découpage de l'état en enregistrements granulaires ;
6. écriture transactionnelle ;
7. enregistrement du marqueur `migrationStatus: complete` uniquement après la transaction ;
8. conservation du coffre historique.

Si la migration est interrompue avant son marqueur final, l'application peut reprendre à partir de la source historique sans considérer la migration comme terminée.

## 6. Cas du coffre historique illisible

Si l'ancien enregistrement `states` existe mais ne peut plus être lu, Journalier :

- ne supprime pas l'ancien coffre ;
- n'affirme pas avoir récupéré les données locales ;
- ouvre un coffre granulaire vide et identifié ;
- marque explicitement le contexte comme nécessitant une récupération ;
- permet ensuite au mécanisme OneDrive existant de récupérer les données distantes lorsque l'espace distant est disponible.

Cette récupération ne doit pas écraser silencieusement un état local non vérifié.

## 7. OneDrive et source de récupération

OneDrive AppFolder reste distinct du coffre local.

La structure distante reste :

```text
Journalier/
├── profil/
├── eleves/
│   └── {studentId}/
│       ├── profil.json
│       └── seances/
│           └── {sessionId}.json
├── agenda/
│   └── agenda.json
├── pia/
│   └── {studentId}/pia.json
└── system/
```

Les permissions Graph restent limitées à `Files.ReadWrite.AppFolder`.

## 8. Compatibilité

Les identifiants techniques historiques `v72` restent conservés :

- identité de compte `journalier-v72:${raw}` ;
- ancienne base `journalier-secure-v72` ;
- ancien registre de synchronisation ;
- formats distants existants.

Le nouveau coffre est une évolution du stockage local, pas un changement d'identité ou de protocole distant.

## 9. Limites

IndexedDB reste un stockage navigateur. Le chiffrement protège les données au repos dans le coffre applicatif, mais ne transforme pas le navigateur en frontière de sécurité absolue contre un XSS exécuté dans l'origine de l'application.

La perte définitive de la `CryptoKey` locale rend les ciphertexts locaux correspondants indéchiffrables. La récupération métier doit donc pouvoir repartir des données synchronisées dans OneDrive lorsque celles-ci existent.
