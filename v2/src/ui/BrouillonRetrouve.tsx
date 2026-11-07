import { Button } from './Button.tsx';

const quand = (iso: string): string => new Date(iso).toLocaleString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

interface Props {
  /** Ce qui a été retrouvé, accordé avec « non enregistré(e) » : « Une fiche d'élève », « Une activité ». */
  quoi: string;
  enregistreLe: string;
  onReprendre: () => void;
  onRepartir: () => void;
}

/** Proposition de reprendre une saisie retrouvée (rechargement, changement d'écran par erreur). Jamais appliquée sans l'accord de la personne. */
export function BrouillonRetrouve({ quoi, enregistreLe, onReprendre, onRepartir }: Props) {
  return (
    <div className="brouillon-retrouve" role="status">
      <p>{quoi} non enregistré(e) a été retrouvé(e) ({quand(enregistreLe)}).</p>
      <div className="fiche-actions">
        <Button variante="primaire" onClick={onReprendre}>Reprendre ma saisie</Button>
        <Button onClick={onRepartir}>Repartir de zéro</Button>
      </div>
    </div>
  );
}
