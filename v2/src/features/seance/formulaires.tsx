import { useEffect, useState } from 'react';
import {
  ACTIONS_SUITE_SUGGEREES, AIDES_SUGGEREES, COLLABORATIONS_SUGGEREES, EFFETS_LIBELLES,
  FILIERES_LIBELLES, interventionsAffichees, modalitesAffichees, NIVEAUX_LIBELLES, NIVEAUX_VIGILANCE, NIVEAU_MIN, OBSERVATIONS_SUGGEREES, PERIODES_DEFAUT, PRESENCE_LIBELLES, PRESENCE_PROF_ABSENT_VU, SITUATION_AIDE_LIBELLES, VIGILANCES_SUGGEREES, estVigilance
} from '../../domain/types.ts';
import type { Aide, Eleve, Effet, Niveau, Observation, Presence, Seance, SituationAide } from '../../domain/types.ts';
import { LEXIQUE_ACCOMPAGNEMENTS, LEXIQUE_AIDES, LEXIQUE_NIVEAUX } from '../../domain/lexique.ts';
import { Button } from '../../ui/Button.tsx';
import { BoutonLexique } from '../../ui/Lexique.tsx';
import { Chips } from '../../ui/Chip.tsx';
import { ChampSuggestions } from '../../ui/ChampSuggestions.tsx';
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx';
import { anneeDeNiveau, cibleDeSeance, defautsSeance, formeDeFiliere, rentreeDeDate } from '../../domain/referentiel/index.ts';
import { elevesProposes, enseignantDuDossier, languesDe, nomAffiche } from '../../domain/eleves/index.ts';
import { ecoleDeEleve, nbPeriodesUtilisees } from '../../domain/agenda/index.ts';
import type { Ecole } from '../../domain/agenda/index.ts';
import type { Piste } from '../../domain/referentiel/index.ts';
import { indexDe } from '../../domain/referentiel/charger.ts';
import { ListeColonnes } from '../../ui/ListeColonnes.tsx';
import type { ErreursChamps } from './brouillon.ts';
import { Point, TEINTES_EFFET, TEINTES_NIVEAU, TEINTES_VIGILANCE } from '../../ui/Point.tsx';

export interface PropsFormulaire {
  s: Seance;
  maj: (patch: Partial<Seance>) => void;
}

/** Messages d'erreur à écrire sous les champs de l'étape 1 (vide tant que la personne n'a pas essayé d'enregistrer). */
interface PropsCreneau extends PropsFormulaire { eleves: Eleve[]; ecoles?: readonly Ecole[]; erreurs?: ErreursChamps }

const niveau = (n: number): Niveau => n as Niveau;
const effet = (n: number): Effet => n as Effet;

/* ───────── 1. Créneau et partie pédagogique ───────── */
/** Les choix de présence, dans l'ordre affiché : « professeur absent, élève vu » est une séance tenue, juste après la présence normale. */
const CHOIX_PRESENCE: { cle: string; presence: Presence; profAbsent: boolean; titre: string; aide: string }[] = [
  ...(Object.keys(PRESENCE_LIBELLES) as Presence[]).flatMap((p) => {
    const normal = { cle: p, presence: p, profAbsent: false, ...PRESENCE_LIBELLES[p] };
    return p === 'present' ? [normal, { cle: 'present-prof-absent', presence: p, profAbsent: true, ...PRESENCE_PROF_ABSENT_VU }] : [normal];
  })
];

export function FormulaireCreneau({ s, maj, eleves, ecoles = [], erreurs = {} }: PropsCreneau) {
  const eleve = eleves.find((e) => e.id === s.eleveId);
  // Les périodes proposées sont celles de l'école de l'élève (neuf au plus) ; on garde toujours celles déjà choisies.
  const nbPeriodes = ecoles.length
    ? Math.max(nbPeriodesUtilisees(ecoleDeEleve(eleve, ecoles).periodes), PERIODES_DEFAUT.indexOf(s.periodeDebut as never) + 1, PERIODES_DEFAUT.indexOf(s.periodeFin as never) + 1)
    : PERIODES_DEFAUT.length;
  const periodesProposees = PERIODES_DEFAUT.slice(0, nbPeriodes);
  // Les langues du dossier sont proposées comme matières (Anglais, Néerlandais…), après les matières suivies.
  const matieres = eleve ? [...eleve.matieres, ...languesDe(eleve).filter((l) => !eleve.matieres.includes(l))] : [];
  const absent = s.presence !== 'present';
  const coteach = s.presence === 'absent_eleve_coteach';
  const classeSeule = absent && !coteach;
  const choisi = CHOIX_PRESENCE.find((c) => c.presence === s.presence && c.profAbsent === (s.profAbsent === true)) ?? CHOIX_PRESENCE[0]!;

  return (
    <>
      <fieldset className="presence" aria-label="Statut de présence">
        {CHOIX_PRESENCE.map((c) => (
          <label key={c.cle} className="presence-choix" data-actif={choisi.cle === c.cle} data-presence={c.presence}>
            <input type="radio" name="presence" value={c.cle} checked={choisi.cle === c.cle} onChange={() => maj({ presence: c.presence, profAbsent: c.profAbsent })} />
            <span>{c.titre}</span>
          </label>
        ))}
        <p className="field-hint presence-aide">{choisi.aide}</p>
      </fieldset>

      <div className="champs champs-3">
        <Field label="Élève accompagné" {...(erreurs.eleve ? { erreur: erreurs.eleve } : {})}>
          {(id, champ) => (
            <Select id={id} {...champ} value={s.eleveId} onChange={(e) => {
              const el = eleves.find((x) => x.id === e.target.value);
              maj({ eleveId: e.target.value, matiere: '', ...defautsSeance(el) });
            }}>
              <option value="">Choisir un élève</option>
              {elevesProposes(eleves, s.eleveId).map((e) => <option key={e.id} value={e.id}>{nomAffiche(e)}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date" {...(erreurs.date ? { erreur: erreurs.date } : {})}>
          {(id, champ) => <Input id={id} {...champ} type="date" value={s.date} onChange={(e) => maj({ date: e.target.value })} />}
        </Field>
        <Field label="Période">
          {(id) => (
            <div className="periodes">
              <Select id={id} value={s.periodeDebut} aria-label="Première période" onChange={(e) => maj({ periodeDebut: e.target.value, periodeFin: e.target.value })}>
                {periodesProposees.map((p) => <option key={p}>{p}</option>)}
              </Select>
              <span aria-hidden="true">→</span>
              <Select value={s.periodeFin} aria-label="Dernière période" onChange={(e) => maj({ periodeFin: e.target.value })}>
                {periodesProposees.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          )}
        </Field>
      </div>

      <div className="champs champs-3">
        <Field label="Matière" aide={matieres.length ? 'Les matières du dossier de l’élève sont proposées en priorité.' : undefined} {...(erreurs.matiere ? { erreur: erreurs.matiere } : {})}>
          {(id, champ) => (
            <ChampSuggestions id={id} {...champ} value={s.matiere} placeholder="Choisir ou écrire" suggestions={matieres} onChange={(matiere) => maj({ matiere })} />
          )}
        </Field>
        <Field label="Enseignant du cours" optionnel aide="Laissez vide : le nom du dossier de l’élève sera gardé. Écrivez un nom pour un remplacement.">
          {(id) => <Input id={id} value={s.enseignant ?? ''} placeholder={enseignantDuDossier(eleve, s.matiere) || 'Nom de l’enseignant'} onChange={(e) => maj({ enseignant: e.target.value })} />}
        </Field>
        <Field label="Classe ou niveau" optionnel>
          {(id) => <Input id={id} value={s.niveauScolaire} placeholder="3CB, 4TQ, S2…" onChange={(e) => maj({ niveauScolaire: e.target.value })} />}
        </Field>
        <Field label="Niveau d’étude" optionnel>
          {(id) => (
            <Select id={id} value={s.forme} onChange={(e) => maj({ forme: e.target.value })}>
              <option value="">Non précisée</option>
              {Object.entries(FILIERES_LIBELLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
      </div>

      {!classeSeule ? (
        <>
          {coteach ? (
            <Field label="Contenu vu en classe" aide="L’élève est absent : notez ce qui a été travaillé en classe.">
              {(id) => <Textarea id={id} value={s.contenuClasse} onChange={(e) => maj({ contenuClasse: e.target.value })} />}
            </Field>
          ) : (
            <Field label="Objectif de la leçon">
              {(id) => <Input id={id} value={s.objectifLecon} placeholder="Ce que l’élève est censé apprendre" onChange={(e) => maj({ objectifLecon: e.target.value })} />}
            </Field>
          )}
          <Field label="Mon objectif">
            {(id) => <Input id={id} value={s.monObjectif} placeholder="Ce que vous visez durant cette séance" onChange={(e) => maj({ monObjectif: e.target.value })} />}
          </Field>
          <div className="field">
            <div className="rubrique-entete"><span className="field-label">Mon intervention</span><BoutonLexique titre="Lexique des types d’accompagnement" entrees={LEXIQUE_ACCOMPAGNEMENTS} /></div>
            <Chips options={interventionsAffichees(s.interventions)} valeurs={s.interventions} onChange={(interventions) => maj({ interventions })} />
          </div>
        </>
      ) : null}
    </>
  );
}

/* ───────── 2. Fonctionnement observé ───────── */
export function FormulaireFonctionnement({ s, maj }: PropsFormulaire) {
  const [libre, setLibre] = useState('');
  const [libreVigilance, setLibreVigilance] = useState('');
  const trouve = (texte: string) => s.observations.find((o) => o.texte === texte);
  const retire = (texte: string) => maj({ observations: s.observations.filter((o) => o.texte !== texte) });
  const fixe = (texte: string, n: number, vigilance: boolean) =>
    maj({ observations: trouve(texte)
      ? s.observations.map((o): Observation => (o.texte === texte ? { ...o, niveau: niveau(n) } : o))
      : [...s.observations, { texte, niveau: niveau(n), ...(vigilance ? { vigilance: true } : {}) }] });
  const connus = new Set([...OBSERVATIONS_SUGGEREES.flatMap((g) => g.items), ...VIGILANCES_SUGGEREES]);
  const perso = s.observations.filter((o) => !connus.has(o.texte) && !estVigilance(o));
  const persoVigilance = s.observations.filter((o) => !connus.has(o.texte) && estVigilance(o));
  const ajouterLibre = (texte: string, vigilance: boolean, vider: () => void) => {
    const t = texte.trim();
    if (!t || trouve(t)) return;
    maj({ observations: [...s.observations, { texte: t, niveau: null, ...(vigilance ? { vigilance: true } : {}) }] });
    vider();
  };

  const carte = (texte: string, personnalise = false, vigilance = false) => (
    <Point key={texte} nom={texte} libelles={vigilance ? NIVEAUX_VIGILANCE : NIVEAUX_LIBELLES} valeurMin={vigilance ? 0 : NIVEAU_MIN} teintes={vigilance ? TEINTES_VIGILANCE : TEINTES_NIVEAU}
      valeur={trouve(texte)?.niveau} onChoisir={(n) => fixe(texte, n, vigilance)} onRetirer={retire.bind(null, texte)}
      libelleRetirer={personnalise ? 'Retirer' : 'Pas observé'} />
  );

  return (
    <>
      <div className="rubrique-entete">
        <p className="etape-aide">Pour chaque point observé, choisissez le niveau. Laissez de côté ce qui n’a pas été observé.</p>
        <BoutonLexique titre="Lexique des niveaux" entrees={LEXIQUE_NIVEAUX} />
      </div>
      {OBSERVATIONS_SUGGEREES.map((g) => (
        <div key={g.rubrique} className="rubrique">
          <h3>{g.rubrique}</h3>
          <ul className="points">{g.items.map((i) => carte(i))}</ul>
        </div>
      ))}
      <div className="rubrique">
        <h3>Autre observation</h3>
        {perso.length ? <ul className="points">{perso.map((o) => carte(o.texte, true))}</ul> : null}
        <form className="ajout" onSubmit={(e) => { e.preventDefault(); ajouterLibre(libre, false, () => setLibre('')); }}>
          <Input value={libre} placeholder="Une observation qui n’est pas dans la liste" aria-label="Autre observation" onChange={(e) => setLibre(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
      </div>
      <div className="rubrique">
        <h3>Points de vigilance</h3>
        <p className="etape-aide">Une difficulté observée : indiquez à quelle fréquence, et non si c’est acquis.</p>
        <ul className="points">
          {VIGILANCES_SUGGEREES.map((v) => carte(v, false, true))}
          {persoVigilance.map((o) => carte(o.texte, true, true))}
        </ul>
        <form className="ajout" onSubmit={(e) => { e.preventDefault(); ajouterLibre(libreVigilance, true, () => setLibreVigilance('')); }}>
          <Input value={libreVigilance} placeholder="Une autre difficulté observée" aria-label="Autre point de vigilance" onChange={(e) => setLibreVigilance(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
      </div>
      <Field label="Remarque" optionnel aide="Astuce : le micro du clavier de la tablette dicte directement dans ce champ.">
        {(id) => <Textarea id={id} value={s.remarque} placeholder="Ce qui a été observé, en quelques mots" onChange={(e) => maj({ remarque: e.target.value })} />}
      </Field>
    </>
  );
}

/* ───────── 3. Compétence travaillée ───────── */
/** Pistes tirées du référentiel officiel à partir de l'objectif, de la matière et du niveau. */
function usePistes(s: Seance, eleve: Eleve | undefined, nombre: number): { pistes: Piste[]; langueAmbigue: boolean } {
  const [pistes, setPistes] = useState<Piste[]>([]);
  const objectif = `${s.objectifLecon} ${s.monObjectif}`.trim();
  const clefLangues = eleve ? languesDe(eleve).join('|') : '';
  const { cible, ambigu } = cibleDeSeance(s.matiere, clefLangues ? clefLangues.split('|') : []);
  const jeu = cible?.jeu;
  const langue = cible?.langue;
  useEffect(() => {
    if (!jeu || !objectif) { setPistes([]); return; }
    let actif = true;
    const t = setTimeout(() => {
      void indexDe(jeu).then((index) => {
        if (actif) setPistes(index.suggerer({ objectif, annee: anneeDeNiveau(s.niveauScolaire), forme: formeDeFiliere(s.forme), langue, rentree: rentreeDeDate(s.date) }, nombre));
      }).catch(() => { if (actif) setPistes([]); });
    }, 300);
    return () => { actif = false; clearTimeout(t); };
  }, [jeu, langue, s.niveauScolaire, s.forme, s.date, objectif, nombre]);
  return { pistes: jeu && objectif ? pistes : [], langueAmbigue: ambigu };
}

export function FormulaireCompetence({ s, maj, eleve }: PropsFormulaire & { eleve?: Eleve | undefined }) {
  const [texte, setTexte] = useState('');
  const [plus, setPlus] = useState(false);
  const { pistes: brutes, langueAmbigue } = usePistes(s, eleve, plus ? 8 : 4);
  const pistes = brutes.filter((p) => !s.competences.some((c) => c.texte === p.entree.a));
  /** Séquence ou module du programme dont viennent les premières pistes (le reste, s'il y en a, n'est pas de ce module). */
  const sequence = brutes[0]?.sequence;
  /** Pistes qui ne sont pas du module nommé au-dessus : proposées après lui, sans titre. */
  const autresPistes = sequence ? pistes.filter((p) => !p.sequence) : [];
  const listeDePistes = (liste: Piste[]) => (
    <ListeColonnes elements={liste.map((p) => {
      const nom = p.ecartAnnee ? `${p.entree.a} (programme de ${p.ecartAnnee})` : p.entree.a;
      return {
        cle: `${p.entree.n ?? ''}${p.entree.a}`,
        longueur: nom.length,
        noeud: <Point nom={nom} libelles={NIVEAUX_LIBELLES} valeurMin={NIVEAU_MIN} teintes={TEINTES_NIVEAU} valeur={null} niveauFacultatif
          onGarder={() => prendre(p)} onChoisir={(n) => prendre(p, n)} />
      };
    })} />
  );
  /** `n` absent : la piste est gardée sans niveau (le niveau reste facultatif pour une compétence). */
  const prendre = (p: Piste, n?: number) =>
    maj({ competences: [...s.competences, { texte: p.entree.a, niveau: n === undefined ? null : niveau(n) }] });
  const ajouter = () => {
    const t = texte.trim();
    if (!t || s.competences.some((c) => c.texte === t)) return;
    maj({ competences: [...s.competences, { texte: t, niveau: null }] });
    setTexte('');
  };
  return (
    <>
      {langueAmbigue && !pistes.length ? (
        <p className="field-hint">Cet élève suit plusieurs langues : choisissez la langue précise (Anglais, Néerlandais…) comme matière à l’étape 1 pour voir des pistes.</p>
      ) : null}
      {pistes.length ? (
        <div className="rubrique">
          <h3>Pistes d’après l’objectif de la leçon</h3>
          {sequence ? (
            <p className="sequence-programme">
              <span className="sequence-titre">{sequence.titre}</span>
              {sequence.competence ? <span className="sequence-competence"> : {sequence.competence}</span> : null}
            </p>
          ) : null}
          <p className="etape-aide">Touchez « Garder » pour retenir une piste (le niveau est facultatif), ou saisissez la vôtre.</p>
          {listeDePistes(sequence ? pistes.filter((p) => p.sequence) : pistes)}
          {sequence && autresPistes.length ? (
            <>
              <p className="etape-aide">Autres pistes proches de l’objectif</p>
              {listeDePistes(autresPistes)}
            </>
          ) : null}
          {!plus ? <Button type="button" variante="secondaire" onClick={() => setPlus(true)}>Voir d’autres pistes</Button> : null}
        </div>
      ) : null}
      <form className="ajout" onSubmit={(e) => { e.preventDefault(); ajouter(); }}>
        <Field label="Compétence travaillée" className="ajout-champ">
          {(id) => <Input id={id} value={texte} placeholder="Ex. : résoudre un problème à une opération" onChange={(e) => setTexte(e.target.value)} />}
        </Field>
        <Button type="submit">Garder</Button>
      </form>
      {s.competences.length ? (
        <ul className="points">
          {s.competences.map((c) => (
            <Point key={c.texte} nom={c.texte} libelles={NIVEAUX_LIBELLES} valeurMin={NIVEAU_MIN} teintes={TEINTES_NIVEAU} valeur={c.niveau} niveauFacultatif
              onChoisir={(n) => maj({ competences: s.competences.map((x) => (x.texte === c.texte ? { ...x, niveau: niveau(n) } : x)) })}
              onRetirer={() => maj({ competences: s.competences.filter((x) => x.texte !== c.texte) })} />
          ))}
        </ul>
      ) : null}
      <Field label="Précision" optionnel>
        {(id) => <Textarea id={id} value={s.precisionCompetence} onChange={(e) => maj({ precisionCompetence: e.target.value })} />}
      </Field>
    </>
  );
}

/* ───────── 4. Ce qui a aidé ───────── */
export function FormulaireAides({ s, maj }: PropsFormulaire) {
  const trouve = (nom: string) => s.aides.find((a) => a.nom === nom);
  const retire = (nom: string) => maj({ aides: s.aides.filter((a) => a.nom !== nom) });
  const fixe = (nom: string, n: number) =>
    maj({ aides: trouve(nom) ? s.aides.map((a): Aide => (a.nom === nom ? { ...a, effet: effet(n) } : a)) : [...s.aides, { nom, effet: effet(n) }] });
  const connues = new Set<string>(AIDES_SUGGEREES);
  const autres = s.aides.filter((a) => !connues.has(a.nom));

  return (
    <>
      <div className="field">
        <span className="field-label">Ces aides sont…</span>
        <div className="chips" role="radiogroup" aria-label="Statut des aides">
          {(Object.keys(SITUATION_AIDE_LIBELLES) as SituationAide[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={s.situationAide === k} className="chip"
              onClick={() => maj({ situationAide: k })}>{SITUATION_AIDE_LIBELLES[k]}</button>
          ))}
        </div>
      </div>
      <div className="rubrique">
        <div className="rubrique-entete"><h3>Aides utilisées</h3><BoutonLexique titre="Lexique des aides" entrees={LEXIQUE_AIDES} /></div>
        <p className="etape-aide">Pour chaque aide utilisée, choisissez son effet. Laissez de côté ce qui n’a pas servi.</p>
        <ul className="points">
          {[...AIDES_SUGGEREES, ...autres.map((a) => a.nom)].map((nom) => (
            <Point key={nom} nom={nom} libelles={EFFETS_LIBELLES} teintes={TEINTES_EFFET} valeur={trouve(nom)?.effet}
              onChoisir={(n) => fixe(nom, n)} onRetirer={() => retire(nom)} libelleRetirer="Pas utilisée" />
          ))}
        </ul>
      </div>
      <Field label="Précision" optionnel>
        {(id) => <Textarea id={id} value={s.precisionAide} placeholder="Ce qui a été fait et ce qui a été observé ensuite" onChange={(e) => maj({ precisionAide: e.target.value })} />}
      </Field>
    </>
  );
}

/* ───────── 5. Suite ───────── */
export function FormulaireSuite({ s, maj }: PropsFormulaire) {
  const suite = s.suite;
  const set = (patch: Partial<Seance['suite']>) => maj({ suite: { ...suite, ...patch } });
  return (
    <>
      <div className="field">
        <span className="field-label">Suite de l’accompagnement</span>
        <Chips options={ACTIONS_SUITE_SUGGEREES} valeurs={suite.actions} onChange={(actions) => set({ actions })} />
      </div>
      <Field label="Format de la prochaine séance" optionnel>
        {(id) => (
          <Select id={id} value={suite.modalite} onChange={(e) => set({ modalite: e.target.value })}>
            <option value="">Sans changement</option>
            {modalitesAffichees(suite.modalite).map((m) => <option key={m}>{m}</option>)}
          </Select>
        )}
      </Field>
      <Field label="Objectif pour la prochaine séance" optionnel>
        {(id) => <Input id={id} value={suite.objectif} onChange={(e) => set({ objectif: e.target.value })} />}
      </Field>
      <div className="field">
        <span className="field-label">Collaboration et concertation <span className="opt">si nécessaire</span></span>
        <Chips options={COLLABORATIONS_SUGGEREES} valeurs={suite.collaborations} onChange={(collaborations) => set({ collaborations })} />
      </div>
      <Field label="Précision" optionnel>
        {(id) => <Textarea id={id} value={suite.precision} onChange={(e) => set({ precision: e.target.value })} />}
      </Field>
    </>
  );
}
