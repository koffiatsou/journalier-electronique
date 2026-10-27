import type { Seance } from '../types.ts';
import { ajouterJours, ecartJours, indexJour } from './dates.ts';
import { PERIODES_AGENDA } from './types.ts';
import type { Activite, Occurrence, StatutActivite } from './types.ts';

const indexPeriode = (label: string): number => PERIODES_AGENDA.findIndex((p) => p.label === label);

/** La séance encodée correspond-elle à ce créneau (même élève, même jour, périodes qui se recouvrent) ? */
export function seanceDuCreneau(a: Activite, date: string, debut: number, fin: number, seances: readonly Seance[]): Seance | undefined {
  if (a.type !== 'eleve' || !a.eleveId) return undefined;
  return seances.find((s) => {
    if (s.eleveId !== a.eleveId || s.date !== date) return false;
    const d = indexPeriode(s.periodeDebut);
    const f = indexPeriode(s.periodeFin);
    return d >= 0 && f >= 0 && d <= fin && f >= debut;
  });
}

/** Dates d'une activité entre deux dates incluses (une seule pour une activité unique). */
function datesDansIntervalle(a: Activite, du: string, au: string): string[] {
  if (a.repetition === 'aucune') return a.date >= du && a.date <= au ? [a.date] : [];
  const fin = a.jusquau && a.jusquau < au ? a.jusquau : au;
  const out: string[] = [];
  let d = a.date;
  if (d < du) d = ajouterJours(a.date, Math.ceil(ecartJours(a.date, du) / 7) * 7);
  for (; d <= fin; d = ajouterJours(d, 7)) if (!a.exceptions?.includes(d)) out.push(d);
  return out;
}

export function statutDe(a: Activite, date: string, seances: readonly Seance[]): StatutActivite {
  const propre = a.etats?.[date];
  if (propre === 'annule') return 'annule';
  if (seanceDuCreneau(a, date, a.debut, a.fin, seances)) return 'realise';
  return propre ?? 'prevu';
}

/** Occurrences visibles entre deux dates, du plus tôt au plus tard. */
export function occurrences(activites: readonly Activite[], du: string, au: string, seances: readonly Seance[] = []): Occurrence[] {
  const out: Occurrence[] = [];
  for (const a of activites) {
    for (const date of datesDansIntervalle(a, du, au)) {
      out.push({ cle: `${a.id}@${date}`, activite: a, date, debut: a.debut, fin: a.fin, statut: statutDe(a, date, seances) });
    }
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.debut - y.debut || x.cle.localeCompare(y.cle));
}

/** Activité « virtuelle » qui représente une séance réalisée sans planification (jamais enregistrée). */
function activiteDeSeance(s: Seance, debut: number, fin: number): Activite {
  return {
    id: `seance:${s.id}`, type: 'eleve', eleveId: s.eleveId, titre: '', lieu: '', note: '', date: s.date, debut, fin, repetition: 'aucune',
    ...(s.matiere ? { matiere: s.matiere } : {}), creeLe: '', modifieLe: ''
  };
}

/**
 * Ce que l'agenda affiche : les activités planifiées + toute séance réalisée (présente dans le Journalier) qui n'est couverte par aucune
 * planification de l'élève, même rétroactivement. Une séance dont les périodes ne sont pas celles de l'agenda ne peut pas être placée : elle reste au Journalier.
 */
export function occurrencesAgenda(activites: readonly Activite[], du: string, au: string, seances: readonly Seance[]): Occurrence[] {
  const prevues = occurrences(activites, du, au, seances);
  const out = [...prevues];
  for (const s of seances) {
    if (s.date < du || s.date > au) continue;
    const debut = indexPeriode(s.periodeDebut);
    const fin = indexPeriode(s.periodeFin);
    if (debut < 0 || fin < 0) continue;
    const d = Math.min(debut, fin);
    const f = Math.max(debut, fin);
    if (prevues.some((o) => seanceDuCreneau(o.activite, o.date, o.debut, o.fin, [s]))) continue;
    out.push({ cle: `seance:${s.id}@${s.date}`, activite: activiteDeSeance(s, d, f), date: s.date, debut: d, fin: f, statut: 'realise', seanceId: s.id });
  }
  return out.sort((x, y) => x.date.localeCompare(y.date) || x.debut - y.debut || x.cle.localeCompare(y.cle));
}

/** Mise en colonnes des activités qui se recouvrent (comme un calendrier) : colonne et nombre de colonnes du groupe. */
export function disposer(occ: readonly Occurrence[]): Map<string, { colonne: number; colonnes: number }> {
  const res = new Map<string, { colonne: number; colonnes: number }>();
  const parJour = new Map<string, Occurrence[]>();
  for (const o of occ) parJour.set(o.date, [...(parJour.get(o.date) ?? []), o]);
  for (const liste of parJour.values()) {
    const tri = [...liste].sort((a, b) => a.debut - b.debut || b.fin - a.fin || a.cle.localeCompare(b.cle));
    let groupe: Occurrence[] = [];
    let finGroupe = -1;
    const fermer = () => {
      const colonnes = Math.max(1, ...groupe.map((o) => res.get(o.cle)!.colonne + 1));
      for (const o of groupe) res.set(o.cle, { colonne: res.get(o.cle)!.colonne, colonnes });
      groupe = [];
    };
    for (const o of tri) {
      if (groupe.length && o.debut > finGroupe) fermer();
      const occupees = new Set(groupe.filter((g) => g.fin >= o.debut).map((g) => res.get(g.cle)!.colonne));
      let c = 0;
      while (occupees.has(c)) c++;
      res.set(o.cle, { colonne: c, colonnes: 1 });
      groupe.push(o);
      finGroupe = Math.max(finGroupe, o.fin);
    }
    if (groupe.length) fermer();
  }
  return res;
}

/* ───────── modifications (fonctions pures : elles renvoient les activités à enregistrer et celles à supprimer) ───────── */
export interface Changement { enregistrer: Activite[]; supprimer: string[] }
export type Portee = 'occurrence' | 'serie';

const maintenant = (): string => new Date().toISOString();
export const nouvelIdActivite = (): string => globalThis.crypto?.randomUUID?.() ?? `a-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;

function detacher(a: Activite, date: string, modif: Partial<Activite>, id = nouvelIdActivite()): Changement {
  const serie: Activite = { ...a, exceptions: [...(a.exceptions ?? []), date], modifieLe: maintenant() };
  const { exceptions: _e, etats: _s, jusquau: _j, ...base } = a;
  const unique: Activite = { ...base, ...modif, id, serieId: a.serieId ?? a.id, repetition: 'aucune', date: modif.date ?? date, creeLe: maintenant(), modifieLe: maintenant() };
  const etat = a.etats?.[date];
  if (etat && !modif.etats) unique.etats = { [unique.date]: etat };
  return { enregistrer: [serie, unique], supprimer: [] };
}

/** Déplace une occurrence (autre jour et/ou autres périodes) ; pour toute la série, décale la série entière. */
export function deplacer(o: Occurrence, date: string, debut: number, portee: Portee = 'occurrence'): Changement {
  const longueur = o.fin - o.debut;
  const nouveauDebut = Math.max(0, Math.min(PERIODES_AGENDA.length - 1 - longueur, debut));
  const modif = { date, debut: nouveauDebut, fin: nouveauDebut + longueur };
  if (o.activite.repetition === 'aucune') return { enregistrer: [{ ...o.activite, ...modif, modifieLe: maintenant() }], supprimer: [] };
  if (portee === 'serie') {
    const decalage = ecartJours(o.date, date);
    const a = o.activite;
    return { enregistrer: [{ ...a, date: ajouterJours(a.date, decalage), jusquau: a.jusquau ? ajouterJours(a.jusquau, decalage) : undefined, exceptions: a.exceptions?.map((d) => ajouterJours(d, decalage)), etats: undefined, debut: modif.debut, fin: modif.fin, modifieLe: maintenant() } as Activite], supprimer: [] };
  }
  return detacher(o.activite, o.date, modif);
}

export function redimensionner(o: Occurrence, fin: number, portee: Portee = 'occurrence'): Changement {
  const nouvelleFin = Math.max(o.debut, Math.min(PERIODES_AGENDA.length - 1, fin));
  if (o.activite.repetition === 'aucune') return { enregistrer: [{ ...o.activite, fin: nouvelleFin, modifieLe: maintenant() }], supprimer: [] };
  if (portee === 'serie') return { enregistrer: [{ ...o.activite, fin: nouvelleFin, modifieLe: maintenant() }], supprimer: [] };
  return detacher(o.activite, o.date, { fin: nouvelleFin });
}

/** Copie unique (sans répétition) à une autre date / période. */
export function dupliquer(o: Occurrence, date: string, debut: number): Changement {
  const longueur = o.fin - o.debut;
  const d = Math.max(0, Math.min(PERIODES_AGENDA.length - 1 - longueur, debut));
  const { exceptions: _e, etats: _s, jusquau: _j, serieId: _i, ...base } = o.activite;
  return { enregistrer: [{ ...base, id: nouvelIdActivite(), repetition: 'aucune', date, debut: d, fin: d + longueur, creeLe: maintenant(), modifieLe: maintenant() }], supprimer: [] };
}

export function annuler(o: Occurrence, annule = true): Changement {
  const etats = { ...(o.activite.etats ?? {}) };
  if (annule) etats[o.date] = 'annule'; else delete etats[o.date];
  return { enregistrer: [{ ...o.activite, etats, modifieLe: maintenant() }], supprimer: [] };
}

export function marquerRealisee(o: Occurrence, realise = true): Changement {
  const etats = { ...(o.activite.etats ?? {}) };
  if (realise) etats[o.date] = 'realise'; else delete etats[o.date];
  return { enregistrer: [{ ...o.activite, etats, modifieLe: maintenant() }], supprimer: [] };
}

export function supprimer(o: Occurrence, portee: Portee = 'occurrence'): Changement {
  const a = o.activite;
  if (a.repetition === 'aucune' || portee === 'serie') return { enregistrer: [], supprimer: [a.id] };
  // « cette occurrence » : si c'est la première, on peut simplement décaler le début de la série ; sinon on ajoute une exception
  return { enregistrer: [{ ...a, exceptions: [...(a.exceptions ?? []), o.date], modifieLe: maintenant() }], supprimer: [] };
}

/** Modifie les champs d'une occurrence ou de toute la série (titre, lieu, note, type, élève…). */
export function modifier(o: Occurrence, modif: Partial<Activite>, portee: Portee = 'occurrence'): Changement {
  const a = o.activite;
  if (a.repetition === 'aucune' || portee === 'serie') return { enregistrer: [{ ...a, ...modif, modifieLe: maintenant() }], supprimer: [] };
  return detacher(a, o.date, modif);
}

/** Champs d'une activité modifiés depuis le panneau (la date et les périodes sont toujours fournies). */
export type Edition = Partial<Omit<Activite, 'id' | 'date' | 'debut' | 'fin'>> & { date: string; debut: number; fin: number };

/** Applique une édition complète à une occurrence ou, pour une série, à toute la série (en décalant ses dates si besoin). */
export function editer(o: Occurrence, e: Edition, portee: Portee = 'occurrence'): Changement {
  const a = o.activite;
  const fin = Math.max(e.debut, e.fin);
  const champs = { ...e, fin };
  if (a.repetition === 'aucune') return { enregistrer: [{ ...a, ...champs, modifieLe: maintenant() }], supprimer: [] };
  if (portee === 'occurrence') return detacher(a, o.date, { ...champs, repetition: 'aucune' });
  const decalage = ecartJours(o.date, e.date);
  const { date: _d, ...reste } = champs;
  const jusquau = reste.jusquau ?? (a.jusquau ? ajouterJours(a.jusquau, decalage) : undefined);
  const suite: Activite = {
    ...a, ...reste, date: ajouterJours(a.date, decalage), exceptions: a.exceptions?.map((d) => ajouterJours(d, decalage)),
    etats: decalage === 0 ? a.etats : undefined, modifieLe: maintenant()
  } as Activite;
  if (jusquau) suite.jusquau = jusquau; else delete suite.jusquau;
  return { enregistrer: [suite], supprimer: [] };
}

export function creer(base: Pick<Activite, 'type' | 'date' | 'debut' | 'fin'> & Partial<Activite>): Activite {
  const t = maintenant();
  return { id: nouvelIdActivite(), titre: '', lieu: '', note: '', repetition: 'aucune', creeLe: t, modifieLe: t, ...base };
}

export const estWeekEnd = (iso: string): boolean => indexJour(iso) > 4;

/** Libellé court d'une activité : élève (+ titre) ou titre. */
export function libelle(a: Activite, nomEleve?: string): string {
  if (a.type === 'eleve') return [nomEleve ?? a.nomLibre ?? 'Élève', a.titre].filter(Boolean).join(' — ');
  return a.titre || ({ collaboration: 'Collaboration', formation: 'Formation', administratif: 'Administratif', libre: 'Activité', eleve: '' } as const)[a.type];
}
