import { ajouterJours, lundiDe } from '../domain/agenda/dates.ts';
import { descriptionEvenement, repereDans } from '../domain/synchro/outlook.ts';
import type { EvenementExistant, EvenementSouhaite } from '../domain/synchro/outlook.ts';
import { ErreurVersion } from './nuage.ts';
import type { CalendrierNuage, FichierDistant, Nuage } from './nuage.ts';

/*
 * Nuage simulé : un « faux OneDrive » et un « faux Outlook » gardés sur cet appareil.
 * Il sert à essayer toute la synchronisation (envoi, réception, conflits, Outlook) sans compte Microsoft.
 * Rien ne quitte l'appareil. Il respecte les mêmes règles de version que le vrai OneDrive.
 */

interface FichierSimule { id: string; etag: string; contenu: string }
interface EvenementSimule { id: string; sujet: string; debut: string; fin: string; lieu: string; description: string }
interface EtatSimule {
  prochain: number;
  fichiers: Record<string, FichierSimule>;
  calendriers: Record<string, { nom: string; evenements: Record<string, EvenementSimule> }>;
}

/** Où garder la simulation entre deux visites (en pratique localStorage). */
export interface Persistance { lire(): string | null; ecrire(texte: string): void }

const vide = (): EtatSimule => ({ prochain: 1, fichiers: {}, calendriers: {} });

export class NuageSimule implements Nuage, CalendrierNuage {
  readonly nom = 'demonstration' as const;
  private etat: EtatSimule;

  constructor(private readonly persistance: Persistance | null = null, private readonly aujourdhui: () => string = () => new Date().toISOString().slice(0, 10)) {
    this.etat = vide();
    const brut = persistance?.lire();
    if (brut) {
      try {
        const lu = JSON.parse(brut) as EtatSimule;
        if (lu && typeof lu === 'object' && lu.fichiers && lu.calendriers && typeof lu.prochain === 'number') this.etat = lu;
      } catch { /* simulation abîmée : on repart de zéro */ }
    }
  }

  private sauver(): void { this.persistance?.ecrire(JSON.stringify(this.etat)); }
  private numero(): number { const n = this.etat.prochain; this.etat.prochain += 1; return n; }

  /* ── Fichiers ── */

  async lister(dossier: string): Promise<FichierDistant[]> {
    return Object.entries(this.etat.fichiers)
      .filter(([chemin]) => chemin.startsWith(`${dossier}/`) && !chemin.slice(dossier.length + 1).includes('/'))
      .map(([chemin, f]) => ({ chemin, id: f.id, etag: f.etag }));
  }

  async lire(fichier: FichierDistant): Promise<string> {
    const f = this.etat.fichiers[fichier.chemin];
    if (!f || f.id !== fichier.id) throw new ErreurVersion('Le fichier n’existe plus.');
    return f.contenu;
  }

  async ecrire(chemin: string, contenu: string, etagAttendu: string | null): Promise<FichierDistant> {
    const actuel = this.etat.fichiers[chemin];
    if (actuel ? etagAttendu !== actuel.etag : etagAttendu !== null) throw new ErreurVersion();
    const n = this.numero();
    const f: FichierSimule = { id: actuel?.id ?? `sim-${n}`, etag: `"sim-${n}"`, contenu };
    this.etat.fichiers[chemin] = f;
    this.sauver();
    return { chemin, id: f.id, etag: f.etag };
  }

  async supprimer(fichier: FichierDistant): Promise<void> {
    const actuel = this.etat.fichiers[fichier.chemin];
    if (!actuel) return;
    if (actuel.etag !== fichier.etag) throw new ErreurVersion();
    delete this.etat.fichiers[fichier.chemin];
    this.sauver();
  }

  /* ── Calendrier ── */

  async trouverOuCreer(nom: string): Promise<string> {
    const trouve = Object.entries(this.etat.calendriers).find(([, c]) => c.nom === nom);
    if (trouve) return trouve[0];
    const id = `cal-${this.numero()}`;
    const lundi = lundiDe(this.aujourdhui());
    // Un rendez-vous personnel d'exemple, SANS repère : le Journalier ne doit jamais y toucher.
    const perso: EvenementSimule = { id: `ev-${this.numero()}`, sujet: 'Rendez-vous personnel (exemple)', debut: `${ajouterJours(lundi, 2)}T17:00`, fin: `${ajouterJours(lundi, 2)}T18:00`, lieu: '', description: '' };
    this.etat.calendriers[id] = { nom, evenements: { [perso.id]: perso } };
    this.sauver();
    return id;
  }

  private calendrier(id: string): EtatSimule['calendriers'][string] {
    const c = this.etat.calendriers[id];
    if (!c) throw new ErreurVersion('Le calendrier n’existe plus.');
    return c;
  }

  async evenements(calendrier: string, du: string, au: string): Promise<EvenementExistant[]> {
    return Object.values(this.calendrier(calendrier).evenements)
      .filter((e) => e.debut.slice(0, 10) >= du && e.debut.slice(0, 10) <= au)
      .map((e) => ({ id: e.id, cle: repereDans(e.description), sujet: e.sujet, debut: e.debut, fin: e.fin, lieu: e.lieu }));
  }

  async creer(calendrier: string, e: EvenementSouhaite): Promise<void> {
    const id = `ev-${this.numero()}`;
    this.calendrier(calendrier).evenements[id] = { id, sujet: e.sujet, debut: e.debut, fin: e.fin, lieu: e.lieu, description: descriptionEvenement(e.cle) };
    this.sauver();
  }

  async modifier(calendrier: string, id: string, e: EvenementSouhaite): Promise<void> {
    const c = this.calendrier(calendrier);
    if (!c.evenements[id]) throw new ErreurVersion('L’événement n’existe plus.');
    c.evenements[id] = { id, sujet: e.sujet, debut: e.debut, fin: e.fin, lieu: e.lieu, description: descriptionEvenement(e.cle) };
    this.sauver();
  }

  async supprimerEvenement(calendrier: string, id: string): Promise<void> {
    delete this.calendrier(calendrier).evenements[id];
    this.sauver();
  }

  async supprimerCalendrier(calendrier: string): Promise<void> {
    delete this.etat.calendriers[calendrier];
    this.sauver();
  }

  /* ── Pour essayer ── */

  /** Nombre de fichiers et d'événements « dans le nuage ». */
  resume(): { fichiers: number; evenements: number } {
    return {
      fichiers: Object.keys(this.etat.fichiers).length,
      evenements: Object.values(this.etat.calendriers).reduce((n, c) => n + Object.values(c.evenements).filter((e) => repereDans(e.description)).length, 0)
    };
  }

  /**
   * Fait comme si un AUTRE appareil avait modifié un fichier (sans passer par ici).
   * `modifier` reçoit le contenu et renvoie le nouveau contenu, ou `null` pour ne pas y toucher.
   * Renvoie le chemin modifié, ou `null` si aucun fichier ne convenait.
   */
  modifierSurAutreAppareil(dossier: string, modifier: (contenu: string, chemin: string) => string | null): string | null {
    for (const [chemin, f] of Object.entries(this.etat.fichiers)) {
      if (!chemin.startsWith(`${dossier}/`)) continue;
      const nouveau = modifier(f.contenu, chemin);
      if (nouveau === null) continue;
      const n = this.numero();
      this.etat.fichiers[chemin] = { id: f.id, etag: `"sim-${n}"`, contenu: nouveau };
      this.sauver();
      return chemin;
    }
    return null;
  }

  /** Comme si un autre appareil avait supprimé un fichier. */
  supprimerSurAutreAppareil(chemin: string): boolean {
    if (!this.etat.fichiers[chemin]) return false;
    delete this.etat.fichiers[chemin];
    this.sauver();
    return true;
  }

  /** Tout effacer : le nuage redevient vide. */
  vider(): void { this.etat = vide(); this.sauver(); }
}
