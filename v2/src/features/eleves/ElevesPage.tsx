import { useState } from 'react';
import type { Aller } from '../../app/useRoute.ts';
import { couleurLibre, couleursEleves } from '../../domain/agenda/index.ts';
import { anneeScolaire } from '../../domain/export/journalier.ts';
import {
  archiver, bilanSeances, effetSuppression, elevesActifs, elevesArchives, languesDe, reactiver, rechercherEleves
} from '../../domain/eleves/index.ts';
import type { BilanSeances } from '../../domain/eleves/index.ts';
import { analyserClasse } from '../../domain/referentiel/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { FILIERES_LIBELLES } from '../../domain/types.ts';
import type { Eleve, Seance } from '../../domain/types.ts';
import { telechargerJournalier } from '../../domain/export/telecharger.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { Avatar } from '../../ui/Avatar.tsx';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Dialog } from '../../ui/Dialog.tsx';
import { Input } from '../../ui/Field.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { aujourdhuiISO } from '../seance/brouillon.ts';
import { FicheEleve } from './FicheEleve.tsx';
import { PassageAnnee } from './PassageAnnee.tsx';

const vide = (autres: readonly Eleve[]): Eleve => ({ id: crypto.randomUUID(), nom: '', prenom: '', classe: '', ecole: '', titulaire: '', dateNaissance: '', matieres: [], couleur: couleurLibre(autres) });

const nomComplet = (e: Pick<Eleve, 'nom' | 'prenom'>): string => `${e.nom} ${e.prenom}`.trim();
const pluriel = (n: number, mot: string): string => `${n} ${mot}${n > 1 ? 's' : ''}`;

/** Classe et niveau d'étude, tels que l'application les lit (ex. « 3CB · Secondaire général »). */
function resume(e: Eleve): string {
  const fil = e.filiere ?? analyserClasse(e.classe)?.filiere;
  return [e.classe, fil ? FILIERES_LIBELLES[fil] : ''].filter(Boolean).join(' · ');
}

type Vue =
  | { genre: 'liste' }
  | { genre: 'dossier'; id: string }
  | { genre: 'fiche'; eleve: Eleve; retour: Vue }
  | { genre: 'passage' };

function Carte({ eleve, couleur, bilan, aJour, onOuvrir }: { eleve: Eleve; couleur: number; bilan: BilanSeances | undefined; aJour: boolean; onOuvrir: () => void }) {
  const langues = languesDe(eleve);
  return (
    <li>
      <button type="button" className="carte-eleve" data-archive={Boolean(eleve.archiveLe)} onClick={onOuvrir}>
        <Avatar eleve={eleve} couleur={couleur} />
        <span className="carte-corps">
          <strong className="carte-nom">{nomComplet(eleve) || 'Sans nom'}</strong>
          <span className="carte-detail">{resume(eleve) || 'Dossier à compléter'}</span>
          {eleve.matieres.length ? <span className="carte-detail">{eleve.matieres.join(', ')}</span> : null}
          {langues.length ? <span className="carte-detail">Langues : {langues.join(', ')}</span> : null}
          <span className="carte-pied">
            <span className="num">{bilan ? `${pluriel(bilan.nombre, 'séance')} · dernière le ${dateFR(bilan.derniere)}` : 'Aucune séance'}</span>
            {eleve.archiveLe ? <Badge>Archivé</Badge> : !aJour ? <Badge ton="attention">À mettre à jour</Badge> : null}
          </span>
        </span>
      </button>
    </li>
  );
}

export function ElevesPage({ magasin, onAller }: { magasin: Magasin; onAller: Aller }) {
  const eleves = useMagasin(magasin, (s) => s.eleves);
  const seances = useMagasin(magasin, (s) => s.seances);
  const activites = useMagasin(magasin, (s) => s.activites);
  const pias = useMagasin(magasin, (s) => s.pias);
  const ecoles = useMagasin(magasin, (s) => s.ecoles);
  const { annoncer } = useToast();
  const aujourdhui = aujourdhuiISO();
  const anneeCourante = anneeScolaire(aujourdhui);

  const [vue, setVue] = useState<Vue>({ genre: 'liste' });
  const [requete, setRequete] = useState('');
  const [archivesOuvertes, setArchivesOuvertes] = useState(false);
  const [aSupprimer, setASupprimer] = useState<Eleve | null>(null);
  const [compris, setCompris] = useState(false);
  const [enCours, setEnCours] = useState(false);

  const couleurs = couleursEleves(eleves);
  const bilans = bilanSeances(seances);
  const parNom = (a: Eleve, b: Eleve) => nomComplet(a).localeCompare(nomComplet(b), 'fr');
  const trouves = rechercherEleves(eleves, requete);
  const actifs = elevesActifs(trouves).sort(parNom);
  const archives = elevesArchives(trouves).sort(parNom);
  const nbActifs = elevesActifs(eleves).length;
  const recherche = requete.trim() !== '';
  /** Un dossier est « à mettre à jour » quand il date d'une année scolaire passée. */
  const aJour = (e: Eleve): boolean => !e.anneeDossier || e.anneeDossier >= anneeCourante;

  const seancesDe = (id: string): Seance[] => seances.filter((s) => s.eleveId === id).sort((a, b) => (a.date < b.date ? 1 : -1));

  const enregistrer = async (e: Eleve, retour: Vue) => {
    await magasin.ajouterEleves([e]);
    setVue(retour.genre === 'dossier' ? { genre: 'dossier', id: e.id } : { genre: 'liste' });
    annoncer(`${nomComplet(e)} enregistré`);
  };

  const basculerArchive = async (e: Eleve) => {
    if (e.archiveLe) {
      await magasin.ajouterEleves([reactiver(e)]);
      annoncer(`${nomComplet(e)} est de nouveau suivi`);
    } else {
      await magasin.ajouterEleves([archiver(e, aujourdhui)]);
      annoncer(`${nomComplet(e)} archivé : son historique reste au Journalier`);
    }
  };

  const fermerSuppression = () => { setASupprimer(null); setCompris(false); };
  const supprimer = async () => {
    if (!aSupprimer || !compris) return;
    setEnCours(true);
    try {
      const e = aSupprimer;
      const effet = await magasin.supprimerEleve(e.id);
      fermerSuppression();
      setVue({ genre: 'liste' });
      annoncer(`${nomComplet(e)} supprimé (${pluriel(effet.seances.length, 'séance')})`);
    } catch (err) {
      annoncer(err instanceof Error ? err.message : 'Suppression impossible');
    } finally {
      setEnCours(false);
    }
  };

  const telechargerAvant = async (e: Eleve) => {
    try {
      annoncer(`${await telechargerJournalier(e, seancesDe(e.id), { periode: 'complet' })} téléchargé`);
    } catch (err) {
      annoncer(err instanceof Error ? err.message : 'Export impossible');
    }
  };

  /* ───────── vues ───────── */

  const entete = (
    <header className="page-entete">
      <h1>Élèves</h1>
      <p className="page-sous-titre">Le dossier sert à préremplir les séances : classe, niveau d’étude, matières, langues.</p>
    </header>
  );

  if (vue.genre === 'fiche') {
    const { eleve, retour } = vue;
    return (
      <div className="page">
        {entete}
        <section className="liste-carte fiche-carte">
          <div className="liste-entete"><h2>{eleves.some((x) => x.id === eleve.id) ? 'Modifier le dossier' : 'Nouvel élève'}</h2></div>
          <FicheEleve eleve={eleve} ecoles={ecoles} couleurParDefaut={couleurs.get(eleve.id) ?? 0} onEnregistrer={(e) => { void enregistrer(e, retour); }} onAnnuler={() => setVue(retour)} />
        </section>
      </div>
    );
  }

  if (vue.genre === 'passage') {
    return (
      <div className="page">
        {entete}
        <PassageAnnee
          eleves={eleves} couleurs={couleurs} aujourdhui={aujourdhui}
          onAnnuler={() => setVue({ genre: 'liste' })}
          onAppliquer={(modifies, cible) => {
            void magasin.ajouterEleves(modifies).then(() => {
              setVue({ genre: 'liste' });
              annoncer(`Passage à ${cible} appliqué (${pluriel(modifies.length, 'dossier')} modifié${modifies.length > 1 ? 's' : ''})`);
            });
          }}
        />
      </div>
    );
  }

  const ouvert = vue.genre === 'dossier' ? eleves.find((x) => x.id === vue.id) : undefined;
  if (ouvert) {
    const s = seancesDe(ouvert.id);
    const langues = languesDe(ouvert);
    const fil = ouvert.filiere ?? analyserClasse(ouvert.classe)?.filiere;
    const effet = effetSuppression(ouvert.id, seances, activites, pias);
    return (
      <div className="page">
        {entete}
        <section className="liste-carte dossier">
          <div className="dossier-entete">
            <Button variante="discret" onClick={() => setVue({ genre: 'liste' })}>← Tous les élèves</Button>
          </div>
          <div className="dossier-identite">
            <Avatar eleve={ouvert} couleur={couleurs.get(ouvert.id) ?? 0} taille="l" />
            <div>
              <h2>{nomComplet(ouvert)}</h2>
              <p className="liste-detail">{resume(ouvert) || 'Dossier à compléter'}</p>
              {ouvert.archiveLe ? <p><Badge>Archivé le {dateFR(ouvert.archiveLe)}</Badge></p> : !aJour(ouvert) ? <p><Badge ton="attention">Dossier de {ouvert.anneeDossier} : à mettre à jour</Badge></p> : null}
            </div>
          </div>

          <dl className="dossier-infos">
            {ouvert.ecole ? <><dt>École</dt><dd>{ouvert.ecole}</dd></> : null}
            {ouvert.titulaire ? <><dt>Titulaire</dt><dd>{ouvert.titulaire}</dd></> : null}
            {ouvert.niveau ? <><dt>Année</dt><dd>{ouvert.niveau}</dd></> : null}
            {fil && ouvert.filiere ? <><dt>Niveau d’étude</dt><dd>{FILIERES_LIBELLES[fil]}</dd></> : null}
            <dt>Matières</dt><dd>{ouvert.matieres.length ? ouvert.matieres.join(', ') : 'Aucune précisée'}</dd>
            <dt>Langues</dt><dd>{langues.length ? langues.join(', ') : 'Aucune précisée'}</dd>
          </dl>

          {ouvert.archiveLe ? (
            <p className="dossier-note">Cet élève n’apparaît plus dans les choix de séance et d’agenda. Son historique reste au Journalier.</p>
          ) : null}

          <div className="dossier-seances">
            <h3>{s.length ? `${pluriel(s.length, 'séance')} — les plus récentes` : 'Séances'}</h3>
            {s.length ? (
              <ul className="eleve-seances">
                {s.slice(0, 5).map((x) => <li key={x.id}><span className="num">{dateFR(x.date)}</span> {x.matiere || 'Matière non précisée'}</li>)}
              </ul>
            ) : <p className="liste-detail">Aucune séance enregistrée.</p>}
          </div>

          <div className="fiche-actions dossier-actions">
            <Button variante="primaire" onClick={() => onAller('journalier', { eleve: ouvert.id })}>Voir le Journalier</Button>
            <Button onClick={() => onAller('pia', { eleve: ouvert.id, onglet: 'preparer' })}>Préparer la réunion</Button>
            <Button onClick={() => onAller('pia', { eleve: ouvert.id })}>Ouvrir le PIA</Button>
            <Button onClick={() => setVue({ genre: 'fiche', eleve: ouvert, retour: vue })}>Modifier le dossier</Button>
            <Button onClick={() => { void basculerArchive(ouvert); }}>{ouvert.archiveLe ? 'Suivre à nouveau' : 'Archiver'}</Button>
            <Button className="btn-danger" onClick={() => setASupprimer(ouvert)}>Supprimer…</Button>
          </div>
        </section>

        <Dialog ouvert={aSupprimer !== null} titre="Supprimer définitivement cet élève ?" onFermer={fermerSuppression}>
          {aSupprimer ? (
            <>
              <p>
                Le dossier de <strong>{nomComplet(aSupprimer)}</strong> sera supprimé
                {effet.seances.length || effet.activites.length || effet.pias.length ? (
                  <>, avec <strong>{pluriel(effet.seances.length, 'séance')}</strong> du Journalier{effet.pias.length ? ', ' : ' et '}<strong>{pluriel(effet.activites.length, 'activité')}</strong> de l’agenda{effet.pias.length ? <> et <strong>{pluriel(effet.pias.length, 'PIA')}</strong></> : null}</>
                ) : ' (aucune séance ni activité n’y est liée)'}.
                {' '}Cette action est définitive.
              </p>
              <p className="field-hint">Pour ne plus voir l’élève sans rien perdre, choisissez plutôt « Archiver ».</p>
              {effet.seances.length ? (
                <div><Button onClick={() => { void telechargerAvant(aSupprimer); }}>Télécharger son Journalier (Word) avant</Button></div>
              ) : null}
              <label className="case-anonyme">
                <input type="checkbox" checked={compris} onChange={(ev) => setCompris(ev.target.checked)} />
                Je comprends que cette suppression est définitive.
              </label>
              <div className="fiche-actions">
                <Button variante="primaire" className="btn-danger-plein" disabled={!compris || enCours} onClick={() => { void supprimer(); }}>Supprimer définitivement</Button>
                <Button onClick={fermerSuppression}>Annuler</Button>
              </div>
            </>
          ) : null}
        </Dialog>
      </div>
    );
  }

  const carte = (e: Eleve) => (
    <Carte key={e.id} eleve={e} couleur={couleurs.get(e.id) ?? 0} bilan={bilans.get(e.id)} aJour={aJour(e)} onOuvrir={() => setVue({ genre: 'dossier', id: e.id })} />
  );
  const archivesVisibles = archivesOuvertes || (recherche && archives.length > 0);

  return (
    <div className="page">
      {entete}
      <section className="liste-carte">
        <div className="liste-entete">
          <h2 className="liste-entete-titre">{nbActifs ? pluriel(nbActifs, 'élève') : 'Aucun élève'}</h2>
          <div className="liste-entete-actions">
            {nbActifs ? <Button onClick={() => setVue({ genre: 'passage' })}>Passage d’année</Button> : null}
            <Button variante="primaire" onClick={() => setVue({ genre: 'fiche', eleve: vide(eleves), retour: { genre: 'liste' } })}>Nouvel élève</Button>
          </div>
        </div>

        {eleves.length ? (
          <div className="eleves-recherche">
            <Input type="search" value={requete} placeholder="Nom, classe, matière, langue…" aria-label="Rechercher un élève" onChange={(ev) => setRequete(ev.target.value)} />
            {recherche ? <p className="field-hint" aria-live="polite">{trouves.length ? `${pluriel(trouves.length, 'dossier')} trouvé${trouves.length > 1 ? 's' : ''}` : 'Aucun dossier ne correspond.'}</p> : null}
          </div>
        ) : null}

        {actifs.length ? <ul className="cartes-eleves">{actifs.map(carte)}</ul> : (
          !eleves.length ? <p className="vide-texte vide-pad">Ajoutez un premier élève pour préparer une séance.</p>
            : !recherche ? <p className="vide-texte vide-pad">Tous les élèves sont archivés.</p> : null
        )}
      </section>

      {eleves.some((e) => e.archiveLe) ? (
        <details className="liste-carte archives" open={archivesVisibles} onToggle={(ev) => setArchivesOuvertes(ev.currentTarget.open)}>
          <summary>Élèves archivés ({archives.length}{recherche ? ` trouvé${archives.length > 1 ? 's' : ''}` : ''})</summary>
          {archives.length ? <ul className="cartes-eleves">{archives.map(carte)}</ul> : <p className="vide-texte vide-pad">Aucun élève archivé ne correspond.</p>}
        </details>
      ) : null}
    </div>
  );
}
