import { nettoyer } from './langue.ts';

const platCar = (c: string): string => c.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
const plat = (s: string): string => Array.from(s).map(platCar).join('');
const estLettre = (c: string | undefined): boolean => !!c && /[a-z0-9]/.test(c);

/**
 * Remplace chaque nom (mot entier, accents et casse ignorés) par « l’élève ».
 * Les noms les plus longs passent en premier ; les répétitions sont fusionnées.
 */
export function deIdentifier(texte: string, noms: readonly string[]): string {
  let out = String(texte);
  const cibles = noms.map(nettoyer).filter((n) => n.length > 1).sort((a, b) => b.length - a.length);
  for (const nom of cibles) {
    const cible = Array.from(plat(nom));
    const car = Array.from(out);
    const flat = Array.from(plat(out));
    let res = '';
    let i = 0;
    while (i < car.length) {
      const ok = cible.every((c, k) => flat[i + k] === c)
        && !estLettre(flat[i - 1]) && !estLettre(flat[i + cible.length]);
      if (ok) { res += 'l’élève'; i += cible.length; } else { res += car[i] ?? ''; i++; }
    }
    out = res;
  }
  return out.replace(/l’élève(?:[  ]+l’élève)+/g, 'l’élève');
}
