import { useMemo } from 'react';
import { infosJour, jourComplet, jourMois, libelle, memeMois, natureJour, semainesDuMois, teinteDe } from '../../domain/agenda/index.ts';
import type { Occurrence, Periode } from '../../domain/agenda/index.ts';
import type { Eleve } from '../../domain/types.ts';

interface Props {
  /** N'importe quelle date du mois à afficher. */
  jour: string;
  periodes: readonly Periode[];
  occurrences: Occurrence[];
  eleves: Eleve[];
  couleurs: ReadonlyMap<string, number>;
  aujourdhui: string;
  selection: string | null;
  etroit: boolean;
  onSelection: (o: Occurrence) => void;
  /** Ouvre la vue Jour de cette date. */
  onJour: (date: string) => void;
}

const ENTETES = ['lun.', 'mar.', 'mer.', 'jeu.', 'ven.'];
/** Activités montrées par case avant « + N autres » (sur téléphone : de simples pastilles, plus nombreuses). */
const MAX_LARGE = 3;
const MAX_ETROIT = 4;

/** Vue Mois : une case par jour de classe possible (lundi à vendredi), fériés et vacances signalés. */
export function Mois({ jour, periodes, occurrences, eleves, couleurs, aujourdhui, selection, etroit, onSelection, onJour }: Props) {
  const semaines = useMemo(() => semainesDuMois(jour), [jour]);
  const parJour = useMemo(() => {
    const m = new Map<string, Occurrence[]>();
    for (const o of occurrences) m.set(o.date, [...(m.get(o.date) ?? []), o]);
    return m;
  }, [occurrences]);
  const nomDe = (o: Occurrence): string | undefined => {
    const e = eleves.find((x) => x.id === o.activite.eleveId);
    return e ? `${e.prenom} ${e.nom}` : undefined;
  };
  const max = etroit ? MAX_ETROIT : MAX_LARGE;

  return (
    <div className="mois" role="grid" aria-label="Mois">
      <div className="mois-entete" role="row">
        {ENTETES.map((n) => <div key={n} role="columnheader">{n}</div>)}
      </div>
      {semaines.map((sem) => (
        <div key={sem[0]} className="mois-semaine" role="row">
          {sem.map((j) => {
            const infos = infosJour(j);
            const nature = natureJour(infos);
            const occ = parJour.get(j) ?? [];
            const visibles = occ.slice(0, max);
            const reste = occ.length - visibles.length;
            const classes = ['mois-case', nature ? `jour-${nature}` : '', memeMois(j, jour) ? '' : 'hors-mois', j === aujourdhui ? 'aujourdhui' : ''].filter(Boolean).join(' ');
            return (
              <div key={j} className={classes} role="gridcell">
                <button type="button" className="mois-jour" onClick={() => onJour(j)}
                  aria-label={`${jourComplet(j)}${infos.libelle ? `, ${infos.libelle}` : ''}${occ.length ? `, ${occ.length} activité${occ.length > 1 ? 's' : ''}` : ''}. Ouvrir ce jour`}>
                  <strong>{Number(j.slice(8))}</strong>
                  {j.endsWith('-01') ? <small>{jourMois(j).split(' ')[1]}</small> : null}
                </button>
                {infos.libelle ? <small className="marque-jour">{infos.libelle}</small> : null}
                <ul className="mois-evts">
                  {visibles.map((o) => {
                    const t = teinteDe(o.activite, couleurs);
                    const texte = libelle(o.activite, nomDe(o));
                    const quand = `${periodes[o.debut]?.label ?? ''}${o.fin > o.debut ? ` à ${periodes[o.fin]?.label ?? ''}` : ''}`;
                    const teinte = t.kind === 'couleur' ? `c-${t.index}` : `t-${t.type}`;
                    // Sur téléphone : simples pastilles (le détail s'ouvre en touchant le jour).
                    if (etroit) return <li key={o.cle}><span className={`mois-pastille ${teinte} ${o.statut === 'annule' ? 'annule' : ''}`} aria-hidden="true" /></li>;
                    return (
                      <li key={o.cle}>
                        <button type="button" aria-pressed={selection === o.cle}
                          className={`mois-evt ${teinte} ${o.statut === 'annule' ? 'annule' : ''}`}
                          aria-label={`${texte}, ${jourComplet(o.date)}, ${quand}${o.statut === 'annule' ? ', annulé' : o.statut === 'realise' ? ', réalisé' : ''}`}
                          title={`${texte} (${quand})`}
                          onClick={() => onSelection(o)}>
                          {texte}
                        </button>
                      </li>
                    );
                  })}
                  {reste > 0 && etroit ? <li className="mois-reste" aria-hidden="true">+{reste}</li> : null}
                </ul>
                {reste > 0 && !etroit ? <button type="button" className="mois-plus" onClick={() => onJour(j)}>+ {reste} autre{reste > 1 ? 's' : ''}</button> : null}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
