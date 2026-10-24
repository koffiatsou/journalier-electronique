import { useState } from 'react';
import { NB_COULEURS, NOMS_COULEURS, couleurLibre, couleursEleves } from '../../domain/agenda/index.ts';
import { analyserClasse } from '../../domain/referentiel/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { FILIERES_LIBELLES } from '../../domain/types.ts';
import type { Eleve, Filiere, Seance } from '../../domain/types.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { Chips } from '../../ui/Chip.tsx';
import { Field, Input, Select } from '../../ui/Field.tsx';
import type { Aller } from '../../app/useRoute.ts';
import { useToast } from '../../ui/Toast.tsx';

const MATIERES = ['Mathématiques', 'Français', 'Néerlandais', 'Anglais', 'Sciences', 'Sciences économiques', 'Histoire', 'Géographie', 'Langues modernes'];
const LANGUES = ['Néerlandais', 'Anglais', 'Allemand', 'Espagnol', 'Italien'];

const vide = (autres: readonly Eleve[]): Eleve => ({ id: crypto.randomUUID(), nom: '', prenom: '', classe: '', ecole: '', titulaire: '', dateNaissance: '', matieres: [], couleur: couleurLibre(autres) });

/** Ce que l'application déduit de la classe saisie (3CB, 4TQ…), montré pour que l'agent vérifie. */
function deduction(classe: string): string {
  const c = analyserClasse(classe);
  if (!c) return classe.trim() ? 'Classe non reconnue : choisissez le niveau d’étude ci-dessous.' : '';
  return `Lu : ${c.annee}${c.filiere ? ` — ${FILIERES_LIBELLES[c.filiere]}` : ''}`;
}

function FicheEleve({ eleve, onEnregistrer, onAnnuler }: { eleve: Eleve; onEnregistrer: (e: Eleve) => void; onAnnuler: () => void }) {
  const [e, setE] = useState(eleve);
  const maj = (p: Partial<Eleve>) => setE((x) => ({ ...x, ...p }));
  const valide = e.nom.trim() !== '' && e.prenom.trim() !== '';
  const soumettre = (ev: { preventDefault(): void }) => { ev.preventDefault(); if (valide) onEnregistrer({ ...e, nom: e.nom.trim(), prenom: e.prenom.trim() }); };
  const filiereDeduite = analyserClasse(e.classe)?.filiere;

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
        <Field label="École" optionnel>{(id) => <Input id={id} value={e.ecole} onChange={(ev) => maj({ ecole: ev.target.value })} />}</Field>
        <Field label="Titulaire" optionnel>{(id) => <Input id={id} value={e.titulaire} onChange={(ev) => maj({ titulaire: ev.target.value })} />}</Field>
      </div>
      <div className="field">
        <span className="field-label">Matières suivies</span>
        <Chips options={[...MATIERES, ...e.matieres.filter((m) => !MATIERES.includes(m))]} valeurs={e.matieres} onChange={(matieres) => maj({ matieres })} />
      </div>
      <div className="field">
        <span className="field-label">Couleur dans l’agenda</span>
        <div className="pastilles-couleur" role="group" aria-label="Couleur dans l’agenda">
          {Array.from({ length: NB_COULEURS }, (_, i) => (
            <button key={i} type="button" className={`c-${i}`} aria-pressed={e.couleur === i} aria-label={NOMS_COULEURS[i]} onClick={() => maj({ couleur: i })} />
          ))}
        </div>
      </div>
      <Field label="Langue moderne" optionnel aide="Sert aux pistes de compétences quand la matière est « Langues modernes ».">
        {(id) => (
          <Select id={id} value={e.langue ?? ''} onChange={(ev) => { const { langue: _l, ...reste } = e; setE(ev.target.value ? { ...reste, langue: ev.target.value } : reste); }}>
            <option value="">Non précisée</option>
            {LANGUES.map((l) => <option key={l}>{l}</option>)}
          </Select>
        )}
      </Field>
      <div className="fiche-actions">
        <Button type="submit" variante="primaire" disabled={!valide}>Enregistrer</Button>
        <Button type="button" onClick={onAnnuler}>Annuler</Button>
      </div>
    </form>
  );
}

function resume(e: Eleve): string {
  const c = analyserClasse(e.classe);
  const fil = e.filiere ?? c?.filiere;
  return [e.classe, fil ? FILIERES_LIBELLES[fil] : '', e.langue ?? ''].filter(Boolean).join(' · ');
}

export function ElevesPage({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (s) => s.eleves);
  const seances = useMagasin(magasin, (s) => s.seances);
  const { annoncer } = useToast();
  const [edition, setEdition] = useState<Eleve | null>(null);
  const [ouvert, setOuvert] = useState<string | null>(null);

  const enregistrer = async (e: Eleve) => {
    await magasin.ajouterEleves([e]);
    setEdition(null);
    annoncer(`${e.prenom} ${e.nom} enregistré`);
  };
  const couleurs = couleursEleves(eleves);
  const triees = [...eleves].sort((a, b) => `${a.nom} ${a.prenom}`.localeCompare(`${b.nom} ${b.prenom}`, 'fr'));
  const deEleve = (id: string): Seance[] => seances.filter((s) => s.eleveId === id).sort((a, b) => (a.date < b.date ? 1 : -1));

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Élèves</h1>
        <p className="page-sous-titre">Le dossier sert à préremplir les séances : classe, niveau d’étude, matières, langue.</p>
      </header>

      {edition ? (
        <section className="liste-carte fiche-carte">
          <div className="liste-entete"><h2>{eleves.some((x) => x.id === edition.id) ? 'Modifier le dossier' : 'Nouvel élève'}</h2></div>
          <FicheEleve eleve={edition} onEnregistrer={(e) => { void enregistrer(e); }} onAnnuler={() => setEdition(null)} />
        </section>
      ) : (
        <section className="liste-carte">
          <div className="liste-entete">
            <h2>{triees.length ? `${triees.length} élève${triees.length > 1 ? 's' : ''}` : 'Aucun élève'}</h2>
            <Button variante="primaire" onClick={() => setEdition(vide(eleves))}>Nouvel élève</Button>
          </div>
          {triees.length ? (
            <ul className="liste liste-eleves">
              {triees.map((e) => {
                const s = deEleve(e.id);
                const est = ouvert === e.id;
                return (
                  <li key={e.id}>
                    <button type="button" className="eleve-ligne" aria-expanded={est} onClick={() => setOuvert(est ? null : e.id)}>
                      <span className="liste-titre"><i className={`pastille-eleve c-${couleurs.get(e.id) ?? 0}`} aria-hidden="true" />{e.nom} {e.prenom}</span>
                      <span className="liste-detail">{resume(e) || 'Dossier à compléter'} — {s.length} séance{s.length > 1 ? 's' : ''}</span>
                    </button>
                    {est ? (
                      <div className="eleve-detail">
                        {e.matieres.length ? <p className="liste-detail">Matières : {e.matieres.join(', ')}</p> : null}
                        {s.length ? (
                          <ul className="eleve-seances">
                            {s.slice(0, 5).map((x) => <li key={x.id}><span className="num">{dateFR(x.date)}</span> {x.matiere || 'Matière non précisée'}</li>)}
                          </ul>
                        ) : <p className="liste-detail">Aucune séance enregistrée.</p>}
                        <div className="fiche-actions">
                          <Button variante="primaire" onClick={() => onAller('journalier', { eleve: e.id })}>Voir le Journalier</Button>
                          <Button onClick={() => setEdition(e)}>Modifier le dossier</Button>
                        </div>
                      </div>
                    ) : null}
                  </li>
                );
              })}
            </ul>
          ) : <p className="vide-texte">Ajoutez un premier élève pour préparer une séance.</p>}
        </section>
      )}
    </div>
  );
}
