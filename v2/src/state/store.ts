import { useSyncExternalStore } from 'react';
import type { Depot } from '../data/repository.ts';
import type { Activite } from '../domain/agenda/types.ts';
import type { Changement } from '../domain/agenda/planning.ts';
import { horairesParDefaut, normaliserHoraires, verifierHoraires } from '../domain/agenda/horaires.ts';
import { REGLAGE_ECOLES, ecolesParDefaut, elevesApresChangement, normaliserEcoles, verifierEcoles } from '../domain/agenda/ecoles.ts';
import type { Ecole, ErreurEcole } from '../domain/agenda/ecoles.ts';
import { REGLAGE_SEMAINE_TYPE, normaliserSemaineType } from '../domain/agenda/semainetype.ts';
import type { SemaineType } from '../domain/agenda/semainetype.ts';
import type { ErreurHoraire } from '../domain/agenda/horaires.ts';
import type { Periode } from '../domain/agenda/types.ts';
import { effetSuppression, normaliserEleve } from '../domain/eleves/index.ts';
import type { EffetSuppression } from '../domain/eleves/index.ts';
import { normaliserPia } from '../domain/pia/index.ts';
import type { Pia } from '../domain/pia/index.ts';
import { estDemo } from '../domain/synchro/cles.ts';
import type { ObjetSynchro, ObjetsLocaux } from '../domain/synchro/objets.ts';
import type { RefObjet } from '../domain/synchro/cles.ts';
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
  /** Horaires de l'école par défaut (réglables ; les noms 1e H… ne changent pas). Les autres écoles sont dans `ecoles`. */
  horaires: Periode[];
  /** Écoles de l'agenda avec leurs horaires ; la première est l'école par défaut. */
  ecoles: Ecole[];
  /** Temps de trajet minimal (minutes) entre deux écoles. */
  trajet: number;
  /** Modèle de semaine habituelle de l'agenda, s'il en existe un. */
  semaineType: SemaineType | null;
  statutPia: StatutPia;
  /** Éléments enregistrés sur cet appareil mais illisibles (abîmés) : mis de côté, jamais supprimés tout seuls. */
  illisibles: number;
  /** Séance à ouvrir préremplie (depuis l'agenda) ; consommée une fois. */
  preparation: Partial<Seance> | null;
}

const initial: Etat = {
  pret: false, erreur: null, eleves: [], seances: [], activites: [], pias: [], horaires: horairesParDefaut(), ecoles: ecolesParDefaut().ecoles, trajet: ecolesParDefaut().trajet, semaineType: null, statutPia: { etat: 'repos', le: '', message: '' }, illisibles: 0, preparation: null
};

/** Ancien nom du réglage « horaires des périodes » (une seule école) : encore relu tant que `agenda-ecoles` n'existe pas. */
export const REGLAGE_HORAIRES = 'agenda-horaires';

/** Les écoles à partir des réglages enregistrés (nouveau réglage, sinon ancien réglage d'une seule école). */
function ecolesDepuis(reglages: readonly { id: string; valeur: unknown }[]) {
  const cfg = normaliserEcoles(reglages.find((r) => r.id === REGLAGE_ECOLES)?.valeur, reglages.find((r) => r.id === REGLAGE_HORAIRES)?.valeur);
  return { ecoles: cfg.ecoles, trajet: cfg.trajet, horaires: cfg.ecoles[0]!.periodes };
}

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
          ...ecolesDepuis(reglages),
          semaineType: normaliserSemaineType(reglages.find((r) => r.id === REGLAGE_SEMAINE_TYPE)?.valeur),
          illisibles: depot.illisibles().length
        });
      } catch (e) {
        maj({ pret: true, erreur: e instanceof Error ? e.message : 'Chargement impossible' });
      }
    },

    /** Écarte les éléments illisibles (et leur trace de synchro : OneDrive les renverra), puis recharge. Renvoie leur nombre. */
    async ecarterIllisibles(): Promise<number> {
      await file;
      const n = await depot.ecarterIllisibles();
      await this.charger();
      return n;
    },

    async ajouterEleves(brutes: Eleve[]) {
      const liste = brutes.map(normaliserEleve);
      for (const e of liste) await depot.enregistrerEleve(e);
      maj({ eleves: [...etat.eleves.filter((x) => !liste.some((n) => n.id === x.id)), ...liste] });
    },

    /** Charge d'un coup un jeu de données fictives (élèves, séances, agenda, PIA) ; ce qui existe déjà sous le même identifiant est remplacé. */
    async chargerExemple(exemple: { eleves: Eleve[]; seances: Seance[]; pias: Pia[]; activites?: Activite[] }) {
      await this.ajouterEleves(exemple.eleves);
      for (const s of exemple.seances) await this.enregistrerSeance(s);
      if (exemple.activites?.length) await this.changerAgenda({ enregistrer: exemple.activites, supprimer: [] });
      for (const p of exemple.pias) this.enregistrerPia(p);
      await this.viderEnregistrements();
    },

    /** Efface les données de démonstration (identifiants « demo-… ») et elles seules. Renvoie ce qui a disparu. */
    async effacerDemo(): Promise<{ eleves: number; seances: number; activites: number; pias: number }> {
      const bilan = { eleves: 0, seances: 0, activites: 0, pias: 0 };
      for (const e of etat.eleves.filter((x) => estDemo(x.id))) {
        const effet = await this.supprimerEleve(e.id);
        bilan.eleves += 1; bilan.seances += effet.seances.length; bilan.activites += effet.activites.length; bilan.pias += effet.pias.length;
      }
      const seules = etat.activites.filter((a) => estDemo(a.id));
      if (seules.length) { await this.changerAgenda({ enregistrer: [], supprimer: seules.map((a) => a.id) }); bilan.activites += seules.length; }
      return bilan;
    },

    /** Tout ce qui peut partir vers OneDrive ou dans une copie de secours, tel qu'enregistré sur cet appareil. */
    async lireObjets(): Promise<ObjetsLocaux> {
      await this.viderEnregistrements();
      const reglages = await depot.chargerReglages();
      return { eleves: etat.eleves, seances: etat.seances, activites: etat.activites, pias: etat.pias, reglages };
    },

    /**
     * Applique ce qui vient d'ailleurs (OneDrive, copie de secours) : suppressions puis écritures, avec mise à jour de l'écran.
     * Les objets doivent déjà avoir été vérifiés (`normaliserObjet`).
     */
    async appliquerSynchro(ecrire: readonly ObjetSynchro[], supprimer: readonly RefObjet[]): Promise<void> {
      await file;
      for (const r of supprimer) {
        if (r.type === 'eleve') await this.supprimerEleve(r.id);
        else if (r.type === 'seance') await this.supprimerSeance(r.id);
        else if (r.type === 'activite') await this.changerAgenda({ enregistrer: [], supprimer: [r.id] });
        else if (r.type === 'pia') {
          for (const [k, p] of [...enAttente]) if (p.id === r.id) enAttente.delete(k);
          await depot.supprimerPia(r.id);
          maj({ pias: etat.pias.filter((x) => x.id !== r.id) });
        }
      }
      const eleves: Eleve[] = [];
      const seances: Seance[] = [];
      const activites: Activite[] = [];
      const pias: Pia[] = [];
      let ecolesRecues = false;
      let semaineType = etat.semaineType;
      for (const o of ecrire) {
        if (o.type === 'eleve') { const e = normaliserEleve(o.donnees as Eleve); await depot.enregistrerEleve(e); eleves.push(e); }
        else if (o.type === 'seance') { const x = o.donnees as Seance; await depot.enregistrerSeance(x); seances.push(x); }
        else if (o.type === 'activite') { const x = o.donnees as Activite; await depot.enregistrerActivite(x); activites.push(x); }
        else if (o.type === 'pia') { const x = normaliserPia(o.donnees); if (x) { await depot.enregistrerPia(x); pias.push(x); } }
        else {
          const r = o.donnees as { id: string; valeur: unknown };
          await depot.enregistrerReglage({ id: r.id, valeur: r.valeur });
          if (r.id === REGLAGE_HORAIRES || r.id === REGLAGE_ECOLES) ecolesRecues = true;
          else if (r.id === REGLAGE_SEMAINE_TYPE) semaineType = normaliserSemaineType(r.valeur);
        }
      }
      const ids = (l: readonly { id: string }[]) => new Set(l.map((x) => x.id));
      const [ie, is, ia, ip] = [ids(eleves), ids(seances), ids(activites), ids(pias)];
      const ecolesLues = ecolesRecues ? ecolesDepuis(await depot.chargerReglages()) : {};
      maj({
        eleves: [...etat.eleves.filter((x) => !ie.has(x.id)), ...eleves],
        seances: [...etat.seances.filter((x) => !is.has(x.id)), ...seances],
        activites: [...etat.activites.filter((x) => !ia.has(x.id)), ...activites],
        pias: [...etat.pias.filter((x) => !ip.has(x.id)), ...pias],
        ...ecolesLues, semaineType
      });
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

    /** Enregistre de nouveaux horaires pour l'école par défaut. S'ils sont incohérents, rien n'est écrit et les erreurs sont renvoyées. */
    async changerHoraires(periodes: readonly Periode[]): Promise<ErreurHoraire[]> {
      const erreurs = verifierHoraires(periodes);
      if (erreurs.length) return erreurs;
      const [premiere, ...autres] = etat.ecoles;
      const refus = await this.changerEcoles([{ ...premiere!, periodes: normaliserHoraires(periodes) }, ...autres], etat.trajet);
      return refus.map((r) => ({ index: r.index ?? 0, message: r.message }));
    },

    /**
     * Enregistre les écoles et leurs horaires (la première est l'école par défaut). Si quelque chose est incohérent,
     * rien n'est écrit et les erreurs sont renvoyées. Les élèves rattachés à une école renommée ou supprimée suivent.
     */
    async changerEcoles(ecoles: readonly Ecole[], trajet: number): Promise<ErreurEcole[]> {
      const erreurs = verifierEcoles(ecoles);
      if (erreurs.length) return erreurs;
      const cfg = normaliserEcoles({ ecoles: ecoles.map((e) => ({ ...e, nom: e.nom.trim() })), trajet });
      const aMettreAJour = elevesApresChangement(etat.eleves, etat.ecoles, cfg.ecoles);
      await depot.enregistrerReglage({ id: REGLAGE_ECOLES, valeur: cfg });
      for (const e of aMettreAJour) await depot.enregistrerEleve(e);
      const modifies = new Map(aMettreAJour.map((e) => [e.id, e]));
      maj({ ecoles: cfg.ecoles, trajet: cfg.trajet, horaires: cfg.ecoles[0]!.periodes, ...(modifies.size ? { eleves: etat.eleves.map((e) => modifies.get(e.id) ?? e) } : {}) });
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
