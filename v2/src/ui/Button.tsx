import { useId } from 'react';
import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primaire' | 'secondaire' | 'discret';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
  /**
   * Pourquoi le bouton ne peut pas servir pour l'instant (« Choisissez d'abord l'élève. »). Le bouton reste dans l'ordre de Tab
   * (`aria-disabled`, pas `disabled`) : le clavier et le lecteur d'écran trouvent le bouton ET lisent la raison, écrite dessous.
   */
  raison?: string | undefined;
}

const classes: Record<Variante, string> = {
  primaire: 'btn btn-primary',
  secondaire: 'btn',
  discret: 'btn btn-ghost'
};

export function Button({ variante = 'secondaire', className = '', type = 'button', raison, onClick, ...reste }: Props) {
  const id = useId();
  if (!raison) return <button type={type} className={`${classes[variante]} ${className}`.trim()} onClick={onClick} {...reste} />;
  // Inactif : le clic et l'envoi du formulaire ne font rien (une touche Entrée dans un champ passe par ce bouton).
  return (
    <>
      <button type={type} className={`${classes[variante]} ${className}`.trim()} aria-disabled="true" aria-describedby={`${id}-raison`} {...reste}
        onClick={(e) => e.preventDefault()} />
      <small className="btn-raison" id={`${id}-raison`}>{raison}</small>
    </>
  );
}
