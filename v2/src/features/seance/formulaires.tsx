import { useState } from 'react';
import {
  ACTIONS_SUITE_SUGGEREES, AIDES_SUGGEREES, COLLABORATIONS_SUGGEREES, EFFETS_LIBELLES, INTERVENTIONS_SUGGEREES,
  MODALITES_SUITE, NIVEAUX_LIBELLES, OBSERVATIONS_SUGGEREES, PERIODES_DEFAUT, PRESENCE_LIBELLES, SITUATION_AIDE_LIBELLES,
  TRANSFERT_LIBELLES
} from '../../domain/types.ts';
import type { Aide, Eleve, Effet, Niveau, Observation, Presence, Seance, SituationAide, Transfert } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Chips } from '../../ui/Chip.tsx';
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx';
import { Point, TEINTES_EFFET, TEINTES_NIVEAU } from '../../ui/Point.tsx';

export interface PropsFormulaire {
  s: Seance;
  maj: (patch: Partial<Seance>) => void;
}

const niveau = (n: number): Niveau => n as Niveau;
const effet = (n: number): Effet => n as Effet;

/* ───────── 1. Créneau et partie pédagogique ───────── */
export function FormulaireCreneau({ s, maj, eleves }: PropsFormulaire & { eleves: Eleve[] }) {
  const eleve = eleves.find((e) => e.id === s.eleveId);
  const matieres = eleve?.matieres ?? [];
  const absent = s.presence !== 'present';
  const coteach = s.presence === 'absent_eleve_coteach';
  const classeSeule = absent && !coteach;

  return (
    <>
      <fieldset className="presence" aria-label="Statut de présence">
        {(Object.keys(PRESENCE_LIBELLES) as Presence[]).map((p) => (
          <label key={p} className="presence-choix" data-actif={s.presence === p} data-presence={p}>
            <input type="radio" name="presence" value={p} checked={s.presence === p} onChange={() => maj({ presence: p })} />
            <span>{PRESENCE_LIBELLES[p].titre}</span>
          </label>
        ))}
        <p className="field-hint presence-aide">{PRESENCE_LIBELLES[s.presence].aide}</p>
      </fieldset>

      <div className="grille grille-3">
        <Field label="Élève accompagné">
          {(id) => (
            <Select id={id} value={s.eleveId} onChange={(e) => maj({ eleveId: e.target.value, matiere: '' })}>
              <option value="">Choisir un élève</option>
              {eleves.map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
            </Select>
          )}
        </Field>
        <Field label="Date">
          {(id) => <Input id={id} type="date" value={s.date} onChange={(e) => maj({ date: e.target.value })} />}
        </Field>
        <Field label="Période">
          {(id) => (
            <div className="periodes">
              <Select id={id} value={s.periodeDebut} aria-label="Première période" onChange={(e) => maj({ periodeDebut: e.target.value, periodeFin: e.target.value })}>
                {PERIODES_DEFAUT.map((p) => <option key={p}>{p}</option>)}
              </Select>
              <span aria-hidden="true">→</span>
              <Select value={s.periodeFin} aria-label="Dernière période" onChange={(e) => maj({ periodeFin: e.target.value })}>
                {PERIODES_DEFAUT.map((p) => <option key={p}>{p}</option>)}
              </Select>
            </div>
          )}
        </Field>
      </div>

      <div className="grille grille-2">
        <Field label="Matière" aide={matieres.length ? 'Les matières du dossier de l’élève sont proposées en priorité.' : undefined}>
          {(id) => (
            <>
              <Input id={id} list={`${id}-liste`} value={s.matiere} placeholder="Choisir ou saisir une matière" onChange={(e) => maj({ matiere: e.target.value })} />
              <datalist id={`${id}-liste`}>{matieres.map((m) => <option key={m} value={m} />)}</datalist>
            </>
          )}
        </Field>
        <Field label="Niveau" optionnel>
          {(id) => <Input id={id} value={s.niveauScolaire} placeholder="S1, S2…" onChange={(e) => maj({ niveauScolaire: e.target.value })} />}
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
            <span className="field-label">Mon intervention</span>
            <Chips options={INTERVENTIONS_SUGGEREES} valeurs={s.interventions} onChange={(interventions) => maj({ interventions })} />
          </div>
        </>
      ) : null}
    </>
  );
}

/* ───────── 2. Fonctionnement observé ───────── */
export function FormulaireFonctionnement({ s, maj }: PropsFormulaire) {
  const [libre, setLibre] = useState('');
  const trouve = (texte: string) => s.observations.find((o) => o.texte === texte);
  const retire = (texte: string) => maj({ observations: s.observations.filter((o) => o.texte !== texte) });
  const fixe = (texte: string, n: number) =>
    maj({ observations: trouve(texte)
      ? s.observations.map((o): Observation => (o.texte === texte ? { ...o, niveau: niveau(n) } : o))
      : [...s.observations, { texte, niveau: niveau(n) }] });
  const connus = new Set(OBSERVATIONS_SUGGEREES.flatMap((g) => g.items));
  const perso = s.observations.filter((o) => !connus.has(o.texte));

  const carte = (texte: string, personnalise = false) => (
    <Point key={texte} nom={texte} libelles={NIVEAUX_LIBELLES} teintes={TEINTES_NIVEAU} valeur={trouve(texte)?.niveau}
      onChoisir={(n) => fixe(texte, n)} onRetirer={retire.bind(null, texte)} libelleRetirer={personnalise ? 'Retirer' : 'Pas observé'} />
  );

  return (
    <>
      <p className="etape-aide">Pour chaque point observé, choisissez le niveau. Laissez de côté ce qui n’a pas été observé.</p>
      {OBSERVATIONS_SUGGEREES.map((g) => (
        <div key={g.rubrique} className="rubrique">
          <h3>{g.rubrique}</h3>
          <ul className="points">{g.items.map((i) => carte(i))}</ul>
        </div>
      ))}
      <div className="rubrique">
        <h3>Autre observation</h3>
        {perso.length ? <ul className="points">{perso.map((o) => carte(o.texte, true))}</ul> : null}
        <form className="ajout" onSubmit={(e) => { e.preventDefault(); const t = libre.trim(); if (t && !trouve(t)) { maj({ observations: [...s.observations, { texte: t, niveau: null }] }); setLibre(''); } }}>
          <Input value={libre} placeholder="Une observation qui n’est pas dans la liste" aria-label="Autre observation" onChange={(e) => setLibre(e.target.value)} />
          <Button type="submit">Ajouter</Button>
        </form>
      </div>
      <Field label="Remarque" optionnel>
        {(id) => <Textarea id={id} value={s.remarque} placeholder="Ce qui a été observé, en quelques mots" onChange={(e) => maj({ remarque: e.target.value })} />}
      </Field>
    </>
  );
}

/* ───────── 3. Compétence travaillée ───────── */
export function FormulaireCompetence({ s, maj }: PropsFormulaire) {
  const [texte, setTexte] = useState('');
  const ajouter = () => {
    const t = texte.trim();
    if (!t || s.competences.some((c) => c.texte === t)) return;
    maj({ competences: [...s.competences, { texte: t, niveau: null }] });
    setTexte('');
  };
  return (
    <>
      <form className="ajout" onSubmit={(e) => { e.preventDefault(); ajouter(); }}>
        <Field label="Compétence travaillée" className="ajout-champ">
          {(id) => <Input id={id} value={texte} placeholder="Ex. : résoudre un problème à une opération" onChange={(e) => setTexte(e.target.value)} />}
        </Field>
        <Button type="submit">Ajouter</Button>
      </form>
      {s.competences.length ? (
        <ul className="points">
          {s.competences.map((c) => (
            <Point key={c.texte} nom={c.texte} libelles={NIVEAUX_LIBELLES} teintes={TEINTES_NIVEAU} valeur={c.niveau}
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
        <h3>Aides utilisées</h3>
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

/* ───────── 5. Transfert ───────── */
export function FormulaireTransfert({ s, maj }: PropsFormulaire) {
  return (
    <>
      <div className="field">
        <span className="field-label">La stratégie a-t-elle été réutilisée ailleurs ?</span>
        <div className="chips" role="radiogroup" aria-label="Transfert">
          {(Object.keys(TRANSFERT_LIBELLES) as Transfert[]).map((k) => (
            <button key={k} type="button" role="radio" aria-checked={s.transfert === k} className="chip"
              onClick={() => maj({ transfert: s.transfert === k ? null : k })}>{TRANSFERT_LIBELLES[k]}</button>
          ))}
        </div>
      </div>
      <Field label="Précision" optionnel>
        {(id) => <Textarea id={id} value={s.precisionTransfert} onChange={(e) => maj({ precisionTransfert: e.target.value })} />}
      </Field>
    </>
  );
}

/* ───────── 6. Suite ───────── */
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
            {MODALITES_SUITE.map((m) => <option key={m}>{m}</option>)}
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
