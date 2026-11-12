import { useMemo, useState } from 'react';
import {
  ASPECTS, ASPECTS_RAPPROCHES, COLONNES, CONSIGNE_COLONNE, EXEMPLES, PHRASES, ajouterLigne, ajouterRetenuAuProfil, aspectPropose, contientLigne,
  ligneDeProfil, modifierCase, rapprochementsDe, rapprocher, retenusHorsProfil, retirerLigne
} from '../../domain/pia/index.ts';
import type { Aspect } from '../../domain/pia/index.ts';
import { Button } from '../../ui/Button.tsx';
import { Select, Textarea } from '../../ui/Field.tsx';
import type { PropsOnglet } from './contexte.ts';

export function OngletProfil({ pia, seances, changer }: PropsOnglet) {
  const rapprochements = useMemo(() => rapprocher(seances), [seances]);
  const aAjouter = retenusHorsProfil(pia);
  /** Aspect choisi pour chaque objectif retenu ; à défaut, celui qu'on propose d'après l'observation d'où il vient. */
  const [aspects, setAspects] = useState<Record<string, Aspect>>({});

  return (
    <section className="liste-carte pia-section" aria-labelledby="pia-profil-titre">
      <h2 id="pia-profil-titre">Profil de l’élève</h2>
      <p className="field-hint">
        Rien n’est rempli à votre place. Sous chaque case, « Idées » propose des phrases à cliquer ; vous gardez la main sur ce qui est écrit.
        Ressources : {CONSIGNE_COLONNE.ressources.toLowerCase()}
      </p>
      {aAjouter.length ? (
        <div className="pia-retenus" role="group" aria-labelledby="pia-retenus-titre">
          <h3 id="pia-retenus-titre">Objectifs retenus au Préparer</h3>
          <p className="field-hint">Choisissez l’aspect de chaque objectif, puis ajoutez-le aux « Objectifs à poursuivre ». Le procès-verbal 1 reprendra ce qui est écrit dans le profil.</p>
          <ul className="pia-liste-idees">
            {aAjouter.map((r) => {
              const aspect = aspects[r.id] ?? aspectPropose(r);
              return (
                <li key={r.id} className="pia-retenu">
                  <span className="reunion-proposition">{ligneDeProfil(r)}</span>
                  <Select aria-label={`Aspect de l’objectif : ${r.texte}`} value={aspect} onChange={(ev) => setAspects((x) => ({ ...x, [r.id]: ev.target.value as Aspect }))}>
                    {ASPECTS.map((a) => <option key={a.id} value={a.id}>{a.libelle}</option>)}
                  </Select>
                  <Button onClick={() => changer((p) => ajouterRetenuAuProfil(p, r, aspect))}>Ajouter au profil</Button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}
      {ASPECTS.map((a) => (
        <fieldset key={a.id} className="pia-aspect">
          <legend>{a.libelle}</legend>
          <div className="pia-colonnes">
            {COLONNES.map((c) => {
              const valeur = pia.profil[a.id][c.id];
              const lies = ASPECTS_RAPPROCHES.includes(a.id) ? rapprochementsDe(rapprochements, a.id, c.id) : [];
              const phrases = PHRASES[a.id][c.id];
              const idChamp = `pia-${a.id}-${c.id}`;
              return (
                <div key={c.id} className="pia-case field">
                  <label className="field-label" htmlFor={idChamp}>
                    {c.libelle}<span className="sr-only"> — {a.libelle}</span>
                  </label>
                  <Textarea
                    id={idChamp}
                    rows={4}
                    value={valeur}
                    aria-describedby={`${idChamp}-exemple`}
                    onChange={(ev) => changer((p) => modifierCase(p, a.id, c.id, ev.target.value))}
                  />
                  <p className="field-hint" id={`${idChamp}-exemple`}>{EXEMPLES[a.id][c.id]}</p>
                  {lies.length || phrases.length ? (
                    <details className="pia-idees">
                      <summary>Idées<span className="sr-only"> pour {c.libelle.toLowerCase()} — {a.libelle}</span></summary>
                      {lies.length ? (
                        <div className="pia-idees-groupe">
                          <h4>D’après vos séances</h4>
                          <ul className="pia-liste-idees">
                            {lies.map((r) => (
                              <li key={r.id}>
                                <label className="reunion-choix">
                                  <input
                                    type="checkbox"
                                    checked={contientLigne(valeur, r.texte)}
                                    onChange={(ev) => changer((p) => modifierCase(p, a.id, c.id, ev.target.checked ? ajouterLigne(p.profil[a.id][c.id], r.texte) : retirerLigne(p.profil[a.id][c.id], r.texte)))}
                                  />
                                  <span>
                                    <span className="reunion-proposition">{r.texte}</span>
                                    <small className="reunion-raison">{r.raison}</small>
                                  </span>
                                </label>
                              </li>
                            ))}
                          </ul>
                        </div>
                      ) : null}
                      <div className="pia-idees-groupe">
                        <h4>Phrases toutes faites</h4>
                        <div className="chips" role="group" aria-label={`Phrases pour ${c.libelle.toLowerCase()} — ${a.libelle}`}>
                          {phrases.map((ph) => {
                            const actif = contientLigne(valeur, ph);
                            return (
                              <button
                                key={ph}
                                type="button"
                                className="chip"
                                aria-pressed={actif}
                                onClick={() => changer((p) => modifierCase(p, a.id, c.id, actif ? retirerLigne(p.profil[a.id][c.id], ph) : ajouterLigne(p.profil[a.id][c.id], ph)))}
                              >{ph}</button>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  ) : null}
                </div>
              );
            })}
          </div>
        </fieldset>
      ))}
    </section>
  );
}
