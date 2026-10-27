import { useMemo, useRef, useState } from 'react';
import {
  TRAJET_MAXI, cleNom, ecoleParDefaut, horairesModifies, horairesParDefaut, libellePause, MAX_ECOLES, nbPeriodesUtilisees, nouvelIdEcole,
  pauseAvant, rattachement, verifierEcoles
} from '../../domain/agenda/index.ts';
import type { Ecole, ErreurEcole } from '../../domain/agenda/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Dialog } from '../../ui/Dialog.tsx';

interface Props {
  ouvert: boolean;
  ecoles: readonly Ecole[];
  trajet: number;
  eleves: readonly Eleve[];
  /** Renvoie les erreurs si le réglage est refusé ; liste vide = enregistré. */
  onEnregistrer: (ecoles: Ecole[], trajet: number) => Promise<ErreurEcole[]>;
  onFermer: () => void;
}

/**
 * Réglage des écoles et des horaires de leurs périodes. Les noms des périodes (1e H…) ne changent pas : les séances déjà
 * encodées gardent leur période. La première école est l'école par défaut.
 */
export function HorairesDialog({ ouvert, ...reste }: Props) {
  return (
    <Dialog ouvert={ouvert} titre="Horaires des périodes" onFermer={reste.onFermer}>
      {ouvert ? <Formulaire {...reste} /> : null}
    </Dialog>
  );
}

function Formulaire({ ecoles, trajet: trajetInitial, eleves, onEnregistrer, onFermer }: Omit<Props, 'ouvert'>) {
  const [brouillon, setBrouillon] = useState<Ecole[]>(() => ecoles.map((e) => ({ ...e, periodes: e.periodes.map((p) => ({ ...p })) })));
  const [trajet, setTrajet] = useState(String(trajetInitial));
  const [courante, setCourante] = useState(ecoles[0]!.id);
  const [refus, setRefus] = useState<ErreurEcole[]>([]);
  const [confirmeSuppression, setConfirmeSuppression] = useState(false);
  const nom = useRef<HTMLInputElement>(null);

  const plusieurs = brouillon.length > 1;
  const ecole = brouillon.find((e) => e.id === courante) ?? brouillon[0]!;
  const trajetValeur = trajet.trim() === '' ? NaN : Number(trajet);
  const trajetOk = Number.isInteger(trajetValeur) && trajetValeur >= 0 && trajetValeur <= TRAJET_MAXI;
  const erreurs = useMemo(() => verifierEcoles(brouillon), [brouillon]);
  const erreursPeriodes = new Map(erreurs.filter((e) => e.ecoleId === ecole.id && e.index !== undefined).map((e) => [e.index!, e.message]));
  const inchange = JSON.stringify(brouillon) === JSON.stringify(ecoles) && trajetValeur === trajetInitial;
  const nomsConnus = useMemo(() => [...new Set(eleves.map((e) => e.ecole.trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, 'fr')), [eleves]);
  const dejaChoisis = new Set(brouillon.map((e) => cleNom(e.nom)));
  const suggestions = nomsConnus.filter((n) => !dejaChoisis.has(cleNom(n)));

  const modifier = (id: string, suite: (e: Ecole) => Ecole) => { setRefus([]); setBrouillon((b) => b.map((e) => (e.id === id ? suite(e) : e))); };
  const changerHeure = (i: number, champ: 'debut' | 'fin', valeur: string) => modifier(ecole.id, (e) => ({ ...e, periodes: e.periodes.map((p, j) => (j === i ? { ...p, [champ]: valeur } : p)) }));

  const ajouter = () => {
    setRefus([]);
    const id = nouvelIdEcole(brouillon);
    // Une nouvelle école démarre avec les horaires de l'école affichée : il ne reste qu'à corriger ce qui diffère.
    setBrouillon((b) => [...b, { id, nom: '', periodes: ecole.periodes.map((p) => ({ ...p })) }]);
    setCourante(id);
    setConfirmeSuppression(false);
    setTimeout(() => nom.current?.focus(), 0);
  };
  const supprimer = () => {
    setRefus([]);
    const reste = brouillon.filter((e) => e.id !== ecole.id);
    setBrouillon(reste);
    setCourante(reste[0]!.id);
    setConfirmeSuppression(false);
  };
  const mettreParDefaut = () => { setRefus([]); setBrouillon((b) => [ecole, ...b.filter((e) => e.id !== ecole.id)]); };
  const enregistrer = async () => {
    const r = await onEnregistrer(brouillon, trajetValeur);
    if (r.length) setRefus(r);
  };

  const rattaches = eleves.filter((e) => rattachement(e, brouillon)?.id === ecole.id).length;
  const parDefaut = ecoleParDefaut(brouillon).id === ecole.id;
  const montrer = erreurs.length ? erreurs : refus;

  return (
    <>
      <p className="field-hint">
        Indiquez l’heure de début et de fin de chaque période. L’écart entre deux périodes devient une pause (récré ou midi).
        Les séances déjà encodées gardent leur période (1e H, 2e H…). Laissez vide une période que l’école n’utilise pas.
      </p>

      <div className="ecoles-choix" role="group" aria-label="École à régler">
        {brouillon.map((e) => (
          <button key={e.id} type="button" className="chip" aria-pressed={e.id === ecole.id} onClick={() => { setCourante(e.id); setConfirmeSuppression(false); }}>
            {e.nom.trim() || 'Nouvelle école'}{e.id === brouillon[0]!.id && plusieurs ? ' (par défaut)' : ''}
          </button>
        ))}
        {brouillon.length < MAX_ECOLES ? <Button variante="discret" onClick={ajouter}>Ajouter une école</Button> : null}
      </div>

      <div className="field">
        <label className="field-label" htmlFor="ecole-nom">Nom de l’école</label>
        <input id="ecole-nom" ref={nom} className="input" list="ecole-noms" value={ecole.nom} placeholder="Ex. : Institut Saint-Joseph"
          onChange={(e) => modifier(ecole.id, (x) => ({ ...x, nom: e.target.value }))} />
        <datalist id="ecole-noms">{suggestions.map((n) => <option key={n} value={n} />)}</datalist>
        <p className="field-hint">Les élèves dont l’école porte ce nom sont rattachés à ces horaires ; sinon, choisissez l’école dans la fiche de l’élève.</p>
      </div>

      <ol className="horaires-liste">
        {ecole.periodes.map((p, i) => {
          const pause = pauseAvant(ecole.periodes, i);
          const erreur = erreursPeriodes.get(i);
          const inutilisee = i >= nbPeriodesUtilisees(ecole.periodes) && !p.debut && !p.fin;
          return (
            <li key={p.label}>
              {pause > 0 && !erreursPeriodes.has(i) ? <span className="horaires-pause">{libellePause(pause)} · {pause} min</span> : null}
              <div className="horaires-ligne">
                <b>{p.label}</b>
                <input type="time" className="input" value={p.debut} aria-label={`${p.label}, début`} aria-invalid={erreur ? true : undefined}
                  onChange={(e) => changerHeure(i, 'debut', e.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" className="input" value={p.fin} aria-label={`${p.label}, fin`} aria-invalid={erreur ? true : undefined}
                  onChange={(e) => changerHeure(i, 'fin', e.target.value)} />
                {inutilisee && i > 0 ? <span className="horaires-inutilisee">non utilisée</span> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {plusieurs ? (
        <div className="field">
          <label className="field-label" htmlFor="ecole-trajet">Temps de trajet entre deux écoles (minutes)</label>
          <input id="ecole-trajet" type="number" inputMode="numeric" min={0} max={TRAJET_MAXI} className="input input-court" value={trajet}
            aria-invalid={trajetOk ? undefined : true} onChange={(e) => { setRefus([]); setTrajet(e.target.value); }} />
          <p className="field-hint">L’agenda prévient quand deux rendez-vous d’écoles différentes se chevauchent ou laissent moins de temps que cela.</p>
        </div>
      ) : null}

      {montrer.length ? (
        <ul className="horaires-erreurs" role="alert">
          {montrer.map((e, i) => <li key={`${e.ecoleId}-${e.index ?? 'n'}-${i}`}>{e.message}</li>)}
        </ul>
      ) : null}
      {plusieurs && !trajetOk ? <p className="horaires-erreurs" role="alert">Le temps de trajet est un nombre de minutes, de 0 à {TRAJET_MAXI}.</p> : null}

      {plusieurs && !confirmeSuppression ? (
        <div className="horaires-actions">
          {!parDefaut ? <Button variante="discret" onClick={mettreParDefaut}>Mettre « {ecole.nom.trim() || 'cette école'} » par défaut</Button> : <span className="field-hint">École par défaut : utilisée pour les activités sans élève et les élèves sans école.</span>}
          <span className="espace" />
          <Button variante="discret" onClick={() => setConfirmeSuppression(true)}>Supprimer cette école</Button>
        </div>
      ) : null}
      {plusieurs && confirmeSuppression ? (
        <div className="horaires-actions" role="group" aria-label="Confirmer la suppression de l’école">
          <span>
            Supprimer « {ecole.nom.trim() || 'cette école'} » ?{rattaches ? ` ${rattaches} élève${rattaches > 1 ? 's' : ''} passe${rattaches > 1 ? 'nt' : ''} à l’école par défaut.` : ''} Aucune séance ni activité n’est supprimée.
          </span>
          <Button onClick={supprimer}>Oui, supprimer</Button>
          <Button variante="discret" onClick={() => setConfirmeSuppression(false)}>Non</Button>
        </div>
      ) : null}

      <div className="horaires-actions">
        <Button variante="primaire" disabled={erreurs.length > 0 || inchange || (plusieurs && !trajetOk)} onClick={() => { void enregistrer(); }}>Enregistrer</Button>
        <Button onClick={onFermer}>Annuler</Button>
        <span className="espace" />
        <Button variante="discret" disabled={!horairesModifies(ecole.periodes)} onClick={() => modifier(ecole.id, (e) => ({ ...e, periodes: horairesParDefaut() }))}>Remettre les horaires habituels</Button>
      </div>
    </>
  );
}
