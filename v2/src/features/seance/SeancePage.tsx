import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Seance } from '../../domain/types.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import type { Aller } from '../../app/useRoute.ts';
import { fixerEnseignant } from '../../domain/eleves/index.ts';
import { contenuSaisi } from '../../domain/brouillons/index.ts';
import type { BrouillonSeance } from '../../domain/brouillons/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { Apercu } from './Apercu.tsx';
import { Etape } from './Etape.tsx';
import { attendreFinRepli } from './defilement.ts';
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

/** « 7 nov. 2026, 10:12 » : le moment de la dernière saisie, dans la langue de l'appareil. */
const quand = (iso: string): string => new Date(iso).toLocaleString('fr-BE', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

export function SeancePage({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const ecoles = useMagasin(magasin, (e) => e.ecoles);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const [s, setS] = useState<Seance>(() => ({ ...seanceVide(), ...(magasin.lire().preparation ?? {}) }));
  /** Séance déjà enregistrée (ouverte depuis le Journalier) : on la modifie au lieu d'en créer une. */
  const [edition] = useState(() => magasin.lire().seances.some((x) => x.id === s.id));
  /** Ouverte depuis l'agenda ou le Journalier : la séance est déjà choisie, on ne propose pas de brouillon par-dessus. */
  const [preparee] = useState(() => magasin.lire().preparation !== null);
  /** Brouillon retrouvé (rechargement, changement d'écran par erreur) : proposé une fois, jamais appliqué sans accord. */
  const [proposition, setProposition] = useState<BrouillonSeance | null>(() => {
    const b = edition || preparee ? null : magasin.lire().brouillonSeance;
    return b && contenuSaisi(b.seance) ? b : null;
  });
  /** Vrai dès la première saisie : avant cela, ouvrir l'écran ne touche pas à un brouillon existant. */
  const [modifie, setModifie] = useState(false);
  const erreurBrouillon = useMagasin(magasin, (e) => e.erreurBrouillon);
  useEffect(() => { magasin.viderPreparation(); }, [magasin]);
  /* Garde la saisie au fur et à mesure ; à la sortie de l'écran, écrit tout de suite ce qui attend. */
  useEffect(() => {
    if (edition || proposition || !modifie) return;
    if (contenuSaisi(s)) magasin.enregistrerBrouillonSeance(s);
    else void magasin.effacerBrouillonSeance();
  }, [s, edition, proposition, modifie, magasin]);
  useEffect(() => () => { void magasin.viderEnregistrements(); }, [magasin]);
  const [ouvert, setOuvert] = useState(0);
  const [raisons, setRaisons] = useState<string[]>([]);
  const [tiroir, setTiroir] = useState(false);

  const maj = useCallback((patch: Partial<Seance>) => {
    setS((cur) => ({ ...cur, ...patch, modifieLe: new Date().toISOString() }));
    setModifie(true);
    setRaisons([]);
  }, []);

  const reprendre = (b: BrouillonSeance) => { setS(b.seance); setProposition(null); setModifie(true); };
  const repartir = () => { setProposition(null); void magasin.effacerBrouillonSeance(); };

  const eleve = eleves.find((e) => e.id === s.eleveId);
  const precedentes = useMemo(() => seances.filter((x) => x.eleveId === s.eleveId), [seances, s.eleveId]);
  const etats = etatsEtapes(s);
  const resumes = resumesEtapes(s);
  const notes = s.observations.length + s.competences.length + s.aides.length;

  const aller = (i: number) => {
    // Une rubrique ouverte AU-DESSUS de la cible se referme : on attend la fin du repli, sinon la cible bouge pendant le défilement.
    const precedente = ouvert >= 0 && ouvert < i ? document.getElementById(`etape-corps-${ouvert + 1}`) : null;
    setOuvert(i);
    void attendreFinRepli(precedente).then(() => {
      requestAnimationFrame(() => {
        document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ block: 'start', behavior: reduireMouvement() ? 'auto' : 'smooth' });
      });
    });
  };

  const enregistrer = async () => {
    const v = verifier(s);
    if (!v.ok) { setRaisons(v.raisons); return; }
    await magasin.enregistrerSeance(fixerEnseignant(s, eleve));
    await magasin.effacerBrouillonSeance();
    if (edition) {
      annoncer('Séance modifiée');
      onAller('journalier', { eleve: s.eleveId });
      return;
    }
    annoncer('Séance enregistrée');
    setS(seanceVide(s.eleveId, s.date));
    setModifie(false);
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

      {proposition ? (
        <div className="brouillon-retrouve" role="status">
          <p>Une séance non enregistrée a été retrouvée ({quand(proposition.enregistreLe)}).</p>
          <div className="fiche-actions">
            <Button variante="primaire" onClick={() => reprendre(proposition)}>Reprendre ma saisie</Button>
            <Button onClick={repartir}>Repartir de zéro</Button>
          </div>
        </div>
      ) : null}
      {erreurBrouillon ? <p className="field-hint" role="alert">Votre saisie n’a pas pu être gardée sur cet appareil : {erreurBrouillon}</p> : null}

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
