import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { Connexion, DROITS, adresseAutorisation, aleatoire, defiPkce, lireCompte, lireRetour } from '../src/synchro/connexion.ts';
import type { ConfigMicrosoft, MessageRetour, Stockage } from '../src/synchro/connexion.ts';
import { ErreurAcces } from '../src/synchro/nuage.ts';
import { FauxMicrosoft } from './fauxMicrosoft.ts';

const CONFIG: ConfigMicrosoft = { clientId: 'client-test', tenantId: 'tenant-test', adresseRetour: 'https://exemple.test/v2/msal-redirect.html' };

const stockageMemoire = (): Stockage & { contenu: Map<string, string> } => {
  const contenu = new Map<string, string>();
  return { contenu, getItem: (k) => contenu.get(k) ?? null, setItem: (k, v) => { contenu.set(k, v); }, removeItem: (k) => { contenu.delete(k); } };
};

describe('outils de connexion', () => {
  it('défi PKCE conforme à l’exemple de la RFC 7636', async () => {
    assert.equal(await defiPkce('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk'), 'E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });
  it('valeurs aléatoires assez longues et différentes', () => {
    assert.match(aleatoire(64), /^[A-Za-z0-9_-]{86}$/);
    assert.notEqual(aleatoire(), aleatoire());
  });
  it('adresse d’autorisation : code + PKCE S256, retour dans le fragment, droits demandés', () => {
    const u = new URL(adresseAutorisation(CONFIG, { portees: ['fichiers'], etat: 'E', nonce: 'N', defi: 'D' }));
    assert.equal(u.origin + u.pathname, 'https://login.microsoftonline.com/tenant-test/oauth2/v2.0/authorize');
    const p = u.searchParams;
    assert.deepEqual([p.get('response_type'), p.get('response_mode'), p.get('code_challenge'), p.get('code_challenge_method'), p.get('state'), p.get('nonce'), p.get('redirect_uri'), p.get('client_id'), p.get('prompt')],
      ['code', 'fragment', 'D', 'S256', 'E', 'N', CONFIG.adresseRetour, 'client-test', 'select_account']);
    assert.equal(p.get('scope'), 'openid profile offline_access Files.ReadWrite.AppFolder');
    const suite = new URL(adresseAutorisation(CONFIG, { portees: ['fichiers', 'calendrier'], etat: 'E', nonce: 'N', defi: 'D', courriel: 'a@b.c' })).searchParams;
    assert.equal(suite.get('scope'), 'openid profile offline_access Files.ReadWrite.AppFolder Calendars.ReadWrite');
    assert.equal(suite.get('login_hint'), 'a@b.c');
    assert.equal(suite.get('prompt'), null);
  });
  it('lit le retour de Microsoft', () => {
    assert.deepEqual(lireRetour('#code=abc&state=xyz'), { code: 'abc', etat: 'xyz' });
    assert.deepEqual(lireRetour('?code=abc&state=xyz'), { code: 'abc', etat: 'xyz' });
    assert.deepEqual(lireRetour('#error=access_denied&error_description=non&state=xyz'), { erreur: 'access_denied', detail: 'non', etat: 'xyz' });
    assert.equal(lireRetour(''), null);
    assert.equal(lireRetour('#code=abc'), null); // sans état : refusé
  });
  it('lit le compte dans le jeton d’identité et vérifie le nonce', () => {
    const faux = (c: object) => `e.${Buffer.from(JSON.stringify(c)).toString('base64url')}.s`;
    const jeton = faux({ name: 'Léa Durand', preferred_username: 'lea@ecole.test', oid: 'o1', nonce: 'N' });
    assert.deepEqual(lireCompte(jeton, 'N'), { id: 'o1', nom: 'Léa Durand', courriel: 'lea@ecole.test' });
    assert.equal(lireCompte(jeton, 'autre'), null);
    assert.equal(lireCompte(faux({ name: 'Sans id' })), null);
    assert.equal(lireCompte('pas-un-jeton'), null);
  });
});

describe('connexion à un compte Microsoft', () => {
  let faux: FauxMicrosoft;
  let stockage: ReturnType<typeof stockageMemoire>;
  let maintenant: number;
  let ouvertures: string[];
  let auditeurs: ((m: MessageRetour) => void)[];
  /** Comportement de la « fenêtre » : par défaut, l'utilisateur se connecte normalement. */
  let comportement: 'normal' | 'bloquee' | 'refus' | 'autre-etat' | 'silence';

  const creer = (delaiFenetreMs = 5000) => new Connexion({
    config: CONFIG, stockage, fetchFn: (...a) => faux.fetch(...a), maintenant: () => maintenant, delaiFenetreMs,
    ecouterRetour: (rappel) => { auditeurs.push(rappel); return () => { auditeurs = auditeurs.filter((x) => x !== rappel); }; },
    ouvrirFenetre: (adresse) => {
      ouvertures.push(adresse);
      if (comportement === 'bloquee') return null;
      setTimeout(() => {
        const retour = new URL(faux.autoriser(adresse));
        if (comportement === 'silence') return;
        const etat = new URLSearchParams(retour.hash.slice(1)).get('state')!;
        const message: MessageRetour = comportement === 'refus'
          ? { type: 'retour', hash: `#error=access_denied&error_description=Refus&state=${etat}`, search: '' }
          : comportement === 'autre-etat' ? { type: 'retour', hash: '#code=x&state=pirate', search: '' }
            : { type: 'retour', hash: retour.hash, search: '' };
        [...auditeurs].forEach((a) => a(message));
      }, 0);
      return { fermer: () => undefined };
    }
  });

  beforeEach(() => { faux = new FauxMicrosoft(); stockage = stockageMemoire(); maintenant = 1_000_000; ouvertures = []; auditeurs = []; comportement = 'normal'; });

  it('se connecte, donne un jeton, le réutilise tant qu’il est valable', async () => {
    const c = creer();
    assert.equal(c.compte(), null);
    const compte = await c.connecter();
    assert.deepEqual(compte, { id: 'oid-agent-1', nom: 'Agent Test', courriel: 'agent.test@pole.example' });
    assert.deepEqual(c.compte(), compte);
    const j1 = await c.jeton('fichiers');
    assert.equal(await c.jeton('fichiers'), j1);
    assert.equal(c.calendrierAutorise(), false);
    assert.equal(auditeurs.length, 0, 'l’écoute du retour est arrêtée');
  });

  it('renouvelle le jeton en silence quand il expire (et garde le nouveau jeton de renouvellement)', async () => {
    const c = creer();
    await c.connecter();
    const j1 = await c.jeton('fichiers');
    maintenant += 3_600_000;
    const j2 = await c.jeton('fichiers');
    assert.notEqual(j2, j1);
    const avant = faux.journal.length;
    // Appels simultanés : un seul renouvellement.
    maintenant += 3_600_000;
    const [a, b, d] = await Promise.all([c.jeton('fichiers'), c.jeton('fichiers'), c.jeton('fichiers')]);
    assert.ok(a === b && b === d);
    assert.equal(faux.journal.length, avant);
    maintenant += 3_600_000;
    assert.ok(await c.jeton('fichiers'));
  });

  it('demande l’accès à Outlook après coup, sans perdre celui de OneDrive', async () => {
    const c = creer();
    await c.connecter();
    await assert.rejects(() => c.jeton('calendrier'), (e: unknown) => e instanceof ErreurAcces && e.code === 'consentement');
    await c.connecter(['calendrier']);
    assert.equal(c.calendrierAutorise(), true);
    assert.ok(await c.jeton('calendrier'));
    assert.ok(await c.jeton('fichiers'));
    assert.match(new URL(ouvertures[1]!).searchParams.get('scope')!, /Files\.ReadWrite\.AppFolder.*Calendars\.ReadWrite/);
    assert.equal(new URL(ouvertures[1]!).searchParams.get('login_hint'), 'agent.test@pole.example');
  });

  it('si l’administrateur refuse Outlook, OneDrive continue de marcher', async () => {
    const c = creer();
    await c.connecter();
    faux.calendrierAutorise = false;
    await assert.rejects(() => c.connecter(['calendrier']), (e: unknown) => e instanceof ErreurAcces && e.code === 'consentement');
    assert.equal(c.calendrierAutorise(), false);
    maintenant += 3_600_000;
    assert.ok(await c.jeton('fichiers'));
  });

  it('demande de se reconnecter quand Microsoft a invalidé la session', async () => {
    const c = creer();
    await c.connecter();
    faux.expirerSessions();
    maintenant += 3_600_000;
    await assert.rejects(() => c.jeton('fichiers'), (e: unknown) => e instanceof ErreurAcces && e.code === 'non-connecte');
    assert.equal(c.reconnexionNecessaire(), true);
    assert.ok(c.compte(), 'le compte reste affiché pour proposer « Se reconnecter »');
    await c.connecter();
    assert.equal(c.reconnexionNecessaire(), false);
    assert.ok(await c.jeton('fichiers'));
  });

  it('refuse un autre compte pendant une connexion déjà établie', async () => {
    const c = creer();
    await c.connecter();
    faux.compte = { ...faux.compte, oid: 'oid-autre' };
    await assert.rejects(() => c.connecter(['calendrier']), /autre compte/);
    assert.equal(c.compte()!.id, 'oid-agent-1');
  });

  it('fenêtre bloquée, refus de l’utilisateur, message étranger, abandon', async () => {
    comportement = 'bloquee';
    await assert.rejects(() => creer().connecter(), /bloqué la fenêtre/);
    comportement = 'refus';
    await assert.rejects(() => creer().connecter(), (e: unknown) => e instanceof ErreurAcces && e.code === 'refuse');
    comportement = 'autre-etat';
    await assert.rejects(() => creer(30).connecter(), /trop de temps/);
    comportement = 'silence';
    const c = creer();
    const p = c.connecter();
    setTimeout(() => c.annuler(), 20);
    await assert.rejects(() => p, /annulée/);
    assert.equal(auditeurs.length, 0);
    assert.equal(stockage.contenu.size, 0, 'rien n’est gardé après un échec');
  });

  it('se déconnecte', async () => {
    const c = creer();
    let prevenu = 0;
    c.abonner(() => { prevenu += 1; });
    await c.connecter();
    c.deconnecter();
    assert.equal(c.compte(), null);
    await assert.rejects(() => c.jeton('fichiers'), (e: unknown) => e instanceof ErreurAcces && e.code === 'non-connecte');
    assert.equal(prevenu, 2);
    assert.equal(DROITS.fichiers, 'Files.ReadWrite.AppFolder');
  });
});
