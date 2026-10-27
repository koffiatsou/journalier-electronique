import { useState } from 'react';
import { NB_COULEURS, NOMS_COULEURS, ecoleParDefaut, rattachement } from '../../domain/agenda/index.ts';
import type { Ecole } from '../../domain/agenda/index.ts';
import { LANGUES_MODERNES, languesDe } from '../../domain/eleves/index.ts';
import { analyserClasse } from '../../domain/referentiel/index.ts';
import { sansAccents } from '../../domain/referentiel/texte.ts';
import { FILIERES_LIBELLES } from '../../domain/types.ts';
import type { Eleve, Filiere } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Chips } from '../../ui/Chip.tsx';
import { Field, Input, Select } from '../../ui/Field.tsx';
import { ChoixAvatar } from './ChoixAvatar.tsx';

/** Matières proposées d'un toucher ; toute autre matière s'ajoute avec le champ « Autre matière ». Les langues ont leur propre rubrique. */
const MATIERES = ['Mathématiques', 'Français', 'Sciences', 'Sciences économiques', 'Histoire', 'Géographie'];

/** Ce que l'application déduit de la classe saisie (3CB, 4TQ…), montré pour que l'agent vérifie. */
function deduction(classe: string): string {
  const c = analyserClasse(classe);
  if (!c) return classe.trim() ? 'Classe non reconnue : choisissez le niveau d’étude ci-dessous.' : '';
  return `Lu : ${c.annee}${c.filiere ? ` — ${FILIERES_LIBELLES[c.filiere]}` : ''}`;
}

const memeMatiere = (a: string, b: string): boolean => sansAccents(a).trim() === sansAccents(b).trim();

interface Props {
  eleve: Eleve;
  /** Couleur de l'élève dans l'agenda quand elle n'est pas encore choisie (déduite de son identifiant). */
  couleurParDefaut: number;
  /** Écoles de l'agenda : s'il y en a plusieurs, l'école de l'élève se choisit dans la liste. */
  ecoles: readonly Ecole[];
  onEnregistrer: (e: Eleve) => void;
  onAnnuler: () => void;
}

export function FicheEleve({ eleve, couleurParDefaut, ecoles, onEnregistrer, onAnnuler }: Props) {
  const [e, setE] = useState(eleve);
  const [autre, setAutre] = useState('');
  const maj = (p: Partial<Eleve>) => setE((x) => ({ ...x, ...p }));
  const valide = e.nom.trim() !== '' && e.prenom.trim() !== '';
  const soumettre = (ev: { preventDefault(): void }) => { ev.preventDefault(); if (valide) onEnregistrer({ ...e, nom: e.nom.trim(), prenom: e.prenom.trim() }); };
  const filiereDeduite = analyserClasse(e.classe)?.filiere;
  const ecoleAttachee = rattachement(e, ecoles);

  /** Une matière déjà connue (accents ou majuscules près) est simplement cochée au lieu d'être recréée. */
  const ajouterMatiere = () => {
    const nom = autre.trim();
    if (!nom) return;
    const connue = [...MATIERES, ...e.matieres].find((m) => memeMatiere(m, nom));
    const choisie = connue ?? nom;
    if (!e.matieres.includes(choisie)) maj({ matieres: [...e.matieres, choisie] });
    setAutre('');
  };

  const langues = languesDe(e);
  const majLangues = (liste: string[]) => {
    const { langue: _ancienne, langues: _l, ...reste } = e;
    setE(liste.length ? { ...reste, langues: liste } : reste);
  };

  return (
    <form className="fiche-eleve" onSubmit={soumettre}>
      <div className="champs champs-2">
        <Field label="Nom">{(id) => <Input id={id} value={e.nom} onChange={(ev) => maj({ nom: ev.target.value })} autoFocus />}</Field>
        <Field label="Prénom">{(id) => <Input id={id} value={e.prenom} onChange={(ev) => maj({ prenom: ev.target.value })} />}</Field>
      </div>
      <div className="champs champs-2">
        <Field label="Classe" aide={deduction(e.classe) || 'Ex. : 3CB, 1DB, 4TQ, 5P'}>
          {(id) => <Input id={id} value={e.classe} placeholder="3CB" onChange={(ev) => maj({ classe: ev.target.value })} />}
        </Field>
        <Field label="Niveau d’étude" optionnel aide={filiereDeduite && !e.filiere ? 'Déduit de la classe.' : undefined}>
          {(id) => (
            <Select id={id} value={e.filiere ?? ''} onChange={(ev) => { const { filiere: _f, ...reste } = e; setE(ev.target.value ? { ...reste, filiere: ev.target.value as Filiere } : reste); }}>
              <option value="">{filiereDeduite ? `Selon la classe (${FILIERES_LIBELLES[filiereDeduite]})` : 'Non précisé'}</option>
              {Object.entries(FILIERES_LIBELLES).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
            </Select>
          )}
        </Field>
      </div>
      <div className="champs champs-2">
        {ecoles.length > 1 ? (
          <Field label="École" aide={ecoleAttachee ? 'Ses séances et rendez-vous prennent les horaires de cette école.' : e.ecole.trim() ? `Dans le dossier : « ${e.ecole.trim()} », qui ne correspond à aucune école de l’agenda : l’école par défaut (${ecoleParDefaut(ecoles).nom}) s’applique.` : `Sans choix, l’école par défaut (${ecoleParDefaut(ecoles).nom}) s’applique.`}>
            {(id) => (
              <Select id={id} value={ecoleAttachee?.id ?? ''} onChange={(ev) => {
                const choisie = ecoles.find((x) => x.id === ev.target.value);
                const { ecoleId: _i, ...reste } = e;
                setE(choisie ? { ...reste, ecoleId: choisie.id, ecole: choisie.nom } : { ...reste, ecole: ecoleAttachee ? '' : e.ecole });
              }}>
                <option value="">Pas précisée (école par défaut)</option>
                {ecoles.map((x) => <option key={x.id} value={x.id}>{x.nom}</option>)}
              </Select>
            )}
          </Field>
        ) : (
          <Field label="École" optionnel>{(id) => <Input id={id} value={e.ecole} onChange={(ev) => maj({ ecole: ev.target.value })} />}</Field>
        )}
        <Field label="Titulaire" optionnel>{(id) => <Input id={id} value={e.titulaire} onChange={(ev) => maj({ titulaire: ev.target.value })} />}</Field>
      </div>

      <div className="field">
        <span className="field-label">Matières suivies</span>
        <Chips options={[...MATIERES, ...e.matieres.filter((m) => !MATIERES.includes(m))]} valeurs={e.matieres} onChange={(matieres) => maj({ matieres })} />
        <div className="ajout-libre">
          <Input value={autre} placeholder="Une autre matière (ex. : Éducation physique)" aria-label="Autre matière"
            onChange={(ev) => setAutre(ev.target.value)}
            onKeyDown={(ev) => { if (ev.key === 'Enter') { ev.preventDefault(); ajouterMatiere(); } }} />
          <Button disabled={!autre.trim()} onClick={ajouterMatiere}>Ajouter la matière</Button>
        </div>
      </div>

      <div className="field">
        <span className="field-label" id="langues-titre">Langues modernes <span className="opt">facultatif</span></span>
        <div role="group" aria-labelledby="langues-titre">
          <Chips options={LANGUES_MODERNES} valeurs={langues} onChange={majLangues} />
        </div>
        <p className="field-hint">Plusieurs langues possibles. Elles servent aux pistes de compétences et sont proposées comme matières dans la séance.</p>
      </div>

      <div className="field">
        <span className="field-label">Couleur dans l’agenda</span>
        <div className="pastilles-couleur" role="group" aria-label="Couleur dans l’agenda">
          {Array.from({ length: NB_COULEURS }, (_, i) => (
            <button key={i} type="button" className={`c-${i}`} aria-pressed={e.couleur === i} aria-label={NOMS_COULEURS[i]} onClick={() => maj({ couleur: i })} />
          ))}
        </div>
      </div>

      <ChoixAvatar
        eleve={e}
        valeur={e.avatar}
        couleur={e.couleur ?? couleurParDefaut}
        onChange={(avatar) => { const { avatar: _a, ...reste } = e; setE(avatar ? { ...reste, avatar } : reste); }}
      />

      <div className="fiche-actions">
        <Button type="submit" variante="primaire" disabled={!valide}>Enregistrer</Button>
        <Button type="button" onClick={onAnnuler}>Annuler</Button>
      </div>
    </form>
  );
}
