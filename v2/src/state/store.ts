import { useSyncExternalStore } from 'react';
import type { Depot } from '../data/repository.ts';
import type { Activite } from '../domain/agenda/types.ts';
import type { Changement } from '../domain/agenda/planning.ts';
import { horairesParDefaut, normaliserHoraires, verifierHoraires } from '../domain/agenda/horaires.ts';
import { REGLAGE_SEMAINE_TYPE, normaliserSemaineType } from '../domain/agenda/semainetype.ts';
import type { SemaineType } from '../domain/agenda/semainetype.ts';
import type { ErreurHoraire } from '../domain/agenda/horaires.ts';
import type { Periode } from '../domain/agenda/types.ts';
import { effetSuppression, normaliserEleve } from '../domain/eleves/index.ts';
import type { EffetSuppression } from '../domain/eleves/index.ts';
import { normaliserPia } from '../domain/pia/index.ts';
import type { Pia } from '../domain/pia/index.ts';
import type { Eleve, Seance } from '../domain/types.ts';

/** Où en est l'enregistrement automatique du brouillon de PIA. */
export interface StatutPia {
  /** repos : rien n'a été modifié ; attente : modifié, pas encore écrit ; ok : écrit ; erreur : l'écriture a échoué. */
  etat: 'repos' | 'attente' | 'ok' | 'erreur';
  /** Moment du dernier enregistrement réussi (date ISO), ou vide. */
  le: string;
  message: string;
}

/** Délai entre la dernière frappe et l'écriture dans la base : évite une écriture par lettre. */
const DELAI_PIA_MS = 400;

export interface Etat {
  pret: boolean;
  erreur: string | null;
  eleves: Eleve[];
  seances: Seance[];
  activites: Activite[];
  pias: Pia[];
  /** Horaires des périodes de l'agenda (réglables ; les noms 1e H… ne changent pas). */
  horaires: Periode[];
  /** Modèle de semaine habituelle de l'agenda, s'il en existe un. */
  semaineType: SemaineType | null;
  statutPia: StatutPia;
  /** Séance à ouvrir préremplie (depuis l'agenda) ; consommée une fois. */
  preparation: Partial<Seance> | null;
}

const initial: Etat = {
  pret: false, erreur: null, eleves: [], seances: [], activites: [], pias: [], horaires: horairesParDefaut(), semaineType: null, statutPia: { etat: 'repos', le: '', message: '' }, preparation: null
};

/** Nom du réglage « horaires des périodes » dans la base. */
export const REGLAGE_HORAIRES = 'agenda-horaires';

/** Petit magasin d'état : une source de vérité en mémoire, écrite dans le dépôt à chaque action. */
export function creerMagasin(depot: Depot) {
  let etat: Etat = initial;
  const abonnes = new Set<() => void>();
  const maj = (suite: Partial<Etat>) => { etat = { ...etat, ...suite }; abonnes.forEach((a) => a()); };

  /* Brouillon de PIA : l'écran voit le changement tout de suite, la base est écrite juste après (en une file, dans l'ordre). */
  let enAttente = new Map<string, Pia>();
  let minuteur: ReturnType<typeof setTimeout> | null = null;
  let file: Promise<void> = Promise.resolve();
  const statut = (suite: Partial<StatutPia>) => maj({ statutPia: { ...etat.statutPia, ...suite } });

  const ecrirePias = (): Promise<void> => {
    file = file.then(async () => {
      const lot = [...enAttente.values()];
      enAttente = new Map();
      if (!lot.length) return;
      try {
        for (const p of lot) await depot.enregistrerPia(p);
        statut(enAttente.size ? { etat: 'attente' } : { etat: 'ok', le: new Date().toISOString(), message: '' });
      } catch (e) {
        // On garde ce qui n'a pas été écrit : la prochaine modification (ou « vider ») réessaiera.
        for (const p of lot) if (!enAttente.has(p.id)) enAttente.set(p.id, p);
        statut({ etat: 'erreur', message: e instanceof Error ? e.message : 'Enregistrement impossible' });
      }
    });
    return file;
  };

  return {
    lire: () => etat,
    abonner(f: () => void) { abonnes.add(f); return () => { abonnes.delete(f); }; },

    async charger() {
      try {
        const [eleves, seances, activites, pias, reglages] = await Promise.all([depot.chargerEleves(), depot.chargerSeances(), depot.chargerActivites(), depot.chargerPias(), depot.chargerReglages()]);
        maj({
          pret: true, erreur: null, eleves: eleves.map(normaliserEleve), seances, activites,
          pias: pias.map(normaliserPia).filter((p): p is Pia => p !== null),
          horaires: normaliserHoraires(reglages.find((r) => r.id === REGLAGE_HORAIRES)?.valeur),
          semaineType: normaliserSemaineType(reglages.find((r) => r.id === REGLAGE_SEMAINE_TYPE)?.valeur)
        });
      } catch (e) {
        maj({ pret: true, erreur: e instanceof Error ? e.message : 'Chargement impossible' });
      }
    },

    async ajouterEleves(brutes: Eleve[]) {
      const liste = brutes.map(normaliserEleve);
      for (const e of liste) await depot.enregistrerEleve(e);
      maj({ eleves: [...etat.eleves.filter((x) => !liste.some((n) => n.id === x.id)), ...liste] });
    },

    /** Charge d'un coup un jeu de données fictives (élèves, séances, PIA) ; ce qui existe déjà sous le même identifiant est remplacé. */
    async chargerExemple(exemple: { eleves: Eleve[]; seances: Seance[]; pias: Pia[] }) {
      await this.ajouterEleves(exemple.eleves);
      for (const s of exemple.seances) await this.enregistrerSeance(s);
      for (const p of exemple.pias) this.enregistrerPia(p);
      await this.viderEnregistrements();
    },

    /** Supprime l'élève avec ses séances, ses activités d'agenda et ses PIA (définitif). Renvoie ce qui a disparu. */
    async supprimerEleve(id: string): Promise<EffetSuppression> {
      const effet = effetSuppression(id, etat.seances, etat.activites, etat.pias);
      // Un brouillon de PIA encore en attente ne doit jamais être réécrit APRÈS la suppression.
      await file;
      for (const [cle, p] of [...enAttente]) if (p.eleveId === id) enAttente.delete(cle);
      await depot.supprimerEleve(id);
      const s = new Set(effet.seances);
      const a = new Set(effet.activites);
      const pi = new Set(effet.pias);
      maj({
        eleves: etat.eleves.filter((x) => x.id !== id), seances: etat.seances.filter((x) => !s.has(x.id)),
        activites: etat.activites.filter((x) => !a.has(x.id)), pias: etat.pias.filter((x) => !pi.has(x.id))
      });
      return effet;
    },

    /** Enregistre le PIA : visible tout de suite à l'écran, écrit dans la base après une courte pause. */
    enregistrerPia(p: Pia) {
      maj({ pias: [...etat.pias.filter((x) => x.id !== p.id), p] });
      statut({ etat: 'attente' });
      enAttente.set(p.id, p);
      if (minuteur) clearTimeout(minuteur);
      minuteur = setTimeout(() => { minuteur = null; void ecrirePias(); }, DELAI_PIA_MS);
    },

    /** Écrit tout de suite ce qui attend (changement d'écran, fermeture de la page, tests). */
    viderEnregistrements(): Promise<void> {
      if (minuteur) { clearTimeout(minuteur); minuteur = null; }
      return ecrirePias();
    },

    async enregistrerSeance(s: Seance) {
      await depot.enregistrerSeance(s);
      maj({ seances: [...etat.seances.filter((x) => x.id !== s.id), s] });
    },

    preparerSeance(p: Partial<Seance>) { maj({ preparation: p }); },
    /** À appeler après l'ouverture de la séance : la préparation n'est valable qu'une fois. */
    viderPreparation() { if (etat.preparation) etat = { ...etat, preparation: null }; },

    /** Applique un changement de l'agenda (enregistrements et suppressions) d'un seul coup pour l'affichage. */
    async changerAgenda(c: Changement) {
      for (const a of c.enregistrer) await depot.enregistrerActivite(a);
      for (const id of c.supprimer) await depot.supprimerActivite(id);
      const ids = new Set([...c.enregistrer.map((a) => a.id), ...c.supprimer]);
      maj({ activites: [...etat.activites.filter((a) => !ids.has(a.id)), ...c.enregistrer] });
    },

    /** Enregistre de nouveaux horaires. S'ils sont incohérents, rien n'est écrit et les erreurs sont renvoyées. */
    async changerHoraires(periodes: readonly Periode[]): Promise<ErreurHoraire[]> {
      const erreurs = verifierHoraires(periodes);
      if (erreurs.length) return erreurs;
      const horaires = normaliserHoraires(periodes);
      await depot.enregistrerReglage({ id: REGLAGE_HORAIRES, valeur: horaires });
      maj({ horaires });
      return [];
    },

    /** Enregistre la semaine type (ou l'efface avec `null`). */
    async enregistrerSemaineType(modele: SemaineType | null) {
      await depot.enregistrerReglage({ id: REGLAGE_SEMAINE_TYPE, valeur: modele });
      maj({ semaineType: modele });
    },

    async supprimerSeance(id: string) {
      await depot.supprimerSeance(id);
      maj({ seances: etat.seances.filter((x) => x.id !== id) });
    }
  };
}

export type Magasin = ReturnType<typeof creerMagasin>;

export const useMagasin = <T,>(magasin: Magasin, selecteur: (e: Etat) => T): T =>
  useSyncExternalStore(magasin.abonner, () => selecteur(magasin.lire()));
