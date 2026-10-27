import { z } from 'zod';

/*
 * Ce que Microsoft nous répond, vérifié avant usage (lot Q). Jusqu'ici ces réponses étaient converties d'office
 * (« as ») : une réponse inattendue (changement chez Microsoft, page d'erreur, proxy d'entreprise) donnait des
 * « undefined » plus loin, loin de la cause. Maintenant elle s'arrête ici, avec un message clair.
 * On ne rejette pas ce qui est simplement en plus : seuls les champs utilisés sont vérifiés.
 */

/** Microsoft met parfois `null` à la place d'un champ absent. */
const facultatif = <T extends z.ZodTypeAny>(s: T) => s.nullish();

/** Une page de liste Graph : les éléments (`value`) et l'adresse de la page suivante. */
export function schemaPage<T extends z.ZodTypeAny>(element: T) {
  return z.object({ value: z.array(element).optional(), '@odata.nextLink': z.string().optional() });
}

/** Un fichier ou un dossier de OneDrive. */
export const schemaElementDrive = z.object({
  id: z.string().min(1),
  name: z.string(),
  eTag: facultatif(z.string()),
  file: facultatif(z.object({}).passthrough()),
  folder: facultatif(z.object({}).passthrough())
});
export type ElementDrive = z.infer<typeof schemaElementDrive>;

/** Réponse à la demande de l'adresse de téléchargement d'un fichier. */
export const schemaMetaFichier = z.object({ '@microsoft.graph.downloadUrl': facultatif(z.string()) });

/** Réponse à l'écriture d'un fichier. */
export const schemaFichierEcrit = z.object({ id: z.string().min(1), eTag: z.string().min(1) });

export const schemaCalendrier = z.object({ id: z.string().min(1), name: z.string() });

export const schemaEvenement = z.object({
  id: z.string().min(1),
  subject: facultatif(z.string()),
  start: facultatif(z.object({ dateTime: facultatif(z.string()) })),
  end: facultatif(z.object({ dateTime: facultatif(z.string()) })),
  location: facultatif(z.object({ displayName: facultatif(z.string()) })),
  body: facultatif(z.object({ content: facultatif(z.string()) }))
});
export type EvenementGraph = z.infer<typeof schemaEvenement>;

/** Corps d'une erreur Graph : seul le code nous intéresse (pour le message). */
export const schemaErreurGraph = z.object({ error: z.object({ code: z.string().optional() }).optional() });

/* ───────── Connexion ───────── */

/** Réponse du point d'accès aux jetons (le temps de validité est parfois donné sous forme de texte). */
export const schemaReponseJeton = z.object({
  access_token: z.string().optional(),
  refresh_token: z.string().optional(),
  id_token: z.string().optional(),
  expires_in: z.coerce.number().optional(),
  scope: z.string().optional(),
  error: z.string().optional(),
  error_description: z.string().optional()
});
export type ReponseJeton = z.infer<typeof schemaReponseJeton>;

/** Ce qu'on lit dans le jeton d'identité : un champ du mauvais type est traité comme absent. */
const texteOuRien = z.string().optional().catch(undefined);
export const schemaChargeIdentite = z.object({
  nonce: z.unknown(),
  oid: texteOuRien,
  sub: texteOuRien,
  preferred_username: texteOuRien,
  email: texteOuRien,
  name: texteOuRien
});

/** Session gardée dans le stockage de l'onglet. */
export const schemaSession = z.object({
  compte: z.object({ id: z.string().min(1), nom: z.string().catch(''), courriel: z.string().catch('') }),
  refresh: z.string(),
  droits: z.array(z.string()),
  acces: z.record(z.string(), z.object({ jeton: z.string(), expireLe: z.number() })).catch({})
});
