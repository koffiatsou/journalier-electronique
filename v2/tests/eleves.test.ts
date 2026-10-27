import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import type { Activite } from '../src/domain/agenda/types.ts';
import {
  appliquerPassage, archiver, bilanSeances, classeSuivante, effetSuppression, elevesActifs, elevesArchives, elevesProposes,
  initiales, languesDe, niveauSuivant, normaliserEleve, planPassage, reactiver, rechercherEleves
} from '../src/domain/eleves/index.ts';
import { rechercherSeances } from '../src/domain/journalier/index.ts';
import { cibleDeSeance } from '../src/domain/referentiel/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';
import { seance } from './fabrique.ts';

const eleve = (surcharge: Partial<Eleve> = {}): Eleve => ({
  id: 'alpha', nom: 'Dupont', prenom: 'Élodie', classe: '3CB', ecole: 'École fictive', titulaire: 'M. Test', dateNaissance: '',
  matieres: ['Mathématiques', 'Français'], ...surcharge
});

const activite = (id: string, eleveId?: string): Activite => ({
  id, type: eleveId ? 'eleve' : 'libre', ...(eleveId ? { eleveId } : {}), titre: '', lieu: '', note: '', date: '2026-10-05', debut: 0, fin: 0,
  repetition: 'aucune', creeLe: '2026-10-01T08:00:00.000Z', modifieLe: '2026-10-01T08:00:00.000Z'
});

describe('Élèves : langues', () => {
  it('plusieurs langues, sans doublon ; l’ancien champ « langue » est lu', () => {
    assert.deepEqual(languesDe(eleve({ langues: ['Anglais', 'Néerlandais', 'Anglais'] })), ['Anglais', 'Néerlandais']);
    assert.deepEqual(languesDe(eleve({ langue: 'Néerlandais' })), ['Néerlandais']);
    assert.deepEqual(languesDe(eleve()), []);
  });
  it('un dossier de l’ancien format est converti à l’ouverture', () => {
    const n = normaliserEleve(eleve({ langue: 'Espagnol' }));
    assert.deepEqual(n.langues, ['Espagnol']);
    assert.equal('langue' in n, false);
    assert.equal('langues' in normaliserEleve(eleve({ langues: [] })), false);
  });
});

describe('Langues modernes : toutes reliées au référentiel', () => {
  it('chaque langue du dossier a son jeu de données et sa langue', () => {
    for (const langue of ['Néerlandais', 'Anglais', 'Allemand', 'Espagnol', 'Italien']) {
      assert.deepEqual(cibleDeSeance(langue, []), { cible: { jeu: 'langues', langue }, ambigu: false }, langue);
    }
  });
  it('« Langues modernes » : la langue du dossier si elle est unique, sinon on demande de préciser', () => {
    assert.deepEqual(cibleDeSeance('Langues modernes', ['Espagnol']).cible, { jeu: 'langues', langue: 'Espagnol' });
    const deux = cibleDeSeance('Langues modernes', ['Anglais', 'Espagnol']);
    assert.deepEqual([deux.cible, deux.ambigu], [null, true]);
    assert.deepEqual(cibleDeSeance('Langues modernes', []), { cible: null, ambigu: false });
  });
  it('une matière précise l’emporte sur les langues du dossier', () => {
    assert.equal(cibleDeSeance('Anglais', ['Espagnol', 'Néerlandais']).cible?.langue, 'Anglais');
    assert.equal(cibleDeSeance('Mathématiques', ['Anglais']).cible?.jeu, 'mathematiques');
  });
});

describe('Élèves : archivage', () => {
  const a = eleve({ id: 'a' });
  const b = archiver(eleve({ id: 'b' }), '2026-10-24');
  it('archiver puis réactiver rend le dossier identique', () => {
    assert.equal(b.archiveLe, '2026-10-24');
    assert.deepEqual(reactiver(b), eleve({ id: 'b' }));
  });
  it('actifs et archivés sont séparés ; l’élève déjà choisi reste proposé', () => {
    assert.deepEqual(elevesActifs([a, b]).map((e) => e.id), ['a']);
    assert.deepEqual(elevesArchives([a, b]).map((e) => e.id), ['b']);
    assert.deepEqual(elevesProposes([a, b]).map((e) => e.id), ['a']);
    assert.deepEqual(elevesProposes([a, b], 'b').map((e) => e.id), ['a', 'b']);
  });
});

describe('Élèves : suppression complète', () => {
  const seances = [seance({ id: 's1', eleveId: 'a' }), seance({ id: 's2', eleveId: 'a' }), seance({ id: 's3', eleveId: 'b' })];
  const activites = [activite('t1', 'a'), activite('t2', 'b'), activite('t3')];

  it('liste exactement ce qui disparaît avec l’élève', () => {
    assert.deepEqual(effetSuppression('a', seances, activites), { seances: ['s1', 's2'], activites: ['t1'], pias: [] });
    assert.deepEqual(effetSuppression('a', seances, activites, [{ id: 'a|2026-2027', eleveId: 'a' }, { id: 'b|2026-2027', eleveId: 'b' }]).pias, ['a|2026-2027']);
    assert.deepEqual(effetSuppression('zzz', seances, activites), { seances: [], activites: [], pias: [] });
  });

  it('le magasin supprime l’élève, ses séances et ses activités : aucune séance orpheline, y compris après rechargement', async () => {
    const depot = creerDepotMemoire([eleve({ id: 'a' }), eleve({ id: 'b', nom: 'Martin' })], seances, activites);
    const magasin = creerMagasin(depot);
    await magasin.charger();
    const effet = await magasin.supprimerEleve('a');
    assert.deepEqual(effet, { seances: ['s1', 's2'], activites: ['t1'], pias: [] });

    const apres = magasin.lire();
    assert.deepEqual(apres.eleves.map((e) => e.id), ['b']);
    assert.deepEqual(apres.seances.map((s) => s.id), ['s3']);
    assert.deepEqual(apres.activites.map((x) => x.id).sort(), ['t2', 't3']);

    // Ce qui est réellement stocké (pas seulement l'affichage)
    const relu = creerMagasin(depot);
    await relu.charger();
    const ids = new Set(relu.lire().eleves.map((e) => e.id));
    assert.deepEqual(relu.lire().seances.map((s) => s.id), ['s3']);
    assert.ok(relu.lire().seances.every((s) => ids.has(s.eleveId)), 'aucune séance sans élève');
    assert.ok(relu.lire().activites.every((x) => !x.eleveId || ids.has(x.eleveId)), 'aucune activité sans élève');
  });

  it('l’archivage garde les séances', async () => {
    const depot = creerDepotMemoire([eleve({ id: 'a' })], seances, []);
    const magasin = creerMagasin(depot);
    await magasin.charger();
    await magasin.ajouterEleves([archiver(eleve({ id: 'a' }), '2026-10-24')]);
    assert.equal(magasin.lire().seances.filter((s) => s.eleveId === 'a').length, 2);
    assert.equal(magasin.lire().eleves[0]?.archiveLe, '2026-10-24');
  });
});

describe('Élèves : recherche et cartes', () => {
  const liste = [
    eleve({ id: '1', nom: 'Dupont', prenom: 'Élodie', classe: '3CB', langues: ['Anglais', 'Néerlandais'] }),
    eleve({ id: '2', nom: 'Martin', prenom: 'Léo', classe: '4TQ', matieres: ['Sciences'], titulaire: 'Mme Gérard' }),
    archiver(eleve({ id: '3', nom: 'Durand', prenom: 'Zoé', classe: '1DB' }), '2026-09-01')
  ];
  it('ignore accents et majuscules, ordre des mots indifférent', () => {
    assert.deepEqual(rechercherEleves(liste, 'ELODIE').map((e) => e.id), ['1']);
    assert.deepEqual(rechercherEleves(liste, 'dupont elodie').map((e) => e.id), ['1']);
    assert.deepEqual(rechercherEleves(liste, 'leo martin').map((e) => e.id), ['2']);
  });
  it('cherche aussi la classe, la matière, la langue, le titulaire et le niveau d’étude', () => {
    assert.deepEqual(rechercherEleves(liste, '4tq').map((e) => e.id), ['2']);
    assert.deepEqual(rechercherEleves(liste, 'sciences').map((e) => e.id), ['2']);
    assert.deepEqual(rechercherEleves(liste, 'neerlandais').map((e) => e.id), ['1']);
    assert.deepEqual(rechercherEleves(liste, 'gerard').map((e) => e.id), ['2']);
    assert.deepEqual(rechercherEleves(liste, 'technique de qualification').map((e) => e.id), ['2']);
    assert.deepEqual(rechercherEleves(liste, 'archive').map((e) => e.id), ['3']);
  });
  it('une recherche vide garde tout le monde ; sans résultat, liste vide', () => {
    assert.equal(rechercherEleves(liste, '   ').length, 3);
    assert.equal(rechercherEleves(liste, 'inconnu').length, 0);
  });
  it('initiales de la pastille', () => {
    assert.equal(initiales({ nom: 'Dupont', prenom: 'Élodie' }), 'ÉD');
    assert.equal(initiales({ nom: 'de Vries', prenom: 'jean-pierre' }), 'JD');
    assert.equal(initiales({ nom: '', prenom: '' }), '?');
  });
  it('nombre de séances et dernière séance par élève', () => {
    const b = bilanSeances([
      seance({ eleveId: 'a', date: '2026-09-01' }), seance({ eleveId: 'a', date: '2026-10-05' }),
      seance({ eleveId: 'a', date: '2026-09-20' }), seance({ eleveId: 'b', date: '2026-09-02' })
    ]);
    assert.deepEqual(b.get('a'), { nombre: 3, derniere: '2026-10-05' });
    assert.deepEqual(b.get('b'), { nombre: 1, derniere: '2026-09-02' });
    assert.equal(b.get('c'), undefined);
  });
});

describe('Journalier : recherche d’une séance', () => {
  const alpha = eleve({ id: 'alpha' });
  const parId = new Map([[alpha.id, alpha]]);
  const liste = [
    seance({ id: 'frac', objectifLecon: 'Additionner des fractions', matiere: 'Mathématiques' }),
    seance({ id: 'texte', objectifLecon: 'Lire un texte', matiere: 'Français', remarque: 'Très motivée', aides: [{ nom: 'Reformulation', effet: 2 }] }),
    seance({ id: 'autre', eleveId: 'beta', objectifLecon: 'Photosynthèse', matiere: 'Sciences', date: '2026-10-14' })
  ];
  it('retrouve par objectif, matière, remarque, aide, nom de l’élève ou date', () => {
    const ids = (q: string) => rechercherSeances(liste, q, parId).map((s) => s.id);
    assert.deepEqual(ids('fractions'), ['frac']);
    assert.deepEqual(ids('FRANCAIS'), ['texte']);
    assert.deepEqual(ids('motivee'), ['texte']);
    assert.deepEqual(ids('reformulation'), ['texte']);
    assert.deepEqual(ids('dupont'), ['frac', 'texte']);
    assert.deepEqual(ids('14/10/2026'), ['autre']);
    assert.deepEqual(ids('photosynthese sciences'), ['autre']);
    assert.deepEqual(ids('introuvable'), []);
    assert.equal(ids('').length, 3);
  });
});

describe('Passage d’année scolaire', () => {
  it('classe suivante : 3CB → 4CB ; dernière année → rien', () => {
    assert.equal(classeSuivante('3CB'), '4CB');
    assert.equal(classeSuivante('1DB'), '2DB');
    assert.equal(classeSuivante(' 5TQ '), '6TQ');
    assert.equal(classeSuivante('6TQ'), undefined);
    assert.equal(classeSuivante('6G'), undefined);
    assert.equal(classeSuivante('6P'), '7P');
    assert.equal(classeSuivante('7P'), undefined);
    assert.equal(classeSuivante('Les Tilleuls'), undefined);
    assert.equal(classeSuivante(''), undefined);
  });
  it('niveau suivant : S3 → S4, P6 → S1, S6 → rien', () => {
    assert.equal(niveauSuivant('S3'), 'S4');
    assert.equal(niveauSuivant('s5'), 'S6');
    assert.equal(niveauSuivant('P6'), 'S1');
    assert.equal(niveauSuivant('S6'), undefined);
    assert.equal(niveauSuivant('3e'), undefined);
  });

  const cible = '2026-2027';
  const liste = [
    eleve({ id: 'a', classe: '3CB', anneeDossier: '2025-2026' }),
    eleve({ id: 'b', classe: '4TQ', anneeDossier: '2026-2027' }),
    eleve({ id: 'c', classe: '3CB' }),
    eleve({ id: 'd', classe: '6TQ', anneeDossier: '2025-2026' }),
    eleve({ id: 'e', classe: 'Tilleuls', anneeDossier: '2025-2026' }),
    archiver(eleve({ id: 'f', classe: '2CB', anneeDossier: '2025-2026' }), '2026-06-30')
  ];
  it('proposition prudente : seuls les dossiers de l’année précédente passent', () => {
    const p = new Map(planPassage(liste, cible).map((l) => [l.eleveId, l]));
    assert.equal(p.size, 5, 'les archivés ne sont pas concernés');
    assert.deepEqual([p.get('a')?.action, p.get('a')?.classe], ['passer', '4CB']);
    assert.equal(p.get('b')?.action, 'laisser', 'déjà à jour');
    assert.equal(p.get('b')?.dejaAJour, true);
    assert.equal(p.get('a')?.dejaAJour, false);
    assert.equal(p.get('b')?.classe, '4TQ');
    assert.equal(p.get('c')?.action, 'laisser', 'année du dossier inconnue : jamais de passage automatique');
    assert.equal(p.get('d')?.action, 'archiver', 'dernière année du parcours');
    assert.deepEqual([p.get('e')?.action, p.get('e')?.classe], ['passer', 'Tilleuls']);
  });

  const ligne = (e: Eleve, surcharge = {}) => ({ ...planPassage([e], cible)[0]!, ...surcharge });
  const options = { viderTitulaire: true, aujourdhui: '2026-10-24' };

  it('passer : nouvelle classe, année du dossier, titulaire vidé (sauf si on le garde)', () => {
    const e = eleve({ classe: '3CB', anneeDossier: '2025-2026' });
    const n = appliquerPassage(e, ligne(e), cible, options);
    assert.deepEqual([n.classe, n.anneeDossier, n.titulaire], ['4CB', cible, '']);
    assert.equal(appliquerPassage(e, ligne(e), cible, { ...options, viderTitulaire: false }).titulaire, 'M. Test');
    assert.equal(e.classe, '3CB', 'le dossier d’origine n’est pas modifié');
  });
  it('le niveau saisi à la main suit la classe, sauf en cas de redoublement', () => {
    const e = eleve({ classe: '3CB', niveau: 'S3', anneeDossier: '2025-2026' });
    assert.equal(appliquerPassage(e, ligne(e), cible, options).niveau, 'S4');
    assert.equal(appliquerPassage(e, ligne(e, { classe: '3CB' }), cible, options).niveau, 'S3');
    const illisible = eleve({ classe: '3CB', niveau: 'troisième', anneeDossier: '2025-2026' });
    assert.equal('niveau' in appliquerPassage(illisible, ligne(illisible), cible, options), false);
  });
  it('archiver garde le dossier tel quel avec une date ; laisser ne change rien', () => {
    const e = eleve({ classe: '6TQ', anneeDossier: '2025-2026' });
    const n = appliquerPassage(e, ligne(e), cible, options);
    assert.deepEqual([n.archiveLe, n.classe, n.titulaire], ['2026-10-24', '6TQ', 'M. Test']);
    assert.equal(appliquerPassage(e, ligne(e, { action: 'laisser' }), cible, options), e);
  });
  it('les séances ne sont jamais touchées par le passage', async () => {
    const s = seance({ id: 's1', eleveId: 'alpha', niveauScolaire: 'S3' });
    const e = eleve({ id: 'alpha', classe: '3CB', anneeDossier: '2025-2026' });
    const magasin = creerMagasin(creerDepotMemoire([e], [s], []));
    await magasin.charger();
    await magasin.ajouterEleves([appliquerPassage(e, ligne(e), cible, options)]);
    assert.equal(magasin.lire().eleves[0]?.classe, '4CB');
    assert.deepEqual(magasin.lire().seances, [s]);
  });
});
