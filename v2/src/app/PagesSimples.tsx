import { useState } from 'react';
import { exempleDemo } from '../data/demo.ts';
import { estDemo } from '../domain/synchro/cles.ts';
import { aujourdhuiISO } from '../features/seance/brouillon.ts';
import { useToast } from '../ui/Toast.tsx';
import { construireBloc } from '../domain/redaction/index.ts';
import type { Magasin } from '../state/store.ts';
import { useMagasin } from '../state/store.ts';
import { Button } from '../ui/Button.tsx';
import { dateFR } from '../domain/redaction/langue.ts';
import type { Aller } from './useRoute.ts';

export function Accueil({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const activites = useMagasin(magasin, (e) => e.activites);
  const { annoncer } = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const nbDemo = eleves.filter((e) => estDemo(e.id)).length + activites.filter((a) => estDemo(a.id)).length;
  const chargerDemo = async () => { await magasin.chargerExemple(exempleDemo(aujourdhuiISO())); annoncer('Données de démonstration chargées'); };
  const effacerDemo = async () => {
    if (!confirmer) { setConfirmer(true); return; }
    const b = await magasin.effacerDemo();
    setConfirmer(false);
    annoncer(`Démonstration effacée : ${b.eleves} élèves, ${b.seances} séances, ${b.activites} rendez-vous`);
  };
  const recentes = [...seances].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  return (
    <div className="page">
      <header className="accueil-entete">
        <div>
          <h1>Bonjour</h1>
          <p className="page-sous-titre">Préparez une séance, retrouvez vos élèves et générez le Journalier.</p>
        </div>
        <img className="accueil-logo" src="./logo-poles-territoriaux.svg" alt="" width="132" height="91" />
      </header>

      {!eleves.length ? (
        <section className="vide">
          <h2>Aucun élève pour l’instant</h2>
          <p>Chargez les données de démonstration (deux élèves fictifs, des séances, un agenda et un PIA) pour tout essayer sans compte et sans données réelles. Rien ne quitte votre appareil.</p>
          <Button variante="primaire" onClick={() => { void chargerDemo(); }}>Charger les données de démonstration</Button>
          <p className="synchro-discret">Vous utilisiez la V75 ? <a href="#/reprise">Reprendre mes données de la V75</a>.</p>
        </section>
      ) : (
        <section className="liste-carte">
          <div className="liste-entete">
            <h2>Dernières séances</h2>
            <Button variante="primaire" onClick={() => onAller('seance')}>Nouvelle séance</Button>
          </div>
          {recentes.length ? (
            <ul className="liste">
              {recentes.map((s) => {
                const e = eleves.find((x) => x.id === s.eleveId);
                const b = construireBloc(s, { titulaire: e?.titulaire ?? '' });
                return (
                  <li key={s.id}>
                    <span className="num liste-date">{dateFR(s.date)}</span>
                    <span className="liste-titre">{e ? `${e.nom} ${e.prenom}` : 'Élève'} — {s.matiere || 'Matière non précisée'}</span>
                    <span className="liste-detail">{b.type === 'absence' ? b.ortho[0]?.texte : 'Séance enregistrée'}</span>
                  </li>
                );
              })}
            </ul>
          ) : (
            <p className="vide-texte">Aucune séance enregistrée. Commencez par une nouvelle séance.</p>
          )}
        </section>
      )}

      {nbDemo ? (
        <section className="bandeau-demo" aria-label="Données de démonstration">
          <p><strong>Des données de démonstration sont présentes.</strong> Elles sont fictives, n’iront jamais vers votre vrai compte Microsoft, et vous pouvez les effacer sans toucher à vos vraies données.</p>
          <div className="bandeau-demo-actions">
            <Button onClick={() => onAller('synchro')}>Essayer la synchronisation</Button>
            <Button variante={confirmer ? 'primaire' : 'discret'} onClick={() => { void effacerDemo(); }}>{confirmer ? 'Oui, effacer la démonstration' : 'Effacer la démonstration'}</Button>
            {confirmer ? <Button variante="discret" onClick={() => setConfirmer(false)}>Garder</Button> : null}
          </div>
        </section>
      ) : (
        eleves.length ? <p className="page-sous-titre"><Button variante="discret" onClick={() => { void chargerDemo(); }}>Ajouter des données de démonstration</Button></p> : null
      )}
    </div>
  );
}
