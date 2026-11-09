import type { Annee, FormeEnseignement } from '../src/domain/referentiel/index.ts';

/**
 * Corpus d'objectifs de leçon FICTIFS, écrits en langage de terrain (courts, abrégés, titres de chapitre),
 * pas avec les mots du référentiel. Aucune donnée d'élève.
 *
 * Une attente est un motif (sans accents, minuscules) cherché dans « phrase + intitulé + thème » d'une piste :
 * jamais le texte exact d'une ligne, qui change à chaque nouvelle extraction.
 * Le corpus est gelé avant tout réglage du moteur ; ajouter des cas est permis, en retirer pour améliorer le score ne l'est pas.
 * Parité de l'indice : pair = lot de réglage, impair = lot de contrôle (jamais regardé pendant les réglages).
 */
export type JeuCorpus = 'mathematiques' | 'francais' | 'sciences' | 'langues' | 'economie' | 'histoire-geographie' | 'technique';

export interface CasCorpus {
  jeu: JeuCorpus;
  objectif: string;
  annee?: Annee;
  forme?: FormeEnseignement;
  langue?: string;
  /** Au moins une des pistes proposées doit correspondre à ce motif. Absent = aucune piste attendue (objectif vague). */
  attendu?: RegExp;
}

const m = (objectif: string, annee: Annee, attendu: RegExp, forme?: FormeEnseignement): CasCorpus => ({ jeu: 'mathematiques', objectif, annee, attendu, ...(forme ? { forme } : {}) });
const f = (objectif: string, annee: Annee, attendu: RegExp, forme?: FormeEnseignement): CasCorpus => ({ jeu: 'francais', objectif, annee, attendu, ...(forme ? { forme } : {}) });
const s = (objectif: string, annee: Annee, attendu: RegExp, forme?: FormeEnseignement): CasCorpus => ({ jeu: 'sciences', objectif, annee, attendu, ...(forme ? { forme } : {}) });
const l = (langue: string, objectif: string, annee: Annee, attendu: RegExp, forme?: FormeEnseignement): CasCorpus => ({ jeu: 'langues', objectif, annee, langue, attendu, ...(forme ? { forme } : {}) });
const e = (objectif: string, attendu: RegExp): CasCorpus => ({ jeu: 'economie', objectif, forme: 'G', attendu });
const h = (objectif: string, annee: Annee, attendu: RegExp): CasCorpus => ({ jeu: 'histoire-geographie', objectif, annee, attendu });
const t = (objectif: string, annee: Annee, attendu: RegExp): CasCorpus => ({ jeu: 'technique', objectif, annee, attendu });
const hs = (objectif: string, annee: Annee, attendu: RegExp): CasCorpus => ({ jeu: 'histoire-geographie', objectif, annee, forme: 'G', attendu });
const vague = (jeu: JeuCorpus, objectif: string, annee: Annee): CasCorpus => ({ jeu, objectif, annee });

export const CORPUS: readonly CasCorpus[] = [
  m('tables de multiplication', 'P3', /multiplic/),
  m('les fractions équivalentes', 'S1', /fraction/),
  m('additionner des fractions', 'S2', /fraction/),
  m('règle des signes', 'S2', /relatif|positif|negatif/),
  m('Pythagore', 'S2', /pythagor|triangle rectangle/),
  m('Thalès', 'S3', /thales|proportionnal|semblable|homothe/),
  m('équations du 1er degré', 'S2', /equation/),
  m('périmètre et aire du rectangle', 'S1', /perimetre|aire/),
  m('somme des angles d’un triangle', 'S1', /angle/),
  m('réduire une expression littérale', 'S2', /expression|litteral|algebr|terme/),
  m('les pourcentages', 'S2', /pourcent/),
  m('proportionnalité, règle de trois', 'S1', /proportion/),
  m('volume du prisme', 'S2', /volume/),
  m('moyenne et médiane', 'S3', /moyenne|mediane|statist/),
  m('fonction affine', 'S3', /fonction|affine|droite/),
  m('SOHCAHTOA', 'S4', /trigono|sinus|cosinus|tangente/, 'G'),
  m('système de deux équations', 'S3', /systeme|equation/),
  m('factoriser', 'S3', /factori|developp|expression/),
  m('les racines carrées', 'S2', /racine/),
  m('puissances de 10, notation scientifique', 'S2', /puissance|scientifique/),
  m('symétrie axiale', 'S1', /symetri/),
  m('diviseurs et PGCD', 'S1', /diviseur|multiple|pgcd|divisib/),
  m('probabilités', 'S3', /probabil|hasard/),
  m('dérivées', 'S6', /deriv/, 'G'),
  m('logarithmes', 'S5', /logarithm|exponent/, 'G'),
  m('les vecteurs', 'S4', /vecteur/, 'G'),
  m('conversion d’unités de longueur', 'S1', /unite|conversion|longueur|grandeur/),
  m('mesurer un angle au rapporteur', 'S1', /angle|mesur/),
  f('accord du participe passé', 'S3', /participe|accord/),
  f('le passé composé', 'S1', /temps|conjug|passe/),
  f('repérer l’idée principale d’un texte', 'S1', /idee|principal|texte/),
  f('résumer un article', 'S4', /resum/, 'G'),
  f('les types de phrases', 'S1', /phrase/),
  f('ponctuation du dialogue', 'S1', /ponctu|dialogue|discours/),
  f('rédiger un texte argumentatif', 'S5', /argument|opinion|defendre/, 'G'),
  f('le champ lexical', 'S2', /lexical|lexique|vocabulaire|mots/),
  f('COD et COI', 'S2', /complement|fonction|objet/),
  f('homophones a / à', 'S1', /homophon|orthograph/),
  f('le narrateur dans le roman', 'S2', /narrat|recit|roman/),
  f('comparaison et métaphore', 'S2', /compar|metaphor|figure|image/),
  f('la proposition subordonnée relative', 'S3', /subordonn|relative|phrase complexe|propositions/),
  f('écrire une lettre formelle', 'S2', /lettre|ecrit|ecrire/),
  f('exposé oral', 'S2', /oral|expos|parole/),
  f('synthèse de documents', 'S5', /synthese|documents|resum/, 'G'),
  f('conjugaison du présent de l’indicatif', 'S1', /conjug|present|indicatif|verbe/),
  f('schéma narratif', 'S1', /narratif|recit|schema/),
  s('la photosynthèse', 'S3', /photosynth|plante|amidon/),
  s('la cellule', 'S1', /cellule/),
  s('les circuits électriques', 'S2', /circuit|electri|courant/),
  s('loi d’Ohm', 'S3', /ohm|tension|resistance|intensite/),
  s('les états de la matière', 'S1', /etat|matiere|solide|liquide|gaz/),
  s('tableau périodique', 'S3', /periodique|element|atome/),
  s('la digestion', 'S2', /digest|aliment|nutri/),
  s('force et mouvement', 'S3', /force|mouvement|vitesse/),
  s('réactions acide-base', 'S4', /acide|base|\bph\b/, 'G'),
  s('chaînes alimentaires', 'S1', /ecosysteme|chaine|alimentaire|milieu/),
  s('la mole', 'S5', /mole|quantite de matiere/, 'G'),
  s('la mitose', 'S4', /mitose|division|cellul/, 'G'),
  s('le système solaire', 'S2', /solaire|astre|terre|planete/),
  s('mélanges et corps purs', 'S1', /melange|separ|corps pur|substance/),
  s('transformations d’énergie', 'S2', /energie/),
  s('ADN et hérédité', 'S5', /adn|gene|genet|heredit/, 'G'),
  l('Anglais', 'verbes irréguliers', 'S2', /irregul|verbe|conjug/),
  l('Néerlandais', 'le plus-que-parfait', 'S4', /plus|parfait|passe|temps/, 'G'),
  l('Néerlandais', 'se présenter', 'S1', /presenter|identit|personne/),
  l('Néerlandais', 'conjuguer au présent', 'S2', /present|conjug|verbe/),
  l('Néerlandais', 'place du verbe dans la phrase', 'S3', /ordre|place|verbe|phrase|syntax/),
  l('Néerlandais', 'vocabulaire de la nourriture', 'S1', /nourriture|aliment|vocabul|mots|champ/),
  l('Anglais', 'compréhension à l’écoute', 'S2', /ecoute|comprendre|oral|ecout/),
  l('Anglais', 'écrire un e-mail', 'S4', /ecri|message|lettre|courrier/, 'G'),
  l('Anglais', 'les comparatifs', 'S3', /compar/),
  l('Néerlandais', 'les pronoms personnels', 'S2', /pronom/),
  l('Anglais', 'commander au restaurant', 'S3', /conversation|interact|parler|situation|oral/),
  l('Allemand', 'der Akkusativ', 'S4', /accusatif|cas|declinaison|complement/, 'G'),
  e('offre et demande', /offre|demande|marche/),
  e('le chômage', /chomage|emploi|travail/),
  e('l’inflation', /inflation|prix|monnaie/),
  e('le contrat de travail', /contrat|travail|droit/),
  e('consommation des ménages', /consomm|menage/),
  m('calcul mental', 'S1', /calcul/),
  m('tableau de proportionnalité', 'S2', /proportion/),
  m('vitesse en km/h', 'S2', /vitesse|grandeur|unite/),
  m('aire du disque', 'S2', /disque|cercle|aire/),
  m('médiatrice et bissectrice', 'S1', /mediatrice|bissectrice|construi/),
  m('identités remarquables', 'S3', /identit|produit|developp|remarquable/),
  m('équation du second degré, discriminant', 'S5', /second degre|equation|trinome/, 'G'),
  m('additions de relatifs', 'S1', /relatif|entier/),
  m('la droite graduée', 'S1', /droite|nombre|gradu|repere/),
  m('diagramme en bâtons', 'S2', /diagramme|statist|donnees|graphique/),
  f('verbes du 1er groupe', 'S1', /conjug|verbe/),
  f('les connecteurs logiques', 'S3', /connecteur|organisateur|lien|logique|cohesion/),
  f('lecture suivie', 'S1', /lire|lecture|texte/),
  f('registres de langue', 'S2', /registre|langue/),
  f('structure d’un paragraphe', 'S2', /paragraphe|structure|texte/),
  f('accord sujet-verbe', 'S1', /accord|sujet/),
  f('imparfait et passé simple', 'S3', /imparfait|passe simple|temps/),
  f('analyse d’une affiche publicitaire', 'S2', /publicit|image|message|argument/),
  s('la densité', 'S2', /densit|masse volumique|masse/),
  s('le cycle de l’eau', 'S1', /eau|cycle/),
  s('les organes des sens', 'S1', /sens|organe/),
  s('la respiration', 'S2', /respir|poumon|echange/),
  s('volcans et séismes', 'S3', /volcan|seisme|tectoni|terre/),
  s('lumière et miroirs', 'S2', /lumiere|reflexion|miroir|rayon/),
  s('le microscope', 'S1', /microscop|observ|cellule/),
  s('la pression des gaz', 'S4', /pression|gaz/, 'G'),
  l('Néerlandais', 'l’imparfait', 'S3', /passe|parfait|temps|imparfait|conjug/),
  l('Anglais', 'present perfect', 'S4', /parfait|perfect|temps/, 'G'),
  l('Néerlandais', 'les nombres et l’heure', 'S1', /nombre|heure|temps/),
  l('Anglais', 'parler de ses loisirs', 'S2', /loisir|parler|exprimer|gout|activit/),
  e('impôts et taxes', /impot|taxe|fiscal|etat/),
  e('le budget d’un ménage', /budget|menage|consomm|revenu/),
  e('la bourse', /bourse|marche|action|financ/),
  h('la frise chronologique', 'S1', /frise|chronolog|temps/),
  h('lire une carte', 'S1', /carte|plan|croquis|localis/),
  h('la colonisation', 'S2', /coloni/),
  h('la Seconde Guerre mondiale', 'S3', /guerre|1945|1940|mondiale/),
  h('l’Antiquité romaine', 'S1', /rome|romain|antiquit|empire/),
  h('le paysage', 'S2', /paysage/),
  h('la mondialisation', 'S2', /mondialisation/),
  h('les sources historiques', 'S1', /trace|source|document/),
  h('commerce équitable et consommation', 'S1', /consommation|commerce/),
  h('l’urbanisation', 'S3', /urbain|ville|urbanisation|population/),
  hs('les Lumières', 'S4', /lumieres|ancien regime|idees/),
  hs('la révolution industrielle', 'S5', /industriel|revolution/),
  hs('la décolonisation', 'S6', /decolonisation|colonisation/),
  hs('risques naturels', 'S5', /risque/),
  hs('la cité athénienne', 'S4', /athen|antiquite|cite/),
  t('programmer avec Scratch', 'S1', /algorithme|programme|boucle/),
  t('lire un dessin technique', 'S2', /dessin|plan|document technique/),
  t('faire un graphique dans le tableur', 'S2', /tableur|graphique|donnees/),
  t('hygiène en cuisine', 'S3', /securite|ingredient|hygien|sanitaire/),
  t('les réseaux sociaux', 'S1', /reseau|socionumerique/),
  t('recherche sur internet', 'S2', /recherche|operateur|moteur|internet/),
  vague('mathematiques', 'révisions', 'S2'),
  vague('mathematiques', 'interro', 'S3'),
  vague('mathematiques', 'exercices', 'S1'),
  vague('francais', 'préparation du bilan', 'S2'),
  vague('francais', 'correction de l’examen', 'S4'),
  vague('francais', 'suite du chapitre', 'S1'),
  vague('sciences', 'film', 'S2'),
  vague('sciences', '', 'S3')
];
