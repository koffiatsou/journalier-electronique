import { useId } from 'react';
import type { InputHTMLAttributes, ReactNode, SelectHTMLAttributes, TextareaHTMLAttributes } from 'react';

interface FieldProps {
  label: string;
  optionnel?: boolean;
  aide?: string;
  children: (id: string) => ReactNode;
  className?: string;
}

/** Libellé + champ + aide, reliés pour les lecteurs d'écran. */
export function Field({ label, optionnel, aide, children, className }: FieldProps) {
  const id = useId();
  return (
    <div className={`field ${className ?? ''}`.trim()}>
      <label className="field-label" htmlFor={id}>
        {label}
        {optionnel ? <span className="opt">facultatif</span> : null}
      </label>
      {children(id)}
      {aide ? <p className="field-hint">{aide}</p> : null}
    </div>
  );
}

export const Input = (p: InputHTMLAttributes<HTMLInputElement>) => <input className="input" {...p} />;
export const Select = (p: SelectHTMLAttributes<HTMLSelectElement>) => <select className="select" {...p} />;
export const Textarea = (p: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea className="textarea" {...p} />;
