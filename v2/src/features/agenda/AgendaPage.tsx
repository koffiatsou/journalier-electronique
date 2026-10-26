import { useEffect, useMemo, useState } from 'react';
import {
  ajouterJours, ajouterMois, annuler, calendrierConnu, couleursEleves, deplacer, dupliquer, indexJour, jourMois, lundiDe, marquerRealisee, nomJour,
  occurrences as calculer, redimensionner, semaine, semainesDuMois, supprimer, titreMois, titreSemaine, versISO
} from '../../domain/agenda/index.ts';
import type { Changement, Occurrence, Portee } from '../../domain/agenda/index.ts';
import { defautsSeance } from '../../domain/referentiel/index.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { Grille } from './Grille.tsx';
import { HorairesDialog } from './HorairesDialog.tsx';
import { Mois } from './Mois.tsx';
import { SemaineTypeDialog } from './SemaineTypeDialog.tsx';
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
  const horaires = useMagasin(magasin, (e) => e.horaires);
  const semaineType = useMagasin(magasin, (e) => e.semaineType);
  const { annoncer } = useToast();
  const etroit = useMedia(ETROIT);
  const large = useMedia(LARGE);
  const [focus, setFocus] = useState(jourDeDepart);
  const [vue, setVue] = useState<'semaine' | 'jour' | 'mois'>('semaine');
  const [horairesOuverts, setHorairesOuverts] = useState(false);
  const [semaineTypeOuverte, setSemaineTypeOuverte] = useState(false);
  const [selection, setSelection] = useState<string | null>(null);
  const [brouillon, setBrouillon] = useState<Brouillon | null>(null);
  const [filtre, setFiltre] = useState<string | null>(null);

  // Sur téléphone, la semaine est trop large : on affiche le jour.
  const vueEffective = etroit && vue === 'semaine' ? 'jour' : vue;
  const mois = vueEffective === 'mois';
  const jourCourant = indexJour(focus) > 4 ? lundiDe(ajouterJours(focus, 7)) : focus;
  const jours = vueEffective === 'semaine' ? semaine(focus) : [jourCourant];
  const couleurs = useMemo(() => couleursEleves(eleves), [eleves]);
  const du = mois ? semainesDuMois(focus)[0]![0]! : jours[0]!;
  const au = mois ? semainesDuMois(focus).at(-1)![4]! : jours[jours.length - 1]!;
  const toutes = useMemo(() => calculer(activites, du, au, seances), [activites, du, au, seances]);
  const visibles = filtre ? toutes.filter((o) => o.activite.eleveId === filtre) : toutes;
  const occSelection = selection ? toutes.find((o) => o.cle === selection) ?? null : null;
  const panneauOuvert = Boolean(occSelection || brouillon);
  const aujourdhui = versISO(new Date());

  const vacancesInconnues = !calendrierConnu(du) || !calendrierConnu(au);

  const elevesAffiches = useMemo(() => {
    const ids = new Set(toutes.map((o) => o.activite.eleveId).filter((x): x is string => Boolean(x)));
    return eleves.filter((e) => ids.has(e.id));
  }, [toutes, eleves]);

  const appliquer = (c: Changement, message?: string) => { void magasin.changerAgenda(c).then(() => { if (message) annoncer(message); }); };
  const naviguer = (n: number) => setFocus((f) => (mois ? ajouterMois(f, n) : ajouterJours(f, vueEffective === 'jour' ? n : n * 7)));
  const fermer = () => { setSelection(null); setBrouillon(null); };

  const geste = (o: Occurrence, mode: ModeGeste, c: Cible) => {
    if (mode === 'etirer') appliquer(redimensionner(o, c.fin ?? o.fin), 'Durée modifiée');
    else if (mode === 'dupliquer') appliquer(dupliquer(o, c.date, c.debut), 'Activité dupliquée');
    else appliquer(deplacer(o, c.date, c.debut), 'Activité déplacée');
  };

  const encoder = (o: Occurrence) => {
    const el = eleves.find((e) => e.id === o.activite.eleveId);
    magasin.preparerSeance({
      eleveId: o.activite.eleveId ?? '', date: o.date, periodeDebut: horaires[o.debut]!.label, periodeFin: horaires[o.fin]!.label,
      matiere: o.activite.matiere ?? '', ...defautsSeance(el)
    });
    globalThis.location.hash = '/seance';
  };

  const supprimerOcc = (o: Occurrence, portee: Portee) => { appliquer(supprimer(o, portee), 'Activité supprimée'); fermer(); };

  return (
    <div className="page agenda">
      <header className="page-entete"><h1>Agenda</h1></header>

      <p className="agenda-impression-titre">
        Agenda · {mois ? titreMois(focus) : vueEffective === 'jour' ? `${nomJour(jours[0]!)} ${jourMois(jours[0]!)}` : titreSemaine(focus)}
        {filtre ? ` · ${eleves.find((e) => e.id === filtre)?.prenom ?? ''} ${eleves.find((e) => e.id === filtre)?.nom ?? ''}` : ''}
      </p>

      <div className="agenda-barre">
        <div className="agenda-nav">
          <Button onClick={() => naviguer(-1)} aria-label={mois ? 'Mois précédent' : vueEffective === 'jour' ? 'Jour précédent' : 'Semaine précédente'}>‹</Button>
          <Button onClick={() => setFocus(jourDeDepart())}>Aujourd’hui</Button>
          <Button onClick={() => naviguer(1)} aria-label={mois ? 'Mois suivant' : vueEffective === 'jour' ? 'Jour suivant' : 'Semaine suivante'}>›</Button>
        </div>
        <h2 className="agenda-titre" aria-live="polite">{mois ? titreMois(focus) : vueEffective === 'jour' ? `${nomJour(jours[0]!)} ${jourMois(jours[0]!)}` : titreSemaine(focus)}</h2>
        <span className="espace" />
        <div className="bascule" role="group" aria-label="Affichage">
          {!etroit ? <button type="button" aria-pressed={vueEffective === 'semaine'} onClick={() => setVue('semaine')}>Semaine</button> : null}
          <button type="button" aria-pressed={vueEffective === 'jour'} onClick={() => setVue('jour')}>Jour</button>
          <button type="button" aria-pressed={vueEffective === 'mois'} onClick={() => setVue('mois')}>Mois</button>
        </div>
        <Button variante="discret" onClick={() => setHorairesOuverts(true)}>Horaires</Button>
        <Button variante="discret" onClick={() => setSemaineTypeOuverte(true)}>Semaine type</Button>
        <Button variante="discret" onClick={() => globalThis.print()}>Imprimer</Button>
        <Button variante="primaire" onClick={() => { setSelection(null); setBrouillon({ date: jourCourant, debut: 0, fin: 0 }); }}>Nouvelle activité</Button>
      </div>

      {vacancesInconnues ? (
        <p className="agenda-note" role="note">Les vacances scolaires de cette période ne sont pas encore dans l’application : seuls les jours fériés et les vacances d’été sont indiqués.</p>
      ) : null}

      {etroit && vueEffective === 'jour' ? (
        <div className="jours-onglets" role="group" aria-label="Jour de la semaine">
          {semaine(focus).map((j) => (
            <button key={j} type="button" aria-pressed={j === jours[0]} onClick={() => setFocus(j)}>
              {nomJour(j).slice(0, 1).toUpperCase()}<small>{Number(j.slice(8))}</small>
            </button>
          ))}
        </div>
      ) : null}

      {elevesAffiches.length ? (
        <div className="legende" role="group" aria-label="Filtrer par élève">
          {elevesAffiches.map((e) => (
            <button key={e.id} type="button" className={`c-${couleurs.get(e.id) ?? 0}`} aria-pressed={filtre === e.id} onClick={() => setFiltre(filtre === e.id ? null : e.id)}>
              <i />{e.prenom} {e.nom}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`agenda-corps ${panneauOuvert && large ? 'avec-panneau' : ''}`}>
        {mois ? (
          <Mois jour={focus} periodes={horaires} occurrences={visibles} eleves={eleves} couleurs={couleurs} aujourdhui={aujourdhui}
            selection={occSelection?.cle ?? null} etroit={etroit}
            onSelection={(o) => { setBrouillon(null); setSelection(o.cle); }}
            onJour={(date) => { fermer(); setFocus(date); setVue('jour'); }}
            onCreer={(date) => { setSelection(null); setBrouillon({ date, debut: 0, fin: 0 }); }}
            onDeplacer={(o, date, copier) => (copier
              ? appliquer(dupliquer(o, date, o.debut), 'Activité dupliquée')
              : appliquer(deplacer(o, date, o.debut), 'Activité déplacée'))} />
        ) : (
          <Grille jours={jours} periodes={horaires} occurrences={visibles} eleves={eleves} couleurs={couleurs} aujourdhui={aujourdhui}
            selection={occSelection?.cle ?? null}
            onSelection={(o) => { setBrouillon(null); setSelection(o.cle); }}
            onCreer={(date, debut, fin) => { setSelection(null); setBrouillon({ date, debut, fin }); }}
            onGeste={geste} />
        )}
        {occSelection ? (
          <Panneau key={occSelection.cle} occurrence={occSelection} periodes={horaires} nouveau={null} eleves={eleves}
            onChanger={(c) => appliquer(c, 'Activité enregistrée')} onFermer={fermer} onEncoder={encoder}
            onDupliquer={(o) => { appliquer(dupliquer(o, ajouterJours(o.date, 7), o.debut), 'Dupliquée à la semaine suivante'); fermer(); }}
            onAnnuler={(o) => { appliquer(annuler(o, o.statut !== 'annule'), o.statut === 'annule' ? 'Activité rétablie' : 'Activité annulée'); fermer(); }}
            onRealiser={(o) => { appliquer(marquerRealisee(o, o.statut !== 'realise')); fermer(); }}
            onSupprimer={supprimerOcc} />
        ) : brouillon ? (
          <Panneau key={`n-${brouillon.date}-${brouillon.debut}`} occurrence={null} periodes={horaires} nouveau={brouillon} eleves={eleves}
            onChanger={(c) => appliquer(c, 'Activité ajoutée')} onFermer={fermer} onEncoder={encoder}
            onDupliquer={() => undefined} onAnnuler={() => undefined} onRealiser={() => undefined} onSupprimer={() => undefined} />
        ) : null}
      </div>

      <SemaineTypeDialog ouvert={semaineTypeOuverte} jour={jourCourant} aujourdhui={aujourdhui} modele={semaineType} periodes={horaires}
        eleves={eleves} activites={activites} seances={seances} onFermer={() => setSemaineTypeOuverte(false)}
        onEnregistrer={(m) => { void magasin.enregistrerSemaineType(m).then(() => annoncer(m ? 'Semaine type enregistrée' : 'Semaine type supprimée')); }}
        onAppliquer={(c, n) => appliquer(c, `${n} activité${n > 1 ? 's' : ''} ajoutée${n > 1 ? 's' : ''}`)} />

      <HorairesDialog ouvert={horairesOuverts} horaires={horaires} onFermer={() => setHorairesOuverts(false)}
        onEnregistrer={async (p) => {
          const erreurs = await magasin.changerHoraires(p);
          if (!erreurs.length) { setHorairesOuverts(false); annoncer('Horaires enregistrés'); }
          return erreurs;
        }} />
    </div>
  );
}
