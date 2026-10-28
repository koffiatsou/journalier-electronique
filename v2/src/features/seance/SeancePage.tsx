import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Seance } from '../../domain/types.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import type { Aller } from '../../app/useRoute.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { Apercu } from './Apercu.tsx';
import { Etape } from './Etape.tsx';
import { BarreEtapes } from './BarreEtapes.tsx';
import { etatsEtapes, progression, resumesEtapes, seanceVide, verifier } from './brouillon.ts';
import {
  FormulaireAides, FormulaireCompetence, FormulaireCreneau, FormulaireFonctionnement, FormulaireSuite
} from './formulaires.tsx';

/** `zone` : bleu = partie pédagogique (1 et 3), vert-bleu = partie orthopédagogique (2, 4 et 5) ; `court` : nom dans la barre d'étapes. */
const ETAPES = [
  { titre: 'Créneau et partie pédagogique', court: 'Créneau', zone: 'peda' },
  { titre: 'Fonctionnement observé', court: 'Fonctionnement', zone: 'ortho' },
  { titre: 'Compétence travaillée', court: 'Compétence', zone: 'peda' },
  { titre: 'Ce qui a aidé', court: 'Ce qui a aidé', zone: 'ortho' },
  { titre: 'Suite', court: 'Suite', zone: 'ortho' }
] as const;

const reduireMouvement = (): boolean => globalThis.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;

export function SeancePage({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const ecoles = useMagasin(magasin, (e) => e.ecoles);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const [s, setS] = useState<Seance>(() => ({ ...seanceVide(), ...(magasin.lire().preparation ?? {}) }));
  /** Séance déjà enregistrée (ouverte depuis le Journalier) : on la modifie au lieu d'en créer une. */
  const [edition] = useState(() => magasin.lire().seances.some((x) => x.id === s.id));
  useEffect(() => { magasin.viderPreparation(); }, [magasin]);
  const [ouvert, setOuvert] = useState(0);
  const [raisons, setRaisons] = useState<string[]>([]);
  const [tiroir, setTiroir] = useState(false);

  const maj = useCallback((patch: Partial<Seance>) => {
    setS((cur) => ({ ...cur, ...patch, modifieLe: new Date().toISOString() }));
    setRaisons([]);
  }, []);

  const eleve = eleves.find((e) => e.id === s.eleveId);
  const precedentes = useMemo(() => seances.filter((x) => x.eleveId === s.eleveId), [seances, s.eleveId]);
  const etats = etatsEtapes(s);
  const resumes = resumesEtapes(s);
  const notes = s.observations.length + s.competences.length + s.aides.length;

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
    if (edition) {
      annoncer('Séance modifiée');
      onAller('journalier', { eleve: s.eleveId });
      return;
    }
    annoncer('Séance enregistrée');
    setS(seanceVide(s.eleveId, s.date));
    setOuvert(0);
    window.scrollTo({ top: 0 });
  };

  const formulaires = [
    <FormulaireCreneau key="1" s={s} maj={maj} eleves={eleves} ecoles={ecoles} />,
    <FormulaireFonctionnement key="2" s={s} maj={maj} />,
    <FormulaireCompetence key="3" s={s} maj={maj} eleve={eleve} />,
    <FormulaireAides key="4" s={s} maj={maj} />,
    <FormulaireSuite key="5" s={s} maj={maj} />
  ];

  return (
    <div className="page seance">
      <header className="page-entete">
        <h1>{edition ? `Modifier la séance du ${dateFR(s.date)}` : 'Nouvelle séance'}</h1>
        <p className="page-sous-titre">{edition
          ? 'Corrigez ce qui doit l’être, puis enregistrez : vous reviendrez au Journalier.'
          : 'Remplissez la feuille comme sur le Journalier papier : la partie pédagogique, puis la partie orthopédagogique.'}</p>
      </header>

      <BarreEtapes etapes={ETAPES} etats={etats} ouvert={ouvert} progression={progression(s)} onAller={aller} />

      <div className="seance-colonnes">
        <div className="seance-formulaire">
          {ETAPES.map((e, i) => (
            <Etape key={e.titre} numero={i + 1} titre={e.titre} zone={e.zone} etat={etats[i] ?? 'vide'} resume={resumes[i] ?? null}
              ouvert={ouvert === i} onBascule={() => (ouvert === i ? setOuvert(-1) : aller(i))}>
              {formulaires[i]}
              {i < ETAPES.length - 1 ? (
                <div className="etape-pied">
                  <Button onClick={() => aller(i + 1)}>Étape suivante : {i + 2} {ETAPES[i + 1]?.titre} ↓</Button>
                </div>
              ) : null}
            </Etape>
          ))}
        </div>
        <Apercu seance={s} eleve={eleve} precedentes={precedentes} tiroirOuvert={tiroir} onFermer={() => setTiroir(false)} />
      </div>

      <div className="barre-action">
        <div className="barre-info" aria-live="polite">
          {raisons.length ? (
            <p className="barre-erreur">{raisons[0]}{raisons.length > 1 ? ` (+${raisons.length - 1})` : ''}</p>
          ) : (
            <p className="num">{notes ? `${notes} point${notes > 1 ? 's' : ''} noté${notes > 1 ? 's' : ''}` : 'Aucun point noté'}</p>
          )}
        </div>
        <Button className="btn-feuille" aria-expanded={tiroir} aria-controls="feuille-apercu" onClick={() => setTiroir((v) => !v)}>Feuille</Button>
        {edition ? <Button onClick={() => onAller('journalier', { eleve: s.eleveId })}>Annuler</Button> : null}
        <Button variante="primaire" onClick={() => { void enregistrer(); }}>{edition ? 'Enregistrer les modifications' : 'Enregistrer la séance'}</Button>
      </div>
    </div>
  );
}
