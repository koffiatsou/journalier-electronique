import { createPortal } from 'react-dom';
import { lignesEvaluation, lignesObjectifs } from '../../domain/export/pia.ts';
import type { PartiePia } from '../../domain/export/index.ts';
import { dateBelge } from '../../domain/export/journalier.ts';
import { ASPECTS, COLONNES, TYPES_AMENAGEMENT } from '../../domain/pia/index.ts';
import type { Amenagement, Pia, Retours } from '../../domain/pia/index.ts';
import type { Eleve } from '../../domain/types.ts';

/*
 * Version imprimable du PIA : le navigateur l'imprime ou l'enregistre en PDF (voir `pia.css`, règles « print »).
 * Ce n'est PAS la mise en page du modèle officiel : pour celle-ci, on exporte en Word.
 */

const LIBELLES_RETOURS: ReadonlyArray<[keyof Retours, string]> = [
  ['parents', 'Retours des parents'], ['direction', 'Retours de la direction et de l’équipe pédagogique'], ['eleve', 'Retours de l’élève'],
  ['pms', 'Retours du centre PMS'], ['agent', 'Retours de l’agent d’intégration'], ['autres', 'Retours des autres intervenants']
];

const Texte = ({ t }: { t: string }) => <>{t.split('\n').map((l, i) => <p key={i}>{l}</p>)}</>;

function Presents({ liste }: { liste: readonly string[] }) {
  const l = liste.filter((x) => x.trim());
  return l.length ? <><h4>Personnes présentes</h4><ul>{l.map((x, i) => <li key={i}>{x}</li>)}</ul></> : null;
}

function Retour({ retours }: { retours: Retours }) {
  return (
    <>
      {LIBELLES_RETOURS.filter(([cle]) => retours[cle].trim()).map(([cle, libelle]) => (
        <div key={cle}><h4>{libelle}</h4><Texte t={retours[cle]} /></div>
      ))}
    </>
  );
}

function Amenagements({ liste }: { liste: readonly Amenagement[] }) {
  const l = liste.filter((a) => a.description.trim() || a.types.length);
  if (!l.length) return <p>Aucun aménagement noté.</p>;
  return (
    <table>
      <thead><tr><th>N°</th>{TYPES_AMENAGEMENT.map((t) => <th key={t.id} title={t.libelle}>{t.id}</th>)}<th>Description / modalité</th></tr></thead>
      <tbody>{l.map((a, i) => (
        <tr key={a.id}><td>{i + 1}</td>{TYPES_AMENAGEMENT.map((t) => <td key={t.id}>{a.types.includes(t.id) ? 'X' : ''}</td>)}<td>{a.description}</td></tr>
      ))}</tbody>
    </table>
  );
}

interface Props { pia: Pia; eleve: Eleve; parties: ReadonlySet<PartiePia>; deidentifie: boolean }

/** Rendu dans `document.body` : à l'impression, tout le reste de la page est masqué. */
export function ImpressionPia({ pia, eleve, parties, deidentifie }: Props) {
  const nom = deidentifie ? 'Élève' : `${eleve.nom} ${eleve.prenom}`.trim();
  const evaluation = lignesEvaluation(pia);
  const objectifs = lignesObjectifs(pia);
  return createPortal(
    <div className="pia-impression">
      <h1>Plan Individuel d’Apprentissage — {pia.annee}</h1>
      <dl>
        <dt>Élève</dt><dd>{nom}</dd>
        {deidentifie ? null : <><dt>Date de naissance</dt><dd>{eleve.dateNaissance ? dateBelge(eleve.dateNaissance) : ''}</dd></>}
        <dt>Classe et option</dt><dd>{[eleve.classe, pia.identite.option].filter(Boolean).join(' — ')}</dd>
        {deidentifie ? null : <>
          <dt>École</dt><dd>{eleve.ecole}</dd><dt>Titulaire</dt><dd>{eleve.titulaire}</dd>
          <dt>CPMS coopérant</dt><dd>{pia.identite.cpms}</dd><dt>Représentant du Pôle Territorial</dt><dd>{pia.identite.representantPole}</dd>
          <dt>Responsable de l’élève</dt><dd>{pia.identite.responsable}</dd>
        </>}
      </dl>

      {parties.has('profil') ? (
        <section>
          <h2>Profil de l’élève</h2>
          <table>
            <thead><tr><th>Aspect</th>{COLONNES.map((c) => <th key={c.id}>{c.libelle}</th>)}</tr></thead>
            <tbody>{ASPECTS.map((a) => (
              <tr key={a.id}><th scope="row">{a.libelle}</th>{COLONNES.map((c) => <td key={c.id}><Texte t={pia.profil[a.id][c.id]} /></td>)}</tr>
            ))}</tbody>
          </table>
        </section>
      ) : null}

      {parties.has('pv1') ? (
        <section>
          <h2>Procès-verbal 1</h2>
          {pia.pv1.date ? <p>Date : {dateBelge(pia.pv1.date)}</p> : null}
          <Presents liste={pia.pv1.presents} />
          {pia.pv1.axe.trim() ? <><h4>Difficulté majeure : axe de travail</h4><Texte t={pia.pv1.axe} /></> : null}
          {objectifs.length ? <><h4>Objectifs visés pour la période et critères d’évaluation</h4>{objectifs.map((l, i) => <p key={i}>{l}</p>)}</> : null}
          {pia.pv1.ressources.trim() ? <><h4>Ressources et moyens complémentaires</h4><Texte t={pia.pv1.ressources} /></> : null}
          <Retour retours={pia.pv1.retours} />
          <h3>Aménagements proposés pour l’élève</h3>
          <Amenagements liste={pia.amenagements} />
          <p className="pia-legende">P = pédagogique · O = organisationnel · M = matériel</p>
        </section>
      ) : null}

      {parties.has('pv2') ? (
        <section>
          <h2>Procès-verbal 2 (fin d’année)</h2>
          {pia.pv2.date ? <p>Date : {dateBelge(pia.pv2.date)}</p> : null}
          <Presents liste={pia.pv2.presents} />
          {evaluation.length ? <><h4>Objectifs visés pour la période : évaluation</h4>{evaluation.map((l, i) => <p key={i}>{l}</p>)}</> : null}
          <Retour retours={pia.pv2.retours} />
          <h3>Mise à jour des aménagements pour la rentrée scolaire suivante</h3>
          <Amenagements liste={pia.pv2.amenagements} />
          <p className="pia-legende">P = pédagogique · O = organisationnel · M = matériel</p>
        </section>
      ) : null}
    </div>,
    document.body
  );
}
