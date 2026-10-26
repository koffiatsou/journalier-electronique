import { ErreurAcces } from './nuage.ts';
import type { FournisseurJeton, Portee } from './graph.ts';

/*
 * Connexion à un compte Microsoft (Entra ID) : « code d'autorisation avec PKCE », la méthode recommandée pour une
 * application web sans serveur. La page de Microsoft s'ouvre dans une fenêtre ; au retour, on échange le code contre
 * des jetons. Aucun mot de passe ne passe par l'application. Les jetons restent dans l'onglet (sessionStorage) :
 * fermer le navigateur déconnecte.
 */

/**
 * Identifiants de l'application dans Entra ID : les mêmes que la V75 (ce sont des identifiants publics, pas des secrets).
 * L'adresse de retour de la V2 doit être ajoutée une fois à cette inscription (voir l'écran Synchronisation).
 */
export const IDENTIFIANTS_MICROSOFT = {
  clientId: '65c3db78-9bad-4a08-8eac-404b83e368cb',
  tenantId: '96c46ef2-21cc-480d-92df-0bf9fd599a97'
} as const;

export interface ConfigMicrosoft { clientId: string; tenantId: string; adresseRetour: string }

const DE_BASE = ['openid', 'profile', 'offline_access'] as const;
export const DROITS: Readonly<Record<Portee, string>> = { fichiers: 'Files.ReadWrite.AppFolder', calendrier: 'Calendars.ReadWrite' };
/** Nom du canal de diffusion entre la fenêtre de connexion et l'application. */
export const CANAL_RETOUR = 'journalier-microsoft';
const CLE_SESSION = 'journalier-microsoft-session';
const DELAI_FENETRE_MS = 5 * 60 * 1000;

export interface Compte { nom: string; courriel: string; id: string }

/* ───────── Outils purs (testés) ───────── */

const base64url = (octets: Uint8Array): string => btoa(String.fromCharCode(...octets)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export function aleatoire(octets = 32): string {
  return base64url(globalThis.crypto.getRandomValues(new Uint8Array(octets)));
}

/** Défi PKCE : SHA-256 du vérificateur, en base64url (RFC 7636). */
export async function defiPkce(verificateur: string): Promise<string> {
  return base64url(new Uint8Array(await globalThis.crypto.subtle.digest('SHA-256', new TextEncoder().encode(verificateur))));
}

export interface DemandeAutorisation { portees: readonly Portee[]; etat: string; nonce: string; defi: string; courriel?: string }

export function adresseAutorisation(config: ConfigMicrosoft, d: DemandeAutorisation): string {
  const scopes = [...DE_BASE, ...d.portees.map((p) => DROITS[p])];
  const p = new URLSearchParams({
    client_id: config.clientId, response_type: 'code', redirect_uri: config.adresseRetour, response_mode: 'fragment',
    scope: scopes.join(' '), state: d.etat, nonce: d.nonce, code_challenge: d.defi, code_challenge_method: 'S256'
  });
  if (d.courriel) p.set('login_hint', d.courriel); else p.set('prompt', 'select_account');
  return `https://login.microsoftonline.com/${encodeURIComponent(config.tenantId)}/oauth2/v2.0/authorize?${p}`;
}

export type RetourAutorisation = { code: string; etat: string } | { erreur: string; detail: string; etat: string };

/** Lit ce que Microsoft a ajouté à l'adresse de retour (après le « # » ou le « ? »). */
export function lireRetour(texte: string): RetourAutorisation | null {
  const p = new URLSearchParams(texte.replace(/^[#?]/, ''));
  const etat = p.get('state') ?? '';
  const erreur = p.get('error');
  if (erreur) return { erreur, detail: p.get('error_description') ?? '', etat };
  const code = p.get('code');
  return code && etat ? { code, etat } : null;
}

/** Nom, courriel et identifiant du compte, lus dans le jeton d'identité (reçu directement de Microsoft). */
export function lireCompte(jetonIdentite: string, nonceAttendu?: string): Compte | null {
  try {
    const charge = jetonIdentite.split('.')[1];
    if (!charge) return null;
    const binaire = atob(charge.replace(/-/g, '+').replace(/_/g, '/'));
    const c = JSON.parse(new TextDecoder().decode(Uint8Array.from(binaire, (x) => x.charCodeAt(0)))) as Record<string, unknown>;
    if (nonceAttendu !== undefined && c.nonce !== nonceAttendu) return null;
    const id = typeof c.oid === 'string' ? c.oid : typeof c.sub === 'string' ? c.sub : '';
    if (!id) return null;
    const courriel = typeof c.preferred_username === 'string' ? c.preferred_username : typeof c.email === 'string' ? c.email : '';
    return { id, nom: typeof c.name === 'string' && c.name ? c.name : courriel, courriel };
  } catch { return null; }
}

/* ───────── Connexion ───────── */

export interface Stockage { getItem(k: string): string | null; setItem(k: string, v: string): void; removeItem(k: string): void }
export interface MessageRetour { type: 'retour'; hash: string; search: string }
export interface FenetreConnexion { fermer(): void }

export interface DependancesConnexion {
  config: ConfigMicrosoft;
  stockage: Stockage;
  fetchFn?: typeof fetch;
  /** Ouvre la page de Microsoft ; `null` si le navigateur bloque la fenêtre. */
  ouvrirFenetre(adresse: string): FenetreConnexion | null;
  /** Écoute les retours de la fenêtre de connexion ; renvoie la fonction qui arrête l'écoute. */
  ecouterRetour(rappel: (m: MessageRetour) => void): () => void;
  maintenant?: () => number;
  delaiFenetreMs?: number;
}

interface Session {
  compte: Compte;
  refresh: string;
  /** Droits accordés (Files.ReadWrite.AppFolder, Calendars.ReadWrite). */
  droits: string[];
  acces: Partial<Record<Portee, { jeton: string; expireLe: number }>>;
}

interface ReponseJeton { access_token?: string; refresh_token?: string; id_token?: string; expires_in?: number; scope?: string; error?: string; error_description?: string }

export class Connexion implements FournisseurJeton {
  private abonnes = new Set<() => void>();
  private renouvellements = new Map<Portee, Promise<string>>();
  private annulation: (() => void) | null = null;
  private readonly fetchFn: typeof fetch;
  private readonly maintenant: () => number;

  constructor(private readonly d: DependancesConnexion) {
    this.fetchFn = d.fetchFn ?? ((...a) => fetch(...a));
    this.maintenant = d.maintenant ?? Date.now;
  }

  abonner(f: () => void): () => void { this.abonnes.add(f); return () => { this.abonnes.delete(f); }; }
  private prevenir(): void { this.abonnes.forEach((f) => f()); }

  private lire(): Session | null {
    try {
      const brut = this.d.stockage.getItem(CLE_SESSION);
      const s = brut ? (JSON.parse(brut) as Session) : null;
      return s && s.compte?.id && typeof s.refresh === 'string' && Array.isArray(s.droits) ? s : null;
    } catch { return null; }
  }
  private ecrire(s: Session | null): void {
    try { if (s) this.d.stockage.setItem(CLE_SESSION, JSON.stringify(s)); else this.d.stockage.removeItem(CLE_SESSION); } catch { /* stockage refusé : la session ne durera pas */ }
  }

  compte(): Compte | null { return this.lire()?.compte ?? null; }
  /** L'accès à Outlook a-t-il déjà été autorisé pour ce compte ? */
  calendrierAutorise(): boolean { return this.lire()?.droits.some((x) => x.endsWith(DROITS.calendrier)) ?? false; }

  /** Interrompt une connexion en cours (l'utilisateur a fermé la fenêtre ou change d'avis). */
  annuler(): void { this.annulation?.(); }

  /**
   * Ouvre la fenêtre de connexion Microsoft. À appeler directement depuis un clic (sinon le navigateur bloque la fenêtre).
   * Demande les droits des `portees` en plus de ceux déjà accordés.
   */
  async connecter(portees: readonly Portee[] = ['fichiers']): Promise<Compte> {
    const avant = this.lire();
    const toutes = (['fichiers', 'calendrier'] as const).filter((p) => portees.includes(p) || avant?.droits.some((x) => x.endsWith(DROITS[p])));
    const verificateur = aleatoire(64);
    const etat = aleatoire(24);
    const nonce = aleatoire(24);
    const adresse = adresseAutorisation(this.d.config, { portees: toutes, etat, nonce, defi: await defiPkce(verificateur), ...(avant ? { courriel: avant.compte.courriel } : {}) });

    const attente = new Promise<{ code: string }>((resolve, reject) => {
      const delai = setTimeout(() => { fin(); reject(new ErreurAcces('inconnue', 'La connexion a pris trop de temps. Réessayez.')); }, this.d.delaiFenetreMs ?? DELAI_FENETRE_MS);
      const arreter = this.d.ecouterRetour((m) => {
        const r = lireRetour(m.hash) ?? lireRetour(m.search);
        if (!r || r.etat !== etat) return; // une autre connexion, ou un message étranger
        fin();
        if ('erreur' in r) reject(new ErreurAcces(r.erreur === 'access_denied' ? 'refuse' : 'inconnue', `Microsoft a refusé la connexion : ${r.detail || r.erreur}`));
        else resolve({ code: r.code });
      });
      const fin = () => { clearTimeout(delai); arreter(); this.annulation = null; };
      this.annulation = () => { fin(); reject(new ErreurAcces('inconnue', 'Connexion annulée.')); };
    });
    attente.catch(() => undefined); // évite un avertissement si la fenêtre ne s'ouvre pas

    const fenetre = this.d.ouvrirFenetre(adresse);
    if (!fenetre) {
      this.annulation?.();
      throw new ErreurAcces('inconnue', 'Le navigateur a bloqué la fenêtre de connexion. Autorisez les fenêtres surgissantes pour ce site, puis réessayez.');
    }
    try {
      const { code } = await attente;
      const rep = await this.jetons(new URLSearchParams({
        grant_type: 'authorization_code', code, redirect_uri: this.d.config.adresseRetour, code_verifier: verificateur,
        scope: [...DE_BASE, ...toutes.map((p) => DROITS[p])].join(' ')
      }));
      const compte = rep.id_token ? lireCompte(rep.id_token, nonce) : null;
      if (!compte || !rep.access_token) throw new ErreurAcces('inconnue', 'Microsoft n’a pas confirmé l’identité du compte.');
      if (avant && avant.compte.id !== compte.id) throw new ErreurAcces('inconnue', 'Vous vous êtes connecté avec un autre compte : déconnectez-vous d’abord.');
      const droits = (rep.scope ?? '').split(' ').filter((x) => x.endsWith(DROITS.fichiers) || x.endsWith(DROITS.calendrier));
      const acces: Session['acces'] = {};
      const expireLe = this.maintenant() + (rep.expires_in ?? 3600) * 1000;
      for (const p of toutes) acces[p] = { jeton: rep.access_token, expireLe };
      this.ecrire({ compte, refresh: rep.refresh_token ?? '', droits: [...new Set([...(avant?.droits ?? []), ...droits])], acces });
      this.prevenir();
      return compte;
    } finally {
      try { fenetre.fermer(); } catch { /* déjà fermée */ }
    }
  }

  private async jetons(corps: URLSearchParams): Promise<ReponseJeton> {
    corps.set('client_id', this.d.config.clientId);
    let reponse: Response;
    try {
      reponse = await this.fetchFn(`https://login.microsoftonline.com/${encodeURIComponent(this.d.config.tenantId)}/oauth2/v2.0/token`, {
        method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: corps.toString()
      });
    } catch { throw new ErreurAcces('reseau', 'Pas de connexion à Microsoft. Vérifiez le réseau, puis réessayez.'); }
    const rep = (await reponse.json().catch(() => ({}))) as ReponseJeton;
    if (!reponse.ok || rep.error) {
      const detail = rep.error_description ?? rep.error ?? `statut ${reponse.status}`;
      if (/consent|AADSTS65001|AADSTS70011|invalid_scope/i.test(`${rep.error} ${detail}`)) throw new ErreurAcces('consentement', 'Microsoft n’a pas autorisé ce droit pour l’application.');
      throw new ErreurAcces('non-connecte', `Microsoft a refusé : ${detail.split('\r')[0]}`);
    }
    return rep;
  }

  /** Jeton d'accès valable pour une portée ; renouvelé en silence si possible. */
  async jeton(portee: Portee): Promise<string> {
    const s = this.lire();
    if (!s) throw new ErreurAcces('non-connecte', 'Vous n’êtes pas connecté à Microsoft.');
    const c = s.acces[portee];
    if (c && c.expireLe - 60_000 > this.maintenant()) return c.jeton;
    const enCours = this.renouvellements.get(portee);
    if (enCours) return enCours;
    const tache = this.renouveler(portee, s).finally(() => { this.renouvellements.delete(portee); });
    this.renouvellements.set(portee, tache);
    return tache;
  }

  private async renouveler(portee: Portee, s: Session): Promise<string> {
    if (portee === 'calendrier' && !s.droits.some((x) => x.endsWith(DROITS.calendrier))) throw new ErreurAcces('consentement', 'L’accès à Outlook n’a pas encore été autorisé.');
    if (!s.refresh) throw new ErreurAcces('non-connecte', 'La connexion Microsoft a expiré : reconnectez-vous.');
    let rep: ReponseJeton;
    try {
      rep = await this.jetons(new URLSearchParams({ grant_type: 'refresh_token', refresh_token: s.refresh, scope: [...DE_BASE, DROITS[portee]].join(' ') }));
    } catch (e) {
      if (e instanceof ErreurAcces && e.code === 'non-connecte') { this.ecrire({ ...s, refresh: '', acces: {} }); this.prevenir(); }
      throw e;
    }
    if (!rep.access_token) throw new ErreurAcces('non-connecte', 'Microsoft n’a pas renvoyé de jeton.');
    const actuel = this.lire() ?? s;
    this.ecrire({ ...actuel, refresh: rep.refresh_token ?? actuel.refresh, acces: { ...actuel.acces, [portee]: { jeton: rep.access_token, expireLe: this.maintenant() + (rep.expires_in ?? 3600) * 1000 } } });
    return rep.access_token;
  }

  /** Oublie le compte sur cet appareil (la session Microsoft du navigateur n'est pas touchée). */
  deconnecter(): void { this.ecrire(null); this.prevenir(); }

  /** Connecté, mais la session a expiré : il faut ouvrir la fenêtre de connexion à nouveau. */
  reconnexionNecessaire(): boolean { const s = this.lire(); return !!s && !s.refresh; }
}
