import { useEffect, useState } from 'react';
import type { Magasin } from '../state/store.ts';
import { useMagasin } from '../state/store.ts';
import { Button } from '../ui/Button.tsx';
import { FournisseurToast } from '../ui/Toast.tsx';
import { AgendaPage } from '../features/agenda/AgendaPage.tsx';
import { ElevesPage } from '../features/eleves/ElevesPage.tsx';
import { JournalierPage } from '../features/journalier/JournalierPage.tsx';
import { PiaPage } from '../features/pia/PiaPage.tsx';
import { ReprisePage } from '../features/reprise/ReprisePage.tsx';
import { SynchroPage } from '../features/synchro/SynchroPage.tsx';
import type { Synchro } from '../synchro/service.ts';
import { SeancePage } from '../features/seance/SeancePage.tsx';
import { Accueil } from './PagesSimples.tsx';
import { Shell } from './Shell.tsx';
import { useRoute } from './useRoute.ts';

interface Props {
  magasin: Magasin;
  synchro: Synchro;
  adresseRetour: string;
  /** Mode essai (données fictives) : un bandeau le rappelle en permanence. */
  essai: boolean;
  /** Phrases à montrer une fois à l'ouverture (anciennes données chiffrées, enregistrement impossible…). */
  notices: readonly string[];
  onVerrouiller: () => void;
}

export function App({ magasin, synchro, adresseRetour, essai, notices, onVerrouiller }: Props) {
  const [page, aller, parametres] = useRoute();
  const pret = useMagasin(magasin, (e) => e.pret);
  const erreur = useMagasin(magasin, (e) => e.erreur);
  const illisibles = useMagasin(magasin, (e) => e.illisibles);
  const [lues, setLues] = useState(0);
  const [ecarte, setEcarte] = useState(false);
  useEffect(() => { void magasin.charger().then(() => synchro.demarrer()); }, [magasin, synchro]);

  return (
    <FournisseurToast>
      <Shell page={page} onAller={aller} essai={essai} onVerrouiller={onVerrouiller}>
        {notices.slice(lues).map((n) => (
          <p key={n} className="synchro-message synchro-message-info bandeau" role="status">
            <span>{n}</span> <Button variante="discret" onClick={() => setLues(notices.length)}>Compris</Button>
          </p>
        ))}
        {pret && illisibles > 0 ? (
          <p className="synchro-message synchro-message-erreur bandeau" role="alert">
            <span>{illisibles} élément{illisibles > 1 ? 's' : ''} enregistré{illisibles > 1 ? 's' : ''} sur cet appareil {illisibles > 1 ? 'sont' : 'est'} illisible{illisibles > 1 ? 's' : ''} (abîmé{illisibles > 1 ? 's' : ''}). Rien n’est supprimé tout seul, et la synchronisation reste en pause. Si vos données sont dans OneDrive, écartez-{illisibles > 1 ? 'les' : 'le'} : {illisibles > 1 ? 'ils seront renvoyés' : 'il sera renvoyé'} à la prochaine synchronisation.</span>{' '}
            <Button disabled={ecarte} onClick={() => { setEcarte(true); void synchro.ecarterIllisibles().finally(() => setEcarte(false)); }}>Écarter {illisibles > 1 ? 'ces éléments' : 'cet élément'}</Button>
          </p>
        ) : null}
        {!pret ? <p className="chargement" role="status">Chargement…</p> : null}
        {pret && erreur ? <p className="erreur" role="alert">Les données locales n’ont pas pu être lues : {erreur}</p> : null}
        {pret && page === 'accueil' ? <Accueil magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'seance' ? <SeancePage magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'agenda' ? <AgendaPage magasin={magasin} /> : null}
        {pret && page === 'journalier' ? <JournalierPage key={parametres.eleve ?? ''} magasin={magasin} onAller={aller} eleveInitial={parametres.eleve ?? null} /> : null}
        {pret && page === 'eleves' ? <ElevesPage magasin={magasin} onAller={aller} /> : null}
        {pret && page === 'synchro' ? <SynchroPage synchro={synchro} adresseRetour={adresseRetour} /> : null}
        {pret && page === 'reprise' ? <ReprisePage magasin={magasin} synchro={synchro} essai={essai} onAller={aller} /> : null}
        {pret && page === 'pia' ? <PiaPage key={`${parametres.eleve ?? ''}|${parametres.annee ?? ''}`} magasin={magasin} onAller={aller} parametres={parametres} /> : null}
      </Shell>
    </FournisseurToast>
  );
}
