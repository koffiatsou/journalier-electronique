import { useId } from 'react';
import type { ComponentProps, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

/** Ce que le champ doit porter pour être compris au lecteur d'écran : à étaler sur l'`Input`, le `Select` ou le `Textarea`. */
export interface ChampAccessible {
  'aria-invalid'?: true;
  'aria-required'?: true;
  'aria-describedby'?: string;
}

interface FieldProps {
  label: string;
  optionnel?: boolean;
  /** Champ sans lequel on ne peut pas enregistrer : écrit « obligatoire » à côté du libellé. */
  obligatoire?: boolean;
  aide?: string;
  /** Message d'erreur affiché sous le champ (le champ est alors marqué invalide). */
  erreur?: string;
  children: (id: string, champ: ChampAccessible) => ReactNode;
  className?: string;
}

/** Libellé + champ + aide, reliés pour les lecteurs d'écran. */
export function Field({ label, optionnel, obligatoire, aide, erreur, children, className }: FieldProps) {
  const id = useId();
  const decrit = [aide ? `${id}-aide` : '', erreur ? `${id}-erreur` : ''].filter(Boolean).join(' ');
  const champ: ChampAccessible = {
    ...(erreur ? { 'aria-invalid': true as const } : {}),
    ...(obligatoire ? { 'aria-required': true as const } : {}),
    ...(decrit ? { 'aria-describedby': decrit } : {})
  };
  return (
    <div className={`field ${className ?? ''}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optionnel ? <span className="opt">facultatif</span> : null}
        {obligatoire ? <span className="opt"> obligatoire</span> : null}
      </label>
      {children(id, champ)}
      {aide ? <p className="field-hint" id={`${id}-aide`}>{aide}</p> : null}
      {erreur ? <p className="field-erreur" id={`${id}-erreur`}>{erreur}</p> : null}
    </div>
  );
}

export const Input = (p: ComponentProps<'input'>) => <input className="input" {...p} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className="select" {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />;
