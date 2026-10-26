import {
  EXEMPLES_RETOURS, EXEMPLE_AXE, EXEMPLE_CRITERES, EXEMPLE_OBJECTIF, EXEMPLE_RESSOURCES, ASPECTS, ajouterObjectifPeriode, ajouterPresent,
  changerPresent, modifierObjectifPeriode, modifierPv1, modifierRetour, reprendreRetenus, retenusAReprendre, retirerObjectifPeriode, retirerPresent
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

export function OngletPv1({ pia, changer }: PropsOnglet) {
  const { pv1 } = pia;
  const aReprendre = retenusAReprendre(pia).length;
  const axes = ASPECTS.map((a) => a.libelle);
  const axeChoisi = (a: string): boolean => pv1.axe.split('\n').includes(a);
  const basculerAxe = (a: string) => changer((p) => {
    const lignes = p.pv1.axe.split('\n').map((l) => l.trim()).filter(Boolean);
    return modifierPv1(p, 'axe', (lignes.includes(a) ? lignes.filter((l) => l !== a) : [...lignes, a]).join('\n'));
  });

  return (
    <div className="pia-pv1">
      <section className="liste-carte pia-section" aria-labelledby="pia-pv1-reunion">
        <h2 id="pia-pv1-reunion">La réunion</h2>
        <Field label="Date de la réunion" optionnel>
          {(id) => <Input id={id} type="date" value={pv1.date} onChange={(ev) => changer((p) => modifierPv1(p, 'date', ev.target.value))} />}
        </Field>
        <div className="field">
          <span className="field-label" id="pia-presents-titre">Personnes présentes</span>
          <p className="field-hint">Une ligne par personne : nom et fonction. Le modèle prévoit 9 lignes ; s’il en faut plus, le fichier en ajoute.</p>
          <ul className="pia-lignes" aria-labelledby="pia-presents-titre">
            {pv1.presents.map((x, i) => (
              <li key={i}>
                <Input value={x} aria-label={`Personne présente ${i + 1}`} placeholder="Nom, fonction" onChange={(ev) => changer((p) => changerPresent(p, i, ev.target.value))} />
                <Button variante="discret" aria-label={`Retirer la personne ${i + 1}`} onClick={() => changer((p) => retirerPresent(p, i))}>Retirer</Button>
              </li>
            ))}
          </ul>
          <div><Button onClick={() => changer((p) => ajouterPresent(p))}>Ajouter une personne</Button></div>
        </div>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv1-axe">
        <h2 id="pia-pv1-axe">Axe de travail</h2>
        <div className="chips" role="group" aria-label="Aspects du profil">
          {axes.map((a) => (
            <button key={a} type="button" className="chip" aria-pressed={axeChoisi(a)} onClick={() => basculerAxe(a)}>{a}</button>
          ))}
        </div>
        <Field label="Axe de travail principal" aide={EXEMPLE_AXE}>
          {(id) => <Textarea id={id} rows={3} value={pv1.axe} onChange={(ev) => changer((p) => modifierPv1(p, 'axe', ev.target.value))} />}
        </Field>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv1-objectifs">
        <h2 id="pia-pv1-objectifs">Objectifs de la période et critères d’évaluation</h2>
        <p className="field-hint">{EXEMPLE_OBJECTIF} {EXEMPLE_CRITERES}</p>
        {aReprendre ? (
          <div>
            <Button variante="primaire" onClick={() => changer((p) => reprendreRetenus(p))}>Reprendre les objectifs retenus ({aReprendre})</Button>
          </div>
        ) : null}
        {pv1.objectifs.length ? (
          <ol className="pia-objectifs">
            {pv1.objectifs.map((o, i) => (
              <li key={o.id} className="pia-objectif">
                <Field label={`Objectif ${i + 1}${o.matiere ? ` (${o.matiere})` : ''}`}>
                  {(id) => <Textarea id={id} rows={2} value={o.texte} onChange={(ev) => changer((p) => modifierObjectifPeriode(p, o.id, 'texte', ev.target.value))} />}
                </Field>
                <Field label={`Critères d’évaluation de l’objectif ${i + 1}`}>
                  {(id) => <Textarea id={id} rows={2} value={o.criteres} onChange={(ev) => changer((p) => modifierObjectifPeriode(p, o.id, 'criteres', ev.target.value))} />}
                </Field>
                <div><Button variante="discret" onClick={() => changer((p) => retirerObjectifPeriode(p, o.id))}>Retirer l’objectif {i + 1}</Button></div>
              </li>
            ))}
          </ol>
        ) : <p className="vide-texte">Aucun objectif pour l’instant.</p>}
        <div><Button onClick={() => changer((p) => ajouterObjectifPeriode(p))}>Ajouter un objectif</Button></div>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv1-ressources">
        <h2 id="pia-pv1-ressources">Ressources mises en place</h2>
        <Field label="Ressources" aide={EXEMPLE_RESSOURCES}>
          {(id) => <Textarea id={id} rows={4} value={pv1.ressources} onChange={(ev) => changer((p) => modifierPv1(p, 'ressources', ev.target.value))} />}
        </Field>
      </section>

      <section className="liste-carte pia-section" aria-labelledby="pia-pv1-retours">
        <h2 id="pia-pv1-retours">Retours</h2>
        <div className="pia-champs">
          {RETOURS.map((r) => (
            <Field key={r.cle} label={r.libelle} optionnel aide={EXEMPLES_RETOURS[r.cle]}>
              {(id) => <Textarea id={id} rows={3} value={pv1.retours[r.cle]} onChange={(ev) => changer((p) => modifierRetour(p, r.cle, ev.target.value))} />}
            </Field>
          ))}
        </div>
      </section>
    </div>
  );
}
