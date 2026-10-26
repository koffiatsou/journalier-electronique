import { modifierIdentite } from '../../domain/pia/index.ts';
import type { IdentitePia } from '../../domain/pia/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { Field, Input } from '../../ui/Field.tsx';
import type { PropsOnglet } from './contexte.ts';
import { nomEleve } from './contexte.ts';

const CHAMPS: { cle: keyof IdentitePia; libelle: string; aide: string }[] = [
  { cle: 'option', libelle: 'Option', aide: 'Elle s’ajoute à la classe dans le document (par exemple : 3CB, Sciences).' },
  { cle: 'cpms', libelle: 'Coordonnées du CPMS coopérant', aide: 'Nom du centre, téléphone ou adresse électronique.' },
  { cle: 'representantPole', libelle: 'Représentant du Pôle Territorial', aide: 'Laissez vide pour reprendre le nom du Pôle indiqué dans le modèle.' },
  { cle: 'responsable', libelle: 'Coordonnées du responsable de l’élève', aide: 'Parent ou tuteur : nom et moyen de le joindre.' }
];

export function OngletIdentite({ eleve, pia, changer }: PropsOnglet) {
  return (
    <section className="liste-carte pia-section" aria-labelledby="pia-identite-titre">
      <h2 id="pia-identite-titre">Identité</h2>
      <p className="field-hint">Ces informations viennent du dossier de l’élève ; pour les changer, passez par l’écran Élèves.</p>
      <dl className="dossier-infos">
        <dt>Élève</dt><dd>{nomEleve(eleve)}</dd>
        <dt>Date de naissance</dt><dd>{eleve.dateNaissance ? dateFR(eleve.dateNaissance) : 'Non renseignée'}</dd>
        <dt>Classe</dt><dd>{eleve.classe || 'Non renseignée'}</dd>
        <dt>École</dt><dd>{eleve.ecole || 'Non renseignée'}</dd>
        <dt>Titulaire</dt><dd>{eleve.titulaire || 'Non renseigné'}</dd>
        <dt>Année scolaire</dt><dd>{pia.annee}</dd>
      </dl>
      <div className="pia-champs">
        {CHAMPS.map((c) => (
          <Field key={c.cle} label={c.libelle} optionnel aide={c.aide}>
            {(id) => <Input id={id} value={pia.identite[c.cle]} onChange={(ev) => changer((p) => modifierIdentite(p, c.cle, ev.target.value))} />}
          </Field>
        ))}
      </div>
    </section>
  );
}
