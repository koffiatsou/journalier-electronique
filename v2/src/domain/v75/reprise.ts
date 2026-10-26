import { horairesModifies } from '../agenda/horaires.ts';
import type { Periode } from '../agenda/types.ts';
import { SCHEMA_COPIE } from '../synchro/copie.ts';
import type { Copie } from '../synchro/copie.ts';
import { empreinte } from '../synchro/empreinte.ts';
import { normaliserObjet } from '../synchro/normaliser.ts';
import type { ObjetsLocaux } from '../synchro/objets.ts';
import type { Eleve } from '../types.ts';
import { convertirAgenda } from './agenda.ts';
import type { ActiviteReprise } from './agenda.ts';
import { cleNom, convertirEleve, convertirSeance, creerAnnuaire, estEcart } from './convertir.ts';
import type { EleveRepris, SeanceReprise } from './convertir.ts';
import { fichePiaV75 } from './pia.ts';
import type { FichePiaV75 } from './pia.ts';
import type { Ecart, EtatV75 } from './types.ts';

/*
 * Plan de reprise : tout ce que la V75 contenait, converti, rangé élève par élève, avec ce qui n'a pas pu être repris.
 * Rien n'est écrit ici : l'écran montre ce plan, l'utilisateur choisit, puis seulement on importe.
 */

export interface FicheReprise {
  eleve: Eleve;
  idV75: string;
  seances: SeanceReprise[];
  activites: ActiviteReprise[];
  pia: FichePiaV75;
  /** Séances de la V75 de cet élève qui n'ont pas pu être reprises. */
  ecarts: Ecart[];
  /** Plus ancienne et plus récente date de séance reprise (vides s'il n'y en a pas). */
  premiere: string;
  derniere: string;
  /** Remarques sur ce qui a changé de forme (à lire, rien de grave). */
  alertes: string[];
}

export interface Reprise {
  fiches: FicheReprise[];
  /** Activités d'agenda qui ne concernent pas un dossier (collaboration, formation, administratif, élève sans dossier…). */
  agendaGeneral: ActiviteReprise[];
  /** Horaires des périodes de la V75, s'ils diffèrent des horaires habituels. */
  horaires: Periode[] | null;
  /** Ce qui n'a pas pu être repris et n'appartient à aucun élève (séances sans dossier, activités illisibles). */
  ecarts: Ecart[];
}

export interface ContexteReprise { aujourdhui: string; maintenant: string }

const parDate = (a: SeanceReprise, b: SeanceReprise): number => a.seance.date.localeCompare(b.seance.date) || a.seance.periodeDebut.localeCompare(b.seance.periodeDebut, 'fr', { numeric: true });

export function preparerReprise(etat: EtatV75, ctx: ContexteReprise): Reprise {
  const ecarts: Ecart[] = [];
  const repris: EleveRepris[] = [];
  const vus = new Set<string>();
  const bruts = new Map<string, unknown>();
  for (const brut of etat.eleves) {
    const r = convertirEleve(brut);
    if (estEcart(r)) { ecarts.push(r); continue; }
    if (vus.has(r.eleve.id)) continue;
    vus.add(r.eleve.id);
    bruts.set(r.idV75, brut);
    repris.push(r);
  }
  const annuaire = creerAnnuaire(repris);
  const agenda = convertirAgenda(etat.agenda, { annuaire, aujourdhui: ctx.aujourdhui, maintenant: ctx.maintenant });
  ecarts.push(...agenda.ecarts);

  const fiches = new Map<string, FicheReprise>();
  for (const r of repris) {
    fiches.set(r.eleve.id, {
      eleve: r.eleve, idV75: r.idV75, seances: [], activites: [], ecarts: [], premiere: '', derniere: '', alertes: [...r.alertes],
      pia: fichePiaV75(bruts.get(r.idV75), etat.pias[r.idV75])
    });
  }

  const vuesSeances = new Set<string>();
  for (const brut of etat.seances) {
    const s = convertirSeance(brut, { annuaire, periodesV75: agenda.periodesV75, maintenant: ctx.maintenant });
    if (estEcart(s)) { ecarts.push(s); continue; }
    if (vuesSeances.has(s.seance.id)) continue;
    vuesSeances.add(s.seance.id);
    fiches.get(s.seance.eleveId)?.seances.push(s);
  }

  const agendaGeneral: ActiviteReprise[] = [];
  for (const a of agenda.activites) {
    const fiche = a.activite.eleveId ? fiches.get(a.activite.eleveId) : undefined;
    if (fiche) fiche.activites.push(a); else agendaGeneral.push(a);
  }

  const liste = [...fiches.values()];
  for (const f of liste) {
    f.seances.sort(parDate);
    f.premiere = f.seances[0]?.seance.date ?? '';
    f.derniere = f.seances[f.seances.length - 1]?.seance.date ?? '';
    const avecAlerte = f.seances.filter((s) => s.alertes.length).length;
    if (avecAlerte) f.alertes.push(`${avecAlerte} séance${avecAlerte > 1 ? 's' : ''} avec une précision déplacée (voir le détail dans la séance)`);
  }
  liste.sort((a, b) => cleNom(a.eleve.nom).localeCompare(cleNom(b.eleve.nom), 'fr'));
  return { fiches: liste, agendaGeneral, horaires: agenda.horaires && horairesModifies(agenda.horaires) ? agenda.horaires : null, ecarts };
}

/* ───────── Ce qu'on importe ───────── */

export interface ChoixReprise {
  /** Identifiants V2 des élèves choisis. */
  eleves: ReadonlySet<string>;
  agendaGeneral: boolean;
  horaires: boolean;
}

/** La copie à restaurer : exactement ce qui est coché, rien d'autre. Les PIA de la V75 ne sont jamais convertis. */
export function copieDeReprise(reprise: Reprise, choix: ChoixReprise, maintenant: string): Copie {
  const choisies = reprise.fiches.filter((f) => choix.eleves.has(f.eleve.id));
  const general = choix.agendaGeneral ? reprise.agendaGeneral : [];
  return {
    schema: SCHEMA_COPIE,
    creeLe: maintenant,
    eleves: choisies.map((f) => f.eleve),
    seances: choisies.flatMap((f) => f.seances.map((s) => s.seance)),
    activites: [...choisies.flatMap((f) => f.activites), ...general].map((a) => a.activite),
    pias: [],
    reglages: choix.horaires && reprise.horaires ? [{ id: 'agenda-horaires', valeur: reprise.horaires }] : []
  };
}

/**
 * Un élève déjà présent dans la V2 sous un autre identifiant, dont le nom ressemble : l'importer créerait peut-être un doublon.
 * La V75 n'a qu'une case « nom » (« Séfora » ou « Séfora Dupont ») : on compare les mots, dans un sens comme dans l'autre.
 * C'est un avertissement, jamais un blocage : deux élèves peuvent partager un prénom.
 */
export function doublonDe(fiche: Pick<FicheReprise, 'eleve'>, eleves: readonly Eleve[]): Eleve | null {
  const mots = (t: string): string[] => cleNom(t).split(' ').filter(Boolean);
  const inclus = (a: string[], b: string[]): boolean => a.length > 0 && a.every((m) => b.includes(m));
  const repris = mots(`${fiche.eleve.prenom} ${fiche.eleve.nom}`);
  return eleves.find((e) => {
    if (e.id === fiche.eleve.id) return false;
    const ici = mots(`${e.prenom} ${e.nom}`);
    return inclus(repris, ici) || inclus(ici, repris);
  }) ?? null;
}

/* ───────── Contrôle après import ───────── */

export interface ControleEleve {
  eleveId: string;
  nom: string;
  seances: { attendues: number; trouvees: number };
  activites: { attendues: number; trouvees: number };
  /** Éléments retrouvés mais dont le contenu n'est plus celui qui a été converti. */
  differents: number;
  ok: boolean;
}

export interface ControleReprise { eleves: ControleEleve[]; agendaGeneral: { attendues: number; trouvees: number }; ok: boolean }

/** Relit ce qui est réellement dans la V2 et le compare, élément par élément, à ce qui devait y entrer. */
export async function controlerReprise(copie: Copie, apres: ObjetsLocaux): Promise<ControleReprise> {
  const sceller = async (type: 'eleve' | 'seance' | 'activite', x: unknown): Promise<string> => empreinte(normaliserObjet(type, x));
  const ici = {
    seances: new Map(apres.seances.map((x) => [x.id, x])),
    activites: new Map(apres.activites.map((x) => [x.id, x]))
  };
  let differentsGeneral = 0;
  const comparer = async (type: 'seance' | 'activite', attendu: { id: string }): Promise<'ok' | 'absent' | 'different'> => {
    const trouve = (type === 'seance' ? ici.seances : ici.activites).get(attendu.id);
    if (!trouve) return 'absent';
    return (await sceller(type, trouve)) === (await sceller(type, attendu)) ? 'ok' : 'different';
  };

  const eleves: ControleEleve[] = [];
  for (const e of copie.eleves) {
    const seances = copie.seances.filter((s) => s.eleveId === e.id);
    const activites = copie.activites.filter((a) => a.eleveId === e.id);
    let differents = 0;
    let trouveesS = 0;
    let trouveesA = 0;
    for (const s of seances) { const r = await comparer('seance', s); if (r !== 'absent') trouveesS += 1; if (r === 'different') differents += 1; }
    for (const a of activites) { const r = await comparer('activite', a); if (r !== 'absent') trouveesA += 1; if (r === 'different') differents += 1; }
    const eleveLa = apres.eleves.some((x) => x.id === e.id);
    eleves.push({
      eleveId: e.id, nom: e.nom,
      seances: { attendues: seances.length, trouvees: trouveesS },
      activites: { attendues: activites.length, trouvees: trouveesA },
      differents,
      ok: eleveLa && trouveesS === seances.length && trouveesA === activites.length && differents === 0
    });
  }
  const ids = new Set(copie.eleves.map((e) => e.id));
  const generales = copie.activites.filter((a) => !a.eleveId || !ids.has(a.eleveId));
  let trouveesG = 0;
  for (const a of generales) { const r = await comparer('activite', a); if (r !== 'absent') trouveesG += 1; if (r === 'different') differentsGeneral += 1; }
  const ok = eleves.every((e) => e.ok) && trouveesG === generales.length && differentsGeneral === 0;
  return { eleves, agendaGeneral: { attendues: generales.length, trouvees: trouveesG }, ok };
}
