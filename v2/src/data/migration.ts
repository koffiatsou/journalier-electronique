import type { Activite } from '../domain/agenda/types.ts';
import type { Pia } from '../domain/pia/types.ts';
import { canonique } from '../domain/synchro/empreinte.ts';
import type { Eleve, Seance } from '../domain/types.ts';
import type { Depot, EntreeSynchro, Reglage } from './repository.ts';

/*
 * Migration des données d'avant le chiffrement (base « journalier-v2 », en clair) vers le coffre.
 * Règles : on copie, on RELIT ce qui a été écrit et on compare objet par objet ; seulement si tout est identique le
 * résultat est « migre » et l'appelant peut supprimer l'ancienne base. Au moindre doute, l'ancienne base reste intacte.
 */

/** Ce qu'on lit dans l'ancienne base (le dépôt en mémoire de tests et l'ancienne base IndexedDB le fournissent). */
export interface SourceAncienne {
  chargerEleves(): Promise<Eleve[]>;
  chargerSeances(): Promise<Seance[]>;
  chargerActivites(): Promise<Activite[]>;
  chargerPias(): Promise<Pia[]>;
  chargerReglages(): Promise<Reglage[]>;
  chargerSynchro(): Promise<EntreeSynchro[]>;
}

export interface BilanMigration {
  /**
   * rien : l'ancienne base est vide · migre : tout est copié et vérifié · reporte : l'espace chiffré contient déjà des
   * données, on ne mélange rien · echec : la copie ou la vérification a échoué (l'appelant doit remettre l'espace à zéro).
   */
  statut: 'rien' | 'migre' | 'reporte' | 'echec';
  eleves: number; seances: number; activites: number; pias: number; reglages: number;
  message: string;
  /**
   * Vrai quand l'échec est survenu APRÈS les premières écritures dans le coffre (qui était vide) : l'appelant doit alors
   * remettre cet espace à zéro, sinon la prochaine tentative croirait y trouver d'autres données. L'ancienne base, elle,
   * n'est jamais touchée par la migration.
   */
  aReinitialiser?: boolean;
}

const BILAN_VIDE = { eleves: 0, seances: 0, activites: 0, pias: 0, reglages: 0 };

/** Même contenu, à l'écriture JSON près (un champ « undefined » disparaît en base : ce n'est pas une différence). */
const pareil = (a: unknown, b: unknown): boolean => canonique(JSON.parse(JSON.stringify(a ?? null))) === canonique(JSON.parse(JSON.stringify(b ?? null)));

function manquantOuDifferent<T extends { id: string }>(attendus: readonly T[], trouves: readonly T[]): string | null {
  if (attendus.length !== trouves.length) return `${attendus.length} attendus, ${trouves.length} relus`;
  const parId = new Map(trouves.map((x) => [x.id, x]));
  for (const a of attendus) if (!pareil(a, parId.get(a.id))) return `« ${a.id} » diffère après copie`;
  return null;
}

export async function migrerVersCoffre(source: SourceAncienne, cible: Depot): Promise<BilanMigration> {
  let eleves: Eleve[]; let seances: Seance[]; let activites: Activite[]; let pias: Pia[]; let reglages: Reglage[]; let synchro: EntreeSynchro[];
  try {
    [eleves, seances, activites, pias, reglages, synchro] = await Promise.all([
      source.chargerEleves(), source.chargerSeances(), source.chargerActivites(), source.chargerPias(), source.chargerReglages(), source.chargerSynchro()
    ]);
  } catch (e) {
    return { statut: 'echec', ...BILAN_VIDE, message: `L’ancienne base n’a pas pu être lue : ${e instanceof Error ? e.message : 'erreur inconnue'}.` };
  }
  const bilan = { eleves: eleves.length, seances: seances.length, activites: activites.length, pias: pias.length, reglages: reglages.length };
  if (!eleves.length && !seances.length && !activites.length && !pias.length && !reglages.length && !synchro.length) return { statut: 'rien', ...BILAN_VIDE, message: 'Aucune ancienne donnée.' };

  const [e2, s2, a2, p2, r2] = await Promise.all([cible.chargerEleves(), cible.chargerSeances(), cible.chargerActivites(), cible.chargerPias(), cible.chargerReglages()]);
  if (e2.length || s2.length || a2.length || p2.length || r2.length) {
    // Déjà copiées lors d'un passage précédent (la suppression de l'ancienne base avait été bloquée) ? Alors tout est déjà chiffré.
    const dejaLa = <T extends { id: string }>(anciens: readonly T[], ici: readonly T[]): boolean => {
      const parId = new Map(ici.map((x) => [x.id, x]));
      return anciens.every((a) => pareil(a, parId.get(a.id)));
    };
    const y2 = await cible.chargerSynchro();
    const registreLa = synchro.every((x) => pareil(x, y2.find((y) => y.cle === x.cle)));
    if (dejaLa(eleves, e2) && dejaLa(seances, s2) && dejaLa(activites, a2) && dejaLa(pias, p2) && dejaLa(reglages, r2) && registreLa) {
      return { statut: 'migre', ...bilan, message: 'Les anciennes données étaient déjà chiffrées.' };
    }
    return { statut: 'reporte', ...bilan, message: 'Des données chiffrées existent déjà ici : les anciennes données non chiffrées n’ont pas été mélangées avec elles.' };
  }

  try {
    for (const x of eleves) await cible.enregistrerEleve(x);
    for (const x of seances) await cible.enregistrerSeance(x);
    for (const x of activites) await cible.enregistrerActivite(x);
    for (const x of pias) await cible.enregistrerPia(x);
    for (const x of reglages) await cible.enregistrerReglage(x);
    if (synchro.length) await cible.enregistrerSynchro(synchro);

    const [e3, s3, a3, p3, r3, y3] = await Promise.all([cible.chargerEleves(), cible.chargerSeances(), cible.chargerActivites(), cible.chargerPias(), cible.chargerReglages(), cible.chargerSynchro()]);
    const ecart = manquantOuDifferent(eleves, e3) ?? manquantOuDifferent(seances, s3) ?? manquantOuDifferent(activites, a3) ?? manquantOuDifferent(pias, p3) ?? manquantOuDifferent(reglages, r3)
      ?? (y3.length === synchro.length && synchro.every((x) => pareil(x, y3.find((y) => y.cle === x.cle))) ? null : 'le registre de synchronisation diffère après copie');
    if (ecart) return { statut: 'echec', ...bilan, aReinitialiser: true, message: `La vérification a échoué (${ecart}). Les anciennes données n’ont pas été touchées.` };
    if (cible.illisibles().length) return { statut: 'echec', ...bilan, aReinitialiser: true, message: 'La vérification a échoué (des éléments copiés sont illisibles). Les anciennes données n’ont pas été touchées.' };
  } catch (e) {
    return { statut: 'echec', ...bilan, aReinitialiser: true, message: `La copie a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Les anciennes données n’ont pas été touchées.` };
  }
  return { statut: 'migre', ...bilan, message: `Anciennes données chiffrées : ${bilan.eleves} élève${bilan.eleves > 1 ? 's' : ''}, ${bilan.seances} séance${bilan.seances > 1 ? 's' : ''}, ${bilan.activites} rendez-vous d’agenda, ${bilan.pias} PIA.` };
}
