import { useEffect } from 'react';
import type { Magasin } from '../state/store.ts';
import { useMagasin } from '../state/store.ts';
import { FournisseurToast } from '../ui/Toast.tsx';
import { AgendaPage } from '../features/agenda/AgendaPage.tsx';
import { ElevesPage } from '../features/eleves/ElevesPage.tsx';
import { SeancePage } from '../features/seance/SeancePage.tsx';
import { Accueil, PageAVenir } from './PagesSimples.tsx';
import { Shell } from './Shell.tsx';
import { useRoute } from './useRoute.ts';

export function App({ magasin }: { magasin: Magasin }) {
  const [page, aller] = useRoute();
  const pret = useMagasin(magasin, (e) => e.pret);
  const erreur = useMagasin(magasin, (e) => e.erreur);
  useEffect(() => { void magasin.charger(); }, [magasin]);

  return (
    <FournisseurToast>
      <Shell page={page} onAller={aller}>
        {!pret ? <p className="chargement" role="status">Chargement…</p> : null}
        {pret && erreur ? <p className="erreur" role="alert">Les données locales n’ont pas pu être lues : {erreur}</p> : null}
        {pret && page === 'accueil' ? <Accueil magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'seance' ? <SeancePage magasin={magasin} /> : null}
        {pret && page === 'agenda' ? <AgendaPage magasin={magasin} /> : null}
        {pret && page === 'eleves' ? <ElevesPage magasin={magasin} /> : null}
        {pret && page === 'rapports' ? <PageAVenir page={page} /> : null}
      </Shell>
    </FournisseurToast>
  );
}
