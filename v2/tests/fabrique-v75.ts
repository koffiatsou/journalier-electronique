import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { RangeeV75, StockageV75, MagasinV75 } from '../src/domain/v75/lecture.ts';
import type { EtatV75 } from '../src/domain/v75/types.ts';

/*
 * Données « comme la V75 les écrivait » (formes relevées dans src/app/sessions-core.js, agenda-core.js, students-core.js
 * et pia-lifecycle-engine.js) et coffre « comme la V75 le chiffre » : on exécute les vraies fonctions de chiffrement de la V75
 * (src/app/storage-vault.js) au lieu de les recopier, pour que ce test casse si le format de la V75 change.
 */

export const CHEMIN_V75 = fileURLToPath(new URL('../../src/app/storage-vault.js', import.meta.url));

/** Texte complet d'une fonction du fichier de la V75 (accolades équilibrées). */
function extraireFonction(source: string, nom: string): string {
  const debut = source.search(new RegExp(`(async\\s+)?function\\s+${nom}\\s*\\(`));
  if (debut < 0) throw new Error(`fonction ${nom} introuvable dans storage-vault.js`);
  const ouvrante = source.indexOf('{', source.indexOf(')', debut));
  let profondeur = 0;
  for (let i = ouvrante; i < source.length; i++) {
    if (source[i] === '{') profondeur += 1;
    else if (source[i] === '}') { profondeur -= 1; if (profondeur === 0) return source.slice(debut, i + 1); }
  }
  throw new Error(`fonction ${nom} mal fermée`);
}

export interface ChiffrementV75 {
  chiffrer(compte: string, type: string, id: string, valeur: unknown, cle: CryptoKey): Promise<RangeeV75 & { storageKey: string }>;
}

/** Les vraies fonctions de la V75, chargées depuis son fichier. */
export function chiffrementV75(): ChiffrementV75 {
  const source = readFileSync(CHEMIN_V75, 'utf8');
  const noms = ['journalierAad', 'journalierCanonicalJson', 'journalierDigestBuffer', 'journalierEncryptRecord'];
  const corps = `const JOURNALIER_STORAGE_SCHEMA_VERSION = 2;\n${noms.map((n) => extraireFonction(source, n)).join('\n')}\nreturn journalierEncryptRecord;`;
  const chiffrer = new Function('crypto', 'TextEncoder', corps)(globalThis.crypto, TextEncoder) as ChiffrementV75['chiffrer'];
  return { chiffrer };
}

export const COMPTE = 'hash-compte-v75-1';

export interface CoffreFabrique { stockage: StockageV75; cle: CryptoKey; rangees: Record<MagasinV75, RangeeV75[]> }

/** Un coffre V75 complet en mémoire : tout est chiffré par les fonctions de la V75. */
export async function coffreV75(etat: EtatV75, options: { compte?: string; migration?: string; abimer?: (r: RangeeV75, magasin: MagasinV75) => boolean } = {}): Promise<CoffreFabrique> {
  const compte = options.compte ?? COMPTE;
  const { chiffrer } = chiffrementV75();
  const cle = await crypto.subtle.generateKey({ name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']);
  const rangees: Record<MagasinV75, RangeeV75[]> = { meta: [], students: [], sessions: [], agenda: [], pia: [] };
  const ranger = async (magasin: MagasinV75, type: string, id: string, valeur: unknown): Promise<void> => {
    const r = await chiffrer(compte, type, id, valeur, cle);
    if (options.abimer?.(r, magasin)) r.ciphertext = new Uint8Array(r.ciphertext as ArrayBuffer).map((o, i) => (i === 0 ? o ^ 255 : o)).buffer;
    rangees[magasin].push(r);
  };
  await ranger('meta', 'meta', compte, { ownerId: compte, migrationStatus: options.migration ?? 'complete', identity: { displayName: 'Agent Test', microsoftAccount: 'agent.test@exemple.be' }, meta: {} });
  for (const e of etat.eleves) await ranger('students', 'student', String((e as { studentId: string }).studentId), e);
  for (const s of etat.seances) await ranger('sessions', 'session', String((s as { id: string | number }).id), s);
  const agenda = (etat.agenda ?? {}) as { __events?: { eventId: string }[]; __exceptions?: unknown; __config?: unknown };
  for (const ev of agenda.__events ?? []) await ranger('agenda', 'agenda', ev.eventId, ev);
  await ranger('agenda', 'agenda', '__config', agenda.__config ?? {});
  await ranger('agenda', 'agenda', '__exceptions', agenda.__exceptions ?? {});
  for (const [id, p] of Object.entries(etat.pias)) await ranger('pia', 'pia', id, { record: p.record, imported: p.imported });
  const stockage: StockageV75 = {
    existe: async () => true,
    rangees: async (m) => rangees[m],
    cles: async () => [{ compte, cle }]
  };
  return { stockage, cle, rangees };
}

/* ───────── Contenu ───────── */

const meta = (jour: string) => ({ createdAt: `${jour}T09:00:00.000Z`, updatedAt: `${jour}T09:30:00.000Z`, source: 'journalier-v72' });

export function seanceV75(id: number | string, surcharge: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    id, schemaVersion: '72.2-secure-appfolder-test', type: 'SEANCE', ownerId: 'hash', dataVersion: '72.2-secure-appfolder-test',
    identification: { eleve: 'Séfora', eleveId: '1001', date: '2026-09-22', periode: { start: '2e H', end: '2e H' } },
    contexte: { matiere: 'Mathématiques', niveau: 'S3', forme: 'Général (G)', typeIntervention: ['Accompagnement individuel'], presenceStatus: 'present', classNotes: '' },
    objectif: { objectifLecon: 'Résoudre une équation', objectifProfessionnel: 'Aider à isoler l’inconnue' },
    q2: { observations: [{ categorie: 'Réalisation', observation: 'Contrôle sa production', niveau: 1 }, { categorie: 'Rapport à l’aide / engagement', observation: 'Demande de l’aide', niveau: 2 }], precision: 'Fatigue en fin de période' },
    q3: { repereWBE: { signature: '', hit: '', kind: '', bridgeId: '', indicatorIds: [], source: '' }, indicateurs: [{ id: 'MATH-12', texte: 'Résoudre une équation du premier degré', source: 'bibliotheque', appreciation: 1 }], precision: '' },
    q4: { situation: 'new', types: ['Support visuel', 'Guidage verbal'], effets: { 'Support visuel': 2, 'Guidage verbal': 1 }, precision: 'Schéma de la balance' },
    q5: { statut: 'observed', precision: '' },
    q6: { actions: ['Maintenir l’accompagnement'], modalite: 'Individuel', objectif: 'Consolider', collaborations: ['Échange avec l’enseignant'], precision: '' },
    metadata: meta('2026-09-22'),
    ...surcharge
  };
}

export function evenementV75(eventId: string, surcharge: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    eventId, seriesId: eventId, recurrence: 'unique', type: 'ELEVE', eleve: 'Séfora', eleveId: '1001', matiere: 'Mathématiques', title: '', detail: '', local: 'Local 12',
    dayIndex: 1, date: '2026-10-27', startPeriod: '2e H', endPeriod: '3e H', eventStatus: 'proposed', realized: false, timezone: 'Europe/Brussels',
    createdAt: '2026-09-01T08:00:00.000Z', updatedAt: '2026-09-01T08:00:00.000Z', ...surcharge
  };
}

export const CONFIG_V75 = {
  version: 2,
  periods: [
    { id: 'p1', label: '1e H', start: '08:15', end: '09:05' }, { id: 'p2', label: '2e H', start: '09:05', end: '09:55' },
    { id: 'p3', label: '3e H', start: '09:55', end: '10:45' }, { id: 'p4', label: '4e H', start: '11:00', end: '11:50' },
    { id: 'p5', label: '5e H', start: '11:50', end: '12:40' }, { id: 'p6', label: '6e H', start: '13:30', end: '14:20' },
    { id: 'p7', label: '7e H', start: '14:20', end: '15:10' }, { id: 'p8', label: '8e H', start: '15:10', end: '16:00' }
  ]
};

/** Une V75 réaliste : deux élèves, des séances de toutes sortes (dont des cas abîmés), un agenda varié, un PIA. */
export function etatV75(): EtatV75 {
  return {
    eleves: [
      {
        id: 1001, studentId: '1001', nom: 'Séfora', classe: '3CB', ecole: 'Athénée Royal', matieres: ['Mathématiques', 'Français', 'néerlandais'],
        pia: 'Gagner en autonomie\nLire à voix haute', dateNaissance: '2012-03-04', titulaire: 'M. Dupont', option: 'Sciences',
        coordonneesCpms: 'CPMS Bruxelles 02 555 12 34', representantPole: 'Pôle Territorial WBE BXL', responsable: 'Mme Martin', coordonneesResponsable: '0470 00 00 00',
        administrativeInfo: { nom: 'Séfora', dateNaissance: '2012-03-04', classe: '3CB' }, ownerId: 'hash', dataVersion: 'x'
      },
      { id: 1002, studentId: 'student_1002', nom: 'Nicoleta', classe: '5P', ecole: '', matieres: ['Sciences économiques'], ownerId: 'hash', dataVersion: 'x' }
    ],
    seances: [
      seanceV75(5001),
      seanceV75('sess_abc', {
        identification: { eleve: 'Nicoleta', eleveId: 'student_1002', date: '2026-09-23', periode: { start: '1e H', end: '2e H' } },
        contexte: { matiere: 'Sciences économiques', niveau: 'S5', forme: 'Professionnel (P)', typeIntervention: ['Coenseignement'], presenceStatus: 'present', classNotes: '' },
        q5: { statut: 'no_opportunity', precision: 'Pas de cours de français cette semaine' }
      }),
      seanceV75(5003, {
        identification: { eleve: 'séfora', date: '2026-09-24', periode: { start: '1e H', end: '1e H' } },
        contexte: { matiere: 'Français', niveau: 'S3', forme: 'Général (G)', typeIntervention: [], presenceStatus: 'absent_eleve', classNotes: '' },
        objectif: { objectifLecon: 'Élève absent — Séance non tenue', objectifProfessionnel: '' },
        q2: { observations: [], precision: '' }, q3: { indicateurs: [], precision: '' }, q4: { situation: 'none', types: [], effets: {}, precision: '' }, q5: { statut: '', precision: '' }
      }),
      seanceV75(5004, { identification: { eleve: 'Inconnu', eleveId: '999', date: '2026-09-25', periode: { start: '1e H', end: '1e H' } } }),
      seanceV75(5005, { identification: { eleve: 'Séfora', eleveId: '1001', date: 'hier', periode: { start: '1e H', end: '1e H' } } }),
      seanceV75(5006, { identification: { eleve: 'Séfora', eleveId: '1001', date: '2026-10-01', periode: { start: 'Période A', end: 'Période A' } } })
    ],
    agenda: {
      __config: CONFIG_V75,
      __exceptions: { serie_lundi: ['2026-11-02', '2026-11-09'] },
      __events: [
        evenementV75('evt_unique', { eventStatus: 'cancelled' }),
        evenementV75('serie_lundi', { recurrence: 'weekly', dayIndex: 0, date: '', startPeriod: '1e H', endPeriod: '1e H', recurrenceRange: { type: 'endDate', startDate: '2026-09-07', endDate: '2027-01-29' } }),
        evenementV75('deux_jours', { recurrence: 'weekly', title: 'Remédiation', recurrencePattern: { type: 'weekly', interval: 1, daysOfWeek: [1, 3] }, recurrenceRange: { type: 'endDate', startDate: '2026-10-05', endDate: '2026-10-23' }, dayIndex: 1, date: '' }),
        evenementV75('quinzaine', { recurrence: 'weekly', type: 'COLLAB', eleve: '', eleveId: '', title: 'Réunion d’équipe', recurrencePattern: { type: 'weekly', interval: 2, daysOfWeek: [2] }, recurrenceRange: { type: 'noEnd', startDate: '2026-10-07' }, dayIndex: 2, date: '' }),
        evenementV75('samedi', { recurrence: 'weekly', type: 'FORMATION', eleve: '', eleveId: '', dayIndex: 5, date: '', title: 'Formation' }),
        evenementV75('libre', { type: 'ELEVE', eleve: 'Quelqu’un', eleveId: '', date: '2026-11-03', startPeriod: '8e H', endPeriod: '8e H' })
      ]
    },
    pias: {
      '1001': {
        record: {
          schemaVersion: '73.0.0', type: 'PIA_ANNUEL', id: 'pia_1', studentId: '1001', schoolYear: '2026-2027',
          meeting1: { date: '2026-12-10', objectivesValidated: [{ formulation: 'Lire un texte court à voix haute' }, 'Utiliser un schéma'], decisions: 'Poursuivre en mathématiques', participants: { eleve: true, parents: false } },
          meeting2: { evaluation: [{ objectif: 'Utiliser un schéma', state: 'ATTEINT', note: 'Régulier' }] },
          amenagements: [{ type: 'M', texte: 'Tablette pour la lecture', effetDocumente: 'Positif', suitePrevue: 'Continuer' }]
        },
        imported: null
      }
    }
  };
}

/* ───────── OneDrive de la V75 ───────── */

const sansAccent = (s: string): string => s.trim().toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '');

/**
 * Dépose dans le faux OneDrive ce que la V75 y envoie (src/app/microsoft-core.js : `v72PathForStudent`, `v72PathForSession`,
 * `v72SyncAgenda`, `v74SavePIACloud`) : eleves/<id>/profil.json, eleves/<id>/seances/<id>.json, agenda/agenda.json, pia/<id>/pia.json.
 */
export function deposerEtatV75(faux: { deposerV75(chemin: string, contenu: unknown): void }, etat: EtatV75): void {
  const eleves = etat.eleves as { studentId: string; nom: string }[];
  for (const e of eleves) faux.deposerV75(`eleves/${e.studentId}/profil.json`, e);
  for (const s of etat.seances as { id: string | number; identification?: { eleveId?: string; eleve?: string } }[]) {
    const par_nom = eleves.find((e) => sansAccent(e.nom) === sansAccent(s.identification?.eleve ?? ''));
    const eleveId = s.identification?.eleveId || par_nom?.studentId;
    if (eleveId) faux.deposerV75(`eleves/${eleveId}/seances/${s.id}.json`, s);
  }
  faux.deposerV75('agenda/agenda.json', etat.agenda);
  for (const [id, p] of Object.entries(etat.pias)) faux.deposerV75(`pia/${id}/pia.json`, p.record ?? { sourceContinuity: p.imported });
}
