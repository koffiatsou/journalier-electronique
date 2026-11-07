import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { IconeCoche } from './icons.tsx';

/** Geste proposé dans la notification (par exemple « Annuler » après une suppression). */
export interface ActionToast { libelle: string; faire: () => void }

interface Message { id: number; texte: string; sortie: boolean; action?: ActionToast }
interface ContexteToast { annoncer: (texte: string, action?: ActionToast) => void }

const Contexte = createContext<ContexteToast>({ annoncer: () => undefined });
let compteur = 0;

/** Durées d'affichage (ms) : plus longue quand un geste est proposé, pour laisser le temps de le toucher. */
export const DUREE_TOAST_MS = 3000;
export const DUREE_TOAST_ACTION_MS = 8000;
/** Début de la sortie animée, un peu avant la disparition. */
const AVANT_SORTIE_MS = 200;

/** Notifications brèves et discrètes (confirmations d'action). */
export function FournisseurToast({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const retirer = useCallback((id: number) => setMessages((m) => m.filter((x) => x.id !== id)), []);

  const annoncer = useCallback((texte: string, action?: ActionToast) => {
    const id = ++compteur;
    const duree = action ? DUREE_TOAST_ACTION_MS : DUREE_TOAST_MS;
    setMessages((m) => [...m, { id, texte, sortie: false, ...(action ? { action } : {}) }]);
    setTimeout(() => setMessages((m) => m.map((x) => (x.id === id ? { ...x, sortie: true } : x))), duree - AVANT_SORTIE_MS);
    setTimeout(() => retirer(id), duree);
  }, [retirer]);

  const valeur = useMemo(() => ({ annoncer }), [annoncer]);
  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className="toast" data-leaving={m.sortie}>
            <IconeCoche taille={16} />
            {m.texte}
            {m.action ? (
              <button type="button" className="toast-action" onClick={() => { const a = m.action; retirer(m.id); a?.faire(); }}>{m.action.libelle}</button>
            ) : null}
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export const useToast = (): ContexteToast => useContext(Contexte);
