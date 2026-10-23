/**
 * Remplissage du Journalier papier (modèle Word officiel) : on clone le bloc type du modèle
 * pour chaque séance au lieu de reconstruire le document. Le texte vient du moteur de rédaction ;
 * ici, on ne rédige rien. Fonctions pures (testables sans navigateur).
 */
import { construireBloc } from '../redaction/index.ts';
import { deIdentifier } from '../redaction/deidentifier.ts';
import type { Bloc } from '../redaction/index.ts';
import type { Eleve, Seance } from '../types.ts';

const NBSP = ' ';
const PARTICULES = new Set(['de', 'du', 'des', 'la', 'le', 'les', 'van', 'von', 'der', 'den', 'el', 'al', 'ben', 'ait']);

// eslint-disable-next-line no-control-regex
const esc = (s: string): string => s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

/* ───────── constructeurs OpenXML ───────── */
const run = (t: string, gras = false): string => (t === '' ? '' : `<w:r>${gras ? '<w:rPr><w:b/></w:rPr>' : ''}<w:t xml:space="preserve">${esc(t)}</w:t></w:r>`);
const para = (runs: string, opts: { puce?: boolean; retrait?: number } = {}): string => {
  const ppr: string[] = [];
  if (opts.puce) ppr.push('<w:pStyle w:val="ListParagraph"/><w:numPr><w:ilvl w:val="0"/><w:numId w:val="1"/></w:numPr>');
  if (opts.retrait) ppr.push(`<w:ind w:left="${opts.retrait}"/>`);
  return `<w:p>${ppr.length ? `<w:pPr>${ppr.join('')}</w:pPr>` : ''}${runs}</w:p>`;
};
const etiquette = (label: string, valeur: string): string => para(run(`${label}${NBSP}: `, true) + run(valeur));

/* ───────── découpage du XML du modèle ───────── */
interface Tableau { debut: number; fin: number; xml: string }
function decouperTables(xml: string): Tableau[] {
  const tables: Tableau[] = [];
  const re = /<w:tbl>[\s\S]*?<\/w:tbl>/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(xml))) tables.push({ debut: m.index, fin: m.index + m[0].length, xml: m[0] });
  return tables;
}
const lignes = (tbl: string): string[] => tbl.match(/<w:tr[ >][\s\S]*?<\/w:tr>/g) ?? [];
const cellules = (tr: string): string[] => tr.match(/<w:tc>[\s\S]*?<\/w:tc>/g) ?? [];
const sansBalises = (x: string): string => { let out = x; let avant: string; do { avant = out; out = out.replace(/<[^>]+>/g, ''); } while (out !== avant); return out; };

/** Remplace le contenu d'une cellule en gardant ses propriétés (largeur, fusion). */
function remplirCellule(tc: string, paragraphes: string): string {
  const pr = /^<w:tc>(<w:tcPr>[\s\S]*?<\/w:tcPr>)/.exec(tc)?.[1] ?? '';
  return `<w:tc>${pr}${paragraphes || '<w:p/>'}</w:tc>`;
}
const remplacerCellule = (tr: string, i: number, nouveau: string): string => {
  const cible = cellules(tr)[i];
  return cible === undefined ? tr : tr.replace(cible, () => nouveau);
};

/* ───────── bloc d'une séance ───────── */
function paragraphesOrtho(bloc: Bloc): string {
  const out = [para(run(`Mes observations, remarques, besoins,…${NBSP}: `, true))];
  for (const b of bloc.ortho) {
    if (b.lignes) {
      if (b.label) out.push(para(run(b.label, true)));
      b.lignes.forEach((l) => out.push(para(run(l), { retrait: 284 })));
    } else if (b.label) out.push(etiquette(b.label, b.texte ?? ''));
    else out.push(para(run(b.texte ?? '')));
  }
  return out.join('');
}

function tableBloc(proto: string, bloc: Bloc): string {
  const rows = lignes(proto);
  // 0 « Partie pédagogique » | 1 Date / Cours / Titulaire | 2 Objectif / Mon objectif / Intervention | 3 « Partie orthopédagogique » | 4 Observations
  const [r0, r1, r2, r3, r4] = rows;
  if (!r0 || !r1 || !r2 || !r3 || !r4) throw new Error('Le modèle Journalier est inattendu (lignes du tableau).');
  const e = bloc.entete;
  const c1 = cellules(r1);
  let l1 = r1;
  l1 = remplacerCellule(l1, 0, remplirCellule(c1[0] ?? '', etiquette('Date', e.date)));
  l1 = remplacerCellule(l1, 1, remplirCellule(c1[1] ?? '', etiquette('Cours', e.cours)));
  l1 = remplacerCellule(l1, 2, remplirCellule(c1[2] ?? '', etiquette('Titulaire', e.titulaire)));
  const cellObs = cellules(r4)[0] ?? '';
  const refaire = (lignesXml: string): string => proto.replace(/<w:tr[ >][\s\S]*<\/w:tr>/, () => lignesXml);

  if (bloc.type === 'absence') {
    const l4 = r4.replace(cellObs, () => remplirCellule(cellObs, bloc.ortho.map((b) => para(run(b.texte ?? ''))).join('')));
    return refaire(l1 + l4);
  }
  const p = bloc.peda;
  const c2 = cellules(r2);
  const objectif = etiquette('Objectif de la leçon', p?.objectifLecon ?? '') + (p?.contenuClasse ? etiquette('Contenu vu en classe', p.contenuClasse) : '');
  const intervention = para(run(`Mon intervention${NBSP}: `, true)) + (p?.interventions ?? []).map((t) => para(run(t), { puce: true })).join('');
  let l2 = r2;
  l2 = remplacerCellule(l2, 0, remplirCellule(c2[0] ?? '', objectif));
  l2 = remplacerCellule(l2, 1, remplirCellule(c2[1] ?? '', etiquette('Mon objectif', p?.monObjectif ?? '')));
  l2 = remplacerCellule(l2, 2, remplirCellule(c2[2] ?? '', intervention));
  const l4 = r4.replace(cellObs, () => remplirCellule(cellObs, paragraphesOrtho(bloc)));
  return refaire(r0 + l1 + l2 + r3 + l4);
}

export function dateBelge(iso: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(iso);
  return m ? `${m[3]}/${m[2]}/${m[1]}` : iso;
}

/* ───────── identité (première table du modèle) ───────── */
export interface Identite { nom: string; prenom: string; dateNaissance: string; classe: string; titulaire: string; ecole: string }

function remplirIdentite(tbl: string, id: Identite): string {
  const valeurs: Record<string, string> = { 'nom de l’enfant': id.nom, prenom: id.prenom, 'date de naissance': dateBelge(id.dateNaissance), classe: id.classe, titulaire: id.titulaire, 'ecole cooperante': id.ecole };
  let out = tbl;
  for (const tr of lignes(tbl)) {
    const cs = cellules(tr);
    if (cs.length < 2) continue;
    const lab = sansBalises(cs[0]!).replace(/[\s  :]+$/g, '').trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');
    const v = valeurs[lab];
    if (!v) continue;
    const rpr = (/<w:rPr>[\s\S]*?<\/w:rPr>/.exec(cs[0]!)?.[0] ?? '').replace(/<w:b\/>|<w:bCs\/>/g, '');
    const ppr = (/<w:pPr>[\s\S]*?<\/w:pPr>/.exec(cs[0]!)?.[0] ?? '<w:pPr/>').replace(/<w:b\/>|<w:bCs\/>/g, '');
    out = out.replace(tr, () => remplacerCellule(tr, 1, remplirCellule(cs[1]!, `<w:p>${ppr}<w:r>${rpr}<w:t xml:space="preserve">${esc(v)}</w:t></w:r></w:p>`)));
  }
  return out;
}

/** document.xml du modèle → document.xml rempli. */
export function remplirDocument(docXml: string, blocs: Bloc[], identite: Identite): string {
  const tables = decouperTables(docXml);
  const premiere = tables[0];
  const prototype = tables[1];
  const derniere = tables[tables.length - 1];
  if (!premiere || !prototype || !derniere) throw new Error('Le modèle Journalier est inattendu (tableaux introuvables).');
  const separateur = '<w:p><w:pPr><w:rPr><w:sz w:val="10"/><w:szCs w:val="10"/></w:rPr></w:pPr></w:p>';
  const corps = blocs.map((b) => tableBloc(prototype.xml, b)).join(separateur);
  return docXml.slice(0, premiere.debut) + remplirIdentite(premiere.xml, identite) + docXml.slice(premiere.fin, prototype.debut) + corps + docXml.slice(derniere.fin);
}

/* ───────── préparation ───────── */
export function noms(eleve: Pick<Eleve, 'nom' | 'prenom'>): string[] {
  const brut = [eleve.nom, eleve.prenom].filter(Boolean).join(' ');
  const mots = brut.split(/[\s-]+/).filter((w) => w.length >= 3 && !PARTICULES.has(w.toLowerCase()));
  return [brut, eleve.nom, eleve.prenom, ...mots].filter(Boolean);
}

export function anneeScolaire(iso: string): string {
  const m = /^(\d{4})-(\d{2})/.exec(iso);
  if (!m) return '';
  const a = Number(m[1]);
  return Number(m[2]) >= 8 ? `${a}-${a + 1}` : `${a - 1}-${a}`;
}

/** Du plus ancien au plus récent ; à date égale, par période (1e H, 2e H…). */
const chronologie = (a: Seance, b: Seance): number => a.date.localeCompare(b.date) || a.periodeDebut.localeCompare(b.periodeDebut, 'fr', { numeric: true });

export function preparerBlocs(seances: readonly Seance[], eleve: Eleve, deidentifie: boolean): Bloc[] {
  const tri = [...seances].sort(chronologie);
  const blocs = tri.map((s, i) => construireBloc(s, { titulaire: eleve.titulaire, precedentes: tri.slice(0, i) }));
  if (!deidentifie) return blocs;
  const liste = noms(eleve);
  const nettoyer = (t: string): string => deIdentifier(t, liste);
  for (const b of blocs) {
    b.entete.titulaire = '';
    if (b.peda) { b.peda.objectifLecon = nettoyer(b.peda.objectifLecon); b.peda.contenuClasse = nettoyer(b.peda.contenuClasse); b.peda.monObjectif = nettoyer(b.peda.monObjectif); }
    for (const o of b.ortho) { if (o.texte) o.texte = nettoyer(o.texte); if (o.lignes) o.lignes = o.lignes.map(nettoyer); }
  }
  return blocs;
}

export function nomFichier(eleve: Eleve, seances: readonly Seance[], deidentifie: boolean): string {
  const premiere = [...seances].sort(chronologie)[0];
  const an = premiere ? anneeScolaire(premiere.date) : '';
  const base = deidentifie ? 'Journalier - dé-identifié' : `Journalier - ${eleve.nom || 'élève'}`;
  return `${base}${an ? ` - ${an}` : ''}.docx`.replace(/[\\/:*?"<>|]/g, '');
}

export function identiteDe(eleve: Eleve, deidentifie: boolean): Identite {
  return deidentifie
    ? { classe: eleve.classe, ecole: '', titulaire: '', nom: '', prenom: '', dateNaissance: '' }
    : { nom: eleve.nom, prenom: eleve.prenom, dateNaissance: eleve.dateNaissance, classe: eleve.classe, titulaire: eleve.titulaire, ecole: eleve.ecole };
}
