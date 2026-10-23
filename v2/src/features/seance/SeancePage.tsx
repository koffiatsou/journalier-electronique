import { useCallback, useMemo, useState } from 'react';
import type { Seance } from '../../domain/types.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { Apercu } from './Apercu.tsx';
import { Etape } from './Etape.tsx';
import { etatsEtapes, seanceVide, verifier } from './brouillon.ts';
import {
  FormulaireAides, FormulaireCompetence, FormulaireCreneau, FormulaireFonctionnement, FormulaireSuite, FormulaireTransfert
} from './formulaires.tsx';

const ETAPES = [
  { titre: 'Créneau et partie pédagogique', zone: 'peda' },
  { titre: 'Fonctionnement observé', zone: 'ortho' },
  { titre: 'Compétence travaillée', zone: 'ortho' },
  { titre: 'Ce qui a aidé', zone: 'ortho' },
  { titre: 'Transfert', zone: 'ortho' },
  { titre: 'Suite', zone: 'ortho' }
] as const;

const reduireMouvement = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function SeancePage({ magasin }: { magasin: Magasin }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const [s, setS] = useState<Seance>(() => seanceVide());
  const [ouvert, setOuvert] = useState(0);
  const [raisons, setRaisons] = useState<string[]>([]);

  const maj = useCallback((patch: Partial<Seance>) => {
    setS((cur) => ({ ...cur, ...patch, modifieLe: new Date().toISOString() }));
    setRaisons([]);
  }, []);

  const eleve = eleves.find((e) => e.id === s.eleveId);
  const precedentes = useMemo(() => seances.filter((x) => x.eleveId === s.eleveId), [seances, s.eleveId]);
  const etats = etatsEtapes(s);
  const renseignees = etats.filter((e) => e === 'remplie').length;
  const utiles = etats.filter((e) => e !== 'sans-objet').length;

  const aller = (i: number) => {
    setOuvert(i);
    requestAnimationFrame(() => {
      document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ block: 'start', behavior: reduireMouvement() ? 'auto' : 'smooth' });
    });
  };

  const enregistrer = async () => {
    const v = verifier(s);
    if (!v.ok) { setRaisons(v.raisons); return; }
    await magasin.enregistrerSeance(s);
    annoncer('Séance enregistrée');
    setS(seanceVide(s.eleveId, s.date));
    setOuvert(0);
    window.scrollTo({ top: 0 });
  };

  const formulaires = [
    <FormulaireCreneau key="1" s={s} maj={maj} eleves={eleves} />,
    <FormulaireFonctionnement key="2" s={s} maj={maj} />,
    <FormulaireCompetence key="3" s={s} maj={maj} />,
    <FormulaireAides key="4" s={s} maj={maj} />,
    <FormulaireTransfert key="5" s={s} maj={maj} />,
    <FormulaireSuite key="6" s={s} maj={maj} />
  ];

  return (
    <div className="page seance">
      <header className="page-entete">
        <h1>Nouvelle séance</h1>
        <p className="page-sous-titre">Remplissez la feuille comme sur le Journalier papier : la partie pédagogique, puis la partie orthopédagogique.</p>
      </header>

      <div className="seance-colonnes">
        <div className="seance-formulaire">
          {ETAPES.map((e, i) => (
            <Etape key={e.titre} numero={i + 1} titre={e.titre} zone={e.zone} etat={etats[i] ?? 'vide'}
              ouvert={ouvert === i} onBascule={() => (ouvert === i ? setOuvert(-1) : aller(i))}>
              {formulaires[i]}
              {i < ETAPES.length - 1 ? (
                <div className="etape-pied">
                  <Button onClick={() => aller(i + 1)}>Étape suivante : {ETAPES[i + 1]?.titre}</Button>
                </div>
              ) : null}
            </Etape>
          ))}
        </div>
        <Apercu seance={s} eleve={eleve} precedentes={precedentes} />
      </div>

      <div className="barre-action">
        <div className="barre-info" aria-live="polite">
          {raisons.length ? (
            <p className="barre-erreur">{raisons[0]}{raisons.length > 1 ? ` (+${raisons.length - 1})` : ''}</p>
          ) : (
            <p className="num">{renseignees} étape{renseignees > 1 ? 's' : ''} sur {utiles} renseignée{renseignees > 1 ? 's' : ''}</p>
          )}
          <div className="progres" role="progressbar" aria-valuemin={0} aria-valuemax={utiles} aria-valuenow={renseignees} aria-label="Avancement">
            <span style={{ width: `${utiles ? (renseignees / utiles) * 100 : 0}%` }} />
          </div>
        </div>
        <Button variante="primaire" onClick={() => { void enregistrer(); }}>Enregistrer la séance</Button>
      </div>
    </div>
  );
}
