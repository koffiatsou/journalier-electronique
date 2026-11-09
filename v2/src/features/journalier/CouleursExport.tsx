import { useState } from 'react';
import { COULEURS_WORD, cleMatiere, couleurDeMatiere } from '../../domain/export/couleurs.ts';
import type { ReglageCouleurs } from '../../domain/export/couleurs.ts';
import { Button } from '../../ui/Button.tsx';
import { Dialog, REPERE_FOCUS_INITIAL } from '../../ui/Dialog.tsx';
import { Select } from '../../ui/Field.tsx';

interface Props {
  /** Matières des séances qui seront exportées. */
  matieres: readonly string[];
  reglage: ReglageCouleurs;
  onChange: (reglage: ReglageCouleurs) => void;
}

/** Pastille de couleur : un petit carré SVG (la CSP interdit les styles en ligne ; la couleur est un attribut). */
const Echantillon = ({ fond }: { fond: string }) => (
  <svg className="echantillon" width="22" height="22" viewBox="0 0 22 22" aria-hidden="true"><rect width="22" height="22" rx="4" fill={`#${fond}`} /></svg>
);

/**
 * « Colorer les en-têtes par matière » : une case, et un tableau pour ceux qui ont déjà leurs codes couleurs.
 * Par défaut chaque matière a une couleur automatique, toujours la même.
 */
export function CouleursExport({ matieres, reglage, onChange }: Props) {
  const [ouvert, setOuvert] = useState(false);
  const choisir = (matiere: string, valeur: string) => {
    const choix = { ...reglage.choix };
    if (valeur === '') delete choix[cleMatiere(matiere)]; else choix[cleMatiere(matiere)] = Number(valeur);
    onChange({ ...reglage, choix });
  };
  return (
    <>
      <label className="case-anonyme">
        <input type="checkbox" checked={reglage.actif} onChange={(e) => onChange({ ...reglage, actif: e.target.checked })} /> Colorer les en-têtes par matière
      </label>
      {reglage.actif ? <Button variante="discret" aria-haspopup="dialog" onClick={() => setOuvert(true)}>Choisir les couleurs</Button> : null}
      <Dialog ouvert={ouvert} titre="Couleurs des matières" onFermer={() => setOuvert(false)}>
        <p className="field-hint">Chaque matière a une couleur automatique. Choisissez-en une autre pour garder votre propre code couleurs.</p>
        {matieres.length ? (
          <ul className="couleurs-matieres">
            {matieres.map((m) => {
              const auto = couleurDeMatiere(m, {});
              const courante = couleurDeMatiere(m, reglage.choix);
              const valeur = reglage.choix[cleMatiere(m)];
              return (
                <li key={m}>
                  <Echantillon fond={courante.fond} />
                  <span className="couleurs-nom">{m}</span>
                  <Select aria-label={`Couleur de ${m}`} value={valeur === undefined ? '' : String(valeur)} onChange={(e) => choisir(m, e.target.value)}>
                    <option value="">Automatique ({auto.nom})</option>
                    {COULEURS_WORD.map((c, i) => <option key={c.fond} value={i}>{c.nom}</option>)}
                  </Select>
                </li>
              );
            })}
          </ul>
        ) : <p>Aucune matière dans la période choisie.</p>}
        <div className="actions">
          <Button variante="primaire" {...{ [REPERE_FOCUS_INITIAL]: '' }} onClick={() => setOuvert(false)}>Fermer</Button>
        </div>
      </Dialog>
    </>
  );
}
