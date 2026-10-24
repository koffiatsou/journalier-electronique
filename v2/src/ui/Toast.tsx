import { createContext, useCallback, useContext, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { IconeCoche } from './icons.tsx';

interface Message { id: number; texte: string; sortie: boolean }
interface ContexteToast { annoncer: (texte: string) => void }

const Contexte = createContext<ContexteToast>({ annoncer: () => undefined });
let compteur = 0;

/** Notifications brèves et discrètes (confirmations d'action). */
export function FournisseurToast({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<Message[]>([]);

  const annoncer = useCallback((texte: string) => {
    const id = ++compteur;
    setMessages((m) => [...m, { id, texte, sortie: false }]);
    setTimeout(() => setMessages((m) => m.map((x) => (x.id === id ? { ...x, sortie: true } : x))), 2800);
    setTimeout(() => setMessages((m) => m.filter((x) => x.id !== id)), 3000);
  }, []);

  const valeur = useMemo(() => ({ annoncer }), [annoncer]);
  return (
    <Contexte.Provider value={valeur}>
      {children}
      <div className="toasts" role="status" aria-live="polite">
        {messages.map((m) => (
          <div key={m.id} className="toast" data-leaving={m.sortie}>
            <IconeCoche taille={16} />
            {m.texte}
          </div>
        ))}
      </div>
    </Contexte.Provider>
  );
}

export const useToast = (): ContexteToast => useContext(Contexte);
