import { useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { exempleDemo } from '../../data/demo.ts';
import { aEncoder, basculerMemo, creerMemo, deplacements, journeeDu, lignesSuite, memosDuCreneau, retirerMemo, viderFaits } from '../../domain/accueil/index.ts';
import type { Creneau, Deplacement, Memo } from '../../domain/accueil/index.ts';
import { PERIODES_AGENDA, ajouterJours, jourComplet, seanceDuCreneau } from '../../domain/agenda/index.ts';
import type { Occurrence } from '../../domain/agenda/index.ts';
import { defautsSeance } from '../../domain/referentiel/index.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { estDemo } from '../../domain/synchro/cles.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { useSynchro } from '../../synchro/service.ts';
import type { Synchro } from '../../synchro/service.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { Input, Select } from '../../ui/Field.tsx';
import { IconeAgenda, IconeChevron } from '../../ui/icons.tsx';
import { useToast } from '../../ui/Toast.tsx';
import type { Aller } from '../../app/useRoute.ts';
import { aujourdhuiISO } from '../seance/brouillon.ts';

const majuscule = (s: string): string => s.charAt(0).toUpperCase() + s.slice(1);
const maintenantMin = (): number => { const d = new Date(); return d.getHours() * 60 + d.getMinutes(); };
const quand = (iso: string): string => {
  const d = new Date(iso);
  return !iso || Number.isNaN(d.getTime()) ? 'date inconnue' : d.toLocaleString('fr-BE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

function PhraseTrajet({ d }: { d: Deplacement }) {
  const libre = d.ecart < 0 ? 'ces deux rendez-vous se chevauchent' : d.ecart === 0 ? 'aucun temps libre entre les deux' : `${d.ecart} min libres entre les deux`;
  return (
    <li className="trajet" data-serre={d.serre}>
      <span className="trajet-fleche" aria-hidden="true">↓</span>
      <span className="trajet-texte">
        Trajet de <strong>{d.de.ecole.nom}</strong> à <strong>{d.vers.ecole.nom}</strong> : {libre}, trajet prévu {d.trajet} min.
      </span>
      {d.ecart < 0 ? <Badge ton="danger">Chevauchement</Badge> : d.serre ? <Badge ton="attention">Trop serré</Badge> : <Badge ton="ok">Assez de temps</Badge>}
    </li>
  );
}

interface PropsAccueil { magasin: Magasin; synchro: Synchro; onAller: Aller }

export function Accueil({ magasin, synchro, onAller }: PropsAccueil) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const activites = useMagasin(magasin, (e) => e.activites);
  const ecoles = useMagasin(magasin, (e) => e.ecoles);
  const trajet = useMagasin(magasin, (e) => e.trajet);
  const memos = useMagasin(magasin, (e) => e.memos);
  const sync = useSynchro(synchro, (x) => x);
  const { annoncer } = useToast();
  const [confirmer, setConfirmer] = useState(false);
  const [texteMemo, setTexteMemo] = useState('');
  const [cibleMemo, setCibleMemo] = useState('');
  /* undefined = choix par défaut (le prochain rendez-vous) ; null = tout replié ; sinon la clé du rendez-vous déplié. */
  const [choix, setChoix] = useState<string | null | undefined>(undefined);

  const aujourdhui = aujourdhuiISO();
  const nbDemo = eleves.filter((e) => estDemo(e.id)).length + activites.filter((a) => estDemo(a.id)).length;
  const chargerDemo = async () => { await magasin.chargerExemple(exempleDemo(aujourdhui)); annoncer('Données de démonstration chargées'); };
  const effacerDemo = async () => {
    if (!confirmer) { setConfirmer(true); return; }
    const b = await magasin.effacerDemo();
    setConfirmer(false);
    annoncer(`Démonstration effacée : ${b.eleves} élèves, ${b.seances} séances, ${b.activites} rendez-vous`);
  };

  /* Le jour affiché : aujourd'hui, ou à défaut le prochain jour où quelque chose est prévu (dans les deux semaines). */
  const jour = useMemo(() => {
    for (let i = 0; i < 15; i++) {
      const date = ajouterJours(aujourdhui, i);
      const creneaux = journeeDu(date, activites, seances, eleves, ecoles);
      if (creneaux.length) return { date, creneaux };
    }
    return { date: aujourdhui, creneaux: [] as Creneau[] };
  }, [aujourdhui, activites, seances, eleves, ecoles]);
  const changements = useMemo(() => deplacements(jour.creneaux, trajet), [jour.creneaux, trajet]);
  const retard = useMemo(() => aEncoder(aujourdhui, activites, seances), [aujourdhui, activites, seances]);
  const aujourdhuiMeme = jour.date === aujourdhui;
  /* Un seul rendez-vous est déplié à la fois : par défaut le prochain rendez-vous d'élève (pas encore passé, pas encore encodé) ; un toucher en déplie un autre. */
  const prochain = jour.creneaux.find((c) => c.occ.activite.type === 'eleve' && c.occ.statut !== 'realise' && !(aujourdhuiMeme && c.finMin !== null && c.finMin < maintenantMin()));
  const plusieursEcoles = ecoles.length > 1;

  const ouvertCle = choix === undefined ? (prochain?.occ.cle ?? null) : choix;

  const encoder = (o: Occurrence) => {
    const el = eleves.find((e) => e.id === o.activite.eleveId);
    magasin.preparerSeance({
      eleveId: o.activite.eleveId ?? '', date: o.date, periodeDebut: PERIODES_AGENDA[o.debut]!.label, periodeFin: PERIODES_AGENDA[o.fin]!.label,
      matiere: o.activite.matiere ?? '', ...defautsSeance(el)
    });
    onAller('seance');
  };
  const ouvrir = (o: Occurrence) => {
    const s = o.seanceId ? seances.find((x) => x.id === o.seanceId) : seanceDuCreneau(o.activite, o.date, o.debut, o.fin, seances);
    if (!s) return;
    magasin.preparerSeance(s);
    onAller('seance');
  };

  const nomEleve = (id: string): string => { const e = eleves.find((x) => x.id === id); return e ? `${e.prenom} ${e.nom}`.trim() : 'Élève'; };
  const cibleDe = (m: Memo): string => (m.eleveId ? nomEleve(m.eleveId) : m.ecoleId ? (ecoles.find((e) => e.id === m.ecoleId)?.nom ?? 'École') : '');
  /** Toujours à partir de la liste du moment (pas de celle de l'écran) : deux gestes rapprochés ne s'écrasent pas. */
  const changerMemos = (f: (liste: Memo[]) => Memo[]) => { void magasin.enregistrerMemos(f(magasin.lire().memos)).catch(() => annoncer('Le mémo n’a pas pu être enregistré')); };
  const ajouterMemo = (ev: FormEvent) => {
    ev.preventDefault();
    const [genre, id] = [cibleMemo.slice(0, 1), cibleMemo.slice(2)];
    const m = creerMemo(texteMemo, genre === 'e' ? { eleveId: id } : genre === 'c' ? { ecoleId: id } : {});
    if (!m) return;
    changerMemos((l) => [m, ...l]);
    setTexteMemo('');
    setCibleMemo('');
  };
  const memosTries = [...memos].sort((a, b) => Number(a.fait) - Number(b.fait));
  const nbFaits = memos.filter((m) => m.fait).length;
  const elevesActifs = eleves.filter((e) => !e.archiveLe).sort((a, b) => a.nom.localeCompare(b.nom, 'fr') || a.prenom.localeCompare(b.prenom, 'fr'));

  return (
    <div className="page">
      <header className="page-entete">
        <h1>Bonjour</h1>
        <p className="page-sous-titre">{majuscule(jourComplet(aujourdhui))}</p>
      </header>

      {!eleves.length ? (
        <section className="vide">
          <h2>Aucun élève pour l’instant</h2>
          <p>Chargez les données de démonstration (deux élèves fictifs, des séances, un agenda et un PIA) pour tout essayer sans compte et sans données réelles. Rien ne quitte votre appareil.</p>
          <Button variante="primaire" onClick={() => { void chargerDemo(); }}>Charger les données de démonstration</Button>
          <p className="synchro-discret">Vous utilisiez la V75 ? <a href="#/reprise">Reprendre mes données de la V75</a>.</p>
        </section>
      ) : (
        <>
          {retard.length ? (
            <details className="rattrapage">
              <summary>
                <Badge ton="attention">{retard.length}</Badge>
                <span>{retard.length > 1 ? 'séances passées pas encore encodées' : 'séance passée pas encore encodée'}</span>
              </summary>
              <ul className="rattrapage-liste">
                {retard.map((o) => (
                  <li key={o.cle}>
                    <span className="num">{dateFR(o.date)}</span>
                    <span>{nomEleve(o.activite.eleveId ?? '')}{o.activite.matiere ? ` — ${o.activite.matiere}` : ''}</span>
                    <Button onClick={() => encoder(o)}>Encoder</Button>
                  </li>
                ))}
              </ul>
            </details>
          ) : null}

          <div className="accueil-grille">
            <section className="liste-carte journee" aria-labelledby="titre-journee">
              <div className="liste-entete">
                <div>
                  <h2 id="titre-journee">{aujourdhuiMeme ? 'Ma journée' : 'Prochains rendez-vous'}</h2>
                  <p className="journee-date">{majuscule(jourComplet(jour.date))}</p>
                </div>
                <Button variante="discret" onClick={() => onAller('agenda')}><IconeAgenda taille={16} /> Agenda</Button>
              </div>
              {jour.creneaux.length ? (
                <ol className="creneaux">
                  {jour.creneaux.flatMap((c) => {
                    const o = c.occ;
                    const realise = o.statut === 'realise';
                    const eleveType = o.activite.type === 'eleve' && Boolean(o.activite.eleveId);
                    const passe = aujourdhuiMeme && c.finMin !== null && c.finMin < maintenantMin();
                    const attendu = eleveType && !realise && passe;
                    const rappel = c.suite ? lignesSuite(c.suite) : [];
                    const siens = memosDuCreneau(memos, o.activite.eleveId, c.ecole.id);
                    const trajetApres = changements.find((d) => d.de === c);
                    const aDetail = rappel.length > 0 || siens.length > 0;
                    const ouvert = aDetail && ouvertCle === o.cle;
                    const quandSeance = c.suite ? `Dernière séance : ${dateFR(c.suite.date)}${c.suite.matiere ? ` · ${c.suite.matiere}` : ''}` : '';
                    const sousLigne = [o.activite.matiere, o.activite.lieu, c.suite && !rappel.length ? `dernière séance le ${dateFR(c.suite.date)}` : ''].filter(Boolean).join(' · ') || (o.activite.type === 'eleve' ? '' : 'Hors accompagnement d’élève');
                    const tete = (
                      <>
                        <span className="creneau-heure">
                          <span className="num">{c.heures || PERIODES_AGENDA[o.debut]?.label}</span>
                          {plusieursEcoles ? <small>{c.ecole.nom}</small> : null}
                        </span>
                        <span className="creneau-corps">
                          <span className="creneau-titre">{c.nom}</span>
                          {sousLigne ? <span className="creneau-detail">{sousLigne}</span> : null}
                        </span>
                        <span className="creneau-signes">
                          {realise ? <Badge ton="ok">Séance encodée</Badge> : attendu ? <Badge ton="attention">À encoder</Badge> : null}
                          {siens.length ? <Badge ton="attention">{siens.length} mémo{siens.length > 1 ? 's' : ''}</Badge> : null}
                          {aDetail ? <IconeChevron className="creneau-chevron" /> : null}
                        </span>
                      </>
                    );
                    const carte = (
                      <li key={o.cle} className="creneau" data-statut={realise ? 'realise' : attendu ? 'attendu' : 'prevu'} data-ouvert={ouvert}>
                        {aDetail ? (
                          <button type="button" className="creneau-tete" aria-expanded={ouvert} aria-controls={`detail-${o.cle}`} onClick={() => setChoix(ouvert ? null : o.cle)}>{tete}</button>
                        ) : <div className="creneau-tete">{tete}</div>}
                        <div className="creneau-action">
                          {eleveType ? (realise ? <Button onClick={() => ouvrir(o)}>Ouvrir</Button> : <Button variante={attendu ? 'primaire' : 'secondaire'} onClick={() => encoder(o)}>Encoder</Button>) : null}
                        </div>
                        {ouvert ? (
                          <div className="creneau-ouvert" id={`detail-${o.cle}`}>
                            {rappel.length ? (
                              <div className="creneau-suite">
                                <p className="creneau-suite-titre">{quandSeance}</p>
                                {rappel.map((l) => <p key={l.etiquette}><span className="creneau-suite-etiquette">{l.etiquette}</span> {l.texte}</p>)}
                              </div>
                            ) : null}
                            {siens.length ? (
                              <ul className="creneau-memos" aria-label="Mémos pour ce rendez-vous">
                                {siens.map((m) => (
                                  <li key={m.id}>
                                    <label><input type="checkbox" checked={m.fait} onChange={() => changerMemos((l) => basculerMemo(l, m.id))} /> <span>{m.texte}</span></label>
                                  </li>
                                ))}
                              </ul>
                            ) : null}
                          </div>
                        ) : null}
                      </li>
                    );
                    return trajetApres ? [carte, <PhraseTrajet key={`${o.cle}-trajet`} d={trajetApres} />] : [carte];
                  })}
                </ol>
              ) : (
                <p className="vide-texte journee-vide">Rien de prévu dans les deux prochaines semaines. Planifiez vos accompagnements dans l’agenda.</p>
              )}
            </section>

            <section className="liste-carte memos" aria-labelledby="titre-memos">
              <div className="liste-entete"><h2 id="titre-memos">Mes mémos</h2></div>
              <form className="memo-ajout" onSubmit={ajouterMemo}>
                <label className="sr-only" htmlFor="memo-texte">Nouveau mémo</label>
                <Input id="memo-texte" value={texteMemo} maxLength={180} placeholder="À ne pas oublier…" onChange={(e) => setTexteMemo(e.target.value)} />
                <label className="sr-only" htmlFor="memo-cible">Pour qui</label>
                <Select id="memo-cible" value={cibleMemo} onChange={(e) => setCibleMemo(e.target.value)}>
                  <option value="">Pour moi</option>
                  <optgroup label="Rappeler à la prochaine séance avec">
                    {elevesActifs.map((e) => <option key={e.id} value={`e:${e.id}`}>{e.prenom} {e.nom}</option>)}
                  </optgroup>
                  {plusieursEcoles ? <optgroup label="Rappeler dans l’école">{ecoles.map((e) => <option key={e.id} value={`c:${e.id}`}>{e.nom}</option>)}</optgroup> : null}
                </Select>
                <Button type="submit" variante="primaire" disabled={!texteMemo.trim()}>Ajouter</Button>
              </form>
              {memosTries.length ? (
                <ul className="memo-liste">
                  {memosTries.map((m) => (
                    <li key={m.id} data-fait={m.fait}>
                      <label>
                        <input type="checkbox" checked={m.fait} onChange={() => changerMemos((l) => basculerMemo(l, m.id))} />
                        <span className="memo-texte">{m.texte}{cibleDe(m) ? <small>{cibleDe(m)}</small> : null}</span>
                      </label>
                      <button type="button" className="memo-retirer" aria-label={`Supprimer le mémo : ${m.texte}`} onClick={() => changerMemos((l) => retirerMemo(l, m.id))}>×</button>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="vide-texte memo-vide">Aucun mémo. Un mémo rattaché à un élève réapparaît dans « Ma journée », sur son prochain rendez-vous.</p>
              )}
              {nbFaits ? <div className="memo-pied"><Button variante="discret" onClick={() => changerMemos(viderFaits)}>Retirer les mémos faits ({nbFaits})</Button></div> : null}
            </section>
          </div>

          <section className="accueil-synchro" aria-label="État de la synchronisation">
            {sync.mode === 'aucun' ? (
              <>
                <p>Pas de synchronisation : vos données restent sur cet appareil.</p>
                <Button variante="discret" onClick={() => onAller('synchro')}>Configurer</Button>
              </>
            ) : sync.reconnexion ? (
              <>
                <p><Badge ton="attention">Session expirée</Badge> Reconnectez-vous à Microsoft pour continuer à synchroniser.</p>
                <Button onClick={() => onAller('synchro')}>Se reconnecter</Button>
              </>
            ) : sync.conflits.length ? (
              <>
                <p><Badge ton="attention">À décider</Badge> {sync.conflits.length} élément{sync.conflits.length > 1 ? 's ont' : ' a'} été modifié{sync.conflits.length > 1 ? 's' : ''} ici et sur OneDrive.</p>
                <Button variante="primaire" onClick={() => onAller('synchro')}>Décider</Button>
              </>
            ) : (
              <>
                <p>
                  {sync.mode === 'demonstration' ? 'Synchronisation de démonstration. ' : ''}
                  {sync.derniere ? <>Dernière synchronisation : {quand(sync.derniere.le)}.</> : 'Pas encore synchronisé depuis cet appareil.'}
                  {sync.derniere?.erreurs.length ? <> <Badge ton="danger">{sync.derniere.erreurs.length} en erreur</Badge></> : null}
                </p>
                <Button variante="discret" disabled={sync.enCours !== null} onClick={() => { void synchro.synchroniser(); }}>{sync.enCours === 'synchronisation' ? 'Synchronisation…' : 'Synchroniser maintenant'}</Button>
              </>
            )}
          </section>
        </>
      )}

      {nbDemo ? (
        <section className="bandeau-demo" aria-label="Données de démonstration">
          <p><strong>Des données de démonstration sont présentes.</strong> Elles sont fictives, n’iront jamais vers votre vrai compte Microsoft, et vous pouvez les effacer sans toucher à vos vraies données.</p>
          <div className="bandeau-demo-actions">
            <Button onClick={() => onAller('synchro')}>Essayer la synchronisation</Button>
            <Button variante={confirmer ? 'primaire' : 'discret'} onClick={() => { void effacerDemo(); }}>{confirmer ? 'Oui, effacer la démonstration' : 'Effacer la démonstration'}</Button>
            {confirmer ? <Button variante="discret" onClick={() => setConfirmer(false)}>Garder</Button> : null}
          </div>
        </section>
      ) : (
        eleves.length ? <p className="page-sous-titre"><Button variante="discret" onClick={() => { void chargerDemo(); }}>Ajouter des données de démonstration</Button></p> : null
      )}
    </div>
  );
}
