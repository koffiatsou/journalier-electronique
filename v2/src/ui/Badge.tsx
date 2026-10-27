import type { ReactNode } from 'react';

type Ton = 'neutre' | 'ok' | 'attention' | 'danger';
const classes: Record<Ton, string> = { neutre: 'badge', ok: 'badge badge-ok', attention: 'badge badge-attention', danger: 'badge badge-danger' };

export const Badge = ({ ton = 'neutre', children }: { ton?: Ton; children: ReactNode }) => (
  <span className={classes[ton]}>{children}</span>
);
