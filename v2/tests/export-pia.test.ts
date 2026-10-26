import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { construirePia, lireZip, nomFichierPia } from '../src/domain/export/index.ts';
import { lignesObjectifs, remplirEntete, remplirPia } from '../src/domain/export/pia.ts';
import { cellules, decouperTables, lignes, sansBalises } from '../src/domain/export/journalier.ts';
import {
  ajouterAmenagement, ajouterObjectifPeriode, basculerType, modifierCase, modifierIdentite, modifierPv1, modifierRetour, piaVierge
} from '../src/domain/pia/index.ts';
import type { Pia } from '../src/domain/pia/index.ts';
import type { Eleve } from '../src/domain/types.ts';

const MODELE = new Uint8Array(readFileSync(new URL('../public/modeles/PIA_modele_officiel_2025-09-11.docx', import.meta.url)));
const dec = new TextDecoder();

const eleve: Eleve = {
  id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École Test, rue X 1, 1000 Bruxelles',
  titulaire: 'Mme Titulaire', dateNaissance: '2011-04-02', matieres: []
};
const eleveVide: Eleve = { id: 'x', nom: '', prenom: '', classe: '', ecole: '', titulaire: '', dateNaissance: '', matieres: [] };

const nrm = (t: string): string => t.replace(/[  \s]+/g, ' ').trim();
const texteDe = (xml: string): string => nrm(sansBalises(xml.replace(/<\/w:p>/g, '\n')).replace(/\n/g, ' '));
const cases = (tbl: string): string[][] => lignes(tbl).map((tr) => cellules(tr).map((tc) => nrm(sansBalises(tc.replace(/<\/w:p>/g, '\n')).split('\n').join(' | ').replace(/( \| )+$/g, ''))));
const paragraphes = (tc: string): string[] => (tc.match(/<w:p[ >][\s\S]*?<\/w:p>|<w:p\/>/g) ?? []).map(texteDe);

/** Contrôle sommaire de balisage : chaque balise ouverte est refermée dans l'ordre. */
function assertBalisesEquilibrees(xml: string): void {
  const pile: string[] = [];
  for (const m of xml.matchAll(/<(\/?)([A-Za-z0-9_:.-]+)([^>]*?)(\/?)>/g)) {
    if (m[3]?.startsWith('?') || m[2]?.startsWith('!')) continue;
    if (m[4] === '/') continue;
    if (m[1] === '/') assert.equal(pile.pop(), m[2], `balise </${m[2]}> inattendue`);
    else pile.push(m[2] ?? '');
  }
  assert.deepEqual(pile, []);
}

async function document_(pia: Pia, e: Eleve = eleve): Promise<{ xml: string; entrees: Awaited<ReturnType<typeof lireZip>>; nom: string }> {
  const { octets, nom } = await construirePia(MODELE, pia, e);
  const entrees = await lireZip(octets);
  return { xml: dec.decode(entrees['word/document.xml']), entrees, nom };
}

const base = (): Pia => piaVierge('alpha', '2026-2027', '2026-10-26T10:00:00.000Z');

describe('Export Word du PIA : modèle officiel', () => {
  it('le modèle a la structure attendue : huit tableaux, dix lignes d’aménagements, cinq aspects', async () => {
    const t = decouperTables(dec.decode((await lireZip(MODELE))['word/document.xml']));
    assert.equal(t.length, 8);
    assert.deepEqual(t.map((x) => lignes(x.xml).length), [8, 6, 3, 12, 12, 3, 8, 12]);
    assert.equal(cases(t[4]!.xml)[0]?.[0], 'N°');
  });
});

describe('Export Word du PIA', () => {
  it('un PIA vierge donne le texte du modèle, avec la seule identité de l’élève en plus', async () => {
    const modele = dec.decode((await lireZip(MODELE))['word/document.xml']);
    const { xml } = await document_(base(), eleveVide);
    assert.equal(texteDe(xml), texteDe(modele));
    assert.equal(decouperTables(xml).length, 8);
    assertBalisesEquilibrees(xml);
  });

  it('le PV 2 et ses aménagements ne sont jamais modifiés (lot 4b)', async () => {
    const modele = decouperTables(dec.decode((await lireZip(MODELE))['word/document.xml']));
    let p = modifierPv1(base(), 'axe', 'Cognitif');
    p = ajouterAmenagement(p, { types: ['P'], description: 'Fiche outil' });
    const { xml } = await document_(p);
    const t = decouperTables(xml);
    for (const i of [5, 6, 7]) assert.equal(t[i]?.xml, modele[i]?.xml, `tableau ${i + 1}`);
  });

  it('écrit l’identité de l’élève et les champs propres au PIA', async () => {
    let p = modifierIdentite(base(), 'option', 'Sciences');
    p = modifierIdentite(p, 'cpms', 'CPMS de Bruxelles, 02 123 45 67');
    p = modifierIdentite(p, 'representantPole', 'Agent Test');
    p = modifierIdentite(p, 'responsable', 'Mme Parent\n0470 00 00 00');
    const { xml } = await document_(p);
    const identite = cases(decouperTables(xml)[0]!.xml);
    assert.deepEqual(identite.map((l) => l[1]), [
      'Dupont Léa', '02/04/2011', 'École Test, rue X 1, 1000 Bruxelles', '3CB — Sciences', 'Mme Titulaire',
      'CPMS de Bruxelles, 02 123 45 67', 'Agent Test', 'Mme Parent | 0470 00 00 00'
    ]);
    // Les libellés du modèle ne bougent pas.
    assert.equal(identite[0]?.[0], 'Nom et prénom de l’élève :');
  });

  it('écrit le profil dans la bonne case de chaque ligne', async () => {
    let p = modifierCase(base(), 'autonomie', 'ressources', 'Prépare son matériel\nUtilise son agenda');
    p = modifierCase(p, 'comportement', 'difficultes', 'Se décourage vite');
    p = modifierCase(p, 'cognitif', 'objectifs', 'Identifier la consigne');
    const { xml } = await document_(p);
    const t = cases(decouperTables(xml)[1]!.xml);
    assert.deepEqual(t[0], ['Aspect', 'Ressources', 'Difficultés', 'Objectifs à poursuivre']);
    assert.deepEqual(t[1], ['Physique et psychomoteur :', '', '', '']);
    assert.deepEqual(t[2], ['Lié à l’autonomie :', 'Prépare son matériel | Utilise son agenda', '', '']);
    assert.deepEqual(t[3], ['Comportemental et affectif :', '', 'Se décourage vite', '']);
    assert.deepEqual(t[5], ['Cognitif (pédagogique) :', '', '', 'Identifier la consigne']);
  });

  it('garde la police du modèle (16 pt dans le profil) et le nombre de lignes d’origine', async () => {
    const modele = decouperTables(dec.decode((await lireZip(MODELE))['word/document.xml']))[1]!.xml;
    const { xml } = await document_(modifierCase(base(), 'comportement', 'ressources', 'Une seule ligne'));
    const ligne = lignes(decouperTables(xml)[1]!.xml)[3]!;
    const cellule = cellules(ligne)[1]!;
    assert.match(cellule, /<w:sz w:val="32"\/>/);
    // La ligne « Comportemental » avait deux paragraphes dans sa case Ressources : ils sont conservés.
    assert.equal(paragraphes(cellule).length, paragraphes(cellules(lignes(modele)[3]!)[1]!).length);
    assert.deepEqual(paragraphes(cellule), ['Une seule ligne', '']);
  });

  it('écrit la date, les personnes présentes (trois par ligne, une ligne de plus au-delà de neuf)', async () => {
    const presents = Array.from({ length: 11 }, (_, i) => `Personne ${i + 1}`);
    const p = { ...modifierPv1(base(), 'date', '2026-10-26'), pv1: { ...modifierPv1(base(), 'date', '2026-10-26').pv1, presents: [...presents.slice(0, 5), '  ', ...presents.slice(5)] } };
    const { xml } = await document_(p);
    const t = decouperTables(xml);
    assert.deepEqual(cases(t[2]!.xml), [['Personne 1', 'Personne 2', 'Personne 3'], ['Personne 4', 'Personne 5', 'Personne 6'], ['Personne 7', 'Personne 8', 'Personne 9'], ['Personne 10', 'Personne 11', '']]);
    // « Date : » du PV 1 porte la date ; celui du PV 2 reste vide.
    const entre = xml.slice(t[1]!.fin, t[2]!.debut);
    assert.match(texteDe(entre), /Date : 26\/10\/2026/);
    const entre2 = xml.slice(t[4]!.fin, t[5]!.debut);
    assert.match(texteDe(entre2), /Date :$|Date : Personnes/);
    assert.ok(!texteDe(entre2).includes('26/10/2026'));
    assertBalisesEquilibrees(xml);
  });

  it('la date saisie n’est pas en gras, le libellé l’est toujours', async () => {
    const { xml } = await document_(modifierPv1(base(), 'date', '2026-10-26'));
    const t = decouperTables(xml);
    const para = (xml.slice(t[1]!.fin, t[2]!.debut).match(/<w:p[ >][\s\S]*?<\/w:p>/g) ?? []).find((q) => texteDe(q).startsWith('Date'))!;
    const runs = para.match(/<w:r[ >][\s\S]*?<\/w:r>/g) ?? [];
    assert.match(runs[0]!, /<w:b\/>/);
    assert.match(runs[runs.length - 1]!, /26\/10\/2026/);
    assert.doesNotMatch(runs[runs.length - 1]!, /<w:b\/>/);
  });

  it('écrit l’axe, les objectifs et critères, les ressources et les six retours dans les bonnes cases', async () => {
    let p = modifierPv1(base(), 'axe', 'Cognitif (pédagogique)');
    p = modifierPv1(p, 'ressources', 'Une séance en plus\nUn ordinateur');
    p = ajouterObjectifPeriode(p, { matiere: 'Mathématiques', texte: 'Repérer la question.', criteres: '4 problèmes sur 5' });
    p = ajouterObjectifPeriode(p, { texte: 'Utiliser son agenda.' });
    p = ajouterObjectifPeriode(p, { texte: '   ', criteres: '   ' });
    const retours = { parents: 'P', direction: 'D', eleve: 'E', pms: 'M', agent: 'A', autres: 'X' } as const;
    for (const [cle, v] of Object.entries(retours)) p = modifierRetour(p, cle as keyof typeof retours, v);
    const { xml } = await document_(p);
    const t = cases(decouperTables(xml)[3]!.xml);
    assert.equal(t[1]?.[0], 'Cognitif (pédagogique)');
    assert.equal(t[3]?.[0], '1. Mathématiques — Repérer la question. | Critères d’évaluation : 4 problèmes sur 5 | 2. Utiliser son agenda.');
    assert.equal(t[5]?.[0], 'Une séance en plus | Un ordinateur');
    assert.deepEqual([t[7]?.[0], t[7]?.[1], t[9]?.[0], t[9]?.[1], t[11]?.[0], t[11]?.[1]], ['P', 'D', 'E', 'M', 'A', 'X']);
    // Les libellés du modèle ne bougent pas.
    assert.equal(t[6]?.[0], 'Retours des parents :');
    assert.equal(t[6]?.[1], 'Retours de la direction et de l’équipe pédagogique :');
    assert.equal(t[8]?.[1], 'Retours du centre PMS :');
    assert.equal(t[10]?.[0], 'Retours de l’agent d’intégration :');
  });

  it('les lignes d’objectifs sont numérotées sans compter les objectifs vides', () => {
    let p = ajouterObjectifPeriode(base(), { texte: '' });
    p = ajouterObjectifPeriode(p, { matiere: 'Français', texte: 'Lire', criteres: 'a\nb' });
    assert.deepEqual(lignesObjectifs(p), ['1. Français — Lire', 'Critères d’évaluation : a b']);
  });

  it('marque P, O, M par une croix centrée, et garde le numéro et la description', async () => {
    let p = ajouterAmenagement(base(), { types: ['P'], description: 'Support visuel' });
    p = ajouterAmenagement(p, { types: ['O', 'M'], description: 'Place près du tableau\nPauses' });
    p = ajouterAmenagement(p);
    p = basculerType(p, 'amenagement-3', 'M');
    const { xml } = await document_(p);
    const t = cases(decouperTables(xml)[4]!.xml);
    // Colonnes : N° | P | O | M | Description
    assert.deepEqual(t[2], ['1', 'X', '', '', 'Support visuel']);
    assert.deepEqual(t[3], ['2', '', 'X', 'X', 'Place près du tableau | Pauses']);
    assert.deepEqual(t[4], ['3', '', '', 'X', '']);
    assert.deepEqual(t[5], ['4', '', '', '', '']);
    const croix = cellules(lignes(decouperTables(xml)[4]!.xml)[2]!)[1]!;
    assert.match(croix, /<w:jc w:val="center"\/>/);
    assert.ok(croix.indexOf('<w:jc ') < croix.indexOf('<w:rPr>'), 'jc avant rPr (ordre exigé par Word)');
    assertBalisesEquilibrees(xml);
  });

  it('ajoute des lignes numérotées au-delà de dix aménagements, sans identifiant de paragraphe en double', async () => {
    let p = base();
    for (let i = 1; i <= 13; i++) p = ajouterAmenagement(p, { types: [(['P', 'O', 'M'] as const)[i % 3]!], description: `Aménagement ${i}` });
    const { xml } = await document_(p);
    const t = cases(decouperTables(xml)[4]!.xml);
    assert.equal(t.length, 2 + 13);
    assert.deepEqual(t.slice(2).map((l) => l[0]), Array.from({ length: 13 }, (_, i) => String(i + 1)));
    assert.deepEqual(t.slice(2).map((l) => l[4]), Array.from({ length: 13 }, (_, i) => `Aménagement ${i + 1}`));
    assert.equal(t[14]?.[1 + (13 % 3)], 'X');
    const ids = [...xml.matchAll(/w14:paraId="([0-9A-F]+)"/g)].map((m) => m[1]);
    assert.equal(new Set(ids).size, ids.length, 'identifiants de paragraphe en double');
    assertBalisesEquilibrees(xml);
  });

  it('met l’année scolaire dans les deux en-têtes, rien d’autre', async () => {
    const { entrees } = await document_(base());
    const h1 = dec.decode(entrees['word/header1.xml']);
    const h2 = dec.decode(entrees['word/header2.xml']);
    assert.equal(texteDe(h1), '2026-2027');
    assert.equal(texteDe(h2), 'Annexe 2 2026-2027');
    const original = dec.decode((await lireZip(MODELE))['word/header2.xml']);
    assert.equal(h2, original.replace('2025-2026', '2026-2027'));
    assert.equal(remplirEntete('<w:t>2025-2025</w:t><w:t>Annexe 2</w:t>', '2026-2027'), '<w:t>2026-2027</w:t><w:t>Annexe 2</w:t>');
  });

  it('garde le logo du pied de page et signe « Pôle Territorial WBE BXL »', async () => {
    const { entrees } = await document_(base());
    const original = await lireZip(MODELE);
    assert.deepEqual(Object.keys(entrees).sort(), Object.keys(original).sort());
    assert.equal(dec.decode(entrees['word/footer1.xml']), dec.decode(original['word/footer1.xml']));
    const core = dec.decode(entrees['docProps/core.xml']);
    assert.match(core, /<dc:creator>Pôle Territorial WBE BXL<\/dc:creator>/);
    assert.match(core, /<cp:lastModifiedBy>Pôle Territorial WBE BXL<\/cp:lastModifiedBy>/);
  });

  it('échappe les caractères spéciaux du texte', async () => {
    const { xml } = await document_(modifierCase(base(), 'physique', 'ressources', 'Lit « a < b & c » "bien"'));
    assert.match(xml, /Lit « a &lt; b &amp; c » &quot;bien&quot;/);
    assertBalisesEquilibrees(xml);
  });

  it('nomme le fichier avec le nom de l’élève et l’année, sans caractère interdit', () => {
    assert.equal(nomFichierPia({ nom: 'Dupont' }, '2026-2027'), 'PIA - Dupont - 2026-2027.docx');
    assert.equal(nomFichierPia({ nom: 'A/B:C' }, '2026-2027'), 'PIA - ABC - 2026-2027.docx');
    assert.equal(nomFichierPia({ nom: '' }, '2026-2027'), 'PIA - élève - 2026-2027.docx');
  });

  it('refuse un modèle qui n’est pas le modèle officiel plutôt que d’écrire au mauvais endroit', async () => {
    const entrees = await lireZip(MODELE);
    const xml = dec.decode(entrees['word/document.xml']);
    assert.throws(() => remplirPia(xml.replace('Titulaire', 'Autre chose'), { pia: base(), identite: { nom: '', dateNaissance: '', ecole: '', classe: '', option: '', titulaire: '', cpms: '', representantPole: '', responsable: '' } }), /modèle PIA est inattendu/);
    assert.throws(() => remplirPia('<w:body></w:body>', { pia: base(), identite: { nom: '', dateNaissance: '', ecole: '', classe: '', option: '', titulaire: '', cpms: '', representantPole: '', responsable: '' } }), /modèle PIA est inattendu/);
  });
});
