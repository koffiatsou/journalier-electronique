import type { ButtonHTMLAttributes } from 'react';

type Variante = 'primaire' | 'secondaire' | 'discret';

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variante?: Variante;
}

const classes: Record<Variante, string> = {
  primaire: 'btn btn-primary',
  secondaire: 'btn',
  discret: 'btn btn-ghost'
};

export function Button({ variante = 'secondaire', className = '', type = 'button', ...reste }: Props) {
  return <button type={type} className={`${classes[variante]} ${className}`.trim()} {...reste} />;
}
