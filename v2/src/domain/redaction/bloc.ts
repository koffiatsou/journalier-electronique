/*
 * Moteur de rédaction déterministe : séance → bloc du Journalier papier.
 *
 * Principes :
 *  - aucune IA, aucun hasard : mêmes données = même texte ;
 *  - chaque phrase vient d'une donnée saisie (rien n'est inventé) ;
 *  - voix neutre : « l'élève » n'apparaît jamais comme pronom, pas de genre ;
 *  - aucun comptage (« six points… ») : les points sont nommés, avec leur niveau ;
 *  - module pur : ne lit ni le DOM, ni le stockage, ni le réseau.
 */
import type { Seance } from '../types.ts';
import { versFaits } from './faits.ts';
import {
  NBSP, dateCourte, dateFR, enumeration, finPhrase, majusculePremiere as Maj, minusculePremiere as min
} from './langue.ts';
import type { Bloc, Faits, LigneOrtho } from './types.ts';

const NIVEAUX = ['Partiellement', 'Suffisamment', 'Totalement'] as const;
const EFFETS = ['Aucun effet', 'Effet partiel', 'Effet positif'] as const;
const TRANSFERT_MOT: Record<string, string> = {
  observed: 'observé',
  not_observed: 'non observé',
  no_opportunity: 'pas d’occasion de l’observer',
  later: 'à observer plus tard'
  // not_relevant : volontairement omis de l'export
};

export const TEXTE_ABSENCE = {
  absent_eleve: 'Élève absent — séance non tenue.',
  absent_prof: 'Professeur absent — cours annulé.',
  absent_eleve_coteach: 'Élève absent — intervention en co-enseignement.',
  absent_agent: 'Agent du pôle absent — séance non assurée.'
} as const;

type AvecNiveau = { texte: string; niveau: number | null };

/** Regroupe par niveau décroissant (Totalement d'abord), puis ceux sans niveau. */
export function grouperParNiveau<T extends AvecNiveau>(items: readonly T[]): { niveau: number | null; items: T[] }[] {
  const groupes: { niveau: number | null; items: T[] }[] = [];
  for (let n = 2; n >= 0; n--) {
    const liste = items.filter((i) => i.niveau === n);
    if (liste.length) groupes.push({ niveau: n, items: liste });
  }
  const sans = items.filter((i) => i.niveau === null);
  if (sans.length) groupes.push({ niveau: null, items: sans });
  return groupes;
}

/* ---------- constats : évolution depuis une séance précédente ---------- */
interface Evolution { texte: string; de: number; dateDe: string; vers: number }

function evolution(faits: Faits, precedentes: readonly Faits[]): Evolution[] {
  const avant = precedentes
    .filter((p) => p.eleveId === faits.eleveId && p.matiere === faits.matiere && p.date && p.date < faits.date && p.presence === 'present')
    .sort((a, b) => (a.date < b.date ? 1 : -1));
  const res: Evolution[] = [];
  for (const o of faits.observations) {
    if (o.niveau === null) continue;
    for (const p of avant) {
      const trouve = p.observations.find((x) => x.texte === o.texte && x.niveau !== null);
      if (trouve && trouve.niveau !== null) {
        if (trouve.niveau !== o.niveau) res.push({ texte: o.texte, de: trouve.niveau, dateDe: p.date, vers: o.niveau });
        break;
      }
    }
  }
  return res;
}

/* ---------- réalisation en français ---------- */
const puces = (groupes: ReturnType<typeof grouperParNiveau>, libelle: (n: number | null) => string): string[] =>
  groupes.map((g) => `• ${libelle(g.niveau)}${NBSP}: ${enumeration(g.items.map((i) => min(i.texte)))}.`);

function ligneFonctionnement(f: Faits): string[] | null {
  if (!f.observations.length) return null;
  return puces(grouperParNiveau(f.observations), (n) => (n === null ? 'Observé' : NIVEAUX[n] ?? 'Observé'));
}

function ligneCompetence(f: Faits): string | null {
  if (!f.competences.length) return null;
  const parts = f.competences.map((c) =>
    c.niveau === null ? min(c.texte) : `${min(c.texte)} (${min(NIVEAUX[c.niveau] ?? '')})`);
  return `${Maj(enumeration(parts))}.`;
}

/** Aides regroupées par effet : « • Effet positif : support visuel ; guidage verbal. » */
function ligneAides(f: Faits): string[] | null {
  if (!f.aides.length) return null;
  const items = f.aides.map((a) => ({ texte: a.texte, niveau: a.effet as number | null }));
  return puces(grouperParNiveau(items), (n) => (n === null ? 'Effet non précisé' : EFFETS[n] ?? 'Effet non précisé'));
}

function ligneTransfert(f: Faits): string | null {
  const mot = f.transfert ? TRANSFERT_MOT[f.transfert] : undefined;
  const prec = finPhrase(f.precisionTransfert);
  if (!mot) return prec || null;
  return prec ? `${Maj(mot)}. ${prec}` : `${Maj(mot)}.`;
}

function ligneSuite(f: Faits): string | null {
  const morceaux: string[] = [];
  if (f.actions.length) morceaux.push(`${Maj(enumeration(f.actions.map(min)))}.`);
  if (f.modalite) morceaux.push(`Modalité${NBSP}: ${min(f.modalite)}.`);
  if (f.objectifSuite) morceaux.push(finPhrase(Maj(f.objectifSuite)));
  if (f.collaborations.length) morceaux.push(`À prévoir${NBSP}: ${enumeration(f.collaborations.map(min))}.`);
  if (f.precisionSuite) morceaux.push(finPhrase(f.precisionSuite));
  return morceaux.length ? morceaux.join(' ') : null;
}

function ligneEvolution(evo: readonly Evolution[]): string | null {
  if (!evo.length) return null;
  const corps = evo.map((x) =>
    `${min(x.texte)}${NBSP}: ${min(NIVEAUX[x.de] ?? '')} (${dateCourte(x.dateDe)}) → ${min(NIVEAUX[x.vers] ?? '')}`);
  return `${enumeration(corps)}.`;
}

/* ---------- bloc complet ---------- */
export interface ContexteBloc {
  titulaire?: string;
  /** Séances antérieures du même élève, pour l'évolution. */
  precedentes?: readonly Seance[];
}

export function construireBloc(seance: Seance, contexte: ContexteBloc = {}): Bloc {
  const faits = versFaits(seance, contexte.titulaire);
  const estAbsence = faits.presence !== 'present' && faits.presence !== 'absent_eleve_coteach';
  const bloc: Bloc = {
    type: estAbsence ? 'absence' : 'seance',
    presence: faits.presence,
    entete: { date: dateFR(faits.date), cours: faits.matiere, titulaire: faits.titulaire },
    peda: null,
    ortho: []
  };

  if (faits.presence !== 'present' && faits.presence !== 'absent_eleve_coteach') {
    bloc.ortho.push({ label: null, texte: TEXTE_ABSENCE[faits.presence] });
    return bloc;
  }

  bloc.peda = {
    objectifLecon: faits.objectifLecon,
    contenuClasse: faits.contenuClasse,
    monObjectif: faits.monObjectif,
    monIntervention: enumeration(faits.interventions),
    interventions: faits.interventions
  };

  if (faits.presence === 'absent_eleve_coteach') {
    bloc.ortho = [{ label: null, texte: TEXTE_ABSENCE.absent_eleve_coteach }];
    return bloc;
  }

  const l: LigneOrtho[] = [];
  const fonct = ligneFonctionnement(faits);
  if (fonct || faits.remarque) {
    const lignes = fonct ? [...fonct] : [];
    if (faits.remarque) lignes.push(`Remarque${NBSP}: ${finPhrase(faits.remarque)}`);
    l.push({ label: 'Fonctionnement observé', lignes });
  }
  const comp = ligneCompetence(faits);
  if (comp) l.push({ label: 'Compétence travaillée', texte: comp });
  if (faits.precisionCompetence) l.push({ label: comp ? 'Précision' : 'Compétence travaillée', texte: finPhrase(faits.precisionCompetence) });
  const aides = ligneAides(faits);
  if (aides) l.push({ label: 'Aides mises en place', lignes: aides });
  if (faits.precisionAide) l.push({ label: 'Précision sur les aides', texte: finPhrase(faits.precisionAide) });
  const tr = ligneTransfert(faits);
  if (tr) l.push({ label: 'Transfert', texte: tr });
  const suite = ligneSuite(faits);
  if (suite) l.push({ label: 'Suite', texte: suite });
  const evo = ligneEvolution(evolution(faits, (contexte.precedentes ?? []).map((p) => versFaits(p))));
  if (evo) l.push({ label: 'Évolution depuis la séance précédente', texte: evo });
  if (!l.length) l.push({ label: null, texte: 'Séance sans observation particulière.' });
  bloc.ortho = l;
  return bloc;
}

/** Champ « Libellé : valeur », avec un tiret quand la valeur est vide (jamais d'espace pendant). */
const champ = (libelle: string, valeur: string): string => `${libelle}${NBSP}: ${valeur || '—'}`;

/** Texte brut d'un bloc (aperçu à l'écran, tests, repli sans Word). */
export function blocEnTexte(bloc: Bloc): string {
  const { date, cours, titulaire } = bloc.entete;
  const out = [`${champ('Date', date)} | ${champ('Cours', cours)} | ${champ('Titulaire', titulaire)}`];
  if (bloc.peda) {
    out.push('PARTIE PÉDAGOGIQUE');
    out.push(champ('Objectif de la leçon', bloc.peda.objectifLecon));
    if (bloc.peda.contenuClasse) out.push(champ('Contenu vu en classe', bloc.peda.contenuClasse));
    out.push(champ('Mon objectif', bloc.peda.monObjectif));
    out.push(champ('Mon intervention', bloc.peda.monIntervention));
    out.push('PARTIE ORTHOPÉDAGOGIQUE');
  }
  for (const b of bloc.ortho) {
    if (b.lignes) {
      out.push(b.label ?? '');
      b.lignes.forEach((x) => out.push(`  ${x}`));
    } else out.push(b.label ? champ(b.label, b.texte ?? '') : (b.texte ?? ''));
  }
  return out.join('\n');
}
