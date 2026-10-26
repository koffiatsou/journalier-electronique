import { useId, useRef } from 'react';
import type { ReactNode } from 'react';
import {
  ACCESSOIRES_LIBELLES, CHEVEUX, CHEVEUX_LIBELLES, COIFFURES_LIBELLES, STYLES_AVATAR, STYLES_LIBELLES, TEINTS, TEINTS_LIBELLES,
  VISAGES_LIBELLES, avatarAuHasard, descriptionAvatar
} from '../../domain/avatar/index.ts';
import type { AvatarEleve } from '../../domain/avatar/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { AvatarDessin } from '../../ui/AvatarDessin.tsx';
import { Button } from '../../ui/Button.tsx';

interface Props {
  eleve: Pick<Eleve, 'nom' | 'prenom'>;
  valeur: AvatarEleve | undefined;
  /** Couleur de l'élève dans l'agenda (0–9) : le vêtement et le fond des dessins la reprennent. */
  couleur: number;
  onChange: (avatar: AvatarEleve | undefined) => void;
}

type Cle = Exclude<keyof AvatarEleve, 'style'>;

function Groupe({ titre, children }: { titre: string; children: ReactNode }) {
  const id = useId();
  return (
    <div className="choix-groupe">
      <span className="choix-titre" id={id}>{titre}</span>
      <div className="choix-options" role="radiogroup" aria-labelledby={id}>{children}</div>
    </div>
  );
}

/** Choix du type d'avatar (dessin ou initiales) puis de chaque détail, avec aperçu immédiat. */
export function ChoixAvatar({ eleve, valeur, couleur, onChange }: Props) {
  // Repasser aux initiales puis revenir au dessin ne fait pas perdre le dernier dessin.
  const memoire = useRef<AvatarEleve | undefined>(valeur);
  if (valeur) memoire.current = valeur;

  const changer = (patch: Partial<AvatarEleve>): void => { if (valeur) onChange({ ...valeur, ...patch }); };

  /** Une vignette par valeur possible : on voit le résultat avant de choisir. */
  const vignettes = (cle: Cle, libelles: readonly string[]): ReactNode => valeur
    ? libelles.map((libelle, i) => (
      <button key={libelle} type="button" role="radio" aria-checked={valeur[cle] === i} aria-label={libelle} title={libelle} className={`choix-bouton c-${couleur}`} onClick={() => changer({ [cle]: i })}>
        <AvatarDessin avatar={{ ...valeur, [cle]: i }} />
      </button>
    ))
    : null;

  const pastilles = (cle: Cle, couleurs: readonly string[], libelles: readonly string[]): ReactNode => valeur
    ? couleurs.map((c, i) => (
      <button key={c} type="button" role="radio" aria-checked={valeur[cle] === i} aria-label={libelles[i]} title={libelles[i]} className="choix-pastille" onClick={() => changer({ [cle]: i })}>
        <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false"><circle cx="12" cy="12" r="10" fill={c} /></svg>
      </button>
    ))
    : null;

  return (
    <div className="field choix-avatar">
      <span className="field-label" id="avatar-type">Avatar</span>
      <p className="field-hint">Pas de photo : un petit dessin au choix, ou les initiales.</p>

      <div className="choix-avatar-tete">
        <Avatar eleve={{ ...eleve, ...(valeur ? { avatar: valeur } : {}) }} couleur={couleur} taille="l" />
        <div className="chips" role="radiogroup" aria-labelledby="avatar-type">
          <button type="button" role="radio" aria-checked={!valeur} className="chip" onClick={() => onChange(undefined)}>Initiales</button>
          <button type="button" role="radio" aria-checked={Boolean(valeur)} className="chip" onClick={() => { if (!valeur) onChange(memoire.current ?? avatarAuHasard()); }}>Avatar dessiné</button>
        </div>
      </div>
      {valeur ? <p className="lecteur-seul" aria-live="polite">{descriptionAvatar(valeur)}</p> : null}

      {valeur ? (
        <div className="choix-detail">
          <Groupe titre="Style">
            {STYLES_AVATAR.map((s) => (
              <button key={s} type="button" role="radio" aria-checked={valeur.style === s} className="chip" onClick={() => changer({ style: s })}>{STYLES_LIBELLES[s]}</button>
            ))}
          </Groupe>
          <Groupe titre="Teint">{pastilles('teint', TEINTS, TEINTS_LIBELLES)}</Groupe>
          <Groupe titre="Coiffure">{vignettes('coiffure', COIFFURES_LIBELLES)}</Groupe>
          <Groupe titre="Couleur des cheveux">{pastilles('cheveux', CHEVEUX, CHEVEUX_LIBELLES)}</Groupe>
          <Groupe titre="Visage">{vignettes('visage', VISAGES_LIBELLES)}</Groupe>
          <Groupe titre="Accessoire">{vignettes('accessoire', ACCESSOIRES_LIBELLES)}</Groupe>
          <div>
            <Button onClick={() => onChange(avatarAuHasard(Math.random, valeur.style))}>Au hasard</Button>
          </div>
          <p className="field-hint">Le vêtement et le fond reprennent la couleur choisie plus bas (« Couleur dans l’agenda »).</p>
        </div>
      ) : null}
    </div>
  );
}
