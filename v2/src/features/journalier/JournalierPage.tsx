import { useMemo, useState } from 'react';
import type { Aller } from '../../app/useRoute.ts';
import { couleursEleves } from '../../domain/agenda/index.ts';
import { telechargerJournalier, telechargerJournaliers } from '../../domain/export/telecharger.ts';
import { anneesDisponibles, bornes, construirePeriode, libellePeriode, rechercherSeances, seancesDuJournalier } from '../../domain/journalier/index.ts';
import type { Periode } from '../../domain/journalier/index.ts';
import { construireBloc } from '../../domain/redaction/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { PRESENCE_LIBELLES } from '../../domain/types.ts';
import type { Eleve, Seance } from '../../domain/types.ts';
import { aujourdhuiISO } from '../seance/brouillon.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { Field, Input, Select } from '../../ui/Field.tsx';
import { useToast } from '../../ui/Toast.tsx';

type Genre = Periode['genre'];
const GENRES: { genre: Genre; libelle: string }[] = [
  { genre: 'a-ce-jour', libelle: 'État à ce jour' },
  { genre: 'annee', libelle: 'Année scolaire' },
  { genre: 'dates', libelle: 'Dates libres' }
];

interface Filtre { eleveId: string; genre: Genre; annee: string; du: string; au: string; anonyme: boolean; requete: string }

/** Le choix est gardé le temps de la visite (retour après une modification de séance). */
let dernier: Filtre | null = null;

const nomEleve = (e: Eleve | undefined): string => (e ? `${e.nom} ${e.prenom}`.trim() : 'Élève supprimé');
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;
const creneau = (s: Seance): string => (s.periodeFin && s.periodeFin !== s.periodeDebut ? `${s.periodeDebut} → ${s.periodeFin}` : s.periodeDebut);

/** Texte de la séance tel qu'il ira dans le Journalier (aperçu repliable). */
function ApercuSeance({ seance, eleve, precedentes }: { seance: Seance; eleve: Eleve | undefined; precedentes: Seance[] }) {
  const b = construireBloc(seance, { titulaire: eleve?.titulaire ?? '', precedentes });
  return (
    <div className="journalier-apercu">
      {b.peda ? (
        <div className="zone-peda">
          <h4>Partie pédagogique</h4>
          {b.peda.objectifLecon ? <p><strong>Objectif de la leçon :</strong> {b.peda.objectifLecon}</p> : null}
          {b.peda.contenuClasse ? <p><strong>Contenu vu en classe :</strong> {b.peda.contenuClasse}</p> : null}
          {b.peda.monObjectif ? <p><strong>Mon objectif :</strong> {b.peda.monObjectif}</p> : null}
          {b.peda.interventions.length ? <p><strong>Mon intervention :</strong> {b.peda.interventions.join(' ; ')}</p> : null}
        </div>
      ) : null}
      <div className="zone-ortho">
        <h4>{b.type === 'absence' ? 'Séance' : 'Partie orthopédagogique'}</h4>
        {b.ortho.map((o, i) => (
          o.lignes ? (
            <div key={i}>
              {o.label ? <p><strong>{o.label}</strong></p> : null}
              {o.lignes.map((l) => <p key={l} className="apercu-ligne">{l}</p>)}
            </div>
          ) : <p key={i}>{o.label ? <strong>{o.label} : </strong> : null}{o.texte}</p>
        ))}
      </div>
    </div>
  );
}

export function JournalierPage({ magasin, onAller, eleveInitial }: { magasin: Magasin; onAller: Aller; eleveInitial: string | null }) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const { annoncer } = useToast();
  const aujourdhui = aujourdhuiISO();
  const annees = useMemo(() => anneesDisponibles(seances, aujourdhui), [seances, aujourdhui]);

  const [f, setF] = useState<Filtre>(() => {
    const base: Filtre = dernier ?? { eleveId: '', genre: 'a-ce-jour', annee: annees[0] ?? '', du: '', au: aujourdhui, anonyme: false, requete: '' };
    return eleveInitial !== null ? { ...base, eleveId: eleveInitial } : base;
  });
  const maj = (p: Partial<Filtre>) => setF((x) => { const n = { ...x, ...p }; dernier = n; return n; });
  const [ouverte, setOuverte] = useState<string | null>(null);
  const [aSupprimer, setASupprimer] = useState<Seance | null>(null);
  const [enCours, setEnCours] = useState(false);

  const periode = construirePeriode(f);
  const resultat = bornes(periode, aujourdhui);
  const liste = resultat.ok ? seancesDuJournalier(seances, f.eleveId, resultat.bornes) : [];
  const parEleve = new Map(eleves.map((e) => [e.id, e]));
  // La recherche sert à retrouver une séance à l'écran ; l'export garde toujours toute la période.
  const recherche = f.requete.trim() !== '';
  const affichees = recherche ? rechercherSeances(liste, f.requete, parEleve) : liste;
  const couleurs = couleursEleves(eleves);
  const triees = [...eleves].sort((a, b) => nomEleve(a).localeCompare(nomEleve(b), 'fr'));
  const eleve = f.eleveId ? parEleve.get(f.eleveId) : undefined;
  const nbEleves = new Set(liste.map((s) => s.eleveId)).size;

  const exporter = async () => {
    if (!liste.length) return;
    setEnCours(true);
    const options = { deidentifie: f.anonyme, periode: libellePeriode(periode, aujourdhui, true) };
    try {
      if (eleve) {
        annoncer(`${await telechargerJournalier(eleve, liste, options)} téléchargé`);
      } else {
        const groupes = triees.map((e) => ({ eleve: e, seances: liste.filter((s) => s.eleveId === e.id) }));
        const r = await telechargerJournaliers(groupes, options);
        annoncer(`${r.nombre} Journalier${r.nombre > 1 ? 's' : ''} téléchargé${r.nombre > 1 ? 's' : ''} (${r.nom})`);
      }
    } catch (err) {
      annoncer(err instanceof Error ? err.message : 'Export impossible');
    } finally {
      setEnCours(false);
    }
  };

  const modifier = (s: Seance) => { magasin.preparerSeance(s); onAller('seance'); };
  const supprimer = async () => {
    if (!aSupprimer) return;
    await magasin.supprimerSeance(aSupprimer.id);
    annoncer(`Séance du ${dateFR(aSupprimer.date)} supprimée`);
    setASupprimer(null);
  };

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Journalier</h1>
        <p className="page-sous-titre">Retrouvez les séances, corrigez-les si besoin et téléchargez le Journalier Word pour la période voulue.</p>
      </header>

      <section className="liste-carte journalier-filtres" aria-label="Choix des séances">
        <div className="journalier-grille">
          <Field label="Élève">
            {(id) => (
              <Select id={id} value={f.eleveId} onChange={(ev) => maj({ eleveId: ev.target.value })}>
                <option value="">Tous les élèves</option>
                {triees.map((e) => <option key={e.id} value={e.id}>{nomEleve(e)}{e.classe ? ` (${e.classe})` : ''}{e.archiveLe ? ' — archivé' : ''}</option>)}
              </Select>
            )}
          </Field>
          <div className="field">
            <span className="field-label" id="periode-titre">Période</span>
            <div className="chips" role="radiogroup" aria-labelledby="periode-titre">
              {GENRES.map((g) => (
                <button key={g.genre} type="button" role="radio" aria-checked={f.genre === g.genre} className="chip" onClick={() => maj({ genre: g.genre })}>{g.libelle}</button>
              ))}
            </div>
          </div>
        </div>

        {f.genre === 'annee' ? (
          <div className="journalier-grille">
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
          <div className="journalier-grille">
            <Field label="Du">{(id) => <Input id={id} type="date" value={f.du} max={f.au || undefined} onChange={(ev) => maj({ du: ev.target.value })} />}</Field>
            <Field label="Au">{(id) => <Input id={id} type="date" value={f.au} min={f.du || undefined} onChange={(ev) => maj({ au: ev.target.value })} />}</Field>
          </div>
        ) : null}

        <div className="journalier-export">
          <p className="journalier-resume" aria-live="polite">
            {!resultat.ok ? <span className="barre-erreur">{resultat.raison}</span> : (
              <>
                <strong className="num">{liste.length} séance{liste.length > 1 ? 's' : ''}</strong>
                {' · '}{libellePeriode(periode, aujourdhui)}
                {!eleve && nbEleves > 1 ? ` · ${nbEleves} élèves` : ''}
              </>
            )}
          </p>
          <label className="case-anonyme"><input type="checkbox" checked={f.anonyme} onChange={(ev) => maj({ anonyme: ev.target.checked })} /> Sans nom ni titulaire (pour partager)</label>
          <Button variante="primaire" disabled={!liste.length || enCours} onClick={() => { void exporter(); }}>
            {enCours ? 'Préparation…' : 'Exporter le Journalier (Word)'}
          </Button>
          {!eleve && nbEleves > 1 ? <p className="field-hint">Un fichier Word par élève, réunis dans un dossier compressé (.zip).</p> : null}
        </div>
      </section>

      <section className="liste-carte">
        <div className="liste-entete">
          <h2>{eleve ? nomEleve(eleve) : 'Toutes les séances'}</h2>
          <Button onClick={() => { if (f.eleveId) magasin.preparerSeance({ eleveId: f.eleveId }); onAller('seance'); }}>Nouvelle séance</Button>
        </div>
        {seances.length ? (
          <div className="journalier-recherche">
            <Input type="search" value={f.requete} placeholder="Élève, matière, objectif, mot du texte…" aria-label="Rechercher une séance" onChange={(ev) => maj({ requete: ev.target.value })} />
            {recherche ? (
              <p className="field-hint" aria-live="polite">
                {pluriel(affichees.length, 'séance')} sur {liste.length} dans la période. L’export Word contient toute la période, pas seulement la recherche.
              </p>
            ) : null}
          </div>
        ) : null}
        {affichees.length ? (
          <ul className="liste journalier-liste">
            {affichees.map((s) => {
              const e = parEleve.get(s.eleveId);
              const ouvert = ouverte === s.id;
              const absent = s.presence !== 'present';
              return (
                <li key={s.id}>
                  <span className="num liste-date">{dateFR(s.date)}</span>
                  <div className="journalier-ligne">
                    <span className="liste-titre">
                      {!eleve ? <><i className={`pastille-eleve c-${couleurs.get(s.eleveId) ?? 0}`} aria-hidden="true" />{nomEleve(e)} — </> : null}
                      {s.matiere || 'Matière non précisée'}
                      {absent ? <> <Badge ton="danger">{PRESENCE_LIBELLES[s.presence].titre}</Badge></> : null}
                    </span>
                    <span className="liste-detail">{creneau(s)}{s.objectifLecon ? ` · ${s.objectifLecon}` : ''}</span>
                  </div>
                  <div className="journalier-actions">
                    <Button variante="discret" aria-expanded={ouvert} onClick={() => setOuverte(ouvert ? null : s.id)}>{ouvert ? 'Masquer' : 'Voir'}</Button>
                    <Button variante="discret" onClick={() => modifier(s)}>Modifier</Button>
                    <Button variante="discret" className="btn-danger" onClick={() => setASupprimer(s)}>Supprimer</Button>
                  </div>
                  {ouvert ? <ApercuSeance seance={s} eleve={e} precedentes={seances.filter((x) => x.eleveId === s.eleveId && x.date < s.date)} /> : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="vide-texte journalier-vide">
            {!seances.length ? 'Aucune séance enregistrée pour l’instant.' : !resultat.ok ? 'Corrigez la période pour voir les séances.' : !liste.length ? 'Aucune séance dans cette période.' : 'Aucune séance de cette période ne correspond à la recherche.'}
          </p>
        )}
      </section>

      <Dialog ouvert={aSupprimer !== null} titre="Supprimer cette séance ?" onFermer={() => setASupprimer(null)}>
        {aSupprimer ? (
          <>
            <p>
              Séance du <strong>{dateFR(aSupprimer.date)}</strong> — {nomEleve(parEleve.get(aSupprimer.eleveId))}, {aSupprimer.matiere || 'matière non précisée'}.
              {' '}Elle disparaîtra du Journalier. Cette action est définitive.
            </p>
            <div className="fiche-actions">
              <Button variante="primaire" className="btn-danger-plein" onClick={() => { void supprimer(); }}>Supprimer</Button>
              <Button onClick={() => setASupprimer(null)}>Annuler</Button>
            </div>
          </>
        ) : null}
      </Dialog>
    </div>
  );
}
