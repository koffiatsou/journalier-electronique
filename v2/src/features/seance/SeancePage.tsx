import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Seance } from '../../domain/types.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import type { Aller } from '../../app/useRoute.ts';
import { fixerEnseignant, nomAffiche } from '../../domain/eleves/index.ts';
import { sansPointNote, seanceEnDoublon } from '../../domain/journalier/index.ts';
import { contenuSaisi } from '../../domain/brouillons/index.ts';
import type { BrouillonSeance } from '../../domain/brouillons/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { Apercu } from './Apercu.tsx';
import { Etape } from './Etape.tsx';
import { ConfirmerAbandon } from '../../ui/ConfirmerAbandon.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { attendreFinRepli, DELAI_CORRECTION_DEFILEMENT_MS } from './defilement.ts';
import { BarreEtapes } from './BarreEtapes.tsx';
import { aCompetenceSaisie, champsEnErreur, etatsEtapes, INDEX_COMPETENCE, progression, resumesEtapes, seanceVide, verifier } from './brouillon.ts';
import { competenceMasqueeEnregistree, retenirCompetenceMasquee } from '../../ui/competenceMasquee.ts';
import {
  FormulaireAides, FormulaireCompetence, FormulaireCreneau, FormulaireFonctionnement, FormulaireSuite
} from './formulaires.tsx';

/** `zone` : bleu = partie pédagogique (1 et 2), vert-bleu = partie orthopédagogique (3, 4 et 5) ; `court` : nom dans la barre d'étapes. */
const ETAPES = [
  { titre: 'Créneau et partie pédagogique', court: 'Créneau', zone: 'peda' },
  { titre: 'Compétence travaillée', court: 'Compétence', zone: 'peda' },
  { titre: 'Fonctionnement observé', court: 'Fonctionnement', zone: 'ortho' },
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
  // Vrai après un essai d'enregistrement refusé : les erreurs s'affichent alors, et disparaissent d'elles-mêmes une fois corrigées.
  const [tentative, setTentative] = useState(false);
  const raisons = tentative ? verifier(s).raisons : [];
  const erreurs = tentative ? champsEnErreur(s) : {};
  const [tiroir, setTiroir] = useState(false);

  const maj = useCallback((patch: Partial<Seance>) => {
    setS((cur) => ({ ...cur, ...patch, modifieLe: new Date().toISOString() }));
    setModifie(true);
    setTentative(false);
  }, []);

  const reprendre = (b: BrouillonSeance) => { setS(b.seance); setProposition(null); setModifie(true); };
  const repartir = () => { setProposition(null); void magasin.effacerBrouillonSeance(); };

  const eleve = eleves.find((e) => e.id === s.eleveId);
  const precedentes = useMemo(() => seances.filter((x) => x.eleveId === s.eleveId), [seances, s.eleveId]);
  /** Rubrique Compétence cachée au choix de la personne ; jamais quand la séance contient déjà une compétence (aucune donnée cachée). */
  const [competenceMasquee, setCompetenceMasquee] = useState(competenceMasqueeEnregistree);
  const masquer = competenceMasquee && !aCompetenceSaisie(s);
  const basculerCompetence = () => {
    retenirCompetenceMasquee(!competenceMasquee);
    setCompetenceMasquee(!competenceMasquee);
    setOuvert(0);
  };
  /** Rubriques affichées, avec leur place d'origine (les tableaux de `brouillon.ts` gardent les cinq places). */
  const visibles = ETAPES.map((e, origine) => ({ ...e, origine })).filter((e) => !(masquer && e.origine === INDEX_COMPETENCE));
  const tousEtats = etatsEtapes(s, masquer);
  const tousResumes = resumesEtapes(s, masquer);
  const etats = visibles.map((e) => tousEtats[e.origine] ?? 'vide');
  const notes = s.observations.length + s.competences.length + s.aides.length;

  /** Seconde visée en attente : annulée dès qu'une autre navigation commence (sinon elle tirerait la page vers une ancienne rubrique). */
  const correction = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(correction.current), []);

  const aller = (i: number) => {
    window.clearTimeout(correction.current);
    // Une rubrique ouverte AU-DESSUS de la cible se referme : on attend la fin du repli, sinon la cible bouge pendant le défilement.
    const precedente = ouvert >= 0 && ouvert < i ? document.getElementById(`etape-corps-${ouvert + 1}`) : null;
    setOuvert(i);
    void attendreFinRepli(precedente).then(() => {
      requestAnimationFrame(() => {
        document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ block: 'start', behavior: reduireMouvement() ? 'auto' : 'smooth' });
        // Sur une machine chargée (WebKit sur la CI), le repli peut ne pas être fini quand la position est calculée : la cible
        // remonte ensuite et le titre se retrouve hors de l'écran. Une seconde visée, sans animation, rattrape l'écart ;
        // si la position est déjà bonne, elle ne change rien.
        correction.current = window.setTimeout(() => {
          document.getElementById(`etape-${i + 1}`)?.scrollIntoView({ block: 'start', behavior: 'auto' });
        }, DELAI_CORRECTION_DEFILEMENT_MS);
      });
    });
  };

  /** Montre les erreurs et amène le focus sur le premier champ en erreur (rubrique 1 d'abord, ouverte si besoin). */
  const refuser = () => {
    setTentative(true);
    if (Object.keys(champsEnErreur(s)).length === 0) return;
    setOuvert(0);
    requestAnimationFrame(() => {
      document.querySelector<HTMLElement>('.seance-formulaire [aria-invalid="true"]')?.focus({ preventScroll: false });
    });
  };

  const [confirmerAnnulation, setConfirmerAnnulation] = useState(false);
  /** Annuler la modification d'une séance : on ne demande que si quelque chose a été changé. */
  const annuler = () => { if (modifie) setConfirmerAnnulation(true); else onAller('journalier', { eleve: s.eleveId }); };

  const [doublon, setDoublon] = useState<Seance | null>(null);

  const [videAConfirmer, setVideAConfirmer] = useState(false);

  /** `acquis` : ce que l'agent a déjà confirmé après avertissement (séance sans point noté, doublon) : on ne le lui redemande pas. */
  const enregistrer = async (acquis: { vide?: boolean; doublon?: boolean } = {}) => {
    const v = verifier(s);
    if (!v.ok) { refuser(); return; }
    if (sansPointNote(s) && !acquis.vide) { setVideAConfirmer(true); return; }
    setVideAConfirmer(false);
    const enConflit = seanceEnDoublon(seances, s);
    if (enConflit && !acquis.doublon) { setDoublon(enConflit); return; }
    setDoublon(null);
    await magasin.enregistrerSeance(fixerEnseignant(s, eleve));
    await magasin.effacerBrouillonSeance();
    if (edition) {
      annoncer('Séance modifiée');
      onAller('journalier', { eleve: s.eleveId });
      return;
    }
    const eleveId = s.eleveId;
    annoncer('Séance enregistrée', { libelle: 'Voir dans le Journalier', faire: () => onAller('journalier', { eleve: eleveId }) });
    setS(seanceVide(s.eleveId, s.date));
    setModifie(false);
    setOuvert(0);
    window.scrollTo({ top: 0 });
  };

  const formulaires = [
    <FormulaireCreneau key="1" s={s} maj={maj} eleves={eleves} ecoles={ecoles} erreurs={erreurs} />,
    <FormulaireCompetence key="2" s={s} maj={maj} eleve={eleve} />,
    <FormulaireFonctionnement key="3" s={s} maj={maj} />,
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

      <p className="seance-reglage">
        <Button variante="secondaire" onClick={basculerCompetence}>
          {competenceMasquee ? 'Afficher la rubrique Compétence' : 'Masquer la rubrique Compétence'}
        </Button>
        <span className="field-hint">Ce réglage vaut pour cet appareil. Une séance qui contient déjà une compétence garde la rubrique visible.</span>
      </p>

      <BarreEtapes etapes={visibles} etats={etats} ouvert={ouvert} progression={progression(s, masquer)} onAller={aller} />

      <div className="seance-colonnes">
        <div className="seance-formulaire">
          {visibles.map((e, i) => (
            <Etape key={e.titre} numero={i + 1} titre={e.titre} zone={e.zone} etat={etats[i] ?? 'vide'} resume={tousResumes[e.origine] ?? null}
              ouvert={ouvert === i} onBascule={() => (ouvert === i ? setOuvert(-1) : aller(i))}>
              {formulaires[e.origine]}
              {i < visibles.length - 1 ? (
                <div className="etape-pied">
                  <Button onClick={() => aller(i + 1)}>Étape suivante : {i + 2} {visibles[i + 1]?.titre} ↓</Button>
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
            <p className="barre-erreur">{raisons.join(' ')}</p>
          ) : (
            <p className="num">{notes ? `${notes} point${notes > 1 ? 's' : ''} noté${notes > 1 ? 's' : ''}` : 'Aucun point noté'}</p>
          )}
        </div>
        <Button className="btn-feuille" aria-expanded={tiroir} aria-controls="feuille-apercu" onClick={() => setTiroir((v) => !v)}>Feuille</Button>
        {edition ? <Button onClick={annuler}>Annuler</Button> : null}
        <Button variante="primaire" onClick={() => { void enregistrer(); }}>{edition ? 'Enregistrer les modifications' : 'Enregistrer la séance'}</Button>
      </div>
      <Dialog ouvert={doublon !== null} titre="Il y a déjà une séance sur ce créneau" onFermer={() => setDoublon(null)}>
        {doublon ? (
          <>
            <p>Séance du {dateFR(doublon.date)}, {doublon.periodeDebut}{doublon.matiere ? ` — ${doublon.matiere}` : ''}, pour {eleve ? nomAffiche(eleve) : 'cet élève'}. Si ce n’est pas voulu, revenez à la séance et changez la date ou la période.</p>
            <div className="fiche-actions">
              <Button data-focus-initial variante="primaire" onClick={() => setDoublon(null)}>Revenir à la séance</Button>
              <Button onClick={() => { void enregistrer({ vide: true, doublon: true }); }}>Enregistrer quand même</Button>
            </div>
          </>
        ) : null}
      </Dialog>
      <Dialog ouvert={videAConfirmer} titre="Aucun point noté" onFermer={() => setVideAConfirmer(false)}>
        <p>Vous n’avez noté ni observation, ni compétence, ni aide pour cette séance. Elle apparaîtra au Journalier sans partie orthopédagogique détaillée.</p>
        <div className="fiche-actions">
          <Button data-focus-initial variante="primaire" onClick={() => setVideAConfirmer(false)}>Revenir à la séance</Button>
          <Button onClick={() => { void enregistrer({ vide: true }); }}>Enregistrer quand même</Button>
        </div>
      </Dialog>
      <ConfirmerAbandon ouvert={confirmerAnnulation} perte="Les changements faits à cette séance ne sont pas enregistrés." onContinuer={() => setConfirmerAnnulation(false)} onAbandonner={() => onAller('journalier', { eleve: s.eleveId })} />
    </div>
  );
}
