import { useMemo, useState } from 'react';
import {
  TYPES_LIBELLES, ajouterJours, changementDepuisPlan, lundiDe, lundisEntre, nomJour, occurrences, planifierSemaineType, semaineTypeDepuis, titreSemaine
} from '../../domain/agenda/index.ts';
import type { Activite, Changement, ElementType, Occurrence, Periode, SemaineType } from '../../domain/agenda/index.ts';
import type { Eleve, Seance } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { Field, Input } from '../../ui/Field.tsx';

interface Props {
  ouvert: boolean;
  /** Une date de la semaine affichée dans l'agenda. */
  jour: string;
  aujourdhui: string;
  modele: SemaineType | null;
  periodes: readonly Periode[];
  eleves: readonly Eleve[];
  activites: readonly Activite[];
  seances: readonly Seance[];
  onEnregistrer: (modele: SemaineType | null) => void;
  onAppliquer: (changement: Changement, nombre: number) => void;
  onFermer: () => void;
}

/** Au plus un an de semaines d'un coup : assez pour une année scolaire, pas assez pour une erreur de frappe. */
const MAX_SEMAINES = 53;

export function SemaineTypeDialog(p: Props) {
  return (
    <Dialog ouvert={p.ouvert} titre="Semaine type" onFermer={p.onFermer}>
      {p.ouvert ? <Contenu {...p} /> : null}
    </Dialog>
  );
}

function Contenu({ jour, aujourdhui, modele, periodes, eleves, activites, seances, onEnregistrer, onAppliquer, onFermer }: Props) {
  const lundi = lundiDe(jour);
  const vendredi = ajouterJours(lundi, 4);
  const [jusquau, setJusquau] = useState('');
  const [ignorer, setIgnorer] = useState(true);
  const [confirmerSuppression, setConfirmerSuppression] = useState(false);

  const semaine = useMemo(() => occurrences(activites, lundi, vendredi, seances).filter((o: Occurrence) => o.statut !== 'annule'), [activites, lundi, vendredi, seances]);
  const nom = (id?: string): string => {
    const e = eleves.find((x) => x.id === id);
    return e ? `${e.prenom} ${e.nom}` : 'Élève supprimé';
  };
  const intitule = (e: ElementType): string =>
    e.type === 'eleve' ? [e.eleveId ? nom(e.eleveId) : e.nomLibre ?? 'Élève', e.titre].filter(Boolean).join(' — ') : e.titre || TYPES_LIBELLES[e.type];
  const quand = (e: ElementType): string => (e.fin > e.debut ? `${periodes[e.debut]?.label}–${periodes[e.fin]?.label}` : `${periodes[e.debut]?.label}`);

  const fin = jusquau || vendredi;
  const lundis = jusquau && jusquau < lundi ? [] : lundisEntre(lundi, fin).slice(0, MAX_SEMAINES);
  const plan = useMemo(() => {
    if (!modele || !lundis.length) return null;
    const existantes = occurrences(activites, lundis[0]!, ajouterJours(lundis[lundis.length - 1]!, 4), seances);
    return planifierSemaineType(modele, lundis, existantes, { ignorerSansClasse: ignorer, eleveIds: new Set(eleves.map((e) => e.id)) });
  }, [modele, lundis.join(','), ignorer, activites, seances, eleves]);

  const parJour = modele ? [0, 1, 2, 3, 4].map((j) => ({ j, elements: modele.elements.filter((e) => e.jour === j) })).filter((x) => x.elements.length) : [];
  const limiteMax = ajouterJours(lundi, MAX_SEMAINES * 7 - 3);

  return (
    <>
      <section className="semaine-type-bloc" aria-labelledby="st-enregistrer">
        <h3 id="st-enregistrer">Enregistrer la semaine affichée</h3>
        <p className="field-hint">
          Semaine du {titreSemaine(lundi)} : {semaine.length === 0 ? 'aucune activité.' : `${semaine.length} activité${semaine.length > 1 ? 's' : ''} (les activités annulées ne sont pas reprises).`}
        </p>
        <Button disabled={semaine.length === 0} onClick={() => { onEnregistrer(semaineTypeDepuis(semaine, lundi, aujourdhui)); }}>
          {modele ? 'Remplacer la semaine type par celle-ci' : 'Enregistrer comme semaine type'}
        </Button>
      </section>

      {modele ? (
        <>
          <section className="semaine-type-bloc" aria-labelledby="st-contenu">
            <h3 id="st-contenu">Votre semaine type</h3>
            <dl className="semaine-type-liste">
              {parJour.map(({ j, elements }) => (
                <div key={j}>
                  <dt>{nomJour(ajouterJours(lundi, j))}</dt>
                  <dd>{elements.map((e, i) => <span key={i}>{quand(e)} · {intitule(e)}</span>)}</dd>
                </div>
              ))}
            </dl>
          </section>

          <section className="semaine-type-bloc" aria-labelledby="st-appliquer">
            <h3 id="st-appliquer">Placer dans l’agenda</h3>
            <p className="field-hint">À partir de la semaine affichée. Chaque activité est ajoutée à sa date ; vous pourrez ensuite la déplacer ou la supprimer seule.</p>
            <Field label="Jusqu’au (laisser vide : cette semaine seulement)" optionnel>
              {(id) => <Input id={id} type="date" value={jusquau} min={lundi} max={limiteMax} onChange={(e) => setJusquau(e.target.value)} />}
            </Field>
            <label className="case-a-cocher">
              <input type="checkbox" checked={ignorer} onChange={(e) => setIgnorer(e.target.checked)} />
              Ne rien placer les jours fériés et pendant les vacances scolaires
            </label>
            <p className="semaine-type-apercu" role="status">
              {!plan ? 'Choisissez une date de fin après le début de la semaine affichée.' : (
                <>
                  <strong>{plan.aCreer.length} activité{plan.aCreer.length > 1 ? 's' : ''} ajoutée{plan.aCreer.length > 1 ? 's' : ''}</strong> sur {lundis.length} semaine{lundis.length > 1 ? 's' : ''}
                  {plan.joursIgnores ? ` · ${plan.joursIgnores} ignorée${plan.joursIgnores > 1 ? 's' : ''} (jour férié ou vacances)` : ''}
                  {plan.dejaPresents ? ` · ${plan.dejaPresents} déjà présente${plan.dejaPresents > 1 ? 's' : ''}` : ''}
                  {plan.elevesIntrouvables ? ` · ${plan.elevesIntrouvables} sans élève (dossier supprimé)` : ''}
                </>
              )}
            </p>
            <Button variante="primaire" disabled={!plan || plan.aCreer.length === 0}
              onClick={() => { if (plan) { onAppliquer(changementDepuisPlan(plan), plan.aCreer.length); onFermer(); } }}>
              Ajouter à l’agenda
            </Button>
          </section>
        </>
      ) : (
        <p className="field-hint">Pas encore de semaine type : arrangez une semaine dans l’agenda comme vous la vivez d’habitude, puis enregistrez-la ici.</p>
      )}

      <div className="horaires-actions">
        <Button onClick={onFermer}>Fermer</Button>
        <span className="espace" />
        {modele ? (
          confirmerSuppression
            ? <Button variante="discret" onClick={() => { onEnregistrer(null); setConfirmerSuppression(false); }}>Oui, supprimer la semaine type</Button>
            : <Button variante="discret" onClick={() => setConfirmerSuppression(true)}>Supprimer la semaine type</Button>
        ) : null}
      </div>
    </>
  );
}
