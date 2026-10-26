import { useEffect, useMemo, useRef, useState } from 'react';
import { disposer, infosJour, jourMois, libelle, natureJour, nomJour, teinteDe } from '../../domain/agenda/index.ts';
import type { Occurrence, Periode } from '../../domain/agenda/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { geometrie, PH } from './geometrie.ts';

export interface Cible { date: string; debut: number; fin?: number }
export type ModeGeste = 'deplacer' | 'dupliquer' | 'etirer';

interface Props {
  jours: string[];
  periodes: readonly Periode[];
  occurrences: Occurrence[];
  eleves: Eleve[];
  couleurs: ReadonlyMap<string, number>;
  aujourdhui: string;
  selection: string | null;
  onSelection: (o: Occurrence) => void;
  onCreer: (date: string, periode: number) => void;
  onGeste: (o: Occurrence, mode: ModeGeste, cible: Cible) => void;
}

interface Geste { o: Occurrence; mode: ModeGeste; cible: Cible }

const SEUIL = 5;
const APPUI_LONG = 320;

/** Retrouve la case (jour, période) sous le pointeur. */
function caseSous(x: number, y: number): Cible | null {
  for (const el of document.elementsFromPoint(x, y)) {
    const c = (el as HTMLElement).closest?.('[data-date]') as HTMLElement | null;
    if (c?.dataset.date && c.dataset.periode !== undefined) return { date: c.dataset.date, debut: Number(c.dataset.periode) };
  }
  return null;
}

export function Grille({ jours, periodes, occurrences, eleves, couleurs, aujourdhui, selection, onSelection, onCreer, onGeste }: Props) {
  const geo = useMemo(() => geometrie(periodes), [periodes]);
  const disp = useMemo(() => disposer(occurrences), [occurrences]);
  const [geste, setGeste] = useState<Geste | null>(null);
  const suivi = useRef<{ o: Occurrence; mode: ModeGeste; x: number; y: number; actif: boolean; tactile: boolean; minuteur: number | undefined } | null>(null);
  const dernier = useRef<Geste | null>(null);
  const clicIgnore = useRef(false);
  const rappel = useRef({ onGeste, onSelection });
  rappel.current = { onGeste, onSelection };

  const nomDe = (o: Occurrence): string => eleves.find((e) => e.id === o.activite.eleveId) ? `${eleves.find((e) => e.id === o.activite.eleveId)!.prenom} ${eleves.find((e) => e.id === o.activite.eleveId)!.nom}` : '';

  useEffect(() => {
    const bouger = (e: PointerEvent) => {
      const s = suivi.current;
      if (!s) return;
      if (!s.actif) {
        const d = Math.hypot(e.clientX - s.x, e.clientY - s.y);
        if (s.tactile) { if (d > 10) { window.clearTimeout(s.minuteur); suivi.current = null; } return; }
        if (d < SEUIL) return;
        s.actif = true;
      }
      e.preventDefault();
      const c = caseSous(e.clientX, e.clientY);
      if (!c) return;
      const mode: ModeGeste = s.mode === 'etirer' ? 'etirer' : (e.altKey || e.ctrlKey || e.metaKey ? 'dupliquer' : 'deplacer');
      const g: Geste = { o: s.o, mode, cible: s.mode === 'etirer' ? { date: s.o.date, debut: s.o.debut, fin: Math.max(s.o.debut, c.debut) } : c };
      dernier.current = g;
      setGeste(g);
    };
    const finir = () => {
      const s = suivi.current;
      window.clearTimeout(s?.minuteur);
      suivi.current = null;
      const g = dernier.current;
      dernier.current = null;
      if (s?.actif && g) {
        clicIgnore.current = true;
        setTimeout(() => { clicIgnore.current = false; }, 0);
        const identique = g.mode !== 'dupliquer' && g.cible.date === g.o.date && g.cible.debut === g.o.debut && (g.mode !== 'etirer' || g.cible.fin === g.o.fin);
        if (!identique) rappel.current!.onGeste(g.o, g.mode, g.cible);
      }
      setGeste(null);
    };
    const bloquerDefilement = (e: TouchEvent) => { if (suivi.current?.actif) e.preventDefault(); };
    window.addEventListener('pointermove', bouger, { passive: false });
    window.addEventListener('pointerup', finir);
    window.addEventListener('pointercancel', finir);
    window.addEventListener('touchmove', bloquerDefilement, { passive: false });
    return () => {
      window.removeEventListener('pointermove', bouger);
      window.removeEventListener('pointerup', finir);
      window.removeEventListener('pointercancel', finir);
      window.removeEventListener('touchmove', bloquerDefilement);
    };
  }, []);

  const commencer = (e: { button: number; pointerType: string; clientX: number; clientY: number; stopPropagation(): void }, o: Occurrence, mode: ModeGeste) => {
    if (e.button !== 0) return;
    const tactile = e.pointerType === 'touch';
    const s = { o, mode, x: e.clientX, y: e.clientY, actif: false, tactile, minuteur: undefined as number | undefined };
    if (tactile) s.minuteur = window.setTimeout(() => { if (suivi.current === s) { s.actif = true; navigator.vibrate?.(15); } }, APPUI_LONG);
    suivi.current = s;
    if (mode === 'etirer') e.stopPropagation();
  };

  const style = (o: Occurrence, yDeb: number, yFin: number): Record<string, string | number> => {
    const d = disp.get(o.cle) ?? { colonne: 0, colonnes: 1 };
    return { top: yDeb + 2, height: yFin - yDeb - 4, left: `calc(${(d.colonne * 100) / d.colonnes}% + 2px)`, width: `calc(${100 / d.colonnes}% - 4px)` };
  };
  const finY = (i: number): number => geo.y[i]! + PH;

  return (
    <div className="grille" style={{ '--nb-jours': jours.length } as Record<string, number>}>
      <div className="grille-entete" role="row">
        <div />
        {jours.map((j) => {
          const infos = infosJour(j);
          const nature = natureJour(infos);
          return (
            <div key={j} className={`${j === aujourdhui ? 'aujourdhui' : ''} ${nature ? `jour-${nature}` : ''}`.trim()} role="columnheader">
              {nomJour(j).slice(0, 3)}.<strong>{Number(j.slice(8))}</strong>
              <span className="sr-only"> {jourMois(j)}</span>
              {infos.libelle ? <small className="marque-jour">{infos.libelle}</small> : null}
            </div>
          );
        })}
      </div>
      <div className="grille-corps">
        <div className="axe" style={{ height: geo.total }} aria-hidden="true">
          {periodes.map((p, i) => (
            <div key={p.label}>
              <b style={{ position: 'absolute', top: geo.y[i]! + 4 }}>{p.label}</b>
              <span style={{ top: geo.y[i]! + 4 + 22, right: 6, transform: 'none', background: 'none' }}>{p.debut}</span>
            </div>
          ))}
          {geo.pauses.map((p) => <div key={p.y} className="pause-axe" style={{ top: p.y, height: p.h }}>{p.libelle}</div>)}
        </div>
        {jours.map((j) => (
          <div key={j} className={`colonne ${natureJour(infosJour(j)) ? `jour-${natureJour(infosJour(j))}` : ''}`.trim()} style={{ height: geo.total }} role="gridcell">
            {geo.pauses.map((p) => <div key={p.y} className="pause" style={{ top: p.y, height: p.h }} />)}
            {periodes.map((p, i) => (
              <button key={p.label} type="button" className="cellule" data-date={j} data-periode={i}
                style={{ top: geo.y[i]!, height: finY(i) - geo.y[i]! }}
                aria-label={`Nouvelle activité, ${nomJour(j)} ${jourMois(j)}, ${p.label}, ${p.debut}`}
                onClick={() => onCreer(j, i)} />
            ))}
            {occurrences.filter((o) => o.date === j).map((o) => {
              const t = teinteDe(o.activite, couleurs);
              const cls = t.kind === 'couleur' ? `c-${t.index}` : `t-${t.type}`;
              const enCours = geste?.o.cle === o.cle;
              const nom = nomDe(o);
              const etire = enCours && geste?.mode === 'etirer' ? geste.cible.fin ?? o.fin : o.fin;
              return (
                <button key={o.cle} type="button" aria-pressed={selection === o.cle}
                  className={`evt ${cls} ${o.statut === 'annule' ? 'annule' : ''} ${o.statut === 'realise' ? 'realise' : ''} ${enCours && geste?.mode !== 'etirer' ? 'glisse' : ''}`}
                  style={style(o, geo.y[o.debut]!, finY(etire))}
                  aria-label={`${libelle(o.activite, nom || undefined)}, ${nomJour(o.date)} ${jourMois(o.date)}, ${periodes[o.debut]!.label}${o.fin > o.debut ? ` à ${periodes[o.fin]!.label}` : ''}${o.statut === 'annule' ? ', annulé' : o.statut === 'realise' ? ', réalisé' : ''}`}
                  onPointerDown={(e) => commencer(e, o, 'deplacer')}
                  onClick={() => { if (!clicIgnore.current) rappel.current!.onSelection(o); }}>
                  <strong>{libelle(o.activite, nom || undefined)}</strong>
                  <small>{periodes[o.debut]!.label}{o.fin > o.debut ? `–${periodes[o.fin]!.label}` : ''}{o.activite.matiere ? ` · ${o.activite.matiere}` : ''}{o.activite.lieu ? ` · ${o.activite.lieu}` : ''}</small>
                  <span className="evt-poignee" onPointerDown={(e) => commencer(e, o, 'etirer')} aria-hidden="true" />
                </button>
              );
            })}
            {geste && geste.mode !== 'etirer' && geste.cible.date === j ? (() => {
              const t = teinteDe(geste.o.activite, couleurs);
              const longueur = geste.o.fin - geste.o.debut;
              const d = Math.max(0, Math.min(periodes.length - 1 - longueur, geste.cible.debut));
              return <div className={`fantome ${geste.mode === 'dupliquer' ? 'copie' : ''} ${t.kind === 'couleur' ? `c-${t.index}` : `t-${t.type}`}`} style={{ left: 2, right: 2, top: geo.y[d]! + 2, height: finY(d + longueur) - geo.y[d]! - 4 }} />;
            })() : null}
          </div>
        ))}
      </div>
    </div>
  );
}
