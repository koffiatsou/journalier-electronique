# Plan de travail de la V2 (un lot = une conversation)

Mis à jour le 24 octobre 2026 (lot 1 terminé). Ce fichier est la **liste des lots**. Pour démarrer : ouvrir une nouvelle conversation, écrire « Lot N » (ou « le lot suivant ») ; Claude lit `AGENTS.md`, ce plan et `docs/etat-des-lieux.md`, puis travaille uniquement sur ce lot.

## Principe
- Une conversation = un lot. Pas de dérive vers un autre lot : toute idée en plus va dans « Idées en attente » ci‑dessous.
- Un lot est **fini** quand sa liste « Critères de fin » est vraie ET que la **fin de lot** (ci‑dessous) est faite.
- Si un lot est trop gros pour une conversation, on le coupe (ex. 5a / 5b) et on met le plan à jour.

## Fin de lot (obligatoire, dans cet ordre)
1. `cd v2 && npm run check` vert (typecheck + tests + build). Si le registre npm est bloqué, relier les paquets déjà présents sur la machine dans `v2/node_modules` (voir README, « Sans accès au registre »).
2. Vérification dans un vrai navigateur : scripts Playwright dans `v2/tools/navigateur/` (en ajouter un par lot) ; aucune erreur console.
3. Mettre à jour : `docs/etat-des-lieux.md` (Fait / Reste), ce plan (statut du lot, lot suivant conseillé), `AGENTS.md` (décisions durables, nouveaux dossiers), `docs/decisions.md` (une ligne par décision), `README.md` (tableau d'avancement).
4. Commit + push sur `v2/react-ts` (jamais `main`), PR #37 mise à jour.
5. Dire à l'utilisateur en français simple : ce qui marche, ce qui reste, **quel lot lancer ensuite**.

## Statuts
✅ fait · 🔜 conseillé ensuite · ⏳ à faire · ⏸ en pause

## Déjà fait (avant le plan par lots)
✅ Socle (React/TS, domaine, données locales, CI) · ✅ Séance en 5 étapes + moteur de rédaction · ✅ Référentiel (partiel, voir lots R) · ✅ Écran Élèves (fiche, historique) · ✅ Export Word du Journalier (modèle papier) · ✅ Agenda (semaine/jour, couleurs, glisser-déplacer, répétition, Encoder).

## Lots

### Cœur du produit (priorité)
| Lot | Contenu | Critères de fin | Statut |
|---|---|---|---|
| 1 — Journalier (écran) | Écran « Journalier » : séances d'un élève ou de tous, période (année scolaire, état à ce jour, dates libres), modification/suppression d'une séance, export Word par période (identifié / dé‑identifié) depuis cet écran | Parcours séance → Journalier → Word sans passer par Élèves ; période respectée dans le fichier | ✅ (24/10/2026) |
| 2 — Élèves complets | Page Élèves en cartes (initiales sur pastille de couleur), recherche, matière libre, plusieurs langues modernes, archivage, suppression complète (séances et agenda compris, confirmation), passage d'année scolaire ; recherche d'une séance au Journalier | Suppression testée ; aucune séance orpheline (vérifié dans la base du navigateur) | ✅ (24/10/2026) |
| 2b — Avatars dessinés | **Pas de photo** : avatar dessiné au choix, personnalisable (teint, coiffure, couleur des cheveux, visage, accessoire) en cinq styles génériques (manga, bande dessinée, dessin animé, pixel, minimaliste), dessins originaux, sans personnage ni marque existants ; sans avatar, les initiales | Dessins relus sur écran par l'utilisateur ; choix conservé après rechargement ; initiales si aucun avatar | ✅ (26/10/2026, dans la même conversation que le lot 2) — **à relire par l'utilisateur** |
| 3 — Réunion | Vue réunion en langage simple par matière (points d'appui, à travailler, compétence, aides), choix de la période, propositions d'objectifs à valider | Synthèse correcte sur des séances réelles ; textes relus par l'utilisateur | 🔜 |
| 4 — PIA | Cases du modèle officiel (voir `docs/PIA_MODELE_STRUCTURE.md` à la racine du dépôt), procès‑verbaux, export Word officiel + dé‑identifié, option PDF | Fichier comparé au modèle officiel (conversion PDF relue) | ⏳ |

### Agenda
| Lot | Contenu | Statut |
|---|---|---|
| 5 — Agenda : calendrier | Vue mois, jours fériés et vacances scolaires FWB, horaires des périodes réglables | ⏳ |
| 6 — Agenda : confort | « Semaine type », glisser pour créer sur plusieurs périodes, impression | ⏳ |

### Données et sécurité
| Lot | Contenu | Statut |
|---|---|---|
| 7 — Coffre chiffré | Chiffrement AES‑GCM local (voir `docs/STOCKAGE_LOCAL_V74.md`), mot de passe, verrouillage, export/import de secours | ⏳ |
| 8 — OneDrive / Outlook | Synchronisation Microsoft (Entra ID, Graph), conflits, repli manuel ; liaison Outlook (agenda) | ⏳ |
| 9 — Reprise V75 | Import des données de la V75 vers la V2, vérification élève par élève, plan de bascule et d'information de l'équipe | ⏳ |

### Référentiel (« R »), à reprendre quand l'utilisateur le décide
| Lot | Contenu | Statut |
|---|---|---|
| R1 — Histoire‑géographie et technique | Extraction (2022, 1999, HPT 2014) puis technique manuel/technologique ; droit détaillé | ⏳ |
| R2 — Langues | Anglais/allemand du tronc commun ; correspondance CECRL ↔ année ; grammaire par langue | ⏳ |
| R3 — Qualité des pistes | Relecture par échantillon, lignes tronquées, alias de terrain, regroupement des formulations proches, essai sur de vrais objectifs (journaux réels) | ⏳ |

### Qualité
| Lot | Contenu | Statut |
|---|---|---|
| Q — Finitions | Schémas zod, `package-lock.json` (quand le registre est accessible), accessibilité (lecteur d'écran, clavier), performance, tests navigateur dans la CI | ⏳ |

### Habillage
| Lot | Contenu | Statut |
|---|---|---|
| F — Finition visuelle (dernier lot) | Habillage de l'application : couleurs, logo, vocabulaire du menu, icônes, espacements, tablette ; relecture écran par écran avec l'utilisateur. Le style « Bleu encre » reste la base (décision validée) sauf demande contraire. | ⏳ (à faire en tout dernier) |

## Ordre conseillé
1 → 2 → 2b → 3 → 4 (le fil séance → Journalier → réunion → PIA est complet) → 7 → 8 → 9 (mise en service) ; les lots 5, 6, R et Q s'intercalent selon les retours de l'équipe. Le lot F (finition visuelle) vient en tout dernier. L'utilisateur peut changer l'ordre à tout moment : on met alors ce fichier à jour.

## Idées en attente (non planifiées)
- Journalier : en-tête du document Word avec la période choisie (aujourd'hui elle n'est que dans le nom du fichier) — à valider avec l'équipe (le modèle papier n'a pas de case prévue).
- Accueil : rendre les « Dernières séances » cliquables vers le Journalier.
- Menu : un second clic sur « Élèves » depuis un dossier ouvert ne ramène pas à la liste (seul « ← Tous les élèves » le fait).
- Archivage : les activités d'agenda (séries hebdomadaires) d'un élève archivé restent visibles ; à voir avec l'équipe si elles doivent se masquer ou s'arrêter à l'archivage.
- Avatars : afficher aussi l'avatar au Journalier, dans l'agenda et dans l'écran Séance ; ajouter des coiffures/accessoires si l'équipe en demande ; avatar choisi au hasard à la création d'un élève.
- Élèves : tri au choix des cartes (nom, classe, dernière séance) et filtre par classe, si la liste devient longue.
