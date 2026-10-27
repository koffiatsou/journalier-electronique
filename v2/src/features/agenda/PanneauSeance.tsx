import { jourComplet, libelle } from '../../domain/agenda/index.ts';
import type { Occurrence, Periode } from '../../domain/agenda/index.ts';
import { PRESENCE_LIBELLES } from '../../domain/types.ts';
import type { Eleve, Seance } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';

interface Props {
  occurrence: Occurrence;
  periodes: readonly Periode[];
  /** Heures réelles dans l'école de l'élève, quand l'agenda a plusieurs écoles. */
  heures?: string;
  eleves: Eleve[];
  seance: Seance | undefined;
  onOuvrir: (o: Occurrence) => void;
  onFermer: () => void;
}

/** Panneau d'une séance réalisée sans planification : on la retrouve ici, on l'ouvre pour la relire ou la modifier (rien à planifier). */
export function PanneauSeance({ occurrence, periodes, heures, eleves, seance, onOuvrir, onFermer }: Props) {
  const eleve = eleves.find((e) => e.id === occurrence.activite.eleveId);
  const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : undefined;
  const quand = `${periodes[occurrence.debut]?.label ?? ''}${occurrence.fin > occurrence.debut ? ` à ${periodes[occurrence.fin]?.label ?? ''}` : ''}`;
  return (
    <section className="panneau feuille-bas" aria-label="Séance réalisée">
      <div className="en-tete">
        <h2>{libelle(occurrence.activite, nom)}</h2>
        <Button onClick={onFermer} aria-label="Fermer le panneau">Fermer</Button>
      </div>
      <p className="liste-detail">{jourComplet(occurrence.date)} · {quand}{heures ? ` · ${heures}` : ''} · Réalisé</p>
      {seance ? (
        <p className="liste-detail">
          {[seance.matiere, seance.presence !== 'present' ? PRESENCE_LIBELLES[seance.presence].titre : ''].filter(Boolean).join(' · ')}
        </p>
      ) : null}
      <p className="liste-detail">Séance enregistrée sans planification : elle vient du Journalier et apparaît ici automatiquement.</p>
      <div className="actions">
        <Button variante="primaire" onClick={() => onOuvrir(occurrence)}>Ouvrir la séance</Button>
      </div>
    </section>
  );
}
