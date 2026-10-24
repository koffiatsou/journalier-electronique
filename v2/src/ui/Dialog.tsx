import { useEffect, useRef } from 'react';
import type { ReactNode } from 'react';

interface Props {
  ouvert: boolean;
  titre: string;
  onFermer: () => void;
  children: ReactNode;
}

/** Fenêtre de dialogue basée sur l'élément natif <dialog> : focus piégé et Échap gérés par le navigateur. */
export function Dialog({ ouvert, titre, onFermer, children }: Props) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);
  return (
    <dialog ref={ref} className="dialog" aria-label={titre} onClose={onFermer} onCancel={onFermer}>
      <div style={{ padding: 24, display: 'grid', gap: 16 }}>
        <h2>{titre}</h2>
        {children}
      </div>
    </dialog>
  );
}
