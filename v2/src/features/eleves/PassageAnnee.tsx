import { useMemo, useState } from 'react';
import { anneeSuivante, appliquerPassage, elevesActifs, planPassage } from '../../domain/eleves/index.ts';
import type { ActionPassage, LignePassage } from '../../domain/eleves/index.ts';
import { anneeScolaire } from '../../domain/export/journalier.ts';
import type { Eleve } from '../../domain/types.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { Button } from '../../ui/Button.tsx';
import { Field, Input, Select } from '../../ui/Field.tsx';

const ACTIONS: { valeur: ActionPassage; libelle: string }[] = [
  { valeur: 'passer', libelle: 'Passe en classe suivante' },
  { valeur: 'laisser', libelle: 'Ne pas changer' },
  { valeur: 'archiver', libelle: 'Archiver (ne l’accompagne plus)' }
];

interface Props {
  eleves: readonly Eleve[];
  couleurs: ReadonlyMap<string, number>;
  aujourdhui: string;
  onAppliquer: (modifies: Eleve[], cible: string) => void;
  onAnnuler: () => void;
}

/** Passage à la nouvelle année scolaire : une proposition à relire ligne par ligne, rien n'est changé avant « Appliquer ». */
export function PassageAnnee({ eleves, couleurs, aujourdhui, onAppliquer, onAnnuler }: Props) {
  const courante = anneeScolaire(aujourdhui);
  const choix = useMemo(() => [courante, anneeSuivante(courante)].filter(Boolean), [courante]);
  const [cible, setCible] = useState(courante);
  const [lignes, setLignes] = useState<LignePassage[]>(() => planPassage(eleves, courante));
  const [viderTitulaire, setViderTitulaire] = useState(true);

  const actifs = useMemo(() => elevesActifs(eleves).sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr')), [eleves]);
  const parLigne = new Map(lignes.map((l) => [l.eleveId, l]));

  const changerCible = (c: string) => { setCible(c); setLignes(planPassage(eleves, c)); };
  const majLigne = (id: string, p: Partial<LignePassage>) => setLignes((ls) => ls.map((l) => (l.eleveId === id ? { ...l, ...p } : l)));
  const toutFaire = (action: ActionPassage) => setLignes((ls) => ls.map((l) => (action === 'passer' && l.dejaAJour ? l : { ...l, action })));

  const nb = (a: ActionPassage) => lignes.filter((l) => l.action === a).length;
  const sansClasse = lignes.some((l) => l.action === 'passer' && !l.classe.trim());
  const aChanger = nb('passer') + nb('archiver');

  const appliquer = () => {
    const modifies: Eleve[] = [];
    for (const e of actifs) {
      const l = parLigne.get(e.id);
      if (!l || l.action === 'laisser') continue;
      modifies.push(appliquerPassage(e, l, cible, { viderTitulaire, aujourdhui }));
    }
    onAppliquer(modifies, cible);
  };

  return (
    <section className="liste-carte passage">
      <div className="liste-entete"><h2>Passage à la nouvelle année scolaire</h2></div>
      <div className="passage-corps">
        <p className="page-sous-titre">
          Relisez la proposition pour chaque élève, puis appliquez. Les séances déjà encodées ne changent pas : elles gardent la classe de leur époque.
        </p>

        <div className="champs champs-2">
          <Field label="Année scolaire qui commence" aide="Une année va du 1er août au 31 juillet.">
            {(id) => <Select id={id} value={cible} onChange={(ev) => changerCible(ev.target.value)}>{choix.map((a) => <option key={a}>{a}</option>)}</Select>}
          </Field>
          <div className="field">
            <span className="field-label">Titulaires</span>
            <label className="case-anonyme">
              <input type="checkbox" checked={viderTitulaire} onChange={(ev) => setViderTitulaire(ev.target.checked)} />
              Effacer le titulaire des élèves qui passent (il change presque toujours)
            </label>
          </div>
        </div>

        {actifs.length ? (
          <>
            <div className="passage-outils">
              <Button onClick={() => toutFaire('passer')}>Tout faire passer</Button>
              <Button onClick={() => toutFaire('laisser')}>Tout laisser</Button>
              <span className="field-hint">« Tout faire passer » ne touche pas aux dossiers déjà à jour.</span>
            </div>
            <ul className="passage-liste" aria-label="Proposition pour chaque élève">
              {actifs.map((e) => {
                const l = parLigne.get(e.id);
                if (!l) return null;
                return (
                  <li key={e.id} className="passage-ligne">
                    <div className="passage-eleve">
                      <Avatar eleve={e} couleur={couleurs.get(e.id) ?? 0} />
                      <span>
                        <strong>{e.nom} {e.prenom}</strong>
                        <span className="liste-detail">{e.classe || 'Sans classe'}{e.titulaire ? ` · ${e.titulaire}` : ''}</span>
                      </span>
                    </div>
                    <Select aria-label={`Que faire pour ${e.prenom} ${e.nom}`} value={l.action} onChange={(ev) => majLigne(e.id, { action: ev.target.value as ActionPassage })}>
                      {ACTIONS.map((a) => <option key={a.valeur} value={a.valeur}>{a.libelle}</option>)}
                    </Select>
                    {l.action === 'passer' ? (
                      <Input aria-label={`Nouvelle classe de ${e.prenom} ${e.nom}`} value={l.classe} placeholder="4CB" onChange={(ev) => majLigne(e.id, { classe: ev.target.value })} />
                    ) : <span aria-hidden="true" />}
                    <span className="liste-detail passage-note">{l.note}</span>
                  </li>
                );
              })}
            </ul>
          </>
        ) : <p className="vide-texte">Aucun élève à faire passer.</p>}

        <p className="journalier-resume" aria-live="polite">
          <strong className="num">{nb('passer')} passent · {nb('archiver')} archivé{nb('archiver') > 1 ? 's' : ''} · {nb('laisser')} inchangé{nb('laisser') > 1 ? 's' : ''}</strong>
          {sansClasse ? <span className="barre-erreur"> — indiquez la nouvelle classe des élèves qui passent.</span> : null}
        </p>
        <div className="fiche-actions">
          <Button variante="primaire" disabled={!aChanger || sansClasse} onClick={appliquer}>Appliquer le passage</Button>
          <Button onClick={onAnnuler}>Annuler</Button>
        </div>
      </div>
    </section>
  );
}
