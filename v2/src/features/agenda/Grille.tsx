import { useEffect, useMemo, useRef, useState } from 'react';
import { disposer, heuresDe, infosJour, jourMois, libelle, libelleHeures, natureJour, nomJour, teinteDe } from '../../domain/agenda/index.ts';
import type { Ecole, Occurrence, Periode } from '../../domain/agenda/index.ts';
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
  /** École d'une occurrence (heures réelles de la case). */
  ecoleDe: (o: Occurrence) => Ecole;
  /** Plusieurs écoles : chaque case indique l'heure réelle et l'école. */
  plusieurs: boolean;
  /** Clés des occurrences concernées par un avertissement (chevauchement, trajet trop court). */
  alertes: ReadonlySet<string>;
  onSelection: (o: Occurrence) => void;
  /** Création d'une activité : une période (clic) ou plusieurs (glisser sur les cases vides). */
  onCreer: (date: string, debut: number, fin: number) => void;
  onGeste: (o: Occurrence, mode: ModeGeste, cible: Cible) => void;
}

interface Geste { o: Occurrence; mode: ModeGeste; cible: Cible }
/** Sélection en cours sur des cases vides d'un même jour : de la période de départ à la période sous le pointeur. */
interface Selection { date: string; depart: number; courant: number }

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

export function Grille({ jours, periodes, occurrences, eleves, couleurs, aujourdhui, selection, ecoleDe, plusieurs, alertes, onSelection, onCreer, onGeste }: Props) {
  const geo = useMemo(() => geometrie(periodes), [periodes]);
  const disp = useMemo(() => disposer(occurrences), [occurrences]);
  const [geste, setGeste] = useState<Geste | null>(null);
  const [creation, setCreation] = useState<Selection | null>(null);
  const suiviCreation = useRef<{ date: string; depart: number; courant: number; x: number; y: number; actif: boolean; tactile: boolean; minuteur: number | undefined } | null>(null);
  const suivi = useRef<{ o: Occurrence; mode: ModeGeste; x: number; y: number; actif: boolean; tactile: boolean; minuteur: number | undefined } | null>(null);
  const dernier = useRef<Geste | null>(null);
  const clicIgnore = useRef(false);
  const rappel = useRef({ onGeste, onSelection, onCreer });
  rappel.current = { onGeste, onSelection, onCreer };

  const nomDe = (o: Occurrence): string => eleves.find((e) => e.id === o.activite.eleveId) ? `${eleves.find((e) => e.id === o.activite.eleveId)!.prenom} ${eleves.find((e) => e.id === o.activite.eleveId)!.nom}` : '';

  useEffect(() => {
    const bouger = (e: PointerEvent) => {
      const n = suiviCreation.current;
      if (n) {
        if (!n.actif) {
          const d = Math.hypot(e.clientX - n.x, e.clientY - n.y);
          if (n.tactile) { if (d > 10) { window.clearTimeout(n.minuteur); suiviCreation.current = null; } return; }
          if (d < SEUIL) return;
          n.actif = true;
        }
        e.preventDefault();
        const c = caseSous(e.clientX, e.clientY);
        // On reste dans la colonne du jour de départ ; hors de la colonne, la sélection garde sa dernière taille.
        if (c && c.date === n.date) { n.courant = c.debut; setCreation({ date: n.date, depart: n.depart, courant: c.debut }); }
        return;
      }
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
      const n = suiviCreation.current;
      if (n) {
        window.clearTimeout(n.minuteur);
        suiviCreation.current = null;
        setCreation(null);
        if (n.actif) {
          clicIgnore.current = true;
          setTimeout(() => { clicIgnore.current = false; }, 0);
          rappel.current.onCreer(n.date, Math.min(n.depart, n.courant), Math.max(n.depart, n.courant));
        }
        return;
      }
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
    const bloquerDefilement = (e: TouchEvent) => { if (suivi.current?.actif || suiviCreation.current?.actif) e.preventDefault(); };
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
    if (e.button !== 0 || o.seanceId) return; // une séance sans planification ne se déplace pas : elle suit la séance
    const tactile = e.pointerType === 'touch';
    const s = { o, mode, x: e.clientX, y: e.clientY, actif: false, tactile, minuteur: undefined as number | undefined };
    if (tactile) s.minuteur = window.setTimeout(() => { if (suivi.current === s) { s.actif = true; navigator.vibrate?.(15); } }, APPUI_LONG);
    suivi.current = s;
    if (mode === 'etirer') e.stopPropagation();
  };

  const commencerCreation = (e: React.PointerEvent, date: string, periode: number) => {
    if (e.button !== 0) return;
    const tactile = e.pointerType === 'touch';
    const s = { date, depart: periode, courant: periode, x: e.clientX, y: e.clientY, actif: false, tactile, minuteur: undefined as number | undefined };
    if (tactile) s.minuteur = window.setTimeout(() => { if (suiviCreation.current === s) { s.actif = true; navigator.vibrate?.(15); setCreation({ date, depart: periode, courant: periode }); } }, APPUI_LONG);
    suiviCreation.current = s;
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
                aria-label={`Nouvelle activité, ${nomJour(j)} ${jourMois(j)}, ${p.label}${p.debut ? `, ${p.debut}` : ''}`}
                onPointerDown={(e) => commencerCreation(e, j, i)}
                onClick={() => { if (!clicIgnore.current) onCreer(j, i, i); }} />
            ))}
            {occurrences.filter((o) => o.date === j).map((o) => {
              const t = teinteDe(o.activite, couleurs);
              const cls = t.kind === 'couleur' ? `c-${t.index}` : `t-${t.type}`;
              const enCours = geste?.o.cle === o.cle;
              const nom = nomDe(o);
              const etire = enCours && geste?.mode === 'etirer' ? geste.cible.fin ?? o.fin : o.fin;
              const ecole = plusieurs ? ecoleDe(o) : null;
              const heures = ecole ? libelleHeures(heuresDe(ecole, o.debut, o.fin)) : '';
              const alerte = alertes.has(o.cle);
              return (
                <button key={o.cle} type="button" aria-pressed={selection === o.cle}
                  className={`evt ${cls} ${alerte ? 'alerte' : ''} ${o.statut === 'annule' ? 'annule' : ''} ${o.statut === 'realise' ? 'realise' : ''} ${enCours && geste?.mode !== 'etirer' ? 'glisse' : ''}`}
                  style={style(o, geo.y[o.debut]!, finY(etire))}
                  aria-label={`${libelle(o.activite, nom || undefined)}, ${nomJour(o.date)} ${jourMois(o.date)}, ${periodes[o.debut]!.label}${o.fin > o.debut ? ` à ${periodes[o.fin]!.label}` : ''}${heures ? `, ${heures}` : ''}${ecole ? `, ${ecole.nom}` : ''}${o.statut === 'annule' ? ', annulé' : o.statut === 'realise' ? ', réalisé' : ''}${alerte ? ', attention : chevauchement ou trajet trop court' : ''}`}
                  onPointerDown={(e) => commencer(e, o, 'deplacer')}
                  onClick={() => { if (!clicIgnore.current) rappel.current!.onSelection(o); }}>
                  <strong>{libelle(o.activite, nom || undefined)}</strong>
                  <small>{periodes[o.debut]!.label}{o.fin > o.debut ? `–${periodes[o.fin]!.label}` : ''}{o.activite.matiere ? ` · ${o.activite.matiere}` : ''}{o.activite.lieu ? ` · ${o.activite.lieu}` : ''}</small>
                  {ecole ? <small className="evt-ecole">{heures ? `${heures} · ` : ''}{ecole.nom}</small> : null}
                  {o.seanceId ? null : <span className="evt-poignee" onPointerDown={(e) => commencer(e, o, 'etirer')} aria-hidden="true" />}
                </button>
              );
            })}
            {creation && creation.date === j ? (() => {
              const d = Math.min(creation.depart, creation.courant);
              const f = Math.max(creation.depart, creation.courant);
              return <div className="fantome creation c-0" aria-hidden="true" style={{ left: 2, right: 2, top: geo.y[d]! + 2, height: finY(f) - geo.y[d]! - 4 }} />;
            })() : null}
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
