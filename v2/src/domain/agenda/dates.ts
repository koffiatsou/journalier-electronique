/** Dates en AAAA-MM-JJ, sans fuseau (le calendrier scolaire n'en a pas besoin). */
const p2 = (n: number): string => String(n).padStart(2, '0');

export function versISO(d: Date): string {
  return `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`;
}
export function depuisISO(iso: string): Date {
  const [y, m, j] = iso.split('-').map(Number);
  return new Date(y ?? 1970, (m ?? 1) - 1, j ?? 1);
}
export const ajouterJours = (iso: string, n: number): string => {
  const d = depuisISO(iso);
  d.setDate(d.getDate() + n);
  return versISO(d);
};
/** 0 = lundi … 6 = dimanche */
export const indexJour = (iso: string): number => (depuisISO(iso).getDay() + 6) % 7;
export const lundiDe = (iso: string): string => ajouterJours(iso, -indexJour(iso));
export const semaine = (iso: string): string[] => Array.from({ length: 5 }, (_, i) => ajouterJours(lundiDe(iso), i));
export const ecartJours = (a: string, b: string): number => Math.round((depuisISO(b).getTime() - depuisISO(a).getTime()) / 86_400_000);

const JOURS = ['lundi', 'mardi', 'mercredi', 'jeudi', 'vendredi', 'samedi', 'dimanche'];
const MOIS = ['janvier', 'février', 'mars', 'avril', 'mai', 'juin', 'juillet', 'août', 'septembre', 'octobre', 'novembre', 'décembre'];
export const nomJour = (iso: string): string => JOURS[indexJour(iso)]!;
export const jourMois = (iso: string): string => `${depuisISO(iso).getDate()} ${MOIS[depuisISO(iso).getMonth()]}`;
export const jourComplet = (iso: string): string => `${nomJour(iso)} ${jourMois(iso)}`;
export function titreSemaine(iso: string): string {
  const [lun, , , , ven] = semaine(iso);
  const a = depuisISO(lun!); const b = depuisISO(ven!);
  const fin = `${b.getDate()} ${MOIS[b.getMonth()]} ${b.getFullYear()}`;
  return a.getMonth() === b.getMonth() ? `${a.getDate()} – ${fin}` : `${a.getDate()} ${MOIS[a.getMonth()]} – ${fin}`;
}

/* ───────── mois ───────── */
export const debutDuMois = (d: string): string => `${d.slice(0, 7)}-01`;
export const finDuMois = (d: string): string => { const x = depuisISO(d); return versISO(new Date(x.getFullYear(), x.getMonth() + 1, 0)); };
/** Même jour du mois dans n mois (le dernier jour du mois si le jour n'existe pas : 31 janvier + 1 mois = 28 février). */
export function ajouterMois(d: string, n: number): string {
  const x = depuisISO(d);
  const cible = new Date(x.getFullYear(), x.getMonth() + n, 1);
  const dernier = new Date(cible.getFullYear(), cible.getMonth() + 1, 0).getDate();
  return versISO(new Date(cible.getFullYear(), cible.getMonth(), Math.min(x.getDate(), dernier)));
}
export const titreMois = (d: string): string => `${MOIS[depuisISO(d).getMonth()]} ${depuisISO(d).getFullYear()}`;
export const memeMois = (a: string, b: string): boolean => a.slice(0, 7) === b.slice(0, 7);

/**
 * Les semaines (lundi → vendredi) à afficher pour le mois de cette date.
 * Les jours des mois voisins qui complètent la première et la dernière semaine sont inclus (à griser) ;
 * une semaine qui ne contient que des week-ends du mois n'est pas affichée.
 */
export function semainesDuMois(d: string): string[][] {
  const premier = debutDuMois(d);
  const dernier = finDuMois(d);
  const depart = indexJour(premier) > 4 ? lundiDe(ajouterJours(premier, 7)) : lundiDe(premier);
  const semaines: string[][] = [];
  for (let lundi = depart; lundi <= dernier && indexJour(lundi) === 0; lundi = ajouterJours(lundi, 7)) {
    semaines.push(Array.from({ length: 5 }, (_, i) => ajouterJours(lundi, i)));
  }
  return semaines;
}
