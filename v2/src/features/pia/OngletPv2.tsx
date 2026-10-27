import { useMemo } from 'react';
import {
  RESULTATS, TYPES_AMENAGEMENT, ajouterAmenagementPv2, ajouterPresentPv2, basculerTypePv2, changerPresentPv2, choisirResultat, commenterObjectif,
  EXEMPLES_RETOURS, evaluationDe, modifierAmenagementPv2, modifierDatePv2, modifierRetourPv2, objectifsAEvaluer, rappelDepuisPv1,
  reprendreAmenagementsPourRentree, reprendrePresentsPv1, retirerAmenagementPv2, retirerPresentPv2
} from '../../domain/pia/index.ts';
import type { CleRetour } from '../../domain/pia/index.ts';
import { Button } from '../../ui/Button.tsx';
import { Field, Input, Textarea } from '../../ui/Field.tsx';
import type { PropsOnglet } from './contexte.ts';

const RETOURS: { cle: CleRetour; libelle: string }[] = [
  { cle: 'parents', libelle: 'Retour des parents' },
  { cle: 'direction', libelle: 'Retour de la direction / de l’équipe' },
  { cle: 'eleve', libelle: 'Retour de l’élève' },
  { cle: 'pms', libelle: 'Retour du CPMS' },
  { cle: 'agent', libelle: 'Retour de l’agent du Pôle' },
  { cle: 'autres', libelle: 'Autres retours' }
];

const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

export function OngletPv2({ pia, seances, changer }: PropsOnglet) {
  const { pv1, pv2 } = pia;
  const objectifs = objectifsAEvaluer(pia);
  const rappels = useMemo(
    () => new Map(objectifs.map((o) => [o.id, rappelDepuisPv1(seances, pv1.date, o.matiere)])),
    [objectifs, seances, pv1.date]
  );
  const presentsAReprendre = pv1.presents.some((x) => x.trim());

  return (
    <div className="pia-pv1">
      <section className="liste-carte pia-section" aria-labelledby="pia-pv2-reunion">
        <h2 id="pia-pv2-reunion">La réunion de fin d’année</h2>
        <Field label="Date de la réunion" optionnel>
          {(id) => <Input id={id} type="date" value={pv2.date} onChange={(ev) => changer((p) => modifierDatePv2(p, ev.target.value))} />}
        </Field>
        <div className="field">
          <span className="field-label" id="pia-presents2-titre">Personnes présentes</span>
          <p className="field-hint">Une ligne par personne : nom et fonction.</p>
          <ul className="pia-lignes" aria-labelledby="pia-presents2-titre">
            {pv2.presents.map((x, i) => (
              <li key={i}>
                <Input value={x} aria-label={`Personne présente au PV 2, ${i + 1}`} placeholder="Nom, fonction" onChange={(ev) => changer((p) => changerPresentPv2(p, i, ev.target.value))} />
                <Button variante="discret" aria-label={`Retirer la personne ${i + 1} du PV 2`} onClick={() => changer((p) => retirerPresentPv2(p, i))}>Retirer</Button>
              </li>
            ))}
          </ul>
          <div className="pia-actions">
            <Button onClick={() => changer((p) => ajouterPresentPv2(p))}>Ajouter une personne</Button>
            {presentsAReprendre ? <Button onClick={() => changer((p) => reprendrePresentsPv1(p))}>Reprendre les présents du PV 1</Button> : null}
          </div>
        </div>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv2-objectifs">
        <h2 id="pia-pv2-objectifs">Évaluation des objectifs du procès-verbal 1</h2>
        <p className="field-hint">
          Pour chaque objectif, choisissez ce qui a été constaté. Rien n’est choisi à votre place : le rappel des séances n’est là que pour vous aider.
        </p>
        {!objectifs.length ? <p className="vide-texte">Aucun objectif au procès-verbal 1 : il n’y a rien à évaluer. Ajoutez d’abord les objectifs dans l’onglet « Procès-verbal 1 ».</p> : (
          <ol className="pia-objectifs">
            {objectifs.map((o, i) => {
              const ev = evaluationDe(pia, o.id);
              const r = rappels.get(o.id);
              return (
                <li key={o.id} className="pia-objectif">
                  <p className="pia-objectif-texte"><strong>Objectif {i + 1}{o.matiere ? ` (${o.matiere})` : ''}</strong> — {o.texte}</p>
                  {o.criteres.trim() ? <p className="field-hint">Critères d’évaluation : {o.criteres}</p> : null}
                  {r ? (
                    <details className="pia-idees">
                      <summary>Rappel des séances depuis le PV 1<span className="sr-only"> — objectif {i + 1}</span></summary>
                      <div className="pia-idees-groupe">
                        <p className="field-hint">
                          {r.sansDate ? 'La date du PV 1 manque : toutes les séances de l’année sont prises en compte. ' : ''}
                          {r.seances ? `${pluriel(r.seances, 'séance')} d’accompagnement${o.matiere ? ` en ${o.matiere}` : ''} depuis le PV 1.` : 'Aucune séance d’accompagnement depuis le PV 1.'}
                        </p>
                        {r.appuis.length ? <><h4>Points d’appui</h4><ul>{r.appuis.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
                        {r.aTravailler.length ? <><h4>À travailler</h4><ul>{r.aTravailler.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
                        {r.competences.length ? <><h4>Compétence travaillée</h4><ul>{r.competences.map((x) => <li key={x}>{x}</li>)}</ul></> : null}
                      </div>
                    </details>
                  ) : null}
                  <div className="chips" role="group" aria-label={`Résultat de l’objectif ${i + 1}`}>
                    {RESULTATS.map((x) => (
                      <button key={x.id} type="button" className="chip" aria-pressed={ev.resultat === x.id} onClick={() => changer((p) => choisirResultat(p, o.id, x.id))}>{x.libelle}</button>
                    ))}
                  </div>
                  <Field label={`Commentaire sur l’objectif ${i + 1}`} optionnel>
                    {(id) => <Textarea id={id} rows={2} value={ev.commentaire} onChange={(ev2) => changer((p) => commenterObjectif(p, o.id, ev2.target.value))} />}
                  </Field>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv2-retours">
        <h2 id="pia-pv2-retours">Retours</h2>
        <div className="pia-champs">
          {RETOURS.map((r) => (
            <Field key={r.cle} label={`${r.libelle} (PV 2)`} optionnel aide={EXEMPLES_RETOURS[r.cle]}>
              {(id) => <Textarea id={id} rows={3} value={pv2.retours[r.cle]} onChange={(ev) => changer((p) => modifierRetourPv2(p, r.cle, ev.target.value))} />}
            </Field>
          ))}
        </div>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv2-amen">
        <h2 id="pia-pv2-amen">Aménagements pour la rentrée suivante</h2>
        <p className="field-hint">Une ligne = un aménagement ({TYPES_AMENAGEMENT.map((t) => `${t.id} = ${t.libelle.toLowerCase()}`).join(', ')}). Le modèle Word prévoit 10 lignes ; s’il en faut plus, le fichier en ajoute.</p>
        {!pv2.amenagementsRepris && pia.amenagements.some((a) => a.description.trim()) ? (
          <div><Button variante="primaire" onClick={() => changer((p) => reprendreAmenagementsPourRentree(p))}>Reprendre les aménagements de l’année</Button></div>
        ) : null}
        {pv2.amenagements.length ? (
          <ol className="pia-amenagements">
            {pv2.amenagements.map((a, i) => (
              <li key={a.id} className="pia-amenagement">
                <div className="chips" role="group" aria-label={`Type de l’aménagement de rentrée ${i + 1}`}>
                  {TYPES_AMENAGEMENT.map((t) => (
                    <button key={t.id} type="button" className="chip" aria-pressed={a.types.includes(t.id)} title={t.libelle} aria-label={t.libelle} onClick={() => changer((p) => basculerTypePv2(p, a.id, t.id))}>{t.id}</button>
                  ))}
                </div>
                <Input value={a.description} aria-label={`Aménagement de rentrée ${i + 1}`} placeholder="Par exemple : consignes reformulées à l’oral" onChange={(ev) => changer((p) => modifierAmenagementPv2(p, a.id, ev.target.value))} />
                <Button variante="discret" aria-label={`Retirer l’aménagement de rentrée ${i + 1}`} onClick={() => changer((p) => retirerAmenagementPv2(p, a.id))}>Retirer</Button>
              </li>
            ))}
          </ol>
        ) : <p className="vide-texte">Aucun aménagement pour la rentrée pour l’instant.</p>}
        <div><Button onClick={() => changer((p) => ajouterAmenagementPv2(p))}>Ajouter un aménagement</Button></div>
      </section>
    </div>
  );
}
