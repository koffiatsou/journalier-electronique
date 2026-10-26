import { descriptionEvenement, repereDans } from '../domain/synchro/outlook.ts';
import type { EvenementExistant, EvenementSouhaite } from '../domain/synchro/outlook.ts';
import { ajouterJours } from '../domain/agenda/dates.ts';
import { ErreurAcces, ErreurVersion } from './nuage.ts';
import type { CalendrierNuage, FichierDistant, Nuage } from './nuage.ts';

/*
 * Microsoft Graph : OneDrive (dossier privé de l'application) et calendrier Outlook.
 * Les fichiers sont dans « Applications/<nom de l'application>/v2/… » : jamais dans les dossiers de la V75.
 */

const BASE = 'https://graph.microsoft.com/v1.0';
const RACINE = '/me/drive/special/approot:/v2';
/** Brussels, en nom Windows (celui que Graph connaît sans doute possible). */
export const FUSEAU_OUTLOOK = 'Romance Standard Time';

export type Portee = 'fichiers' | 'calendrier';
export interface FournisseurJeton { jeton(portee: Portee): Promise<string> }

export interface OptionsGraph {
  jeton: FournisseurJeton;
  fetchFn?: typeof fetch;
  /** Pause entre deux essais quand Microsoft demande de ralentir (remplaçable dans les tests). */
  attendre?: (ms: number) => Promise<void>;
}

class Introuvable extends Error {}

const pause = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/** Les adresses de téléchargement pré-signées sont servies par OneDrive ou SharePoint, jamais ailleurs. */
export function adresseTelechargementSure(url: string): boolean {
  let u: URL;
  try { u = new URL(url); } catch { return false; }
  const h = u.hostname.toLowerCase();
  return u.protocol === 'https:' && (h === 'files.1drv.com' || h.endsWith('.files.1drv.com') || h === '1drv.com' || h.endsWith('.1drv.com') || h.endsWith('.sharepoint.com'));
}

function creerClient(o: OptionsGraph) {
  const f = o.fetchFn ?? ((...a: Parameters<typeof fetch>) => fetch(...a));
  const attendre = o.attendre ?? pause;

  async function requete(portee: Portee, adresse: string, init: RequestInit = {}, entetes: Record<string, string> = {}): Promise<Response> {
    for (let essai = 1; ; essai += 1) {
      const jeton = await o.jeton.jeton(portee);
      let reponse: Response;
      try {
        reponse = await f(adresse, { ...init, headers: { ...entetes, Authorization: `Bearer ${jeton}` } });
      } catch (e) {
        if (e instanceof ErreurAcces) throw e;
        throw new ErreurAcces('reseau', 'Pas de connexion à Microsoft. Vérifiez le réseau, puis réessayez.');
      }
      if (reponse.ok) return reponse;
      if ((reponse.status === 429 || reponse.status === 503 || reponse.status === 504) && essai < 4) {
        const demande = Number(reponse.headers.get('Retry-After'));
        await attendre(Math.min(10_000, (Number.isFinite(demande) && demande > 0 ? demande : essai) * 1000));
        continue;
      }
      if (reponse.status === 401) throw new ErreurAcces('non-connecte', 'La connexion Microsoft a expiré : reconnectez-vous.');
      if (reponse.status === 403) throw new ErreurAcces(portee === 'calendrier' ? 'consentement' : 'refuse', portee === 'calendrier' ? 'Microsoft n’autorise pas encore l’accès à Outlook pour cette application.' : 'Microsoft a refusé l’accès à OneDrive.');
      if (reponse.status === 404) throw new Introuvable();
      if (reponse.status === 409 || reponse.status === 412) throw new ErreurVersion();
      let code = '';
      try { code = ((await reponse.json()) as { error?: { code?: string } }).error?.code ?? ''; } catch { /* corps vide */ }
      throw new ErreurAcces('inconnue', `Microsoft a répondu ${reponse.status}${code ? ` (${code})` : ''}.`);
    }
  }

  /** Lit toutes les pages d'une liste Graph. */
  async function pages<T>(portee: Portee, premiere: string, entetes: Record<string, string> = {}): Promise<T[]> {
    const sortie: T[] = [];
    let suite: string | undefined = premiere;
    for (let n = 0; suite && n < 200; n += 1) {
      if (!suite.startsWith(`${BASE}/`)) throw new ErreurAcces('inconnue', 'Adresse de page inattendue.');
      const r: { value?: T[]; '@odata.nextLink'?: string } = await (await requete(portee, suite, {}, entetes)).json();
      sortie.push(...(r.value ?? []));
      suite = r['@odata.nextLink'];
    }
    return sortie;
  }

  return { requete, pages, fetchBrut: f };
}

interface ElementDrive { id: string; name: string; eTag?: string; file?: object }

export function creerNuageGraph(o: OptionsGraph): Nuage {
  const c = creerClient(o);
  return {
    nom: 'microsoft',

    async lister(dossier) {
      try {
        const items = await c.pages<ElementDrive>('fichiers', `${BASE}${RACINE}/${dossier}:/children?$select=id,name,eTag,file&$top=200`);
        return items.filter((i) => i.file && i.eTag).map((i): FichierDistant => ({ chemin: `${dossier}/${i.name}`, id: i.id, etag: i.eTag! }));
      } catch (e) {
        if (e instanceof Introuvable) return []; // le dossier n'existe pas encore
        throw e;
      }
    },

    async lire(fichier) {
      try {
        const meta = (await (await c.requete('fichiers', `${BASE}/me/drive/items/${encodeURIComponent(fichier.id)}?select=id,@microsoft.graph.downloadUrl`)).json()) as Record<string, unknown>;
        const adresse = meta['@microsoft.graph.downloadUrl'];
        if (typeof adresse !== 'string' || !adresseTelechargementSure(adresse)) throw new ErreurAcces('inconnue', 'Microsoft n’a pas donné d’adresse de téléchargement sûre.');
        // Adresse pré-signée : on n'y joint JAMAIS le jeton de connexion.
        let reponse: Response;
        try { reponse = await c.fetchBrut(adresse, { method: 'GET', cache: 'no-store', credentials: 'omit' }); } catch { throw new ErreurAcces('reseau', 'Pas de connexion à Microsoft. Vérifiez le réseau, puis réessayez.'); }
        if (reponse.status === 404) throw new Introuvable();
        if (!reponse.ok) throw new ErreurAcces('inconnue', `Téléchargement impossible (${reponse.status}).`);
        return await reponse.text();
      } catch (e) {
        if (e instanceof Introuvable) throw new ErreurVersion('Le fichier n’existe plus.');
        throw e;
      }
    },

    async ecrire(chemin, contenu, etagAttendu) {
      const adresse = `${BASE}${RACINE}/${chemin}:/content${etagAttendu ? '' : '?@microsoft.graph.conflictBehavior=fail'}`;
      try {
        const r = await c.requete('fichiers', adresse, { method: 'PUT', body: contenu }, { 'Content-Type': 'text/plain', ...(etagAttendu ? { 'If-Match': etagAttendu } : {}) });
        const item = (await r.json()) as ElementDrive;
        if (!item.id || !item.eTag) throw new ErreurAcces('inconnue', 'Réponse de Microsoft incomplète.');
        return { chemin, id: item.id, etag: item.eTag };
      } catch (e) {
        if (e instanceof Introuvable) throw new ErreurVersion('Le fichier n’existe plus.');
        throw e;
      }
    },

    async supprimer(fichier) {
      try {
        await c.requete('fichiers', `${BASE}/me/drive/items/${encodeURIComponent(fichier.id)}`, { method: 'DELETE' }, { 'If-Match': fichier.etag });
      } catch (e) {
        if (!(e instanceof Introuvable)) throw e; // déjà supprimé : tant mieux
      }
    }
  };
}

interface EvenementGraph {
  id: string;
  subject?: string;
  start?: { dateTime?: string };
  end?: { dateTime?: string };
  location?: { displayName?: string };
  body?: { content?: string };
}

const corps = (e: EvenementSouhaite) => ({
  subject: e.sujet,
  body: { contentType: 'text', content: descriptionEvenement(e.cle) },
  start: { dateTime: `${e.debut.slice(0, 16)}:00`, timeZone: FUSEAU_OUTLOOK },
  end: { dateTime: `${e.fin.slice(0, 16)}:00`, timeZone: FUSEAU_OUTLOOK },
  location: { displayName: e.lieu },
  isReminderOn: false
});

export function creerCalendrierGraph(o: OptionsGraph): CalendrierNuage {
  const c = creerClient(o);
  const json = { 'Content-Type': 'application/json' };
  return {
    async trouverOuCreer(nom) {
      const liste = await c.pages<{ id: string; name: string }>('calendrier', `${BASE}/me/calendars?$select=id,name&$top=100`);
      const trouve = liste.find((x) => x.name === nom);
      if (trouve) return trouve.id;
      const cree = (await (await c.requete('calendrier', `${BASE}/me/calendars`, { method: 'POST', body: JSON.stringify({ name: nom }) }, json)).json()) as { id: string };
      return cree.id;
    },

    async evenements(calendrier, du, au) {
      // Fenêtre élargie d'un jour de chaque côté (fuseaux), puis on ne garde que les dates demandées.
      const debut = `${ajouterJours(du, -1)}T00:00:00Z`;
      const fin = `${ajouterJours(au, 1)}T23:59:59Z`;
      const adresse = `${BASE}/me/calendars/${encodeURIComponent(calendrier)}/calendarView?startDateTime=${debut}&endDateTime=${fin}&$select=id,subject,start,end,location,body&$top=100`;
      const liste = await c.pages<EvenementGraph>('calendrier', adresse, { Prefer: `outlook.timezone="${FUSEAU_OUTLOOK}", outlook.body-content-type="text"` });
      return liste
        .map((e): EvenementExistant => ({
          id: e.id, cle: repereDans(e.body?.content ?? ''), sujet: e.subject ?? '',
          debut: (e.start?.dateTime ?? '').slice(0, 16), fin: (e.end?.dateTime ?? '').slice(0, 16), lieu: e.location?.displayName ?? ''
        }))
        .filter((e) => e.debut.slice(0, 10) >= du && e.debut.slice(0, 10) <= au);
    },

    async creer(calendrier, e) {
      await c.requete('calendrier', `${BASE}/me/calendars/${encodeURIComponent(calendrier)}/events`, { method: 'POST', body: JSON.stringify(corps(e)) }, json);
    },

    async modifier(calendrier, id, e) {
      await c.requete('calendrier', `${BASE}/me/calendars/${encodeURIComponent(calendrier)}/events/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(corps(e)) }, json);
    },

    async supprimerEvenement(calendrier, id) {
      try { await c.requete('calendrier', `${BASE}/me/calendars/${encodeURIComponent(calendrier)}/events/${encodeURIComponent(id)}`, { method: 'DELETE' }); } catch (e) { if (!(e instanceof Introuvable)) throw e; }
    },

    async supprimerCalendrier(calendrier) {
      try { await c.requete('calendrier', `${BASE}/me/calendars/${encodeURIComponent(calendrier)}`, { method: 'DELETE' }); } catch (e) { if (!(e instanceof Introuvable)) throw e; }
    }
  };
}
