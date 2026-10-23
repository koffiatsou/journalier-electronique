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
