import { ELEVES_DEMO } from '../data/demo.ts';
import { construireBloc } from '../domain/redaction/index.ts';
import type { Magasin } from '../state/store.ts';
import { useMagasin } from '../state/store.ts';
import { Button } from '../ui/Button.tsx';
import { dateFR } from '../domain/redaction/langue.ts';
import type { Aller } from './useRoute.ts';

export function Accueil({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const recentes = [...seances].sort((a, b) => (a.date < b.date ? 1 : -1)).slice(0, 5);

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Bonjour</h1>
        <p className="page-sous-titre">Préparez une séance, retrouvez vos élèves et générez le Journalier.</p>
      </header>

      {!eleves.length ? (
        <section className="vide">
          <h2>Aucun élève pour l’instant</h2>
          <p>Ajoutez des élèves fictifs pour essayer l’application sans données réelles. Rien ne quitte votre appareil.</p>
          <Button variante="primaire" onClick={() => { void magasin.ajouterEleves(ELEVES_DEMO); }}>Ajouter des élèves fictifs</Button>
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
    </div>
  );
}

const A_VENIR: Record<string, { titre: string; texte: string }> = {
  rapports: { titre: 'Rapports et PIA', texte: 'La préparation de réunion et l’export du PIA officiel arrivent dans une prochaine étape de la V2.' }
};

export function PageAVenir({ page }: { page: 'rapports' }) {
  const p = A_VENIR[page];
  return (
    <div className="page">
      <header className="page-entete"><h1>{p?.titre}</h1></header>
      <section className="vide">
        <h2>Pas encore dans la V2</h2>
        <p>{p?.texte}</p>
        <a className="btn" href="../">Ouvrir la version actuelle (V75)</a>
      </section>
    </div>
  );
}
