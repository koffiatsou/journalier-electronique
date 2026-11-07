import { Button } from './Button.tsx';
import { Dialog } from './Dialog.tsx';

interface Props {
  ouvert: boolean;
  /** Ce qui serait perdu, en une phrase (« Les changements de cette activité… »). */
  perte: string;
  onContinuer: () => void;
  onAbandonner: () => void;
}

/**
 * Demande confirmation avant de quitter un formulaire modifié sans l'enregistrer.
 * Le bouton qui détruit ne reçoit jamais le focus à l'ouverture : « Continuer » est le bouton sûr (data-focus-initial).
 */
export function ConfirmerAbandon({ ouvert, perte, onContinuer, onAbandonner }: Props) {
  return (
    <Dialog ouvert={ouvert} titre="Abandonner les modifications ?" onFermer={onContinuer}>
      <p>{perte} Elles seront perdues.</p>
      <div className="fiche-actions">
        <Button data-focus-initial variante="primaire" onClick={onContinuer}>Continuer à modifier</Button>
        <Button onClick={onAbandonner}>Abandonner les modifications</Button>
      </div>
    </Dialog>
  );
}
