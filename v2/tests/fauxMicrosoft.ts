/*
 * Faux Microsoft pour les tests : connexion (autorisation + jetons, avec vérification PKCE), OneDrive et calendrier Outlook de Graph.
 * Il imite assez fidèlement les règles qui comptent (versions de fichiers, If-Match, pagination, 401/403/404/412/429).
 * Utilisé par les tests automatiques ET par le parcours dans un vrai navigateur (tools/navigateur/synchro.mjs).
 */

interface FichierFaux { id: string; etag: string; contenu: string }
interface EvenementFaux { id: string; subject: string; start: string; end: string; lieu: string; description: string }

const base64url = (octets: Uint8Array): string => Buffer.from(octets).toString('base64url');
const json = (corps: unknown, statut = 200, entetes: Record<string, string> = {}): Response =>
  new Response(JSON.stringify(corps), { status: statut, headers: { 'Content-Type': 'application/json', ...entetes } });
const erreur = (statut: number, code: string): Response => json({ error: { code, message: code } }, statut);

export class FauxMicrosoft {
  fichiers = new Map<string, FichierFaux>();
  /** Données de la V75, à la RACINE du dossier de l'application (à côté de « v2 »), chemins relatifs : « eleves/abc/profil.json ». Lecture seule pour l'application. */
  fichiersV75 = new Map<string, FichierFaux>();
  calendriers = new Map<string, { nom: string; evenements: Map<string, EvenementFaux> }>();
  /** Journal des requêtes Graph reçues : « METHOD /chemin ». */
  journal: string[] = [];
  /** Nombre d'éléments par page (pour tester la pagination). */
  taillePage = 100;
  /** Les prochaines requêtes Graph recevront ce statut (429, 401…), puis tout redevient normal. */
  pannes: number[] = [];
  /** Vrai quand l'administrateur a autorisé l'accès à Outlook pour l'application. */
  calendrierAutorise = true;
  compte = { name: 'Agent Test', preferred_username: 'agent.test@pole.example', oid: 'oid-agent-1', tid: 'tenant-test' };
  private numero = 1;
  private codes = new Map<string, { defi: string; etat: string; scopes: string[]; redirection: string; nonce: string }>();
  private refresh = new Map<string, string[]>();
  private jetons = new Map<string, string[]>();

  private prochain(): number { const n = this.numero; this.numero += 1; return n; }

  /* ── Connexion ── */

  /** Ce que Microsoft ferait après la page de connexion : renvoie l'adresse de retour avec le code. */
  autoriser(adresse: string): string {
    const u = new URL(adresse);
    const p = u.searchParams;
    if (p.get('code_challenge_method') !== 'S256' || !p.get('code_challenge') || !p.get('state') || !p.get('redirect_uri')) throw new Error('Demande d’autorisation incomplète (PKCE).');
    const code = `code-${this.prochain()}`;
    this.codes.set(code, { defi: p.get('code_challenge')!, etat: p.get('state')!, scopes: (p.get('scope') ?? '').split(' '), redirection: p.get('redirect_uri')!, nonce: p.get('nonce') ?? '' });
    const retour = new URL(p.get('redirect_uri')!);
    const reponse = p.get('response_mode') === 'query' ? 'search' : 'hash';
    const params = new URLSearchParams({ code, state: p.get('state')! });
    if (reponse === 'hash') retour.hash = params.toString(); else retour.search = params.toString();
    return retour.toString();
  }

  private async jeton(corps: URLSearchParams): Promise<Response> {
    const type = corps.get('grant_type');
    let scopes: string[];
    let nonce = '';
    if (type === 'authorization_code') {
      const c = this.codes.get(corps.get('code') ?? '');
      if (!c) return json({ error: 'invalid_grant', error_description: 'code inconnu' }, 400);
      this.codes.delete(corps.get('code')!);
      const verificateur = corps.get('code_verifier') ?? '';
      const attendu = base64url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificateur))));
      if (attendu !== c.defi) return json({ error: 'invalid_grant', error_description: 'PKCE : le vérificateur ne correspond pas' }, 400);
      if (corps.get('redirect_uri') !== c.redirection) return json({ error: 'invalid_grant', error_description: 'redirect_uri différent' }, 400);
      scopes = c.scopes;
      nonce = c.nonce;
    } else if (type === 'refresh_token') {
      const accordes = this.refresh.get(corps.get('refresh_token') ?? '');
      if (!accordes) return json({ error: 'invalid_grant', error_description: 'jeton de renouvellement inconnu' }, 400);
      scopes = (corps.get('scope') ?? '').split(' ').filter(Boolean);
      const demandes = scopes.filter((s) => !['openid', 'profile', 'offline_access'].includes(s));
      if (demandes.some((s) => !accordes.includes(s))) return json({ error: 'invalid_grant', error_description: 'consent_required' }, 400);
    } else return json({ error: 'unsupported_grant_type' }, 400);

    if (scopes.includes('Calendars.ReadWrite') && !this.calendrierAutorise) return json({ error: 'invalid_grant', error_description: 'AADSTS65001: consent_required' }, 400);
    const acces = `acces-${this.prochain()}`;
    this.jetons.set(acces, scopes);
    const refresh = `refresh-${this.prochain()}`;
    const dejaAccordes = [...new Set([...(type === 'refresh_token' ? this.refresh.get(corps.get('refresh_token')!) ?? [] : []), ...scopes])];
    this.refresh.set(refresh, dejaAccordes);
    const entete = base64url(new TextEncoder().encode(JSON.stringify({ alg: 'none' })));
    const charge = base64url(new TextEncoder().encode(JSON.stringify({ ...this.compte, nonce })));
    return json({ token_type: 'Bearer', scope: scopes.join(' '), expires_in: 3600, access_token: acces, refresh_token: refresh, id_token: `${entete}.${charge}.x` });
  }

  /** Dépose un fichier JSON comme la V75 l'aurait envoyé dans OneDrive. */
  deposerV75(chemin: string, contenu: unknown): void {
    const n = this.prochain();
    this.fichiersV75.set(chemin, { id: `v75-item-${n}`, etag: `"{v75-${n}},1"`, contenu: typeof contenu === 'string' ? contenu : JSON.stringify(contenu) });
  }

  /** Invalide les jetons déjà donnés (comme une session expirée côté Microsoft). */
  expirerSessions(): void { this.jetons.clear(); this.refresh.clear(); }

  /* ── Réseau ── */

  async fetch(entree: string | URL | Request, init: RequestInit = {}): Promise<Response> {
    const requete = entree instanceof Request ? entree : null;
    const adresse = new URL(requete ? requete.url : String(entree));
    const methode = (init.method ?? requete?.method ?? 'GET').toUpperCase();
    const entetes = new Headers(init.headers ?? requete?.headers);
    const corps = init.body ?? (requete && methode !== 'GET' ? await requete.text() : undefined);

    if (adresse.hostname === 'login.microsoftonline.com' && adresse.pathname.endsWith('/oauth2/v2.0/token')) {
      return this.jeton(new URLSearchParams(String(corps ?? '')));
    }
    if (adresse.hostname === 'faux.sharepoint.com') {
      const f = [...this.fichiers.values(), ...this.fichiersV75.values()].find((x) => adresse.pathname === `/telecharger/${x.id}`);
      return f ? new Response(f.contenu, { status: 200 }) : new Response('', { status: 404 });
    }
    if (adresse.hostname !== 'graph.microsoft.com') return new Response('', { status: 404 });

    const chemin = decodeURIComponent(adresse.pathname.replace(/^\/v1\.0/, ''));
    this.journal.push(`${methode} ${chemin}`);
    const panne = this.pannes.shift();
    if (panne === 429) return erreur(429, 'activityLimitReached');
    if (panne) return erreur(panne, 'panneSimulee');
    const jeton = /^Bearer (.+)$/.exec(entetes.get('Authorization') ?? '')?.[1];
    const accordes = jeton ? this.jetons.get(jeton) : undefined;
    if (!accordes) return erreur(401, 'InvalidAuthenticationToken');
    const texte = typeof corps === 'string' ? corps : '';

    /* OneDrive : données de la V75, à la racine du dossier de l'application (lecture seule) ; « v2 » est à la V2 */
    const v75 = /^\/me\/drive\/special\/approot(?::\/((?!v2(?:\/|:|$))[^:]+):)?\/children$/.exec(chemin);
    if (v75) {
      if (methode !== 'GET') return erreur(405, 'methodNotAllowed');
      if (!accordes.includes('Files.ReadWrite.AppFolder')) return erreur(403, 'accessDenied');
      const prefixe = v75[1] ? `${v75[1]}/` : '';
      const enfants = new Map<string, { id: string; etag: string; dossier: boolean }>();
      for (const [c, f] of this.fichiersV75) {
        if (!c.startsWith(prefixe)) continue;
        const reste = c.slice(prefixe.length);
        const i = reste.indexOf('/');
        if (i < 0) enfants.set(reste, { id: f.id, etag: f.etag, dossier: false });
        else enfants.set(reste.slice(0, i), { id: `dossier-${prefixe}${reste.slice(0, i)}`, etag: '', dossier: true });
      }
      if (!enfants.size && prefixe) return erreur(404, 'itemNotFound'); // la racine, elle, existe toujours
      return this.page(adresse, [...enfants].map(([nom, e]) => e.dossier ? { id: e.id, name: nom, folder: {} } : { id: e.id, name: nom, eTag: e.etag, file: {} }));
    }

    /* OneDrive */
    let m = /^\/me\/drive\/special\/approot:\/v2\/([^/:]+):\/children$/.exec(chemin);
    if (m && methode === 'GET') {
      if (!accordes.includes('Files.ReadWrite.AppFolder')) return erreur(403, 'accessDenied');
      const dossier = m[1]!;
      const tous = [...this.fichiers].filter(([c]) => c.startsWith(`${dossier}/`)).map(([c, f]) => ({ id: f.id, name: c.slice(dossier.length + 1), eTag: f.etag, file: {} }));
      if (!tous.length && !this.fichiers.has(`__dossier/${dossier}`)) return erreur(404, 'itemNotFound');
      return this.page(adresse, tous);
    }
    m = /^\/me\/drive\/special\/approot:\/v2\/([^/:]+)\/([^/:]+):\/content$/.exec(chemin);
    if (m && methode === 'PUT') {
      if (!accordes.includes('Files.ReadWrite.AppFolder')) return erreur(403, 'accessDenied');
      const cle = `${m[1]}/${m[2]}`;
      const actuel = this.fichiers.get(cle);
      const attendu = entetes.get('If-Match');
      if (actuel) {
        if (!attendu) return erreur(409, 'nameAlreadyExists');
        if (attendu !== actuel.etag) return erreur(412, 'preconditionFailed');
      } else if (attendu) return erreur(404, 'itemNotFound');
      const n = this.prochain();
      const f: FichierFaux = { id: actuel?.id ?? `item-${n}`, etag: `"{${n}},1"`, contenu: texte };
      this.fichiers.set(cle, f);
      this.fichiers.set(`__dossier/${m[1]}`, { id: 'dossier', etag: '', contenu: '' });
      return json({ id: f.id, eTag: f.etag, name: m[2], file: {} }, actuel ? 200 : 201);
    }
    m = /^\/me\/drive\/items\/([^/]+)$/.exec(chemin);
    if (m) {
      const trouve = [...this.fichiers, ...this.fichiersV75].find(([c, f]) => !c.startsWith('__') && f.id === m![1]);
      if (methode === 'GET') {
        if (!trouve) return erreur(404, 'itemNotFound');
        return json({ id: trouve[1].id, '@microsoft.graph.downloadUrl': `https://faux.sharepoint.com/telecharger/${trouve[1].id}` });
      }
      if (methode === 'DELETE') {
        if (!trouve) return erreur(404, 'itemNotFound');
        if (entetes.get('If-Match') && entetes.get('If-Match') !== trouve[1].etag) return erreur(412, 'preconditionFailed');
        if (this.fichiersV75.has(trouve[0])) return erreur(405, 'methodNotAllowed');
        this.fichiers.delete(trouve[0]);
        return new Response(null, { status: 204 });
      }
    }

    /* Outlook */
    if (chemin.startsWith('/me/calendars')) {
      if (!accordes.includes('Calendars.ReadWrite')) return erreur(403, 'ErrorAccessDenied');
      if (chemin === '/me/calendars' && methode === 'GET') return this.page(adresse, [...this.calendriers].map(([id, c]) => ({ id, name: c.nom })));
      if (chemin === '/me/calendars' && methode === 'POST') {
        const id = `cal-${this.prochain()}`;
        this.calendriers.set(id, { nom: (JSON.parse(texte) as { name: string }).name, evenements: new Map() });
        return json({ id }, 201);
      }
      m = /^\/me\/calendars\/([^/]+)(?:\/(calendarView|events)(?:\/([^/]+))?)?$/.exec(chemin);
      if (!m) return erreur(404, 'ErrorInvalidRequest');
      const cal = this.calendriers.get(m[1]!);
      if (!cal) return erreur(404, 'ErrorItemNotFound');
      if (!m[2] && methode === 'DELETE') { this.calendriers.delete(m[1]!); return new Response(null, { status: 204 }); }
      if (m[2] === 'calendarView' && methode === 'GET') {
        const du = adresse.searchParams.get('startDateTime')!.slice(0, 10);
        const au = adresse.searchParams.get('endDateTime')!.slice(0, 10);
        const liste = [...cal.evenements.values()].filter((e) => e.start.slice(0, 10) >= du && e.start.slice(0, 10) <= au)
          .map((e) => ({ id: e.id, subject: e.subject, start: { dateTime: `${e.start}:00.0000000` }, end: { dateTime: `${e.end}:00.0000000` }, location: { displayName: e.lieu }, body: { contentType: 'text', content: e.description } }));
        return this.page(adresse, liste);
      }
      const lire = (): EvenementFaux => {
        const e = JSON.parse(texte) as { subject: string; start: { dateTime: string }; end: { dateTime: string }; location?: { displayName?: string }; body?: { content?: string } };
        return { id: '', subject: e.subject, start: e.start.dateTime.slice(0, 16), end: e.end.dateTime.slice(0, 16), lieu: e.location?.displayName ?? '', description: e.body?.content ?? '' };
      };
      if (m[2] === 'events' && !m[3] && methode === 'POST') {
        const e = lire(); e.id = `ev-${this.prochain()}`; cal.evenements.set(e.id, e);
        return json({ id: e.id }, 201);
      }
      if (m[2] === 'events' && m[3]) {
        const existant = cal.evenements.get(m[3]);
        if (!existant) return erreur(404, 'ErrorItemNotFound');
        if (methode === 'PATCH') { const e = lire(); e.id = existant.id; cal.evenements.set(e.id, e); return json({ id: e.id }); }
        if (methode === 'DELETE') { cal.evenements.delete(m[3]); return new Response(null, { status: 204 }); }
      }
    }
    return erreur(404, 'ErrorInvalidRequest');
  }

  private page(adresse: URL, tous: unknown[]): Response {
    const debut = Number(adresse.searchParams.get('$skiptoken') ?? 0);
    const tranche = tous.slice(debut, debut + this.taillePage);
    const suite = debut + this.taillePage < tous.length ? new URL(adresse.toString()) : null;
    suite?.searchParams.set('$skiptoken', String(debut + this.taillePage));
    return json({ value: tranche, ...(suite ? { '@odata.nextLink': suite.toString() } : {}) });
  }

  /** Fichiers du dossier de l'application, pour les vérifications. */
  chemins(): string[] { return [...this.fichiers.keys()].filter((c) => !c.startsWith('__')).sort(); }
}
