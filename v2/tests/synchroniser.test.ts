import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { creer, horairesParDefaut } from '../src/domain/agenda/index.ts';
import { versTexte } from '../src/domain/synchro/index.ts';
import type { Eleve } from '../src/domain/types.ts';
import { creerMagasin } from '../src/state/store.ts';
import { portLocal, portRegistre } from '../src/synchro/adaptateurs.ts';
import { NuageSimule } from '../src/synchro/simule.ts';
import { resoudreConflit, synchroniser } from '../src/synchro/synchroniser.ts';
import type { OptionsSynchro } from '../src/synchro/synchroniser.ts';
import { seance } from './fabrique.ts';

const eleve = (id: string, extra: Partial<Eleve> = {}): Eleve => ({ id, nom: `Nom-${id}`, prenom: 'Léa', classe: '3CB', ecole: '', titulaire: '', dateNaissance: '', matieres: [], ...extra });

/** Un « appareil » : ses données locales et son registre, branchés sur un nuage commun. */
async function appareil(nuage: NuageSimule, compteId = 'compte-1', exclureDemo = false) {
  const depot = creerDepotMemoire();
  const magasin = creerMagasin(depot);
  await magasin.charger();
  const options: OptionsSynchro = { nuage, local: portLocal(magasin), registre: portRegistre(depot), compteId, exclureDemo };
  return { depot, magasin, options, sync: () => synchroniser(options) };
}
type Appareil = Awaited<ReturnType<typeof appareil>>;

const modifier = (nuage: NuageSimule, dossier: string, transformer: (donnees: Record<string, unknown>) => void): string => {
  const chemin = nuage.modifierSurAutreAppareil(dossier, (contenu) => {
    const o = JSON.parse(contenu) as { donnees: Record<string, unknown> };
    transformer(o.donnees);
    return JSON.stringify(o);
  });
  assert.ok(chemin, 'un fichier à modifier');
  return chemin;
};

describe('synchronisation entre deux appareils', () => {
  let nuage: NuageSimule;
  let A: Appareil;
  let B: Appareil;

  beforeEach(async () => {
    nuage = new NuageSimule();
    A = await appareil(nuage);
    B = await appareil(nuage);
    await A.magasin.ajouterEleves([eleve('x')]);
    await A.magasin.enregistrerSeance(seance({ id: 's1', eleveId: 'x' }));
    await A.magasin.changerAgenda({ enregistrer: [creer({ id: 'a1', type: 'eleve', eleveId: 'x', date: '2026-10-26', debut: 0, fin: 0 })], supprimer: [] });
  });

  it('envoie tout la première fois, puis ne fait plus rien', async () => {
    const r1 = await A.sync();
    assert.equal(r1.envoyes, 3);
    assert.deepEqual([r1.recus, r1.conflits.length, r1.erreurs.length], [0, 0, 0]);
    assert.equal(nuage.resume().fichiers, 3);
    const r2 = await A.sync();
    assert.deepEqual([r2.envoyes, r2.recus, r2.supprimesIci, r2.supprimesLa], [0, 0, 0, 0]);
  });

  it('un second appareil reçoit tout, dans le bon ordre, puis est à jour', async () => {
    await A.sync();
    const r = await B.sync();
    assert.equal(r.recus, 3);
    const e = B.magasin.lire();
    assert.deepEqual([e.eleves.length, e.seances.length, e.activites.length], [1, 1, 1]);
    assert.equal(e.seances[0]!.id, 's1');
    const r2 = await B.sync();
    assert.deepEqual([r2.envoyes, r2.recus], [0, 0]);
  });

  it('une modification se transmet dans les deux sens', async () => {
    await A.sync(); await B.sync();
    await B.magasin.enregistrerSeance({ ...B.magasin.lire().seances[0]!, remarque: 'Modifié sur B' });
    assert.equal((await B.sync()).envoyes, 1);
    assert.equal((await A.sync()).recus, 1);
    assert.equal(A.magasin.lire().seances[0]!.remarque, 'Modifié sur B');
  });

  it('modifié des deux côtés avec le même contenu : pas de conflit', async () => {
    await A.sync(); await B.sync();
    const meme = { ...A.magasin.lire().seances[0]!, remarque: 'Identique' };
    await A.magasin.enregistrerSeance(meme);
    await B.magasin.enregistrerSeance(meme);
    await A.sync();
    const r = await B.sync();
    assert.deepEqual([r.conflits.length, r.envoyes, r.recus], [0, 0, 0]);
  });

  it('modifié des deux côtés avec des contenus différents : conflit, rien n’est écrasé', async () => {
    await A.sync(); await B.sync();
    await A.magasin.enregistrerSeance({ ...A.magasin.lire().seances[0]!, remarque: 'Version A' });
    await B.magasin.enregistrerSeance({ ...B.magasin.lire().seances[0]!, remarque: 'Version B' });
    await A.sync();
    const r = await B.sync();
    assert.equal(r.conflits.length, 1);
    assert.equal(r.conflits[0]!.genre, 'modification');
    assert.match(r.conflits[0]!.etiquette, /^Séance du/);
    assert.equal(B.magasin.lire().seances[0]!.remarque, 'Version B');
    // Tant que c'est en suspens, on retrouve le même conflit sans rien perdre.
    assert.equal((await B.sync()).conflits.length, 1);

    // Garder la version d'ici : OneDrive prend la version B, et A la reçoit.
    await resoudreConflit(B.options, r.conflits[0]!, 'ici');
    assert.equal((await B.sync()).conflits.length, 0);
    await A.sync();
    assert.equal(A.magasin.lire().seances[0]!.remarque, 'Version B');
  });

  it('conflit résolu en prenant la version de OneDrive', async () => {
    await A.sync(); await B.sync();
    await A.magasin.enregistrerSeance({ ...A.magasin.lire().seances[0]!, remarque: 'Version A' });
    await B.magasin.enregistrerSeance({ ...B.magasin.lire().seances[0]!, remarque: 'Version B' });
    await A.sync();
    const [conflit] = (await B.sync()).conflits;
    await resoudreConflit(B.options, conflit!, 'la');
    assert.equal(B.magasin.lire().seances[0]!.remarque, 'Version A');
    const r = await B.sync();
    assert.deepEqual([r.conflits.length, r.envoyes, r.recus], [0, 0, 0]);
  });

  it('une suppression se transmet, sans rien perdre d’autre', async () => {
    await A.sync(); await B.sync();
    await B.magasin.supprimerSeance('s1');
    assert.equal((await B.sync()).supprimesLa, 1);
    assert.equal(nuage.resume().fichiers, 2);
    const r = await A.sync();
    assert.equal(r.supprimesIci, 1);
    assert.equal(A.magasin.lire().seances.length, 0);
    assert.equal(A.magasin.lire().eleves.length, 1);
  });

  it('supprimé d’un côté et modifié de l’autre : conflit, choix de l’utilisateur', async () => {
    await A.sync(); await B.sync();
    await B.magasin.supprimerSeance('s1');
    await A.magasin.enregistrerSeance({ ...A.magasin.lire().seances[0]!, remarque: 'Modifié sur A' });
    await A.sync();
    const r = await B.sync();
    assert.equal(r.conflits[0]!.genre, 'supprimeLocal');
    await resoudreConflit(B.options, r.conflits[0]!, 'la'); // récupérer
    assert.equal(B.magasin.lire().seances[0]!.remarque, 'Modifié sur A');
    assert.equal((await B.sync()).conflits.length, 0);
  });

  it('un élève supprimé ailleurs n’est jamais supprimé ici sans réponse ; accepter supprime tout', async () => {
    await A.sync(); await B.sync();
    await A.magasin.supprimerEleve('x');
    assert.equal((await A.sync()).supprimesLa, 3);
    const r = await B.sync();
    assert.equal(r.supprimesIci, 0);
    assert.equal(r.conflits.length, 1);
    assert.equal(r.conflits[0]!.genre, 'supprimeDistant');
    assert.equal(r.conflits[0]!.liees.length, 2);
    assert.equal(B.magasin.lire().eleves.length, 1);
    await resoudreConflit(B.options, r.conflits[0]!, 'la');
    assert.deepEqual([B.magasin.lire().eleves.length, B.magasin.lire().seances.length, B.magasin.lire().activites.length], [0, 0, 0]);
    assert.equal((await B.sync()).conflits.length, 0);
  });

  it('un élève supprimé ailleurs peut être gardé : tout repart dans OneDrive', async () => {
    await A.sync(); await B.sync();
    await A.magasin.supprimerEleve('x');
    await A.sync();
    const [conflit] = (await B.sync()).conflits;
    await resoudreConflit(B.options, conflit!, 'ici');
    const r = await B.sync();
    assert.equal(r.envoyes, 2); // séance + activité repartent comme des nouveautés
    assert.equal(nuage.resume().fichiers, 3);
    const rA = await A.sync();
    assert.equal(rA.recus, 3);
    assert.equal(A.magasin.lire().seances.length, 1);
  });

  it('ne laisse jamais arriver une séance sans son élève', async () => {
    await A.sync();
    // Un fichier de séance dont l'élève n'existe nulle part.
    await nuage.ecrire('seances/orpheline.json', versTexte('seance', 'orpheline', seance({ id: 'orpheline', eleveId: 'fantome' }), ''), null);
    const r = await B.sync();
    assert.equal(r.ignores.length, 1);
    assert.match(r.ignores[0]!, /l’élève n’existe pas/);
    assert.equal(B.magasin.lire().seances.some((s) => s.id === 'orpheline'), false);
  });

  it('un fichier abîmé ou d’une version trop récente est signalé, sans bloquer le reste', async () => {
    await A.sync();
    await nuage.ecrire('seances/cassee.json', 'pas du json', null);
    await nuage.ecrire('seances/futur.json', JSON.stringify({ schema: 'journalier-v2/9', type: 'seance', id: 'futur', donnees: {} }), null);
    await nuage.ecrire('seances/mentie.json', versTexte('seance', 'autre', seance({ id: 'autre', eleveId: 'x' }), ''), null);
    const r = await B.sync();
    assert.equal(r.erreurs.length, 3);
    assert.equal(r.recus, 3); // le reste est arrivé
  });

  it('une modification faite ailleurs pendant l’envoi demande de relancer, sans rien écraser', async () => {
    await A.sync();
    await A.magasin.enregistrerSeance({ ...A.magasin.lire().seances[0]!, remarque: 'Local' });
    modifier(nuage, 'seances', (d) => { d.remarque = 'Ailleurs'; });
    // Ici la modification distante est vue avant l'envoi : c'est un cas « à comparer », donc un conflit.
    const r = await A.sync();
    assert.equal(r.conflits.length, 1);
    assert.equal(A.magasin.lire().seances[0]!.remarque, 'Local');
  });

  it('un autre compte repart d’un registre vide', async () => {
    await A.sync();
    const autre = await appareil(nuage, 'compte-2');
    await autre.magasin.ajouterEleves([eleve('x')]);
    const r = await autre.sync();
    // Même identifiant d'élève des deux côtés mais jamais synchronisé ensemble : on compare, on n'écrase pas.
    assert.equal(r.envoyes, 0);
    assert.equal(r.recus, 2);
    assert.deepEqual([r.conflits.length, r.erreurs.length], [0, 0]);
  });

  it('les réglages partagés suivent, pas ceux de l’appareil ni ceux qui sont invalides', async () => {
    await A.depot.enregistrerReglage({ id: 'theme', valeur: 'sombre' });
    await A.depot.enregistrerReglage({ id: 'agenda-horaires', valeur: [] }); // invalide : ne part pas
    assert.equal((await A.sync()).envoyes, 3);
    const perso = horairesParDefaut().map((p, i) => (i === 0 ? { ...p, debut: '08:15' } : p));
    await A.depot.enregistrerReglage({ id: 'agenda-horaires', valeur: perso });
    assert.equal((await A.sync()).envoyes, 1);
    assert.equal(nuage.resume().fichiers, 4);
    await B.sync();
    assert.equal(B.magasin.lire().horaires[0]!.debut, '08:15');
    assert.equal((await B.depot.chargerReglages()).some((r) => r.id === 'theme'), false);
  });
});

describe('données de démonstration', () => {
  it('ne partent jamais vers un vrai compte et ne sont jamais reçues', async () => {
    const nuage = new NuageSimule();
    const A = await appareil(nuage, 'vrai-compte', true);
    await A.magasin.ajouterEleves([eleve('demo-alpha'), eleve('reel')]);
    await A.magasin.enregistrerSeance(seance({ id: 'demo-s1', eleveId: 'demo-alpha' }));
    await A.magasin.enregistrerSeance(seance({ id: 'reelle', eleveId: 'reel' }));
    const r = await A.sync();
    assert.equal(r.envoyes, 2);
    assert.equal(nuage.resume().fichiers, 2);

    // Si un fichier de démonstration traîne dans le nuage, il n'est pas reçu non plus.
    await nuage.ecrire('eleves/demo-parasite.json', versTexte('eleve', 'demo-parasite', eleve('demo-parasite'), ''), null);
    const B = await appareil(nuage, 'vrai-compte', true);
    await B.sync();
    assert.deepEqual(B.magasin.lire().eleves.map((e) => e.id), ['reel']);
  });

  it('partent normalement vers le nuage simulé', async () => {
    const nuage = new NuageSimule();
    const A = await appareil(nuage, 'demonstration', false);
    await A.magasin.ajouterEleves([eleve('demo-alpha')]);
    assert.equal((await A.sync()).envoyes, 1);
  });

  it('s’effacent seules, avec leur agenda', async () => {
    const A = await appareil(new NuageSimule());
    await A.magasin.ajouterEleves([eleve('demo-alpha'), eleve('reel')]);
    await A.magasin.enregistrerSeance(seance({ id: 'demo-s1', eleveId: 'demo-alpha' }));
    await A.magasin.enregistrerSeance(seance({ id: 'reelle', eleveId: 'reel' }));
    await A.magasin.changerAgenda({ enregistrer: [creer({ id: 'demo-a1', type: 'collaboration', date: '2026-10-26', debut: 0, fin: 0 }), creer({ id: 'vraie', type: 'libre', date: '2026-10-26', debut: 1, fin: 1 })], supprimer: [] });
    const bilan = await A.magasin.effacerDemo();
    assert.deepEqual(bilan, { eleves: 1, seances: 1, activites: 1, pias: 0 });
    const e = A.magasin.lire();
    assert.deepEqual([e.eleves.map((x) => x.id), e.seances.map((x) => x.id), e.activites.map((x) => x.id)], [['reel'], ['reelle'], ['vraie']]);
  });
});
