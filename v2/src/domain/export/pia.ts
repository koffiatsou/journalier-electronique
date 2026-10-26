/**
 * Remplissage du PIA officiel (modèle Word) : on garde le document du modèle tel quel et on ne fait
 * qu'écrire dans ses cases (jamais de reconstruction, pour que la mise en forme reste celle de l'école).
 * Structure vérifiée du modèle : voir `docs/PIA_MODELE_STRUCTURE.md` à la racine du dépôt.
 * Fonctions pures (testables sans navigateur). Le procès-verbal 2 n'est pas rempli ici (lot 4b).
 */
import { ASPECTS } from '../pia/types.ts';
import type { Pia } from '../pia/types.ts';
import type { Eleve } from '../types.ts';
import { cellules, dateBelge, decouperTables, esc, lignes, sansBalises } from './journalier.ts';

/* ───────── Outils sur le XML ───────── */

/** Paragraphes (jamais imbriqués dans ce modèle) : `<w:pPr>` ne correspond pas, car « P » suit « <w:p ». */
const PARAGRAPHES = /<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g;

const norme = (xml: string): string =>
  sansBalises(xml).replace(/[  \s]+/g, ' ').replace(/[’']/g, ' ').replace(/\s+/g, ' ').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/** Reconstruit un élément en gardant ce qui précède son premier enfant et ce qui suit le dernier. */
function reassembler(xml: string, enfants: readonly string[], ouvre: RegExp, ferme: RegExp): string {
  const premier = ouvre.exec(xml);
  const dernier = [...xml.matchAll(ferme)].pop();
  if (!premier || !dernier) throw new Error('Le modèle PIA est inattendu (structure d’un tableau).');
  return xml.slice(0, premier.index) + enfants.join('') + xml.slice(dernier.index + dernier[0].length);
}
const tableAvecLignes = (tbl: string, rows: readonly string[]): string => reassembler(tbl, rows, /<w:tr[ >]/, /<\/w:tr>/g);
const ligneAvecCellules = (tr: string, cells: readonly string[]): string => reassembler(tr, cells, /<w:tc>/, /<\/w:tc>/g);

/** Copie d'une ligne : les identifiants de paragraphe ne doivent pas être en double dans le document. */
const cloner = (tr: string): string => tr.replace(/ w14:paraId="[^"]*"| w14:textId="[^"]*"/g, '');

/** Réglages d'un paragraphe vide du modèle : on les réutilise pour écrire dans la même police. */
function reperes(paragraphe: string): { ppr: string; rpr: string } {
  const ppr = /<w:pPr>[\s\S]*?<\/w:pPr>/.exec(paragraphe)?.[0] ?? '';
  const rpr = /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(ppr)?.[0] ?? '';
  return { ppr, rpr };
}

const paragraphe = (ppr: string, rpr: string, texte: string): string =>
  `<w:p>${ppr}${texte ? `<w:r>${rpr}<w:t xml:space="preserve">${esc(texte)}</w:t></w:r>` : ''}</w:p>`;

/** Lignes d'un texte saisi : sans lignes vides en fin de texte. */
export const lignesDe = (texte: string): string[] => {
  const l = texte.replace(/\r/g, '').split('\n').map((x) => x.replace(/\s+$/, ''));
  while (l.length && !l[l.length - 1]) l.pop();
  return l;
};

/**
 * Écrit dans une case : une ligne de texte par paragraphe, dans la police du modèle.
 * La case garde au moins son nombre de paragraphes d'origine : la place pour écrire à la main reste la même.
 */
function remplirCase(tc: string, texte: readonly string[]): string {
  const pr = /^<w:tc>(<w:tcPr>[\s\S]*?<\/w:tcPr>)?/.exec(tc)?.[1] ?? '';
  const paras = tc.match(PARAGRAPHES) ?? [];
  const { ppr, rpr } = reperes(paras[0] ?? '');
  const n = Math.max(paras.length, texte.length, 1);
  return `<w:tc>${pr}${Array.from({ length: n }, (_, i) => paragraphe(ppr, rpr, texte[i] ?? '')).join('')}</w:tc>`;
}

/** Ajoute un alignement centré à un paragraphe, à la bonne place dans ses propriétés (l'ordre compte pour Word). */
function centrer(ppr: string): string {
  if (/<w:jc /.test(ppr)) return ppr;
  const jc = '<w:jc w:val="center"/>';
  if (!ppr || ppr === '<w:pPr/>') return `<w:pPr>${jc}</w:pPr>`;
  const suivants = /<w:(textDirection|textAlignment|textboxTightWrap|outlineLvl|divId|cnfStyle|rPr|sectPr|pPrChange)[ />]/.exec(ppr);
  return suivants ? ppr.slice(0, suivants.index) + jc + ppr.slice(suivants.index) : ppr.replace('</w:pPr>', `${jc}</w:pPr>`);
}

/** Met une croix centrée dans une case P, O ou M du tableau d'aménagements. */
function marquer(tc: string): string {
  const pr = /^<w:tc>(<w:tcPr>[\s\S]*?<\/w:tcPr>)?/.exec(tc)?.[1] ?? '';
  const para = (tc.match(PARAGRAPHES) ?? [])[0] ?? '';
  const { ppr, rpr } = reperes(para);
  const run = /<w:r[ >][\s\S]*?<\/w:r>/.exec(para)?.[0];
  const croix = run
    ? run.replace(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/, '<w:t>X</w:t>')
    : `<w:r>${rpr}<w:t>X</w:t></w:r>`;
  return `<w:tc>${pr}<w:p>${centrer(ppr)}${croix}</w:p></w:tc>`;
}

/** Vérifie qu'une cellule porte bien le libellé attendu : si le modèle change, on le dit plutôt que d'écrire au mauvais endroit. */
function verifierLibelle(cellule: string | undefined, attendu: string, ou: string): void {
  if (cellule === undefined || !norme(cellule).startsWith(attendu)) throw new Error(`Le modèle PIA est inattendu (${ou}).`);
}

/* ───────── Les huit tableaux ───────── */

export interface IdentitePourPia {
  nom: string; dateNaissance: string; ecole: string; classe: string; option: string;
  titulaire: string; cpms: string; representantPole: string; responsable: string;
}

const IDENTITE: ReadonlyArray<{ libelle: string; valeur: (i: IdentitePourPia) => string }> = [
  { libelle: 'nom et prenom', valeur: (i) => i.nom },
  { libelle: 'date de naissance', valeur: (i) => dateBelge(i.dateNaissance) },
  { libelle: 'coordonnees de l ecole', valeur: (i) => i.ecole },
  { libelle: 'classe et option', valeur: (i) => [i.classe, i.option].filter(Boolean).join(' — ') },
  { libelle: 'titulaire', valeur: (i) => i.titulaire },
  { libelle: 'coordonnees du cpms', valeur: (i) => i.cpms },
  { libelle: 'representant du pole', valeur: (i) => i.representantPole },
  { libelle: 'coordonnees du responsable', valeur: (i) => i.responsable }
];

function tableIdentite(tbl: string, id: IdentitePourPia): string {
  const rows = lignes(tbl);
  if (rows.length !== IDENTITE.length) throw new Error('Le modèle PIA est inattendu (identité).');
  return tableAvecLignes(tbl, rows.map((tr, i) => {
    const cs = cellules(tr);
    const champ = IDENTITE[i]!;
    verifierLibelle(cs[0], champ.libelle, 'identité');
    return ligneAvecCellules(tr, [cs[0]!, remplirCase(cs[1] ?? '', lignesDe(champ.valeur(id)))]);
  }));
}

function tableProfil(tbl: string, pia: Pia): string {
  const rows = lignes(tbl);
  if (rows.length !== ASPECTS.length + 1) throw new Error('Le modèle PIA est inattendu (profil).');
  verifierLibelle(cellules(rows[0]!)[0], 'aspect', 'profil');
  return tableAvecLignes(tbl, rows.map((tr, i) => {
    if (i === 0) return tr;
    const aspect = ASPECTS[i - 1]!;
    const cs = cellules(tr);
    verifierLibelle(cs[0], norme(aspect.libelle).split(' ').slice(0, 2).join(' '), 'profil');
    const valeurs = pia.profil[aspect.id];
    return ligneAvecCellules(tr, [
      cs[0]!,
      remplirCase(cs[1] ?? '', lignesDe(valeurs.ressources)),
      remplirCase(cs[2] ?? '', lignesDe(valeurs.difficultes)),
      remplirCase(cs[3] ?? '', lignesDe(valeurs.objectifs))
    ]);
  }));
}

/** Tableau des personnes présentes : trois par ligne, une ligne de plus au-delà de neuf. */
function tablePresents(tbl: string, presents: readonly string[]): string {
  const rows = lignes(tbl);
  const derniere = rows[rows.length - 1];
  if (!derniere) throw new Error('Le modèle PIA est inattendu (personnes présentes).');
  const besoin = Math.max(rows.length, Math.ceil(presents.length / 3));
  const toutes = [...rows, ...Array.from({ length: besoin - rows.length }, () => cloner(derniere))];
  return tableAvecLignes(tbl, toutes.map((tr, r) =>
    ligneAvecCellules(tr, cellules(tr).map((tc, c) => (presents[r * 3 + c] !== undefined ? remplirCase(tc, [presents[r * 3 + c]!.trim()]) : tc)))));
}

export interface PartiesPv {
  axe: string; objectifs: string[]; ressources: string;
  retours: { parents: string; direction: string; eleve: string; pms: string; agent: string; autres: string };
}

/** Procès-verbal : libellés sur une ligne, cases dans la ligne suivante (voir « Où écrire la valeur » du modèle). */
function tableProcesVerbal(tbl: string, p: PartiesPv): string {
  const rows = lignes(tbl);
  if (rows.length !== 12) throw new Error('Le modèle PIA est inattendu (procès-verbal 1).');
  const pleine = (i: number, libelle: string, texte: readonly string[]): [string, string] => {
    verifierLibelle(cellules(rows[i]!)[0], libelle, 'procès-verbal 1');
    const tr = rows[i + 1]!;
    return [rows[i]!, ligneAvecCellules(tr, [remplirCase(cellules(tr)[0] ?? '', texte)])];
  };
  const paire = (i: number, g: [string, readonly string[]], d: [string, readonly string[]]): [string, string] => {
    const cs = cellules(rows[i]!);
    verifierLibelle(cs[0], g[0], 'procès-verbal 1');
    verifierLibelle(cs[1], d[0], 'procès-verbal 1');
    const tr = rows[i + 1]!;
    const reponses = cellules(tr);
    return [rows[i]!, ligneAvecCellules(tr, [remplirCase(reponses[0] ?? '', g[1]), remplirCase(reponses[1] ?? '', d[1])])];
  };
  const r = p.retours;
  const morceaux = [
    pleine(0, 'difficulte majeure', lignesDe(p.axe)),
    pleine(2, 'objectifs vises', p.objectifs),
    pleine(4, 'ressources et moyens', lignesDe(p.ressources)),
    paire(6, ['retours des parents', lignesDe(r.parents)], ['retours de la direction', lignesDe(r.direction)]),
    paire(8, ['retours de l eleve', lignesDe(r.eleve)], ['retours du centre pms', lignesDe(r.pms)]),
    paire(10, ['retours de l agent', lignesDe(r.agent)], ['retours des autres', lignesDe(r.autres)])
  ];
  return tableAvecLignes(tbl, morceaux.flat());
}

/** Tableau des aménagements : N° | P | O | M | Description ; une ligne de plus au-delà de dix. */
function tableAmenagements(tbl: string, pia: Pia): string {
  const rows = lignes(tbl);
  if (rows.length < 3) throw new Error('Le modèle PIA est inattendu (aménagements).');
  verifierLibelle(cellules(rows[0]!)[0], 'n°', 'aménagements');
  const entetes = rows.slice(0, 2);
  const donnees = rows.slice(2);
  const derniere = donnees[donnees.length - 1]!;
  const lignesDonnees = [...donnees];
  for (let k = donnees.length; k < pia.amenagements.length; k++) {
    // Le numéro est dans le premier paragraphe de la première cellule : on ne change que lui.
    const copie = cloner(derniere);
    const cs = cellules(copie);
    const numero = cs[0]!.replace(/<w:t(?: [^>]*)?>[\s\S]*?<\/w:t>/, `<w:t>${k + 1}</w:t>`);
    lignesDonnees.push(ligneAvecCellules(copie, [numero, ...cs.slice(1)]));
  }
  const remplies = lignesDonnees.map((tr, k) => {
    const a = pia.amenagements[k];
    if (!a) return tr;
    const cs = cellules(tr);
    if (cs.length !== 5) throw new Error('Le modèle PIA est inattendu (ligne d’aménagement).');
    const case_ = (type: 'P' | 'O' | 'M', tc: string): string => (a.types.includes(type) ? marquer(tc) : tc);
    return ligneAvecCellules(tr, [cs[0]!, case_('P', cs[1]!), case_('O', cs[2]!), case_('M', cs[3]!), remplirCase(cs[4]!, lignesDe(a.description))]);
  });
  return tableAvecLignes(tbl, [...entetes, ...remplies]);
}

/* ───────── Le document ───────── */

/** Écrit la date après « Date : » du premier procès-verbal (le paragraphe est avant le tableau des présents). */
function ecrireDate(segment: string, date: string): string {
  if (!date) return segment;
  const iso = dateBelge(date);
  let fait = false;
  return segment.replace(PARAGRAPHES, (p) => {
    if (fait || !norme(p).startsWith('date')) return p;
    fait = true;
    const dernierRun = [...p.matchAll(/<w:r[ >][\s\S]*?<\/w:r>/g)].pop();
    const rpr = (dernierRun ? /<w:rPr>[\s\S]*?<\/w:rPr>/.exec(dernierRun[0])?.[0] : '') ?? '';
    // Le libellé est en gras ; la date écrite ne l'est pas.
    const valeur = `<w:r>${rpr.replace(/<w:b\/>|<w:bCs\/>/g, '')}<w:t xml:space="preserve">${esc(iso)}</w:t></w:r>`;
    return p.replace(/<\/w:p>$/, `${valeur}</w:p>`);
  });
}

export interface DonneesPia {
  pia: Pia;
  identite: IdentitePourPia;
}

/** Les lignes écrites dans la case « Objectifs visés pour la période et critères d'évaluation ». */
export function lignesObjectifs(pia: Pia): string[] {
  const lignesObjectif: string[] = [];
  pia.pv1.objectifs.filter((o) => o.texte.trim() || o.criteres.trim()).forEach((o, i) => {
    lignesObjectif.push(`${i + 1}. ${o.matiere ? `${o.matiere} — ` : ''}${o.texte.trim()}`);
    const criteres = lignesDe(o.criteres);
    if (criteres.length) lignesObjectif.push(`Critères d’évaluation : ${criteres.join(' ')}`);
  });
  return lignesObjectif;
}

/** document.xml du modèle → document.xml rempli (PV 2 laissé vide). */
export function remplirPia(docXml: string, { pia, identite }: DonneesPia): string {
  const tables = decouperTables(docXml);
  if (tables.length !== 8) throw new Error('Le modèle PIA est inattendu (huit tableaux attendus).');
  const xml = (i: number): string => tables[i]?.xml ?? '';
  // T1 identité, T2 profil, T3 présents du PV 1, T4 PV 1, T5 aménagements. T6 à T8 (PV 2) restent tels quels.
  const remplis = [
    tableIdentite(xml(0), identite),
    tableProfil(xml(1), pia),
    tablePresents(xml(2), pia.pv1.presents.filter((p) => p.trim())),
    tableProcesVerbal(xml(3), { axe: pia.pv1.axe, objectifs: lignesObjectifs(pia), ressources: pia.pv1.ressources, retours: pia.pv1.retours }),
    tableAmenagements(xml(4), pia)
  ];

  let sortie = '';
  let curseur = 0;
  tables.forEach((t, i) => {
    const avant = docXml.slice(curseur, t.debut);
    // « Date : » du PV 1 se trouve juste avant le tableau des personnes présentes.
    sortie += (i === 2 ? ecrireDate(avant, pia.pv1.date) : avant) + (remplis[i] ?? t.xml);
    curseur = t.fin;
  });
  return sortie + docXml.slice(curseur);
}

/** Année scolaire dans les en-têtes (« 2025-2025 » et « 2025-2026 » dans le modèle) : seul ce texte change. */
export const remplirEntete = (xml: string, annee: string): string =>
  xml.replace(/(<w:t(?: [^>]*)?>)\d{4}-\d{4}(<\/w:t>)/g, `$1${esc(annee)}$2`);

/** Nom du fichier Word du PIA. */
export const nomFichierPia = (eleve: Pick<Eleve, 'nom'>, annee: string): string =>
  `PIA - ${eleve.nom || 'élève'} - ${annee}.docx`.replace(/[\\/:*?"<>|]/g, '');
