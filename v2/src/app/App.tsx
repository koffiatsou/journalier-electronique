import { useEffect } from 'react';
import type { Magasin } from '../state/store.ts';
import { useMagasin } from '../state/store.ts';
import { FournisseurToast } from '../ui/Toast.tsx';
import { AgendaPage } from '../features/agenda/AgendaPage.tsx';
import { ElevesPage } from '../features/eleves/ElevesPage.tsx';
import { JournalierPage } from '../features/journalier/JournalierPage.tsx';
import { PiaPage } from '../features/pia/PiaPage.tsx';
import { SynchroPage } from '../features/synchro/SynchroPage.tsx';
import type { Synchro } from '../synchro/service.ts';
import { SeancePage } from '../features/seance/SeancePage.tsx';
import { Accueil } from './PagesSimples.tsx';
import { Shell } from './Shell.tsx';
import { useRoute } from './useRoute.ts';

export function App({ magasin, synchro, adresseRetour }: { magasin: Magasin; synchro: Synchro; adresseRetour: string }) {
  const [page, aller, parametres] = useRoute();
  const pret = useMagasin(magasin, (e) => e.pret);
  const erreur = useMagasin(magasin, (e) => e.erreur);
  useEffect(() => { void magasin.charger().then(() => synchro.demarrer()); }, [magasin, synchro]);

  return (
    <FournisseurToast>
      <Shell page={page} onAller={aller}>
        {!pret ? <p className="chargement" role="status">Chargement…</p> : null}
        {pret && erreur ? <p className="erreur" role="alert">Les données locales n’ont pas pu être lues : {erreur}</p> : null}
        {pret && page === 'accueil' ? <Accueil magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'seance' ? <SeancePage magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'agenda' ? <AgendaPage magasin={magasin} /> : null}
        {pret && page === 'journalier' ? <JournalierPage key={parametres.eleve ?? ''} magasin={magasin} onAller={aller} eleveInitial={parametres.eleve ?? null} /> : null}
        {pret && page === 'eleves' ? <ElevesPage magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'synchro' ? <SynchroPage synchro={synchro} adresseRetour={adresseRetour} /> : null}
        {pret && page === 'pia' ? <PiaPage key={`${parametres.eleve ?? ''}|${parametres.annee ?? ''}`} magasin={magasin} onAller={aller} parametres={parametres} /> : null}
      </Shell>
    </FournisseurToast>
  );
}
