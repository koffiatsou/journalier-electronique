import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import type { Aller } from '../../app/useRoute.ts';
import { noms } from '../../domain/export/journalier.ts';
import { anneesDisponibles, bornes, construirePeriode, libellePeriode, seancesDuJournalier } from '../../domain/journalier/index.ts';
import type { GenrePeriode } from '../../domain/journalier/index.ts';
import { synthese } from '../../domain/redaction/index.ts';
import type { SyntheseMatiere } from '../../domain/redaction/index.ts';
import { dateFR, majusculePremiere } from '../../domain/redaction/langue.ts';
import { ajouterLibre, estRetenu, proposerObjectifs, reecrire, retenir, retirer, texteReunion } from '../../domain/reunion/index.ts';
import type { ObjectifRetenu, Proposition } from '../../domain/reunion/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { aujourdhuiISO } from '../seance/brouillon.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Button } from '../../ui/Button.tsx';
import { Field, Input, Select } from '../../ui/Field.tsx';
import { useToast } from '../../ui/Toast.tsx';

const GENRES: { genre: GenrePeriode; libelle: string }[] = [
  { genre: 'a-ce-jour', libelle: 'État à ce jour' },
  { genre: 'annee', libelle: 'Année scolaire' },
  { genre: 'dates', libelle: 'Dates libres' }
];

interface Filtre { eleveId: string; genre: GenrePeriode; annee: string; du: string; au: string; anonyme: boolean }

/* Gardés le temps de la visite (retour d'un autre écran). Rien n'est enregistré dans la base pour l'instant. */
let dernier: Filtre | null = null;
const retenusParEleve = new Map<string, ObjectifRetenu[]>();

const nomEleve = (e: Eleve | undefined): string => (e ? `${e.nom} ${e.prenom}`.trim() : '');
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

function Rubrique({ titre, lignes }: { titre: string; lignes: readonly string[] }) {
  if (!lignes.length) return null;
  return (
    <div className="reunion-rubrique">
      <h3>{titre}</h3>
      <ul>{lignes.map((l) => <li key={l}>{l}</li>)}</ul>
    </div>
  );
}

function CarteMatiere({ m }: { m: SyntheseMatiere }) {
  const vide = !m.appuis.length && !m.aTravailler.length && !m.competences.length && !m.aides.length && !m.aidesSansEffet.length;
  const dates = !m.dateDebut ? '' : m.dateDebut === m.dateFin ? `le ${dateFR(m.dateDebut)}` : `du ${dateFR(m.dateDebut)} au ${dateFR(m.dateFin)}`;
  return (
    <section className="liste-carte reunion-matiere" aria-label={m.matiere}>
      <div className="reunion-matiere-entete">
        <h2>{m.matiere}</h2>
        {dates ? <span className="reunion-dates">{dates}</span> : null}
      </div>
      {vide ? <p className="vide-texte">Aucune observation notée dans cette matière.</p> : (
        <div className="reunion-rubriques">
          <Rubrique titre="Points d’appui" lignes={m.appuis} />
          <Rubrique titre="À travailler" lignes={m.aTravailler} />
          <Rubrique titre="Compétence travaillée" lignes={m.competences} />
          <Rubrique titre="Aides utilisées" lignes={m.aides.map(majusculePremiere)} />
          <Rubrique titre="Aides sans effet constaté" lignes={m.aidesSansEffet.map(majusculePremiere)} />
        </div>
      )}
    </section>
  );
}

export function ReunionPage({ magasin, onAller, eleveInitial }: { magasin: Magasin; onAller: Aller; eleveInitial: string | null }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const aujourdhui = aujourdhuiISO();
  const annees = useMemo(() => anneesDisponibles(seances, aujourdhui), [seances, aujourdhui]);

  const [f, setF] = useState<Filtre>(() => {
    const base: Filtre = dernier ?? { eleveId: '', genre: 'a-ce-jour', annee: annees[0] ?? '', du: '', au: aujourdhui, anonyme: false };
    return eleveInitial !== null ? { ...base, eleveId: eleveInitial } : base;
  });
  const maj = (p: Partial<Filtre>) => setF((x) => { const n = { ...x, ...p }; dernier = n; return n; });

  const [retenus, setRetenus] = useState<ObjectifRetenu[]>(() => retenusParEleve.get(f.eleveId) ?? []);
  const changerRetenus = (suite: ObjectifRetenu[]) => { setRetenus(suite); retenusParEleve.set(f.eleveId, suite); };
  const changerEleve = (id: string) => { maj({ eleveId: id }); setRetenus(retenusParEleve.get(id) ?? []); };
  const [libre, setLibre] = useState('');

  const triees = [...eleves].sort((a, b) => nomEleve(a).localeCompare(nomEleve(b), 'fr'));
  const eleve = eleves.find((e) => e.id === f.eleveId);
  const periode = construirePeriode(f);
  const resultat = bornes(periode, aujourdhui);
  const liste = resultat.ok && f.eleveId ? seancesDuJournalier(seances, f.eleveId, resultat.bornes) : [];
  const sy = synthese(liste);
  const propositions = proposerObjectifs(sy);
  const matieresAvecPropositions = [...new Set(propositions.map((p) => p.matiere))];
  const nbAbsences = liste.length - sy.seances;

  const texte = eleve
    ? texteReunion(sy, retenus, {
      eleve: nomEleve(eleve), classe: eleve.classe, periode: libellePeriode(periode, aujourdhui),
      masquer: f.anonyme ? noms(eleve) : []
    })
    : '';

  const basculer = (p: Proposition) => changerRetenus(estRetenu(retenus, p.id) ? retirer(retenus, p.id) : retenir(retenus, p));
  const ajouter = (ev: FormEvent) => {
    ev.preventDefault();
    if (!libre.trim()) return;
    changerRetenus(ajouterLibre(retenus, libre));
    setLibre('');
  };
  const copier = async () => {
    try {
      await globalThis.navigator.clipboard.writeText(texte);
      annoncer('Texte de la réunion copié');
    } catch {
      annoncer('Copie impossible ici : ouvrez « Voir le texte » et copiez-le à la main');
    }
  };

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Réunion</h1>
        <p className="page-sous-titre">Un résumé simple par matière, tiré de vos séances, et des objectifs à valider avant la réunion.</p>
      </header>

      <section className="liste-carte reunion-filtres" aria-label="Choix de l’élève et de la période">
        <div className="reunion-grille">
          <Field label="Élève">
            {(id) => (
              <Select id={id} value={f.eleveId} onChange={(ev) => changerEleve(ev.target.value)}>
                <option value="">Choisir un élève…</option>
                {triees.map((e) => <option key={e.id} value={e.id}>{nomEleve(e)}{e.classe ? ` (${e.classe})` : ''}{e.archiveLe ? ' — archivé' : ''}</option>)}
              </Select>
            )}
          </Field>
          <div className="field">
            <span className="field-label" id="reunion-periode-titre">Période</span>
            <div className="chips" role="radiogroup" aria-labelledby="reunion-periode-titre">
              {GENRES.map((g) => (
                <button key={g.genre} type="button" role="radio" aria-checked={f.genre === g.genre} className="chip" onClick={() => maj({ genre: g.genre })}>{g.libelle}</button>
              ))}
            </div>
          </div>
        </div>

        {f.genre === 'annee' ? (
          <div className="reunion-grille">
            <Field label="Année scolaire" aide="Du 1er août au 31 juillet.">
              {(id) => (
                <Select id={id} value={f.annee} onChange={(ev) => maj({ annee: ev.target.value })}>
                  {annees.map((a) => <option key={a} value={a}>{a}</option>)}
                </Select>
              )}
            </Field>
          </div>
        ) : null}
        {f.genre === 'dates' ? (
          <div className="reunion-grille">
            <Field label="Du">{(id) => <Input id={id} type="date" value={f.du} max={f.au || undefined} onChange={(ev) => maj({ du: ev.target.value })} />}</Field>
            <Field label="Au">{(id) => <Input id={id} type="date" value={f.au} min={f.du || undefined} onChange={(ev) => maj({ au: ev.target.value })} />}</Field>
          </div>
        ) : null}

        <p className="reunion-resume" aria-live="polite">
          {!resultat.ok ? <span className="barre-erreur">{resultat.raison}</span> : !eleve ? 'Choisissez un élève pour préparer la réunion.' : (
            <>
              <strong className="num">{pluriel(sy.seances, 'séance')} d’accompagnement</strong>
              {' · '}{libellePeriode(periode, aujourdhui)}
              {nbAbsences ? ` · ${pluriel(nbAbsences, 'séance')} sans accompagnement (absence ou cours annulé)` : ''}
            </>
          )}
        </p>
      </section>

      {eleve && resultat.ok ? (
        <>
          {sy.absences ? <p className="reunion-absences">{sy.absences}</p> : null}

          {!sy.matieres.length ? (
            <section className="liste-carte">
              <p className="vide-texte reunion-vide">
                {liste.length ? 'Aucune séance d’accompagnement dans cette période : il n’y a pas d’observation à résumer.' : 'Aucune séance dans cette période.'}
              </p>
            </section>
          ) : sy.matieres.map((m) => <CarteMatiere key={m.matiere} m={m} />)}

          <section className="liste-carte reunion-objectifs" aria-labelledby="reunion-objectifs-titre">
            <div className="liste-entete">
              <h2 id="reunion-objectifs-titre">Objectifs à valider</h2>
            </div>
            <div className="reunion-objectifs-corps">
              <p className="field-hint">Ce sont des propositions tirées de vos séances. Cochez celles que vous gardez, reformulez-les si besoin, ou ajoutez les vôtres.</p>

              {matieresAvecPropositions.length ? matieresAvecPropositions.map((matiere) => (
                <div key={matiere} className="reunion-groupe">
                  <h3>{matiere}</h3>
                  <ul className="reunion-propositions">
                    {propositions.filter((p) => p.matiere === matiere).map((p) => (
                      <li key={p.id}>
                        <label className="reunion-choix">
                          <input type="checkbox" checked={estRetenu(retenus, p.id)} onChange={() => basculer(p)} />
                          <span>
                            <span className="reunion-proposition">{p.texte}</span>
                            <small className="reunion-raison">{p.raison}</small>
                          </span>
                        </label>
                      </li>
                    ))}
                  </ul>
                </div>
              )) : <p className="vide-texte">Rien à proposer pour l’instant : aucune observation à faire progresser, aucune compétence en cours, aucune aide à garder ou à revoir.</p>}

              <div className="reunion-groupe">
                <h3>Objectifs retenus pour la réunion</h3>
                {retenus.length ? (
                  <ol className="reunion-retenus">
                    {retenus.map((r, i) => (
                      <li key={r.id}>
                        <Input
                          value={r.texte}
                          aria-label={`Objectif retenu ${i + 1}${r.matiere ? ` (${r.matiere})` : ''}`}
                          onChange={(ev) => changerRetenus(reecrire(retenus, r.id, ev.target.value))}
                        />
                        <Button variante="discret" aria-label={`Retirer l’objectif ${i + 1}`} onClick={() => changerRetenus(retirer(retenus, r.id))}>Retirer</Button>
                      </li>
                    ))}
                  </ol>
                ) : <p className="field-hint">Aucun objectif retenu pour l’instant.</p>}

                <form className="reunion-ajout" onSubmit={ajouter}>
                  <Field label="Ajouter un objectif personnel" optionnel className="reunion-ajout-champ">
                    {(id) => <Input id={id} value={libre} placeholder="Par exemple : revoir le matériel avec la titulaire" onChange={(ev) => setLibre(ev.target.value)} />}
                  </Field>
                  <Button type="submit" disabled={!libre.trim()}>Ajouter</Button>
                </form>
              </div>
            </div>
          </section>

          <section className="liste-carte reunion-texte-carte" aria-labelledby="reunion-texte-titre">
            <div className="liste-entete">
              <h2 id="reunion-texte-titre">Texte pour la réunion</h2>
            </div>
            <div className="reunion-objectifs-corps">
              <label className="case-anonyme"><input type="checkbox" checked={f.anonyme} onChange={(ev) => maj({ anonyme: ev.target.checked })} /> Sans nom (pour partager)</label>
              <div className="reunion-actions">
                <Button variante="primaire" disabled={!sy.matieres.length && !retenus.length} onClick={() => { void copier(); }}>Copier le texte</Button>
                <Button onClick={() => onAller('journalier', { eleve: eleve.id })}>Voir le Journalier de l’élève</Button>
              </div>
              <details className="reunion-apercu">
                <summary>Voir le texte</summary>
                <pre className="reunion-texte" tabIndex={0}>{texte}</pre>
              </details>
              <p className="field-hint">Les objectifs retenus sont gardés tant que cette fenêtre reste ouverte ; ils ne sont pas encore enregistrés dans le dossier de l’élève.</p>
            </div>
          </section>
        </>
      ) : null}
    </div>
  );
}
