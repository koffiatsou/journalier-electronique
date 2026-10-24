import { useEffect, useMemo, useState } from 'react';
import {
  PERIODES_AGENDA, ajouterJours, annuler, couleursEleves, deplacer, dupliquer, indexJour, jourMois, lundiDe, marquerRealisee, nomJour,
  occurrences as calculer, redimensionner, semaine, supprimer, titreSemaine, versISO
} from '../../domain/agenda/index.ts';
import type { Changement, Occurrence, Portee } from '../../domain/agenda/index.ts';
import { defautsSeance } from '../../domain/referentiel/index.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { Grille } from './Grille.tsx';
import type { Cible, ModeGeste } from './Grille.tsx';
import { Panneau } from './Panneau.tsx';
import type { Brouillon } from './Panneau.tsx';

const ETROIT = '(max-width: 759px)';
const LARGE = '(min-width: 1100px)';

function useMedia(requete: string): boolean {
  const [v, setV] = useState(() => globalThis.matchMedia?.(requete).matches ?? false);
  useEffect(() => {
    const m = globalThis.matchMedia?.(requete);
    if (!m) return undefined;
    const f = () => setV(m.matches);
    m.addEventListener('change', f);
    return () => m.removeEventListener('change', f);
  }, [requete]);
  return v;
}

/** Jour affiché au départ : aujourd'hui, ou le lundi suivant si c'est le week-end. */
function jourDeDepart(): string {
  const t = versISO(new Date());
  return indexJour(t) > 4 ? lundiDe(ajouterJours(t, 7)) : t;
}

export function AgendaPage({ magasin }: { magasin: Magasin }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const activites = useMagasin(magasin, (e) => e.activites);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const etroit = useMedia(ETROIT);
  const large = useMedia(LARGE);
  const [focus, setFocus] = useState(jourDeDepart);
  const [vue, setVue] = useState<'semaine' | 'jour'>('semaine');
  const [selection, setSelection] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [filtre, setFiltre] = useState<string | null>(null);

  const vueEffective = etroit ? 'jour' : vue;
  const jours = vueEffective === 'jour' ? [indexJour(focus) > 4 ? lundiDe(ajouterJours(focus, 7)) : focus] : semaine(focus);
  const couleurs = useMemo(() => couleursEleves(eleves), [eleves]);
  const toutes = useMemo(() => calculer(activites, jours[0]!, jours[jours.length - 1]!, seances), [activites, jours, seances]);
  const visibles = filtre ? toutes.filter((o) => o.activite.eleveId === filtre) : toutes;
  const occSelection = selection ? toutes.find((o) => o.cle === selection) ?? null : null;
  const panneauOuvert = Boolean(occSelection || brouillon);
  const aujourdhui = versISO(new Date());

  const elevesDeLaSemaine = useMemo(() => {
    const ids = new Set(toutes.map((o) => o.activite.eleveId).filter((x): x is string => Boolean(x)));
    return eleves.filter((e) => ids.has(e.id));
  }, [toutes, eleves]);

  const appliquer = (c: Changement, message?: string) => { void magasin.changerAgenda(c).then(() => { if (message) annoncer(message); }); };
  const naviguer = (n: number) => setFocus((f) => ajouterJours(f, vueEffective === 'jour' ? n : n * 7));
  const fermer = () => { setSelection(null); setBrouillon(null); };

  const geste = (o: Occurrence, mode: ModeGeste, c: Cible) => {
    if (mode === 'etirer') appliquer(redimensionner(o, c.fin ?? o.fin), 'Durée modifiée');
    else if (mode === 'dupliquer') appliquer(dupliquer(o, c.date, c.debut), 'Activité dupliquée');
    else appliquer(deplacer(o, c.date, c.debut), 'Activité déplacée');
  };

  const encoder = (o: Occurrence) => {
    const el = eleves.find((e) => e.id === o.activite.eleveId);
    magasin.preparerSeance({
      eleveId: o.activite.eleveId ?? '', date: o.date, periodeDebut: PERIODES_AGENDA[o.debut]!.label, periodeFin: PERIODES_AGENDA[o.fin]!.label,
      matiere: o.activite.matiere ?? '', ...defautsSeance(el)
    });
    globalThis.location.hash = '/seance';
  };

  const supprimerOcc = (o: Occurrence, portee: Portee) => { appliquer(supprimer(o, portee), 'Activité supprimée'); fermer(); };

  return (
    <div className="page agenda">
      <header className="page-entete"><h1>Agenda</h1></header>

      <div className="agenda-barre">
        <div className="agenda-nav">
          <Button onClick={() => naviguer(-1)} aria-label={vueEffective === 'jour' ? 'Jour précédent' : 'Semaine précédente'}>‹</Button>
          <Button onClick={() => setFocus(jourDeDepart())}>Aujourd’hui</Button>
          <Button onClick={() => naviguer(1)} aria-label={vueEffective === 'jour' ? 'Jour suivant' : 'Semaine suivante'}>›</Button>
        </div>
        <h2 className="agenda-titre" aria-live="polite">{vueEffective === 'jour' ? `${nomJour(jours[0]!)} ${jourMois(jours[0]!)}` : titreSemaine(focus)}</h2>
        <span className="espace" />
        {!etroit ? (
          <div className="bascule" role="group" aria-label="Affichage">
            <button type="button" aria-pressed={vue === 'semaine'} onClick={() => setVue('semaine')}>Semaine</button>
            <button type="button" aria-pressed={vue === 'jour'} onClick={() => setVue('jour')}>Jour</button>
          </div>
        ) : null}
        <Button variante="primaire" onClick={() => { setSelection(null); setBrouillon({ date: jours[0]!, debut: 0, fin: 0 }); }}>Nouvelle activité</Button>
      </div>

      {etroit ? (
        <div className="jours-onglets" role="group" aria-label="Jour de la semaine">
          {semaine(focus).map((j) => (
            <button key={j} type="button" aria-pressed={j === jours[0]} onClick={() => setFocus(j)}>
              {nomJour(j).slice(0, 1).toUpperCase()}<small>{Number(j.slice(8))}</small>
            </button>
          ))}
        </div>
      ) : null}

      {elevesDeLaSemaine.length ? (
        <div className="legende" role="group" aria-label="Filtrer par élève">
          {elevesDeLaSemaine.map((e) => (
            <button key={e.id} type="button" className={`c-${couleurs.get(e.id) ?? 0}`} aria-pressed={filtre === e.id} onClick={() => setFiltre(filtre === e.id ? null : e.id)}>
              <i />{e.prenom} {e.nom}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`agenda-corps ${panneauOuvert && large ? 'avec-panneau' : ''}`}>
        <Grille jours={jours} occurrences={visibles} eleves={eleves} couleurs={couleurs} aujourdhui={aujourdhui}
          selection={occSelection?.cle ?? null}
          onSelection={(o) => { setBrouillon(null); setSelection(o.cle); }}
          onCreer={(date, p) => { setSelection(null); setBrouillon({ date, debut: p, fin: p }); }}
          onGeste={geste} />
        {occSelection ? (
          <Panneau key={occSelection.cle} occurrence={occSelection} nouveau={null} eleves={eleves}
            onChanger={(c) => appliquer(c, 'Activité enregistrée')} onFermer={fermer} onEncoder={encoder}
            onDupliquer={(o) => { appliquer(dupliquer(o, ajouterJours(o.date, 7), o.debut), 'Dupliquée à la semaine suivante'); fermer(); }}
            onAnnuler={(o) => { appliquer(annuler(o, o.statut !== 'annule'), o.statut === 'annule' ? 'Activité rétablie' : 'Activité annulée'); fermer(); }}
            onRealiser={(o) => { appliquer(marquerRealisee(o, o.statut !== 'realise')); fermer(); }}
            onSupprimer={supprimerOcc} />
        ) : brouillon ? (
          <Panneau key={`n-${brouillon.date}-${brouillon.debut}`} occurrence={null} nouveau={brouillon} eleves={eleves}
            onChanger={(c) => appliquer(c, 'Activité ajoutée')} onFermer={fermer} onEncoder={encoder}
            onDupliquer={() => undefined} onAnnuler={() => undefined} onRealiser={() => undefined} onSupprimer={() => undefined} />
        ) : null}
      </div>
    </div>
  );
}
