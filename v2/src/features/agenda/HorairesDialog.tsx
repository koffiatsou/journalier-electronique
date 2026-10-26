import { useState } from 'react';
import { horairesModifies, horairesParDefaut, libellePause, pauseAvant, verifierHoraires } from '../../domain/agenda/index.ts';
import type { ErreurHoraire, Periode } from '../../domain/agenda/index.ts';
import { Button } from '../../ui/Button.tsx';
import { Dialog } from '../../ui/Dialog.tsx';

interface Props {
  ouvert: boolean;
  horaires: readonly Periode[];
  /** Renvoie les erreurs si les horaires sont refusés ; liste vide = enregistré. */
  onEnregistrer: (periodes: Periode[]) => Promise<ErreurHoraire[]>;
  onFermer: () => void;
}

/** Réglage des horaires des huit périodes. Les noms (1e H…) ne changent pas : les séances déjà encodées gardent leur période. */
export function HorairesDialog({ ouvert, horaires, onEnregistrer, onFermer }: Props) {
  return (
    <Dialog ouvert={ouvert} titre="Horaires des périodes" onFermer={onFermer}>
      {ouvert ? <Formulaire horaires={horaires} onEnregistrer={onEnregistrer} onFermer={onFermer} /> : null}
    </Dialog>
  );
}

function Formulaire({ horaires, onEnregistrer, onFermer }: Omit<Props, 'ouvert'>) {
  const [brouillon, setBrouillon] = useState<Periode[]>(() => horaires.map((p) => ({ ...p })));
  const [refus, setRefus] = useState<ErreurHoraire[]>([]);
  const erreurs = verifierHoraires(brouillon);
  const parIndex = new Map(erreurs.map((e) => [e.index, e.message]));
  const inchange = !brouillon.some((p, i) => p.debut !== horaires[i]?.debut || p.fin !== horaires[i]?.fin);

  const changer = (i: number, champ: 'debut' | 'fin', valeur: string) => {
    setRefus([]);
    setBrouillon((b) => b.map((p, j) => (j === i ? { ...p, [champ]: valeur } : p)));
  };
  const enregistrer = async () => {
    const r = await onEnregistrer(brouillon);
    if (r.length) setRefus(r);
  };

  return (
    <>
      <p className="field-hint">
        Indiquez l’heure de début et de fin de chaque période. L’écart entre deux périodes devient une pause (récré ou midi).
        Les séances déjà encodées gardent leur période (1e H, 2e H…).
      </p>
      <ol className="horaires-liste">
        {brouillon.map((p, i) => {
          const pause = pauseAvant(brouillon, i);
          const erreur = parIndex.get(i);
          return (
            <li key={p.label}>
              {pause > 0 && !parIndex.has(i) ? <span className="horaires-pause">{libellePause(pause)} · {pause} min</span> : null}
              <div className="horaires-ligne">
                <b>{p.label}</b>
                <input type="time" className="input" value={p.debut} aria-label={`${p.label}, début`} aria-invalid={erreur ? true : undefined}
                  onChange={(e) => changer(i, 'debut', e.target.value)} />
                <span aria-hidden="true">–</span>
                <input type="time" className="input" value={p.fin} aria-label={`${p.label}, fin`} aria-invalid={erreur ? true : undefined}
                  onChange={(e) => changer(i, 'fin', e.target.value)} />
              </div>
            </li>
          );
        })}
      </ol>
      {erreurs.length || refus.length ? (
        <ul className="horaires-erreurs" role="alert">
          {(erreurs.length ? erreurs : refus).map((e) => <li key={e.index}>{e.message}</li>)}
        </ul>
      ) : null}
      <div className="horaires-actions">
        <Button variante="primaire" disabled={erreurs.length > 0 || inchange} onClick={() => { void enregistrer(); }}>Enregistrer</Button>
        <Button onClick={onFermer}>Annuler</Button>
        <span className="espace" />
        <Button variante="discret" disabled={!horairesModifies(brouillon)} onClick={() => { setRefus([]); setBrouillon(horairesParDefaut()); }}>Remettre les horaires habituels</Button>
      </div>
    </>
  );
}
