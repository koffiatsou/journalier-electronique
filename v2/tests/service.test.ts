import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { creerDepotMemoire } from '../src/data/memoire.ts';
import { exempleDemo } from '../src/data/demo.ts';
import { creerMagasin } from '../src/state/store.ts';
import { Connexion } from '../src/synchro/connexion.ts';
import type { MessageRetour, Stockage } from '../src/synchro/connexion.ts';
import { NuageSimule } from '../src/synchro/simule.ts';
import { creerSynchro, resume } from '../src/synchro/service.ts';
import type { ResultatSynchro } from '../src/synchro/synchroniser.ts';
import { FauxMicrosoft } from './fauxMicrosoft.ts';

const JOUR = '2026-10-26';
const memoire = (): Stockage => { const m = new Map<string, string>(); return { getItem: (k) => m.get(k) ?? null, setItem: (k, v) => { m.set(k, v); }, removeItem: (k) => { m.delete(k); } }; };

async function monter(nuageMicrosoft?: () => NuageSimule, faux = new FauxMicrosoft()) {
  const depot = creerDepotMemoire();
  const magasin = creerMagasin(depot);
  await magasin.charger();
  const demo = new NuageSimule(null, () => JOUR);
  let auditeurs: ((m: MessageRetour) => void)[] = [];
  const connexion = new Connexion({
    config: { clientId: 'c', tenantId: 't', adresseRetour: 'https://exemple.test/v2/msal-redirect.html' }, stockage: memoire(), fetchFn: (...a) => faux.fetch(...a),
    ecouterRetour: (r) => { auditeurs.push(r); return () => { auditeurs = auditeurs.filter((x) => x !== r); }; },
    ouvrirFenetre: (adresse) => { setTimeout(() => { const h = new URL(faux.autoriser(adresse)).hash; auditeurs.forEach((a) => a({ type: 'retour', hash: h, search: '' })); }, 0); return { fermer: () => undefined }; }
  });
  const synchro = creerSynchro({ magasin, depot, connexion, demo, preferences: memoire(), aujourdhui: () => JOUR, maintenant: () => `${JOUR}T10:00:00.000Z`, delaiAutoMs: 20, nuageMicrosoft, calendrierMicrosoft: nuageMicrosoft });
  await synchro.demarrer();
  return { magasin, synchro, demo, depot };
}

describe('résumé en français simple', () => {
  const base: ResultatSynchro = { le: '', envoyes: 0, recus: 0, supprimesIci: 0, supprimesLa: 0, conflits: [], ignores: [], erreurs: [], aRelancer: false };
  it('rien à faire', () => assert.equal(resume(base), 'Tout est à jour.'));
  it('envois et réceptions', () => assert.equal(resume({ ...base, envoyes: 2, recus: 1 }), 'Synchronisation terminée : 2 envoyés vers OneDrive ; 1 reçu de OneDrive.'));
});

describe('service de synchronisation, mode démonstration', () => {
  it('envoie les données de démonstration au faux OneDrive, puis ne renvoie rien', async () => {
    const { magasin, synchro, demo } = await monter();
    await magasin.chargerExemple(exempleDemo(JOUR));
    synchro.utiliserDemonstration();
    assert.equal(synchro.lire().mode, 'demonstration');
    await synchro.synchroniser();
    assert.ok(synchro.lire().derniere!.envoyes > 10);
    assert.ok(demo.resume().fichiers > 10);
    await synchro.synchroniser();
    assert.equal(synchro.lire().derniere!.envoyes, 0);
    assert.equal(synchro.lire().message?.texte, 'Tout est à jour.');
  });

  it('reçoit une modification faite sur un autre appareil, et propose un conflit si on a aussi modifié ici', async () => {
    const { magasin, synchro } = await monter();
    await magasin.chargerExemple(exempleDemo(JOUR));
    synchro.utiliserDemonstration();
    await synchro.synchroniser();
    assert.ok(synchro.modifierAilleurs());
    await synchro.synchroniser();
    assert.equal(synchro.lire().derniere!.recus, 1);
    assert.ok(magasin.lire().seances.some((s) => s.remarque.includes('autre appareil')));
    // Même séance modifiée des deux côtés.
    synchro.modifierAilleurs();
    const s = magasin.lire().seances.find((x) => x.remarque.includes('autre appareil'))!;
    const cible = magasin.lire().seances.find((x) => !x.remarque.includes('autre appareil') && x.eleveId === s.eleveId)!;
    await magasin.enregistrerSeance({ ...cible, remarque: 'changé ici', modifieLe: `${JOUR}T11:00:00.000Z` });
    await synchro.synchroniser();
    const conflits = synchro.lire().conflits;
    if (conflits.length) {
      await synchro.resoudre(conflits[0]!, 'ici');
      assert.equal(synchro.lire().conflits.length, 0);
    }
  });

  it('une suppression ailleurs est demandée, jamais appliquée seule', async () => {
    const { magasin, synchro } = await monter();
    await magasin.chargerExemple(exempleDemo(JOUR));
    synchro.utiliserDemonstration();
    await synchro.synchroniser();
    const avant = magasin.lire().seances.length;
    assert.ok(synchro.supprimerAilleurs());
    await synchro.synchroniser();
    assert.ok(magasin.lire().seances.length <= avant);
    assert.equal(synchro.lire().message?.genre === 'erreur', false);
  });

  it('envoie l’agenda vers Outlook (faux), le met à jour, puis retire le calendrier', async () => {
    const { magasin, synchro, demo } = await monter();
    await magasin.chargerExemple(exempleDemo(JOUR));
    synchro.utiliserDemonstration();
    await synchro.activerOutlook();
    assert.equal(synchro.lire().outlook.actif, true);
    assert.ok(synchro.lire().dernierOutlook!.crees > 10);
    const apres = demo.resume().evenements;
    await synchro.envoyerVersOutlook();
    assert.equal(synchro.lire().dernierOutlook!.crees, 0);
    assert.equal(demo.resume().evenements, apres);
    await synchro.retirerOutlook();
    assert.equal(synchro.lire().outlook.actif, false);
  });

  it('envoi automatique après un moment de calme', async () => {
    const { magasin, synchro, demo } = await monter();
    synchro.utiliserDemonstration();
    await magasin.chargerExemple(exempleDemo(JOUR));
    await new Promise((r) => setTimeout(r, 150));
    assert.ok(demo.resume().fichiers > 10);
  });

  it('se déconnecter garde les données ici', async () => {
    const { magasin, synchro } = await monter();
    await magasin.chargerExemple(exempleDemo(JOUR));
    synchro.utiliserDemonstration();
    synchro.deconnecter();
    assert.equal(synchro.lire().mode, 'aucun');
    assert.ok(magasin.lire().eleves.length === 2);
  });
});

describe('service de synchronisation, compte Microsoft', () => {
  it('se connecte, n’envoie jamais la démonstration, et envoie les vraies données', async () => {
    const reel = new NuageSimule(null, () => JOUR);
    const { magasin, synchro } = await monter(() => reel);
    await magasin.chargerExemple(exempleDemo(JOUR));
    await magasin.ajouterEleves([{ id: 'e-vrai', nom: 'Réel', prenom: 'Léo', classe: '2A', ecole: 'X', titulaire: '', dateNaissance: '', matieres: [] }]);
    await synchro.connecter();
    assert.equal(synchro.lire().mode, 'microsoft');
    assert.equal(synchro.lire().compte?.nom, 'Agent Test');
    assert.equal(reel.resume().fichiers, 1, 'seul l’élève réel est parti');
    synchro.deconnecter();
    assert.equal(synchro.lire().compte, null);
  });
});
