import { useMemo, useState } from 'react';
import { useSynchro } from '../../synchro/service.ts';
import type { Synchro } from '../../synchro/service.ts';
import { stockageV75 } from '../../data/stockage-v75.ts';
import { cle } from '../../domain/synchro/cles.ts';
import type { Cle } from '../../domain/synchro/cles.ts';
import { dateFR } from '../../domain/redaction/langue.ts';
import { PRESENCE_LIBELLES } from '../../domain/types.ts';
import { controlerReprise, copieDeReprise, doublonDe, lireCoffreV75, preparerReprise, trouverComptes } from '../../domain/v75/index.ts';
import type { CompteV75, ControleReprise, Ecart, EtatV75, FicheReprise, Reprise } from '../../domain/v75/index.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { appliquerRestauration, preparerRestauration } from '../../synchro/secours.ts';
import { Badge } from '../../ui/Badge.tsx';
import { Button } from '../../ui/Button.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { aujourdhuiISO } from '../seance/brouillon.ts';
import type { Aller } from '../../app/useRoute.ts';

const pluriel = (n: number, un: string, plusieurs = `${un}s`): string => `${n} ${n > 1 ? plusieurs : un}`;

/** D'où viennent les données lues : du stockage de la V75 sur cet appareil, ou des dossiers de la V75 dans OneDrive. */
type Source = 'appareil' | 'onedrive';

interface Plan {
  source: Source;
  compte: CompteV75;
  reprise: Reprise;
  /** Enregistrements de la V75 qui n'ont pas pu être relus (abîmés). */
  illisibles: Ecart[];
  /** Pour chaque élément repris : déjà présent à l'identique, différent, ou absent de la V2. */
  manquants: ReadonlySet<Cle>;
  differents: ReadonlySet<Cle>;
  /** Éléments convertis que la V2 a refusés (ne devrait pas arriver). */
  refuses: number;
}

type Etape =
  | { nom: 'depart' }
  | { nom: 'recherche' }
  | { nom: 'aucun'; source: Source }
  | { nom: 'comptes'; comptes: CompteV75[] }
  | { nom: 'lecture' }
  | { nom: 'plan'; plan: Plan }
  | { nom: 'import'; plan: Plan }
  | { nom: 'fini'; plan: Plan; controle: ControleReprise; ajoutes: number };

const quand = (f: FicheReprise): string => (f.premiere ? (f.premiere === f.derniere ? `le ${dateFR(f.premiere)}` : `du ${dateFR(f.premiere)} au ${dateFR(f.derniere)}`) : '');

function statutDe(f: FicheReprise, plan: Plan): { ton: 'ok' | 'attention' | 'neutre'; texte: string; nouveaux: number; presents: number; changes: number } {
  const cles = [cle('eleve', f.eleve.id), ...f.seances.map((s) => cle('seance', s.seance.id)), ...f.activites.map((a) => cle('activite', a.activite.id))];
  const nouveaux = cles.filter((c) => plan.manquants.has(c)).length;
  const changes = cles.filter((c) => plan.differents.has(c)).length;
  const presents = cles.length - nouveaux - changes;
  if (nouveaux === cles.length) return { ton: 'neutre', texte: 'Nouveau dans la V2', nouveaux, presents, changes };
  if (nouveaux === 0 && changes === 0) return { ton: 'ok', texte: 'Déjà repris, identique', nouveaux, presents, changes };
  return { ton: 'attention', texte: changes ? 'Déjà repris en partie, modifié depuis' : 'Déjà repris en partie', nouveaux, presents, changes };
}

function Fiche({ f, plan, coche, onCocher, doublon }: { f: FicheReprise; plan: Plan; coche: boolean; onCocher: (v: boolean) => void; doublon: string | null }) {
  const [copie, setCopie] = useState(false);
  const s = statutDe(f, plan);
  const copier = async () => {
    try { await navigator.clipboard.writeText(f.pia.texte); setCopie(true); setTimeout(() => setCopie(false), 2500); } catch { setCopie(false); }
  };
  return (
    <li className="reprise-fiche">
      <label className="reprise-fiche-entete">
        <input type="checkbox" checked={coche} onChange={(e) => onCocher(e.target.checked)} aria-label={`Reprendre ${f.eleve.nom}`} />
        <span className="reprise-fiche-nom"><strong>{f.eleve.nom}</strong>{f.eleve.classe ? ` · ${f.eleve.classe}` : ''}</span>
        <Badge ton={s.ton}>{s.texte}</Badge>
      </label>
      <p className="reprise-fiche-chiffres">
        {pluriel(f.seances.length, 'séance')}{quand(f) ? ` (${quand(f)})` : ''} · {pluriel(f.activites.length, 'rendez-vous d’agenda', 'rendez-vous d’agenda')}
        {f.eleve.matieres.length || f.eleve.langues?.length ? ` · ${[...f.eleve.matieres, ...(f.eleve.langues ?? [])].join(', ')}` : ''}
      </p>
      {s.presents > 0 && s.nouveaux > 0 ? <p className="synchro-discret">{pluriel(s.presents, 'élément est', 'éléments sont')} déjà dans la V2 : ils ne seront pas touchés, seuls les {s.nouveaux} manquants seront ajoutés.</p> : null}
      {s.changes > 0 ? <p className="synchro-discret">{pluriel(s.changes, 'élément a', 'éléments ont')} changé dans la V2 depuis la dernière reprise : ils sont laissés tels quels, jamais remplacés.</p> : null}
      {doublon ? <p className="synchro-message synchro-message-info" role="note">Un élève qui s’appelle presque pareil existe déjà dans la V2 (« {doublon} »). Si c’est la même personne, ne cochez pas ce dossier pour éviter un doublon.</p> : null}
      {f.eleve.nom.trim().includes(' ') ? <p className="synchro-discret">Le nom est repris entier dans la case « Nom » (la V75 n’avait qu’une case). Vous pourrez séparer prénom et nom dans la fiche de l’élève.</p> : null}
      {f.alertes.length ? <ul className="reprise-alertes">{f.alertes.map((a) => <li key={a}>{a}</li>)}</ul> : null}
      {f.seances.length ? (
        <details>
          <summary>Voir les {f.seances.length} séances reprises</summary>
          <div className="reprise-tableau" role="region" aria-label={`Séances reprises de ${f.eleve.nom}`} tabIndex={0}>
            <table>
              <thead><tr><th scope="col">Date</th><th scope="col">Période</th><th scope="col">Matière</th><th scope="col">Présence</th><th scope="col">Observations</th><th scope="col">Aides</th></tr></thead>
              <tbody>
                {f.seances.map(({ seance }) => (
                  <tr key={seance.id}>
                    <td className="num">{dateFR(seance.date)}</td>
                    <td>{seance.periodeFin !== seance.periodeDebut ? `${seance.periodeDebut} → ${seance.periodeFin}` : seance.periodeDebut}</td>
                    <td>{seance.matiere || '—'}</td>
                    <td>{PRESENCE_LIBELLES[seance.presence].titre}</td>
                    <td className="num">{seance.observations.length}</td>
                    <td className="num">{seance.aides.length}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      ) : null}
      {f.pia.texte ? (
        <details>
          <summary>{f.pia.contenu ? 'PIA et objectifs de la V75 (à recopier dans le PIA de la V2)' : 'Coordonnées notées dans la V75 (CPMS, responsable…)'}</summary>
          <p className="synchro-discret">Le PIA de la V2 est organisé autrement (profil, deux procès-verbaux, aménagements) : il n’est pas converti automatiquement, pour ne rien mal ranger. Voici ce que la V75 avait noté.</p>
          <pre className="reprise-pia">{f.pia.texte}</pre>
          <Button variante="discret" onClick={() => { void copier(); }}>{copie ? 'Copié' : 'Copier ce texte'}</Button>
        </details>
      ) : null}
    </li>
  );
}

export function ReprisePage({ magasin, synchro, essai, onAller }: { magasin: Magasin; synchro: Synchro; essai: boolean; onAller: Aller }) {
  const [etape, setEtape] = useState<Etape>({ nom: 'depart' });
  const [erreur, setErreur] = useState<string | null>(null);
  const [choisis, setChoisis] = useState<ReadonlySet<string>>(new Set());
  const [agendaGeneral, setAgendaGeneral] = useState(true);
  const [horaires, setHoraires] = useState(true);
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const mode = useSynchro(synchro, (e) => e.mode);
  const compteMicrosoft = useSynchro(synchro, (e) => e.compte);
  const reconnexion = useSynchro(synchro, (e) => e.reconnexion);
  const microsoftPossible = useSynchro(synchro, (e) => e.microsoftPossible);
  const [progres, setProgres] = useState('');
  const { annoncer } = useToast();

  const rechercher = async () => {
    setErreur(null); setEtape({ nom: 'recherche' });
    const st = stockageV75();
    try {
      const comptes = await trouverComptes(st);
      setEtape(!comptes.length ? { nom: 'aucun', source: 'appareil' } : comptes.length === 1 ? { nom: 'lecture' } : { nom: 'comptes', comptes });
      if (comptes.length === 1) await lire(comptes[0]!);
    } catch (e) {
      setEtape({ nom: 'depart' });
      setErreur(`La recherche a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}.`);
    } finally { await st.fermer?.(); }
  };

  /** Convertit ce qui a été lu (quelle qu'en soit la source) et le compare à ce qui est déjà dans la V2. */
  const construirePlan = async (compte: CompteV75, source: Source, etat: EtatV75, illisibles: Ecart[]) => {
    const maintenant = new Date().toISOString();
    const reprise = preparerReprise(etat, { aujourdhui: aujourdhuiISO(), maintenant });
    const toutes = copieDeReprise(reprise, { eleves: new Set(reprise.fiches.map((f) => f.eleve.id)), agendaGeneral: true, horaires: true }, maintenant);
    const prevue = await preparerRestauration(magasin, JSON.stringify(toutes));
    if (!prevue.ok) throw new Error(prevue.erreur);
    const plan: Plan = {
      source, compte, reprise, illisibles,
      manquants: new Set(prevue.prevue.comparaison.manquants), differents: new Set(prevue.prevue.comparaison.differents), refuses: prevue.prevue.ignores
    };
    setChoisis(new Set(reprise.fiches.filter((f) => statutDe(f, plan).nouveaux > 0 && !doublonDe(f, eleves)).map((f) => f.eleve.id)));
    setAgendaGeneral(true); setHoraires(true);
    setEtape({ nom: 'plan', plan });
  };

  const lire = async (compte: CompteV75) => {
    setErreur(null); setEtape({ nom: 'lecture' });
    const st = stockageV75();
    try {
      const { etat, illisibles } = await lireCoffreV75(st, compte.id);
      await construirePlan(compte, 'appareil', etat, illisibles);
    } catch (e) {
      setEtape({ nom: 'depart' });
      setErreur(`La lecture a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Rien n’a été modifié.`);
    } finally { await st.fermer?.(); }
  };

  /** Lit les dossiers de la V75 dans OneDrive (lecture seule), avec la connexion Microsoft de la V2. */
  const lireOneDrive = async () => {
    setErreur(null); setProgres(''); setEtape({ nom: 'lecture' });
    try {
      const lu = await synchro.lireV75DansOneDrive(setProgres);
      if (!lu) {
        setEtape({ nom: 'depart' });
        setErreur(`${synchro.lire().message?.texte ?? 'La lecture de OneDrive n’a pas pu se faire.'} Rien n’a été modifié.`);
        return;
      }
      if (!lu.trouve) { setEtape({ nom: 'aucun', source: 'onedrive' }); return; }
      await construirePlan({ id: 'onedrive', nom: compteMicrosoft?.nom ?? 'Compte Microsoft', adresse: compteMicrosoft?.courriel ?? '', eleves: lu.etat.eleves.length, seances: lu.etat.seances.length }, 'onedrive', lu.etat, lu.illisibles);
    } catch (e) {
      setEtape({ nom: 'depart' });
      setErreur(`La lecture a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Rien n’a été modifié.`);
    } finally { setProgres(''); }
  };

  const importer = async (plan: Plan) => {
    setErreur(null); setEtape({ nom: 'import', plan });
    try {
      const copie = copieDeReprise(plan.reprise, { eleves: choisis, agendaGeneral, horaires }, new Date().toISOString());
      const prevue = await preparerRestauration(magasin, JSON.stringify(copie));
      if (!prevue.ok) throw new Error(prevue.erreur);
      const ajoutes = await appliquerRestauration(magasin, prevue.prevue, false);
      const controle = await controlerReprise(copie, await magasin.lireObjets());
      setEtape({ nom: 'fini', plan, controle, ajoutes });
      annoncer(controle.ok ? `Reprise terminée : ${ajoutes} éléments ajoutés` : 'Reprise terminée, mais le contrôle signale une différence');
    } catch (e) {
      setEtape({ nom: 'plan', plan });
      setErreur(`L’import a échoué : ${e instanceof Error ? e.message : 'erreur inconnue'}. Vérifiez ce qui est déjà dans la V2 avant de recommencer : rien n’est jamais supprimé ni remplacé.`);
    }
  };

  const plan = etape.nom === 'plan' || etape.nom === 'import' || etape.nom === 'fini' ? etape.plan : null;
  const resume = useMemo(() => {
    if (!plan) return null;
    const f = plan.reprise.fiches;
    return { eleves: f.length, seances: f.reduce((n, x) => n + x.seances.length, 0), rdv: f.reduce((n, x) => n + x.activites.length, 0) + plan.reprise.agendaGeneral.length };
  }, [plan]);
  const nbChoisis = plan ? plan.reprise.fiches.filter((f) => choisis.has(f.eleve.id)).length : 0;
  const rienACocher = nbChoisis === 0 && !(agendaGeneral && (plan?.reprise.agendaGeneral.length ?? 0) > 0) && !(horaires && plan?.reprise.horaires);

  if (essai) {
    return (
      <div className="page reprise">
        <header className="page-entete"><h1>Reprendre mes données de la V75</h1></header>
        <p className="synchro-message synchro-message-info" role="note">Le mode essai est réservé aux données fictives : on n’y reprend jamais de vraies données d’élèves. Verrouillez le Journalier (bouton « Verrouiller »), puis connectez-vous avec votre compte Microsoft pour reprendre vos données.</p>
      </div>
    );
  }

  return (
    <div className="page reprise">
      <header className="page-entete">
        <h1>Reprendre mes données de la V75</h1>
        <p className="page-sous-titre">Copiez vos élèves, vos séances et votre agenda de la V75 vers la V2. La V75 n’est jamais modifiée : on la lit seulement, et rien n’est importé sans votre accord.</p>
      </header>

      {erreur ? <p className="erreur" role="alert">{erreur}</p> : null}

      <section className="synchro-bloc" aria-labelledby="reprise-1">
        <h2 id="reprise-1">1. Trouver mes données</h2>
        <p className="synchro-discret">Avant de commencer, dans la V75 : faites une dernière synchronisation et, si vous le pouvez, gardez une copie de vos documents Word. Rien n’est supprimé dans la V75.</p>
        <p>Deux endroits possibles. Si vos données de la V75 sont anciennes sur cet appareil, <strong>OneDrive est le plus sûr</strong> : c’est là que la V75 envoyait ses copies. Vous pouvez aussi lire les deux, l’un après l’autre : un élève ou une séance présent dans les deux n’est jamais dupliqué.</p>

        <div className="reprise-source">
          <h3>Dans OneDrive (les dossiers de la V75)</h3>
          {mode === 'microsoft' && !reconnexion ? (
            <p className="synchro-discret">Connecté en tant que <strong>{compteMicrosoft?.nom}</strong>{compteMicrosoft?.courriel ? ` (${compteMicrosoft.courriel})` : ''}. Il faut que ce soit le compte Microsoft utilisé dans la V75. La V2 ne fait que lire : rien n’est modifié ni supprimé dans OneDrive.</p>
          ) : mode === 'demonstration' ? (
            <p className="synchro-discret">Indisponible en démonstration : il faut un vrai compte Microsoft (verrouillez le Journalier puis connectez-vous avec votre compte).</p>
          ) : !microsoftPossible ? (
            <p className="synchro-discret">Indisponible en mode essai : il faut un vrai compte Microsoft.</p>
          ) : reconnexion ? (
            <p className="synchro-discret">Votre session Microsoft a expiré : reconnectez-vous d’abord.</p>
          ) : (
            <p className="synchro-discret">Il faut d’abord vous connecter avec le compte Microsoft utilisé dans la V75.</p>
          )}
          {etape.nom === 'depart' || etape.nom === 'aucun' ? (
            <div className="synchro-actions">
              {mode === 'microsoft' && !reconnexion
                ? <Button variante="primaire" onClick={() => { void lireOneDrive(); }}>Lire le OneDrive de la V75</Button>
                : microsoftPossible && mode !== 'demonstration'
                  ? <Button variante="primaire" onClick={() => { void synchro.connecter(); }}>{reconnexion ? 'Se reconnecter' : 'Se connecter avec Microsoft'}</Button>
                  : null}
            </div>
          ) : null}
        </div>

        <div className="reprise-source">
          <h3>Sur cet appareil (V75 ouverte dans ce navigateur)</h3>
          <p>La V2 lit aussi le stockage de la V75 directement sur cet ordinateur, dans ce navigateur : ouvrez donc cette page là où vous utilisiez la V75, avec le même navigateur.</p>
          {etape.nom === 'depart' || etape.nom === 'aucun' ? <div className="synchro-actions"><Button variante="secondaire" onClick={() => { void rechercher(); }}>Chercher mes données de la V75 sur cet appareil</Button></div> : null}
        </div>

        {etape.nom === 'recherche' ? <p role="status">Recherche en cours…</p> : null}
        {etape.nom === 'lecture' ? <p role="status">{progres || 'Lecture des données de la V75…'}</p> : null}
        {etape.nom === 'aucun' && etape.source === 'appareil' ? (
          <p className="synchro-message synchro-message-info" role="status">Aucune donnée de la V75 n’a été trouvée sur cet appareil. Soit vous utilisiez la V75 sur un autre ordinateur ou un autre navigateur, soit son stockage a été vidé. Essayez la lecture dans OneDrive, ou ouvrez la V2 là où vous utilisiez la V75.</p>
        ) : null}
        {etape.nom === 'aucun' && etape.source === 'onedrive' ? (
          <p className="synchro-message synchro-message-info" role="status">Aucune donnée de la V75 n’a été trouvée dans le OneDrive de ce compte. Vérifiez que vous êtes connecté avec le compte Microsoft de la V75 (écran Synchro), ou que la V75 a bien synchronisé. Sinon, essayez la lecture sur l’appareil où vous utilisiez la V75.</p>
        ) : null}
        {etape.nom === 'comptes' ? (
          <>
            <p>Plusieurs coffres de la V75 existent sur cet appareil. Lequel est le vôtre ?</p>
            <ul className="reprise-comptes">
              {etape.comptes.map((c) => (
                <li key={c.id}>
                  <div><strong>{c.nom}</strong>{c.adresse ? ` (${c.adresse})` : ''}<br /><span className="synchro-discret">{pluriel(c.eleves, 'élève')}, {pluriel(c.seances, 'séance')}</span></div>
                  <Button variante="primaire" onClick={() => { void lire(c); }}>Lire celui-ci</Button>
                </li>
              ))}
            </ul>
          </>
        ) : null}
        {plan ? <p className="synchro-message synchro-message-ok" role="status">{plan.source === 'onedrive' ? 'OneDrive de la V75 lu' : 'Coffre de la V75 lu'} : <strong>{plan.compte.nom}</strong>{plan.compte.adresse ? ` (${plan.compte.adresse})` : ''}. {resume ? `${pluriel(resume.eleves, 'élève')}, ${pluriel(resume.seances, 'séance')} reprises, ${pluriel(resume.rdv, 'rendez-vous d’agenda', 'rendez-vous d’agenda')}.` : ''}</p> : null}
      </section>

      {plan ? (
        <>
          {plan.source === 'onedrive' ? (
            <p className="synchro-message synchro-message-info" role="note">
              Ce qui est affiché ici est ce que la V75 a réussi à envoyer dans OneDrive. D’après la lecture de son code, la V75 refuse d’envoyer certaines séances (celles qui contiennent une présence ou des notes de classe) et certains dossiers d’élèves : s’il en manque ici, lisez aussi « Sur cet appareil » ensuite. Rien n’est dupliqué : ce qui est déjà repris est reconnu.
            </p>
          ) : null}
          {plan.illisibles.length ? (
            <section className="synchro-message synchro-message-erreur" role="alert">
              <p><strong>{pluriel(plan.illisibles.length, 'enregistrement de la V75 est illisible', 'enregistrements de la V75 sont illisibles')}</strong> (abîmés) et ne peuvent pas être repris :</p>
              <ul>{plan.illisibles.map((x) => <li key={x.quoi}>{x.quoi} — {x.raison}</li>)}</ul>
            </section>
          ) : null}
          {plan.refuses ? <p className="synchro-message synchro-message-erreur" role="alert">{pluriel(plan.refuses, 'élément converti a été refusé', 'éléments convertis ont été refusés')} par la V2. Ne continuez pas avant d’en avoir parlé : c’est une anomalie de la conversion.</p> : null}

          <section className="synchro-bloc" aria-labelledby="reprise-2">
            <h2 id="reprise-2">2. Vérifier élève par élève</h2>
            <p>Cochez les élèves à reprendre. Ouvrez « Voir les séances » pour comparer avec la V75 : dates, matières, présences. Un élève déjà repris n’est jamais dupliqué.</p>
            {!plan.reprise.fiches.length ? <p className="vide-texte">Aucun élève n’a pu être repris de ce coffre.</p> : null}
            <ul className="reprise-fiches">
              {plan.reprise.fiches.map((f) => (
                <Fiche key={f.eleve.id} f={f} plan={plan} coche={choisis.has(f.eleve.id)} doublon={doublonDe(f, eleves) ? `${doublonDe(f, eleves)!.prenom} ${doublonDe(f, eleves)!.nom}`.trim() : null}
                  onCocher={(v) => setChoisis((avant) => { const n = new Set(avant); if (v) n.add(f.eleve.id); else n.delete(f.eleve.id); return n; })} />
              ))}
            </ul>

            {plan.reprise.agendaGeneral.length ? (
              <label className="synchro-case">
                <input type="checkbox" checked={agendaGeneral} onChange={(e) => setAgendaGeneral(e.target.checked)} />
                <span>Reprendre aussi les {pluriel(plan.reprise.agendaGeneral.length, 'rendez-vous', 'rendez-vous')} qui ne concernent pas un élève (réunions, formations, administratif…)</span>
              </label>
            ) : null}
            {plan.reprise.horaires ? (
              <label className="synchro-case">
                <input type="checkbox" checked={horaires} onChange={(e) => setHoraires(e.target.checked)} />
                <span>Reprendre les horaires des périodes réglés dans la V75 (seulement si vous n’avez pas déjà réglé les vôtres dans la V2)</span>
              </label>
            ) : null}
          </section>

          {plan.reprise.ecarts.length ? (
            <section className="synchro-bloc" aria-labelledby="reprise-ecarts">
              <h2 id="reprise-ecarts">Ce qui n’a pas pu être repris ({plan.reprise.ecarts.length})</h2>
              <p>Rien n’est perdu dans la V75, mais ces éléments ne peuvent pas entrer dans la V2 tels quels. Notez-les si besoin.</p>
              <ul>{plan.reprise.ecarts.map((x, i) => <li key={`${x.quoi}-${i}`}><strong>{x.quoi}</strong> — {x.raison}</li>)}</ul>
            </section>
          ) : null}

          {etape.nom !== 'fini' ? (
            <section className="synchro-bloc" aria-labelledby="reprise-3">
              <h2 id="reprise-3">3. Importer</h2>
              <p>Seuls les éléments cochés sont ajoutés. Ce qui existe déjà dans la V2 n’est jamais supprimé ni remplacé. Les données importées partiront ensuite vers votre OneDrive avec la synchronisation habituelle (si elle est active).</p>
              <div className="synchro-actions">
                <Button variante="primaire" disabled={etape.nom === 'import' || rienACocher} onClick={() => { void importer(plan); }}>
                  {etape.nom === 'import' ? 'Import en cours…' : nbChoisis ? `Importer ${pluriel(nbChoisis, 'élève')}` : 'Importer'}
                </Button>
              </div>
            </section>
          ) : (
            <section className="synchro-bloc" aria-labelledby="reprise-4">
              <h2 id="reprise-4">Contrôle après import</h2>
              <p className={`synchro-message synchro-message-${etape.controle.ok ? 'ok' : 'erreur'}`} role={etape.controle.ok ? 'status' : 'alert'}>
                {etape.controle.ok
                  ? `Tout est en place : ${pluriel(etape.ajoutes, 'élément ajouté', 'éléments ajoutés')}, et chacun a été relu dans la V2.`
                  : 'Le contrôle a trouvé une différence : regardez la liste ci-dessous avant de continuer.'}
              </p>
              <div className="reprise-tableau" role="region" aria-label="Contrôle élève par élève" tabIndex={0}>
                <table>
                  <thead><tr><th scope="col">Élève</th><th scope="col">Séances</th><th scope="col">Agenda</th><th scope="col">Résultat</th></tr></thead>
                  <tbody>
                    {etape.controle.eleves.map((c) => (
                      <tr key={c.eleveId}>
                        <td>{c.nom}</td>
                        <td className="num">{c.seances.trouvees} / {c.seances.attendues}</td>
                        <td className="num">{c.activites.trouvees} / {c.activites.attendues}</td>
                        <td>{c.ok ? <Badge ton="ok">En place</Badge> : <Badge ton="danger">{c.differents ? 'Contenu différent' : 'Incomplet'}</Badge>}</td>
                      </tr>
                    ))}
                    {etape.controle.agendaGeneral.attendues ? (
                      <tr><td>Agenda sans élève</td><td className="num">—</td><td className="num">{etape.controle.agendaGeneral.trouvees} / {etape.controle.agendaGeneral.attendues}</td><td>{etape.controle.agendaGeneral.trouvees === etape.controle.agendaGeneral.attendues ? <Badge ton="ok">En place</Badge> : <Badge ton="danger">Incomplet</Badge>}</td></tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
              <div className="synchro-actions">
                <Button variante="primaire" onClick={() => onAller('eleves')}>Voir mes élèves</Button>
                <Button onClick={() => onAller('journalier')}>Voir le Journalier</Button>
                <Button variante="discret" onClick={() => onAller('agenda')}>Voir l’agenda</Button>
                <Button variante="discret" onClick={() => { setErreur(null); setEtape({ nom: 'depart' }); window.scrollTo?.({ top: 0 }); }}>Lire une autre source (OneDrive ou cet appareil)</Button>
              </div>
              <p className="synchro-discret">Pensez à ouvrir quelques séances au Journalier et à les comparer avec la V75 avant de cesser de l’utiliser.</p>
            </section>
          )}
        </>
      ) : null}
    </div>
  );
}
