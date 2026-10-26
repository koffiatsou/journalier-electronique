import { useMemo } from 'react';
import {
  TYPES_AMENAGEMENT, ajouterAmenagement, basculerType, modifierAmenagement, proposerAmenagements, retirerAmenagement
} from '../../domain/pia/index.ts';
import { Button } from '../../ui/Button.tsx';
import { Input } from '../../ui/Field.tsx';
import type { PropsOnglet } from './contexte.ts';

export function OngletAmenagements({ pia, seances, changer }: PropsOnglet) {
  const propositions = useMemo(() => proposerAmenagements(seances, pia.amenagements), [seances, pia.amenagements]);

  return (
    <section className="liste-carte pia-section" aria-labelledby="pia-amen-titre">
      <h2 id="pia-amen-titre">Aménagements</h2>
      <p className="field-hint">Une ligne = un aménagement. Cochez son type : {TYPES_AMENAGEMENT.map((t) => `${t.id} = ${t.libelle.toLowerCase()}`).join(', ')}. Le modèle Word prévoit 10 lignes ; s’il en faut plus, le fichier en ajoute.</p>

      {propositions.length ? (
        <div className="pia-idees-groupe">
          <h3>D’après vos séances</h3>
          <ul className="pia-liste-idees">
            {propositions.map((pr) => (
              <li key={pr.id} className="pia-proposition">
                <span>
                  <span className="reunion-proposition">{pr.description}</span>
                  <small className="reunion-raison">{pr.raison}</small>
                </span>
                <Button onClick={() => changer((p) => ajouterAmenagement(p, { types: pr.types, description: pr.description, source: pr.id }))}>Ajouter<span className="sr-only"> : {pr.description}</span></Button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {pia.amenagements.length ? (
        <ol className="pia-amenagements">
          {pia.amenagements.map((a, i) => (
            <li key={a.id} className="pia-amenagement">
              <div className="chips" role="group" aria-label={`Type de l’aménagement ${i + 1}`}>
                {TYPES_AMENAGEMENT.map((t) => (
                  <button key={t.id} type="button" className="chip" aria-pressed={a.types.includes(t.id)} title={t.libelle} aria-label={t.libelle} onClick={() => changer((p) => basculerType(p, a.id, t.id))}>{t.id}</button>
                ))}
              </div>
              <Input value={a.description} aria-label={`Aménagement ${i + 1}`} placeholder="Par exemple : consignes reformulées à l’oral" onChange={(ev) => changer((p) => modifierAmenagement(p, a.id, ev.target.value))} />
              <Button variante="discret" aria-label={`Retirer l’aménagement ${i + 1}`} onClick={() => changer((p) => retirerAmenagement(p, a.id))}>Retirer</Button>
            </li>
          ))}
        </ol>
      ) : <p className="vide-texte">Aucun aménagement pour l’instant.</p>}
      <div><Button variante="primaire" onClick={() => changer((p) => ajouterAmenagement(p))}>Ajouter un aménagement</Button></div>
    </section>
  );
}
