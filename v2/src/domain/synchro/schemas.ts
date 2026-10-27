import { z } from 'zod';
import { TYPES_OBJETS } from './cles.ts';

/*
 * Schémas de vérification (zod) des données qui viennent de l'extérieur : un fichier OneDrive, une copie de secours,
 * une séance ou une activité reçue. Règles du lot Q :
 *  - les messages d'erreur montrés à l'utilisateur ne changent pas (ils sont portés par le schéma, dans le même ordre
 *    qu'avant : le premier problème trouvé est celui qu'on affiche) ;
 *  - on ne refuse jamais une donnée qui était lisible : un champ facultatif n'est vérifié que s'il est présent, et les
 *    champs inconnus sont gardés tels quels (`passthrough`), pour qu'une donnée plus riche ne perde rien ;
 *  - on vérifie, on ne transforme pas : les objets valides sont rendus tels qu'ils sont arrivés.
 */

/* ───────── Fichier OneDrive (enveloppe) ───────── */

export const VERSION_ENVELOPPE_MAX = 1;
const MOTIF_ENVELOPPE = /^journalier-v2\/(\d+)$/;
const M_ETRANGER = 'Ce fichier n’a pas été écrit par le Journalier V2.';

export const schemaEnveloppe = z.object({
  schema: z.string({ message: M_ETRANGER }).regex(MOTIF_ENVELOPPE, M_ETRANGER).refine((s) => {
    const m = MOTIF_ENVELOPPE.exec(s);
    return !m || Number(m[1]) <= VERSION_ENVELOPPE_MAX;
  }, 'Ce fichier vient d’une version plus récente de l’application : mettez-la à jour.'),
  type: z.string({ message: 'Type d’objet inconnu.' }).refine((t) => (TYPES_OBJETS as readonly string[]).includes(t), 'Type d’objet inconnu.'),
  id: z.string({ message: 'Identifiant manquant.' }).min(1, 'Identifiant manquant.'),
  enregistreLe: z.string().catch(''),
  donnees: z.custom<object>((v) => typeof v === 'object' && v !== null, 'Contenu manquant.')
}, { message: 'Fichier inattendu.' });

/* ───────── Copie de secours ───────── */

export const VERSION_COPIE_MAX = 1;
const MOTIF_COPIE = /^journalier-v2-copie\/(\d+)$/;
const M_COPIE_ETRANGERE = 'Ce fichier n’est pas une copie du Journalier V2.';
const M_COPIE_ABIMEE = 'La copie est incomplète ou abîmée.';

/** Une section de la copie : une liste d'objets qui ont au moins un identifiant (le détail est vérifié objet par objet à la restauration). */
const sectionCopie = z.array(z.object({ id: z.string({ message: M_COPIE_ABIMEE }) }, { message: M_COPIE_ABIMEE }).passthrough(), { message: M_COPIE_ABIMEE });

export const schemaCopie = z.object({
  schema: z.string({ message: M_COPIE_ETRANGERE }).regex(MOTIF_COPIE, M_COPIE_ETRANGERE).refine((s) => {
    const m = MOTIF_COPIE.exec(s);
    return !m || Number(m[1]) <= VERSION_COPIE_MAX;
  }, 'Cette copie vient d’une version plus récente de l’application : mettez-la à jour.'),
  creeLe: z.string().catch(''),
  eleves: sectionCopie,
  seances: sectionCopie,
  activites: sectionCopie,
  pias: sectionCopie,
  reglages: sectionCopie
}, { message: 'Ce fichier n’est pas une copie du Journalier.' });

/* ───────── Objets synchronisés ───────── */

const identifiant = z.string().min(1);
/** AAAA-MM-JJ (le format de toutes les dates enregistrées par l'application). */
const jour = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const liste = z.array(z.unknown());

export const schemaEleve = z.object({ id: identifiant, nom: z.string(), prenom: z.string() }).passthrough();

/** Séance : ce que le code lit sans précaution (identité, date, observations) est obligatoire ; le reste est vérifié s'il est présent. */
export const schemaSeance = z.object({
  id: identifiant,
  eleveId: identifiant,
  date: jour,
  observations: liste,
  competences: liste.optional(),
  aides: liste.optional(),
  interventions: liste.optional(),
  matiere: z.string().optional(),
  presence: z.string().optional(),
  suite: z.object({}).passthrough().optional()
}).passthrough();

export const TYPES_ACTIVITE = ['eleve', 'collaboration', 'formation', 'administratif', 'libre'] as const;

/** Activité d'agenda : périodes = numéros entiers (0 = première heure) ; dates au format AAAA-MM-JJ. */
export const schemaActivite = z.object({
  id: identifiant,
  type: z.enum(TYPES_ACTIVITE),
  date: jour,
  debut: z.number().int().nonnegative(),
  fin: z.number().int().nonnegative(),
  titre: z.string().optional(),
  repetition: z.enum(['aucune', 'hebdomadaire']).optional(),
  jusquau: jour.optional(),
  exceptions: z.array(jour).optional(),
  etats: z.record(jour, z.enum(['prevu', 'realise', 'annule'])).optional(),
  couleur: z.number().int().min(0).max(9).optional()
}).passthrough();

/** Vérifie un objet sans le transformer : `true` s'il respecte le schéma. */
export const respecte = (schema: z.ZodType, valeur: unknown): boolean => schema.safeParse(valeur).success;
