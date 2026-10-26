import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { describe, it } from 'node:test';
import { construirePia, lireZip } from '../src/domain/export/index.ts';
import { deIdentifierPia, lignesEvaluation } from '../src/domain/export/pia.ts';
import { cellules, decouperTables, lignes, sansBalises } from '../src/domain/export/journalier.ts';
import {
  ajouterAmenagement, ajouterAmenagementPv2, ajouterObjectifPeriode, ajouterPresent, ajouterPresentPv2, basculerTypePv2, changerPresentPv2,
  choisirResultat, commenterObjectif, evaluationDe, modifierAmenagementPv2, modifierDatePv2, modifierPv1, modifierRetourPv2,
  normaliserPia, objectifsAEvaluer, piaVierge, rappelDepuisPv1, reprendreAmenagementsPourRentree, reprendrePresentsPv1, retirerAmenagementPv2
} from '../src/domain/pia/index.ts';
import type { Pia } from '../src/domain/pia/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const MODELE = new Uint8Array(readFileSync(new URL('../public/modeles/PIA_modele_officiel_2025-09-11.docx', import.meta.url)));
const dec = new TextDecoder();
const eleve: Eleve = { id: 'alpha', nom: 'Dupont', prenom: 'Léa', classe: '3CB', ecole: 'École Test', titulaire: 'Mme Titulaire', dateNaissance: '2011-04-02', matieres: [] };
const neuf = (): Pia => piaVierge('alpha', '2026-2027', '2026-10-26T10:00:00.000Z');
const nrm = (t: string): string => t.replace(/[  \s]+/g, ' ').trim();
const texteDe = (xml: string): string => nrm(sansBalises(xml.replace(/<\/w:p>/g, '\n')).replace(/\n/g, ' '));
const cases = (tbl: string): string[][] => lignes(tbl).map((tr) => cellules(tr).map(texteDe));

function avecObjectifs(): Pia {
  let p = ajouterObjectifPeriode(neuf(), { matiere: 'Mathématiques', texte: 'Repérer la question' });
  p = ajouterObjectifPeriode(p, { texte: 'Utiliser son agenda' });
  return p;
}

describe('PV 2 : domaine', () => {
  it('un PIA vierge a un PV 2 vide, et un ancien PIA sans PV 2 est relu avec un PV 2 vide', () => {
    assert.deepEqual(neuf().pv2.evaluations, []);
    const ancien = { ...neuf() } as Partial<Pia>;
    delete ancien.pv2;
    const relu = normaliserPia(ancien);
    assert.ok(relu);
    assert.equal(relu.pv2.date, '');
    assert.deepEqual(relu.pv2.amenagements, []);
  });

  it('évaluer un objectif : rien n’est présélectionné, un second choix identique l’enlève', () => {
    const p = avecObjectifs();
    const id = p.pv1.objectifs[0]!.id;
    assert.equal(evaluationDe(p, id).resultat, '');
    const a = choisirResultat(p, id, 'partiel');
    assert.equal(evaluationDe(a, id).resultat, 'partiel');
    assert.equal(evaluationDe(choisirResultat(a, id, 'partiel'), id).resultat, '');
    assert.equal(evaluationDe(choisirResultat(a, id, 'atteint'), id).resultat, 'atteint');
    assert.equal(evaluationDe(commenterObjectif(a, id, 'Progrès nets'), id).resultat, 'partiel');
    assert.equal(a.pv1.objectifs[0]!.texte, 'Repérer la question');
  });

  it('seuls les objectifs avec un texte sont évalués', () => {
    const p = ajouterObjectifPeriode(avecObjectifs());
    assert.equal(p.pv1.objectifs.length, 3);
    assert.equal(objectifsAEvaluer(p).length, 2);
  });

  it('le PV 2 se relit depuis le stockage, et ignore ce qui est abîmé', () => {
    let p = avecObjectifs();
    p = choisirResultat(p, p.pv1.objectifs[0]!.id, 'atteint');
    p = modifierDatePv2(p, '2027-06-20');
    const relu = normaliserPia(JSON.parse(JSON.stringify(p)));
    assert.deepEqual(relu?.pv2, p.pv2);
    const abime = normaliserPia({ ...p, pv2: { evaluations: [{ objectifId: 'o', resultat: 'n’importe quoi', commentaire: 3 }, 5], presents: [1, 'Mme X'], amenagements: 'non' } });
    assert.equal(abime?.pv2.evaluations[0]?.resultat, '');
    assert.deepEqual(abime?.pv2.presents, ['Mme X']);
    assert.deepEqual(abime?.pv2.amenagements, []);
  });

  it('les présents du PV 1 sont repris sans doublon', () => {
    let p = ajouterPresent(ajouterPresent(neuf(), 'Mme Dupont, titulaire'), 'M. Martin, direction');
    p = ajouterPresentPv2(p, 'mme dupont, titulaire');
    p = reprendrePresentsPv1(p);
    assert.deepEqual(p.pv2.presents, ['mme dupont, titulaire', 'M. Martin, direction']);
    p = changerPresentPv2(p, 0, 'Autre');
    assert.equal(p.pv2.presents[0], 'Autre');
  });

  it('les aménagements de la rentrée partent de ceux de l’année, une seule fois', () => {
    let p = ajouterAmenagement(neuf(), { types: ['P', 'M'], description: 'Fiche outil' });
    p = ajouterAmenagement(p, { types: ['O'], description: 'Temps supplémentaire' });
    p = ajouterAmenagement(p);
    p = reprendreAmenagementsPourRentree(p);
    assert.equal(p.pv2.amenagements.length, 2, 'la ligne vide n’est pas reprise');
    assert.deepEqual(p.pv2.amenagements[0]?.types, ['P', 'M']);
    assert.equal(p.pv2.amenagements[0]?.source, p.amenagements[0]!.id);
    const encore = reprendreAmenagementsPourRentree(p);
    assert.equal(encore, p);
    // Modifier la rentrée ne touche pas l'année.
    const id = p.pv2.amenagements[0]!.id;
    p = modifierAmenagementPv2(basculerTypePv2(p, id, 'O'), id, 'Fiche outil + clavier');
    assert.deepEqual(p.pv2.amenagements[0]?.types, ['P', 'O', 'M']);
    assert.equal(p.amenagements[0]?.description, 'Fiche outil');
    p = retirerAmenagementPv2(p, id);
    assert.equal(p.pv2.amenagements.length, 1);
    assert.equal(ajouterAmenagementPv2(p).pv2.amenagements.length, 2);
  });

  it('rappel : seulement les séances après le PV 1, dans la matière, sans les absences', () => {
    const seances = [
      seance({ date: '2026-09-10' }),
      seance({ date: '2026-11-10' }),
      seance({ date: '2026-12-10', presence: 'absent_eleve' }),
      seance({ date: '2027-01-12', matiere: 'Français' }),
      seance({ date: '2027-02-02' })
    ];
    const r = rappelDepuisPv1(seances, '2026-10-01', 'Mathématiques');
    assert.equal(r.seances, 2);
    assert.equal(r.sansDate, false);
    assert.ok(r.aTravailler.length > 0 || r.appuis.length > 0);
    assert.equal(rappelDepuisPv1(seances, '2026-10-01', '').seances, 3);
    const sans = rappelDepuisPv1(seances, '', 'Mathématiques');
    assert.equal(sans.seances, 3);
    assert.equal(sans.sansDate, true);
  });
});

async function document_(pia: Pia, options = {}): Promise<{ xml: string; nom: string }> {
  const { octets, nom } = await construirePia(MODELE, pia, eleve, options);
  return { xml: dec.decode((await lireZip(octets))['word/document.xml']), nom };
}

function completer(): Pia {
  let p = avecObjectifs();
  p = modifierPv1(p, 'axe', 'Cognitif');
  p = choisirResultat(p, p.pv1.objectifs[0]!.id, 'atteint');
  p = commenterObjectif(p, p.pv1.objectifs[0]!.id, 'Repère la question seul.');
  p = choisirResultat(p, p.pv1.objectifs[1]!.id, 'partiel');
  p = modifierDatePv2(p, '2027-06-20');
  p = ajouterPresentPv2(ajouterPresentPv2(p, 'Mme Dupont, titulaire'), 'Léa Dupont');
  p = modifierRetourPv2(p, 'parents', 'Les devoirs se passent mieux.');
  p = modifierRetourPv2(p, 'autres', 'Le logopède confirme.');
  p = ajouterAmenagementPv2(p, { types: ['P'], description: 'Fiche outil' });
  p = ajouterAmenagementPv2(p, { types: ['O', 'M'], description: 'Clavier' });
  return p;
}

describe('PV 2 : export Word', () => {
  it('écrit l’évaluation des objectifs, les présents, la date, les retours et les aménagements de la rentrée', async () => {
    const { xml } = await document_(completer());
    const t = decouperTables(xml);
    assert.equal(t.length, 8);
    const pv2 = cases(t[6]!.xml);
    assert.match(pv2[1]?.[0] ?? '', /1\. Mathématiques — Repérer la question : Atteint Commentaire : Repère la question seul\. 2\. Utiliser son agenda : Atteint en partie/);
    assert.equal(pv2[3]?.[0], 'Les devoirs se passent mieux.');
    assert.equal(pv2[7]?.[1], 'Le logopède confirme.');
    assert.equal(cases(t[5]!.xml)[0]?.slice(0, 2).join('|'), 'Mme Dupont, titulaire|Léa Dupont');
    const rentree = cases(t[7]!.xml);
    assert.equal(rentree[2]?.[1], 'X');
    assert.equal(rentree[2]?.[4], 'Fiche outil');
    assert.deepEqual(rentree[3]?.slice(1, 4), ['', 'X', 'X']);
    assert.match(texteDe(xml), /Date : 20\/06\/2027/);
    // Le PV 1 n'est pas touché par le PV 2.
    assert.equal(cases(t[4]!.xml)[2]?.[4], '');
  });

  it('les lignes d’évaluation ignorent les objectifs vides et les résultats non choisis', () => {
    let p = ajouterObjectifPeriode(avecObjectifs());
    p = commenterObjectif(p, p.pv1.objectifs[1]!.id, 'À suivre');
    assert.deepEqual(lignesEvaluation(p), ['1. Mathématiques — Repérer la question', '2. Utiliser son agenda', 'Commentaire : À suivre']);
  });
});

describe('Export par partie', () => {
  const textePartie = async (parties: Array<'profil' | 'pv1' | 'pv2'>): Promise<{ xml: string; texte: string }> => {
    const { xml } = await document_(completer(), { parties });
    return { xml, texte: texteDe(xml) };
  };

  it('toutes les parties : le document complet', async () => {
    const t = await textePartie(['profil', 'pv1', 'pv2']);
    assert.match(t.texte, /Procès-verbal 1/);
    assert.match(t.texte, /Procès-verbal 2/);
    assert.equal(decouperTables(t.xml).length, 8);
  });

  it('PV 2 seul : plus de profil ni de PV 1, l’identité reste', async () => {
    const t = await textePartie(['pv2']);
    assert.equal(decouperTables(t.xml).length, 4);
    assert.doesNotMatch(t.texte, /Aspect/);
    assert.doesNotMatch(t.texte, /Procès-verbal 1/);
    assert.match(t.texte, /Procès-verbal 2/);
    assert.match(t.texte, /Dupont Léa/);
    assert.match(t.texte, /Repérer la question/);
  });

  it('PV 1 seul : plus de profil ni de PV 2', async () => {
    const t = await textePartie(['pv1']);
    assert.equal(decouperTables(t.xml).length, 4);
    assert.match(t.texte, /Procès-verbal 1/);
    assert.doesNotMatch(t.texte, /Procès-verbal 2/);
    assert.doesNotMatch(t.texte, /Aspect/);
  });

  it('profil seul : un document d’une seule section paysage, sans page vide', async () => {
    const t = await textePartie(['profil']);
    assert.equal(decouperTables(t.xml).length, 2);
    assert.doesNotMatch(t.texte, /Procès-verbal/);
    assert.equal((t.xml.match(/<w:sectPr/g) ?? []).length, 1);
    assert.match(t.xml, /<w:pgSz[^>]*w:orient="landscape"/);
    assert.match(t.texte, /Aspect/);
  });

  it('le nom du fichier dit quelles parties il contient', async () => {
    assert.match((await document_(completer(), { parties: ['pv2'] })).nom, /PV2\.docx$/);
    assert.match((await document_(completer(), { parties: ['profil', 'pv1'] })).nom, /profil-PV1\.docx$/);
    assert.doesNotMatch((await document_(completer())).nom, /PV/);
  });
});

describe('Version dé-identifiée', () => {
  it('retire le nom de l’élève des textes et des présents, et vide le dossier', async () => {
    let p = completer();
    p = modifierPv1(p, 'ressources', 'Léa a besoin d’un clavier.');
    p = ajouterPresent(p, 'Mme Durand, titulaire');
    p = ajouterPresent(p, 'Parent de Léa Dupont');
    const anonyme = deIdentifierPia(p, eleve);
    assert.equal(anonyme.pv1.ressources, 'l’élève a besoin d’un clavier.');
    assert.deepEqual(anonyme.pv1.presents, ['titulaire', 'Personne présente']);
    assert.deepEqual(anonyme.pv2.presents, ['titulaire', 'Personne présente']);
    assert.equal(p.pv1.ressources, 'Léa a besoin d’un clavier.', 'le PIA d’origine n’est pas modifié');
    const { xml, nom } = await document_(p, { deidentifie: true });
    const texte = texteDe(xml);
    assert.doesNotMatch(texte, /Dupont|Léa|Mme Titulaire|École Test|2011/);
    assert.match(texte, /Élève/);
    assert.match(texte, /3CB/);
    assert.match(nom, /dé-identifié/);
    assert.doesNotMatch(nom, /Dupont/);
  });

  it('vide aussi les coordonnées du CPMS, du Pôle et du responsable', async () => {
    const p = { ...neuf(), identite: { option: 'Sciences', cpms: 'CPMS 02 000', representantPole: 'M. Pôle', responsable: 'Mme Mère 0470' } };
    const texte = texteDe((await document_(p, { deidentifie: true })).xml);
    assert.doesNotMatch(texte, /CPMS 02|M\. Pôle|Mme Mère|0470/);
    assert.match(texte, /Sciences/);
  });
});
