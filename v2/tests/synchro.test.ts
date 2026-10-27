import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creer, horairesParDefaut } from '../src/domain/agenda/index.ts';
import {
  REPERE, aPlat, canonique, cheminDistant, cle, comparerCopie, construireCopie, decouperCle, descriptionEvenement, empreinte, estDemo, etiquette,
  evenementsSouhaites, fenetreOutlook, idDepuisNom, lireCopie, lireEnveloppe, nomFichier, normaliserReglagesOutlook, planVide, planifier,
  planifierOutlook, repereDans, sujetDe, versTexte
} from '../src/domain/synchro/index.ts';
import type { EntreeRegistre, LocalVu, DistantVu, Cle } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { seance } from './fabrique.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: 'Durand', prenom: 'Léa', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });

describe('clés et noms de fichiers', () => {
  it('compose et découpe une clé', () => {
    assert.equal(cle('seance', 'abc'), 'seance:abc');
    assert.deepEqual(decouperCle('pia:alpha|2026-2027'), { type: 'pia', id: 'alpha|2026-2027' });
    assert.equal(decouperCle('inconnu:x'), null);
    assert.equal(decouperCle('seance:'), null);
  });
  it('un nom de fichier sûr, qui se relit à l’identique', () => {
    for (const id of ['abc-123', 'alpha|2026-2027', 'Élève Ünï/x', 'a~b', 'MAJ.min', 'e3c1f7a2-9b44-4c1d-8a2e-0b3f6d5c7e11', 'émoji 😀']) {
      const nom = nomFichier(id);
      assert.match(nom, /^[a-z0-9._~-]+\.json$/, nom);
      assert.equal(idDepuisNom(nom), id);
    }
  });
  it('OneDrive ignore la casse : deux identifiants qui ne diffèrent que par la casse ont deux noms différents', () => {
    assert.notEqual(nomFichier('Ab').toLowerCase(), nomFichier('aB').toLowerCase());
  });
  it('refuse un nom qui n’est pas un fichier de l’application', () => {
    assert.equal(idDepuisNom('lisez-moi.txt'), null);
    assert.equal(idDepuisNom('.json'), null);
    assert.equal(idDepuisNom('A.json'), null);
    assert.equal(idDepuisNom('a~zz.json'), null);
    assert.equal(idDepuisNom('a~ff.json'), null); // octet UTF-8 invalide
  });
  it('chemin distant et données de démonstration', () => {
    assert.equal(cheminDistant('seance', 'x1'), 'seances/x1.json');
    assert.equal(cheminDistant('activite', 'x1'), 'agenda/x1.json');
    assert.equal(estDemo('demo-alpha'), true);
    assert.equal(estDemo('alpha'), false);
  });
});

describe('empreinte', () => {
  it('ne dépend pas de l’ordre des clés ni des valeurs indéfinies', () => {
    assert.equal(canonique({ b: 1, a: [1, { d: 1, c: 2 }], u: undefined }), canonique({ a: [1, { c: 2, d: 1 }], b: 1 }));
  });
  it('change quand le contenu change', async () => {
    assert.equal(await empreinte({ a: 1 }), await empreinte({ a: 1 }));
    assert.notEqual(await empreinte({ a: 1 }), await empreinte({ a: 2 }));
    assert.match(await empreinte({}), /^[0-9a-f]{64}$/);
  });
});

/* ───────── Plan de synchronisation ───────── */

const L = (empreinteLocale: string, eleveId?: string): LocalVu => ({ empreinte: empreinteLocale, ...(eleveId ? { eleveId } : {}) });
const D = (etag: string): DistantVu => ({ etag });
const G = (empreinteSynchro: string, etag: string): EntreeRegistre => ({ empreinte: empreinteSynchro, etag });
const plan = (locaux: Record<string, LocalVu>, distants: Record<string, DistantVu>, registre: Record<string, EntreeRegistre>) =>
  planifier({ locaux: new Map(Object.entries(locaux)), distants: new Map(Object.entries(distants)), registre: new Map(Object.entries(registre)) });

describe('planifier', () => {
  it('rien à faire quand rien n’a bougé', () => {
    const p = plan({ 'seance:a': L('h1') }, { 'seance:a': D('e1') }, { 'seance:a': G('h1', 'e1') });
    assert.equal(planVide(p), true);
  });
  it('nouveau ici → envoyer ; nouveau dans OneDrive → recevoir', () => {
    const p = plan({ 'seance:a': L('h') }, { 'seance:b': D('e') }, {});
    assert.deepEqual(p.envoyer, ['seance:a']);
    assert.deepEqual(p.recevoir, ['seance:b']);
  });
  it('modifié seulement ici → envoyer ; seulement dans OneDrive → recevoir', () => {
    const p = plan({ 'seance:a': L('h2'), 'seance:b': L('h1') }, { 'seance:a': D('e1'), 'seance:b': D('e2') }, { 'seance:a': G('h1', 'e1'), 'seance:b': G('h1', 'e1') });
    assert.deepEqual(p.envoyer, ['seance:a']);
    assert.deepEqual(p.recevoir, ['seance:b']);
  });
  it('modifié des deux côtés, ou jamais synchronisé des deux côtés → à comparer', () => {
    const p = plan({ 'seance:a': L('h2'), 'seance:b': L('h') }, { 'seance:a': D('e2'), 'seance:b': D('e') }, { 'seance:a': G('h1', 'e1') });
    assert.deepEqual(p.aVerifier, ['seance:a', 'seance:b']);
    assert.deepEqual(p.conflits, []);
  });
  it('supprimé dans OneDrive : supprimé ici si inchangé, conflit si modifié ici', () => {
    const p = plan({ 'seance:a': L('h1'), 'seance:b': L('h2') }, {}, { 'seance:a': G('h1', 'e1'), 'seance:b': G('h1', 'e1') });
    assert.deepEqual(p.supprimerLocal, ['seance:a']);
    assert.deepEqual(p.conflits, [{ cle: 'seance:b', genre: 'supprimeDistant', liees: [] }]);
  });
  it('supprimé ici : supprimé dans OneDrive si inchangé là-bas, conflit si modifié là-bas', () => {
    const p = plan({}, { 'seance:a': D('e1'), 'seance:b': D('e2') }, { 'seance:a': G('h1', 'e1'), 'seance:b': G('h1', 'e1') });
    assert.deepEqual(p.supprimerDistant, ['seance:a']);
    assert.deepEqual(p.conflits, [{ cle: 'seance:b', genre: 'supprimeLocal', liees: [] }]);
  });
  it('supprimé partout → on oublie', () => {
    assert.deepEqual(plan({}, {}, { 'seance:a': G('h', 'e') }).oublier, ['seance:a']);
  });
  it('un élève supprimé dans OneDrive est toujours demandé, avec ses séances, activités et PIA mis de côté', () => {
    const p = plan(
      { 'eleve:x': L('h'), 'seance:s1': L('h', 'x'), 'seance:s2': L('hmod', 'x'), 'activite:a1': L('h', 'x'), 'pia:x|2026-2027': L('h', 'x'), 'seance:autre': L('h', 'y'), 'eleve:y': L('h') },
      { 'eleve:y': D('e'), 'seance:autre': D('e') },
      { 'eleve:x': G('h', 'e'), 'seance:s1': G('h', 'e'), 'seance:s2': G('h', 'e'), 'activite:a1': G('h', 'e'), 'pia:x|2026-2027': G('h', 'e'), 'eleve:y': G('h', 'e'), 'seance:autre': G('h', 'e') }
    );
    assert.deepEqual(p.supprimerLocal, []);
    assert.deepEqual(p.envoyer, []);
    assert.equal(p.conflits.length, 1);
    assert.equal(p.conflits[0]!.cle, 'eleve:x');
    assert.deepEqual(p.conflits[0]!.liees, ['seance:s1', 'seance:s2', 'activite:a1', 'pia:x|2026-2027']);
  });
  it('un nouvel objet ici pour un élève supprimé dans OneDrive n’est pas envoyé sans réponse', () => {
    const p = plan({ 'eleve:x': L('h'), 'seance:neuve': L('h', 'x') }, {}, { 'eleve:x': G('h', 'e') });
    assert.deepEqual(p.envoyer, []);
    assert.deepEqual(p.conflits[0]!.liees, ['seance:neuve']);
  });
  it('les élèves passent avant le reste', () => {
    const p = plan({ 'seance:a': L('h', 'e1'), 'eleve:e1': L('h'), 'activite:z': L('h'), 'pia:p': L('h') }, {}, {});
    assert.deepEqual(p.envoyer, ['eleve:e1', 'seance:a', 'activite:z', 'pia:p']);
  });
});

/* ───────── Enveloppe ───────── */

describe('enveloppe de fichier', () => {
  it('écrit puis relit', () => {
    const texte = versTexte('seance', 's1', { a: 1 }, '2026-10-26T10:00:00.000Z');
    const r = lireEnveloppe(texte);
    assert.equal(r.ok, true);
    if (r.ok) assert.deepEqual(r.enveloppe, { type: 'seance', id: 's1', enregistreLe: '2026-10-26T10:00:00.000Z', donnees: { a: 1 } });
  });
  it('refuse ce qui n’est pas à nous, ce qui est abîmé et ce qui vient du futur', () => {
    assert.equal(lireEnveloppe('pas du json').ok, false);
    assert.equal(lireEnveloppe('[]').ok, false);
    assert.equal(lireEnveloppe(JSON.stringify({ schema: 'autre/1', type: 'seance', id: 'x', donnees: {} })).ok, false);
    assert.equal(lireEnveloppe(JSON.stringify({ schema: 'journalier-v2/1', type: 'chose', id: 'x', donnees: {} })).ok, false);
    assert.equal(lireEnveloppe(JSON.stringify({ schema: 'journalier-v2/1', type: 'seance', id: '', donnees: {} })).ok, false);
    assert.equal(lireEnveloppe(JSON.stringify({ schema: 'journalier-v2/1', type: 'seance', id: 'x' })).ok, false);
    const futur = lireEnveloppe(JSON.stringify({ schema: 'journalier-v2/2', type: 'seance', id: 'x', donnees: {} }));
    assert.equal(futur.ok, false);
    if (!futur.ok) assert.match(futur.erreur, /plus récente/);
  });
});

/* ───────── Objets, étiquettes, copie ───────── */

describe('objets et copie de secours', () => {
  const e = eleve('x');
  const s = seance({ eleveId: 'x', date: '2026-10-05', matiere: 'Français' });
  const a = creer({ type: 'eleve', eleveId: 'x', date: '2026-10-05', debut: 0, fin: 0, titre: 'Fractions' });
  const objets = { eleves: [e], seances: [s], activites: [a], pias: [], reglages: [{ id: 'agenda-horaires', valeur: [] }, { id: 'theme', valeur: 'sombre' }] };

  it('met à plat, sans les réglages propres à l’appareil', () => {
    const plat = aPlat(objets);
    assert.deepEqual([...plat.keys()].sort(), [`activite:${a.id}`, 'eleve:x', 'reglage:agenda-horaires', `seance:${s.id}`].sort());
    assert.equal(plat.get(`seance:${s.id}`)!.eleveId, 'x');
  });
  it('désigne chaque objet en français', () => {
    assert.equal(etiquette('eleve', e, [e]), 'Élève : Léa Durand');
    assert.match(etiquette('seance', s, [e]), /^Séance du .*2026.* — Léa Durand — Français$/);
    assert.match(etiquette('activite', a, [e]), /^Agenda : Fractions/);
    assert.equal(etiquette('reglage', { id: 'agenda-semaine-type' }, []), 'Semaine type de l’agenda');
    assert.equal(etiquette('seance', { eleveId: 'inconnu' }, []), 'Séance du  — élève inconnu — matière non précisée');
  });
  it('construit puis relit une copie', () => {
    const copie = construireCopie(objets, '2026-10-26T10:00:00.000Z');
    assert.equal(copie.reglages.length, 1);
    const r = lireCopie(JSON.stringify(copie));
    assert.equal(r.ok, true);
    if (r.ok) assert.equal(r.copie.seances[0]!.id, s.id);
  });
  it('refuse une copie qui n’en est pas une', () => {
    assert.equal(lireCopie('x').ok, false);
    assert.equal(lireCopie('{}').ok, false);
    assert.equal(lireCopie(JSON.stringify({ schema: 'journalier-v2-copie/9', eleves: [], seances: [], activites: [], pias: [], reglages: [] })).ok, false);
    assert.equal(lireCopie(JSON.stringify({ schema: 'journalier-v2-copie/1', eleves: [{ nom: 'sans id' }], seances: [], activites: [], pias: [], reglages: [] })).ok, false);
  });
  it('compare une copie à ce qu’il y a ici', () => {
    const ici = new Map<Cle, string>([['eleve:a', '1'], ['eleve:b', '2']]);
    const copie = new Map<Cle, string>([['eleve:a', '1'], ['eleve:b', 'autre'], ['eleve:c', '3']]);
    assert.deepEqual(comparerCopie(copie, ici), { manquants: ['eleve:c'], differents: ['eleve:b'], identiques: 1 });
  });
});

/* ───────── Outlook ───────── */

describe('liaison Outlook', () => {
  const horaires = horairesParDefaut();
  const e = eleve('x');
  const base = { eleves: [e], seances: [], horaires };
  const reglages = (nom: 'aucun' | 'initiales' | 'prenom' = 'aucun', lieu = true) => ({ actif: true, nom, lieu });

  it('par défaut, aucun nom d’élève n’est écrit dans Outlook', () => {
    const a = creer({ type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 0, fin: 1, matiere: 'Mathématiques', lieu: 'Local 12' });
    assert.equal(sujetDe(a, [e], 'aucun'), 'Accompagnement — Mathématiques');
    assert.equal(sujetDe(a, [e], 'initiales'), 'Accompagnement — L. D. — Mathématiques');
    assert.equal(sujetDe(a, [e], 'prenom'), 'Accompagnement — Léa D. — Mathématiques');
    const [ev] = evenementsSouhaites([a], base.eleves, base.seances, base.horaires, '2026-10-26', '2026-10-30', reglages());
    assert.deepEqual(ev, { cle: `${a.id}@2026-10-26`, sujet: 'Accompagnement — Mathématiques', debut: '2026-10-26T08:00', fin: '2026-10-26T09:40', lieu: 'Local 12' });
    assert.equal(evenementsSouhaites([a], base.eleves, base.seances, base.horaires, '2026-10-26', '2026-10-30', reglages('aucun', false))[0]!.lieu, '');
  });
  it('sujet des autres types, nom libre et titre', () => {
    assert.equal(sujetDe(creer({ type: 'formation', date: '2026-10-26', debut: 0, fin: 0, titre: 'Dyslexie' }), [], 'aucun'), 'Dyslexie');
    assert.equal(sujetDe(creer({ type: 'administratif', date: '2026-10-26', debut: 0, fin: 0 }), [], 'aucun'), 'Administratif');
    assert.equal(sujetDe(creer({ type: 'eleve', nomLibre: 'Marc Petit', date: '2026-10-26', debut: 0, fin: 0 }), [], 'initiales'), 'Accompagnement — M. P.');
    assert.equal(sujetDe(creer({ type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 0, fin: 0, titre: 'Fractions' }), [e], 'aucun'), 'Accompagnement · Fractions');
  });
  it('les activités annulées ne partent pas, les répétitions donnent une occurrence par semaine', () => {
    const a = creer({ type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 2, fin: 2, repetition: 'hebdomadaire', jusquau: '2026-11-09', etats: { '2026-11-02': 'annule' } });
    const evs = evenementsSouhaites([a], base.eleves, base.seances, base.horaires, '2026-10-26', '2026-11-30', reglages());
    assert.deepEqual(evs.map((x) => x.debut), ['2026-10-26T09:40', '2026-11-09T09:40']);
  });
  it('compare à l’existant : crée, corrige, retire, jamais de doublon, n’abîme pas ce qui n’est pas à nous', () => {
    const v = (cleO: string, sujet: string, debut = '2026-10-26T08:00'): { cle: string; sujet: string; debut: string; fin: string; lieu: string } => ({ cle: cleO, sujet, debut, fin: '2026-10-26T08:50', lieu: '' });
    const souhaites = [v('a@1', 'A'), v('b@1', 'B nouveau'), v('c@1', 'C')];
    const existants = [
      { id: 'o1', ...v('a@1', 'A') },                                  // identique
      { id: 'o2', ...v('b@1', 'B ancien') },                           // à corriger
      { id: 'o3', ...v('d@1', 'D') },                                  // plus voulu
      { id: 'o4', ...v('a@1', 'A') },                                  // doublon
      { id: 'o5', ...v('', 'Rendez-vous personnel') },                 // sans repère : intouchable
      { id: 'o6', ...v('c@1', 'C', '2026-10-26T08:00:00.0000000') }    // heure avec secondes : identique
    ];
    const p = planifierOutlook(souhaites, existants);
    assert.deepEqual(p.creer, []);
    assert.deepEqual(p.modifier, [{ id: 'o2', evenement: v('b@1', 'B nouveau') }]);
    assert.deepEqual(p.supprimer.sort(), ['o3', 'o4']);
    assert.deepEqual(planifierOutlook([v('x@1', 'X')], []).creer, [v('x@1', 'X')]);
  });
  it('le repère s’écrit dans la description et se retrouve, même dans du HTML', () => {
    const d = descriptionEvenement('abc@2026-10-26');
    assert.ok(d.includes(`${REPERE}abc@2026-10-26`));
    assert.equal(repereDans(d), 'abc@2026-10-26');
    assert.equal(repereDans(`<html><body><p>Recopié</p><p>journalier:abc@2026-10-26</p></body></html>`), 'abc@2026-10-26');
    assert.equal(repereDans('Rendez-vous'), '');
  });
  it('fenêtre : du lundi de la semaine à la fin de l’année scolaire', () => {
    assert.deepEqual(fenetreOutlook('2026-10-28'), { du: '2026-10-26', au: '2027-07-31' });
    assert.deepEqual(fenetreOutlook('2027-03-03'), { du: '2027-03-01', au: '2027-07-31' });
  });
  it('relit les réglages avec prudence', () => {
    assert.deepEqual(normaliserReglagesOutlook(null), { actif: false, nom: 'aucun', lieu: true });
    assert.deepEqual(normaliserReglagesOutlook({ actif: true, nom: 'inconnu', lieu: false }), { actif: true, nom: 'aucun', lieu: false });
    assert.equal(normaliserReglagesOutlook({ nom: 'prenom' }).nom, 'prenom');
  });
});
