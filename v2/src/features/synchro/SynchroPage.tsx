import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { LONGUEUR_MINIMALE_MOT_DE_PASSE, verifierMotDePasse } from '../../domain/coffre/index.ts';
import { NOM_COPIE } from '../../synchro/secours.ts';
import type { RestaurationPrevue } from '../../synchro/secours.ts';
import { useSynchro } from '../../synchro/service.ts';
import type { Synchro } from '../../synchro/service.ts';
import type { ConflitAffiche } from '../../synchro/synchroniser.ts';
import type { NomDansOutlook } from '../../domain/synchro/outlook.ts';
import { Button } from '../../ui/Button.tsx';
import { Field, Input } from '../../ui/Field.tsx';
import { aujourdhuiISO } from '../seance/brouillon.ts';

const quand = (iso: string): string => {
  if (!iso) return 'date inconnue';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? 'date inconnue' : d.toLocaleString('fr-BE', { day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit' });
};

function Section({ titre, children, id }: { titre: string; children: ReactNode; id: string }) {
  return (
    <section className="synchro-bloc" aria-labelledby={id}>
      <h2 id={id}>{titre}</h2>
      {children}
    </section>
  );
}

function Conflit({ c, synchro, occupe }: { c: ConflitAffiche; synchro: Synchro; occupe: boolean }) {
  const ligne = c.genre === 'supprimeDistant'
    ? 'Supprimé dans OneDrive, mais vous l’avez modifié ici.'
    : c.genre === 'supprimeLocal'
      ? 'Supprimé ici, mais modifié dans OneDrive.'
      : 'Modifié ici et dans OneDrive.';
  return (
    <li className="conflit">
      <div>
        <strong>{c.etiquette}</strong>
        <p>{ligne}</p>
        <p className="synchro-discret">Ici : {quand(c.ici)} · OneDrive : {quand(c.la)}</p>
        {c.liees.length ? <p className="synchro-discret">Concerne aussi : {c.liees.length} élément{c.liees.length > 1 ? 's' : ''} lié{c.liees.length > 1 ? 's' : ''} (séances, agenda, PIA).</p> : null}
      </div>
      <div className="conflit-actions">
        <Button disabled={occupe} onClick={() => { void synchro.resoudre(c, 'ici'); }}>Garder ce qui est ici</Button>
        <Button disabled={occupe} onClick={() => { void synchro.resoudre(c, 'la'); }}>Prendre ce qui est dans OneDrive</Button>
      </div>
    </li>
  );
}

function CopieDeSecours({ synchro }: { synchro: Synchro }) {
  const champ = useRef<HTMLInputElement>(null);
  const [prevue, setPrevue] = useState<RestaurationPrevue | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [occupe, setOccupe] = useState(false);
  // Enregistrer : mot de passe facultatif (saisi deux fois).
  const [protegee, setProtegee] = useState(false);
  const [mdp, setMdp] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [erreurMdp, setErreurMdp] = useState<string | null>(null);
  // Restaurer : un fichier chiffré attend son mot de passe.
  const [enAttente, setEnAttente] = useState<string | null>(null);
  const [mdpRestauration, setMdpRestauration] = useState('');

  const exporter = async () => {
    setErreur(null); setErreurMdp(null);
    if (protegee) {
      const probleme = verifierMotDePasse(mdp) ?? (mdp !== confirmation ? 'Les deux mots de passe ne sont pas identiques.' : null);
      if (probleme) { setErreurMdp(probleme); return; }
    }
    setOccupe(true);
    try {
      const texte = await synchro.preparerCopie(protegee ? mdp : undefined);
      const lien = document.createElement('a');
      lien.href = URL.createObjectURL(new Blob([texte], { type: 'application/json' }));
      lien.download = NOM_COPIE(aujourdhuiISO(), protegee);
      lien.click();
      setTimeout(() => URL.revokeObjectURL(lien.href), 1000);
      setMdp(''); setConfirmation('');
    } catch (e) { setErreur(`La copie n’a pas pu être préparée : ${e instanceof Error ? e.message : 'erreur inconnue'}.`); } finally { setOccupe(false); }
  };
  const lire = async (texte: string, motDePasse?: string) => {
    setOccupe(true);
    try {
      const r = await synchro.preparerRestauration(texte, motDePasse);
      if (r.ok) { setPrevue(r.prevue); setEnAttente(null); setMdpRestauration(''); setErreur(null); }
      else if (r.motDePasseRequis) { setEnAttente(texte); setErreur(motDePasse ? r.erreur : null); }
      else { setEnAttente(null); setErreur(r.erreur); }
    } finally { setOccupe(false); }
  };
  const choisir = async (fichier: File | undefined) => {
    setErreur(null); setPrevue(null); setEnAttente(null); setMdpRestauration('');
    if (!fichier) return;
    if (fichier.size > 50_000_000) { setErreur('Ce fichier est trop gros pour être une copie du Journalier.'); return; }
    await lire(await fichier.text());
    if (champ.current) champ.current.value = '';
  };
  const appliquer = async (remplacer: boolean) => { if (prevue) { await synchro.restaurer(prevue, remplacer); setPrevue(null); } };

  return (
    <Section id="synchro-copie" titre="Copie de secours (sans compte)">
      <p>Un seul fichier avec tout votre Journalier, à garder sur votre ordinateur. Utile si OneDrive n’est pas disponible, ou pour passer d’un appareil à l’autre à la main. Vous venez de la V75 ? <a href="#/reprise">Reprendre mes données de la V75</a>.</p>
      <label className="synchro-case">
        <input type="checkbox" checked={protegee} onChange={(ev) => { setProtegee(ev.target.checked); setErreurMdp(null); }} />
        <span>Protéger la copie par un mot de passe (recommandé : sans mot de passe, quiconque ouvre le fichier lit les noms et les observations)</span>
      </label>
      {protegee ? (
        <div className="synchro-champs">
          <Field label="Mot de passe de la copie" aide={`Au moins ${LONGUEUR_MINIMALE_MOT_DE_PASSE} caractères. Il n’est enregistré nulle part : s’il est perdu, la copie est définitivement illisible.`}>
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={mdp} onChange={(ev) => setMdp(ev.target.value)} />}
          </Field>
          <Field label="Confirmer le mot de passe">
            {(id) => <Input id={id} type="password" autoComplete="new-password" value={confirmation} onChange={(ev) => setConfirmation(ev.target.value)} />}
          </Field>
          {erreurMdp ? <p className="erreur" role="alert">{erreurMdp}</p> : null}
        </div>
      ) : null}
      <div className="synchro-actions">
        <Button disabled={occupe} onClick={() => { void exporter(); }}>{occupe && protegee ? 'Chiffrement…' : 'Enregistrer une copie'}</Button>
        <Button disabled={occupe} onClick={() => champ.current?.click()}>Restaurer une copie…</Button>
        <input ref={champ} type="file" accept=".json,application/json" hidden aria-label="Choisir un fichier de copie" onChange={(e) => { void choisir(e.target.files?.[0]); }} />
      </div>
      {enAttente ? (
        <div className="synchro-restauration" role="region" aria-label="Copie protégée par un mot de passe">
          <p><strong>Cette copie est protégée par un mot de passe.</strong></p>
          <Field label="Mot de passe de la copie">
            {(id) => <Input id={id} type="password" autoComplete="off" value={mdpRestauration} onChange={(ev) => setMdpRestauration(ev.target.value)} />}
          </Field>
          <div className="synchro-actions">
            <Button variante="primaire" disabled={occupe || !mdpRestauration} onClick={() => { void lire(enAttente, mdpRestauration); }}>{occupe ? 'Ouverture…' : 'Ouvrir la copie'}</Button>
            <Button variante="discret" disabled={occupe} onClick={() => { setEnAttente(null); setMdpRestauration(''); setErreur(null); }}>Annuler</Button>
          </div>
        </div>
      ) : null}
      {erreur ? <p className="erreur" role="alert">{erreur}</p> : null}
      {prevue ? (
        <div className="synchro-restauration" role="region" aria-label="Aperçu de la restauration">
          <p><strong>Dans ce fichier :</strong> {prevue.comparaison.manquants.length} élément{prevue.comparaison.manquants.length > 1 ? 's' : ''} qui manque{prevue.comparaison.manquants.length > 1 ? 'nt' : ''} ici, {prevue.comparaison.differents.length} différent{prevue.comparaison.differents.length > 1 ? 's' : ''}, {prevue.comparaison.identiques} identique{prevue.comparaison.identiques > 1 ? 's' : ''}{prevue.ignores ? `, ${prevue.ignores} abîmé${prevue.ignores > 1 ? 's' : ''} (ignoré${prevue.ignores > 1 ? 's' : ''})` : ''}.</p>
          <p className="synchro-discret">Rien n’est jamais supprimé par une restauration.</p>
          <div className="synchro-actions">
            <Button variante="primaire" disabled={!prevue.comparaison.manquants.length} onClick={() => { void appliquer(false); }}>Ajouter ce qui manque</Button>
            <Button disabled={!prevue.comparaison.differents.length} onClick={() => { void appliquer(true); }}>Ajouter et remplacer les différents</Button>
            <Button variante="discret" onClick={() => setPrevue(null)}>Annuler</Button>
          </div>
        </div>
      ) : null}
    </Section>
  );
}

export function SynchroPage({ synchro, adresseRetour }: { synchro: Synchro; adresseRetour: string }) {
  const e = useSynchro(synchro, (x) => x);
  const occupe = e.enCours !== null;
  const demo = e.mode === 'demonstration';
  const noms: Record<NomDansOutlook, string> = { aucun: 'Aucun nom (« Accompagnement »)', initiales: 'Initiales de l’élève', prenom: 'Prénom de l’élève' };

  return (
    <div className="page synchro">
      <header className="page-entete">
        <h1>Synchronisation</h1>
        <p className="page-sous-titre">Gardez vos données sur OneDrive et votre agenda dans Outlook. Vous restez maître : rien n’est écrasé sans votre accord.</p>
      </header>

      {e.message ? <p className={`synchro-message synchro-message-${e.message.genre}`} role={e.message.genre === 'erreur' ? 'alert' : 'status'}>{e.message.texte}</p> : null}

      <Section id="synchro-compte" titre="Compte">
        {e.mode === 'aucun' ? (
          <>
            <p>Pas de synchronisation pour l’instant : tout reste sur cet appareil.</p>
            <div className="synchro-actions">
              {e.microsoftPossible ? <Button variante="primaire" disabled={occupe} onClick={() => { void synchro.connecter(); }}>{e.enCours === 'connexion' ? 'Fenêtre Microsoft ouverte…' : 'Se connecter avec Microsoft'}</Button> : null}
              <Button variante={e.microsoftPossible ? 'secondaire' : 'primaire'} disabled={occupe} onClick={() => synchro.utiliserDemonstration()}>Essayer en démonstration (sans compte)</Button>
              {e.enCours === 'connexion' ? <Button variante="discret" onClick={() => synchro.annulerConnexion()}>Annuler</Button> : null}
            </div>
            <p className="synchro-discret">La démonstration utilise un faux OneDrive et un faux Outlook, gardés (chiffrés) sur cet appareil. Idéal pour essayer sans risque.</p>
            {!e.microsoftPossible ? <p className="synchro-discret">Vous êtes dans le mode essai : il n’est jamais relié à un vrai compte Microsoft. Pour synchroniser vos vraies données, verrouillez le Journalier (bouton « Verrouiller ») puis connectez-vous avec votre compte.</p> : null}
          </>
        ) : (
          <>
            <p>{demo ? <><strong>Mode démonstration</strong> — faux OneDrive et faux Outlook sur cet appareil.</> : <>Connecté : <strong>{e.compte?.nom}</strong>{e.compte?.courriel ? ` (${e.compte.courriel})` : ''}</>}</p>
            {e.reconnexion ? <p className="synchro-message synchro-message-info" role="status">Votre session Microsoft a expiré. Reconnectez-vous pour continuer.</p> : null}
            <div className="synchro-actions">
              {e.reconnexion
                ? <Button variante="primaire" disabled={occupe} onClick={() => { void synchro.connecter(); }}>Se reconnecter</Button>
                : <Button variante="primaire" disabled={occupe} onClick={() => { void synchro.synchroniser(); }}>{e.enCours === 'synchronisation' ? 'Synchronisation…' : 'Synchroniser maintenant'}</Button>}
              <Button variante="discret" disabled={occupe} onClick={() => synchro.deconnecter()}>{demo ? 'Quitter la démonstration' : 'Se déconnecter et verrouiller'}</Button>
            </div>
            <label className="synchro-case">
              <input type="checkbox" checked={e.auto} onChange={(ev) => synchro.changerAuto(ev.target.checked)} />
              <span>Envoyer automatiquement après chaque modification (30 secondes de calme)</span>
            </label>
            {e.derniere ? <p className="synchro-discret">Dernière synchronisation : {quand(e.derniere.le)}.</p> : null}
            {e.derniere?.ignores.length ? <details><summary>{e.derniere.ignores.length} élément(s) laissé(s) de côté</summary><ul>{e.derniere.ignores.map((t) => <li key={t}>{t}</li>)}</ul></details> : null}
            {e.derniere?.erreurs.length ? <details open><summary>{e.derniere.erreurs.length} élément(s) en erreur</summary><ul>{e.derniere.erreurs.map((t) => <li key={t}>{t}</li>)}</ul></details> : null}
          </>
        )}
        {e.mode !== 'demonstration' && e.microsoftPossible ? (
          <details className="synchro-aide">
            <summary>Première connexion : à faire une seule fois par l’administrateur</summary>
            <p>Dans l’inscription d’application Microsoft Entra, ajoutez cette adresse de retour (type « Application monopage ») :</p>
            <p><code>{adresseRetour}</code></p>
            <p>Pour l’agenda Outlook, l’autorisation « Calendars.ReadWrite » doit aussi être permise (parfois par un administrateur).</p>
          </details>
        ) : null}
      </Section>

      {e.conflits.length ? (
        <Section id="synchro-conflits" titre={`À décider (${e.conflits.length})`}>
          <p>Ces éléments ont changé des deux côtés. Rien n’a été écrasé : choisissez ce que vous gardez.</p>
          <ul className="conflits">{e.conflits.map((c) => <Conflit key={c.cle} c={c} synchro={synchro} occupe={occupe} />)}</ul>
        </Section>
      ) : null}

      {e.mode !== 'aucun' && !e.reconnexion ? (
        <Section id="synchro-outlook" titre="Agenda dans Outlook">
          <p>Vos rendez-vous du Journalier sont copiés dans un calendrier à part, « Journalier », jusqu’à la fin de l’année scolaire. Vos autres événements Outlook ne sont jamais touchés.</p>
          <label className="synchro-case">
            <input type="checkbox" checked={e.outlook.actif} disabled={occupe}
              onChange={(ev) => { if (ev.target.checked) void synchro.activerOutlook(); else void synchro.reglerOutlook({ actif: false }); }} />
            <span>Envoyer mon agenda vers Outlook</span>
          </label>
          {e.outlook.actif ? (
            <>
              <div className="synchro-champs">
                <Field label="Nom de l’élève dans Outlook" aide="Choisissez le moins de données personnelles possible.">
                  {(id) => (
                    <select id={id} className="select" value={e.outlook.nom} onChange={(ev) => { void synchro.reglerOutlook({ nom: ev.target.value as NomDansOutlook }); }}>
                      {(Object.keys(noms) as NomDansOutlook[]).map((k) => <option key={k} value={k}>{noms[k]}</option>)}
                    </select>
                  )}
                </Field>
                <label className="synchro-case">
                  <input type="checkbox" checked={e.outlook.lieu} onChange={(ev) => { void synchro.reglerOutlook({ lieu: ev.target.checked }); }} />
                  <span>Indiquer le lieu</span>
                </label>
              </div>
              <div className="synchro-actions">
                <Button variante="primaire" disabled={occupe} onClick={() => { void synchro.envoyerVersOutlook(); }}>{e.enCours === 'outlook' ? 'Envoi…' : 'Mettre à jour Outlook'}</Button>
                <Button variante="discret" disabled={occupe} onClick={() => { void synchro.retirerOutlook(); }}>Retirer le calendrier d’Outlook</Button>
              </div>
              {e.dernierOutlook ? <p className="synchro-discret">Dernière mise à jour : {quand(e.dernierOutlook.le)}.</p> : null}
            </>
          ) : null}
        </Section>
      ) : null}

      {demo ? (
        <Section id="synchro-essai" titre="Pour essayer">
          <p>Dans le faux OneDrive : {e.nuageDemo.fichiers} fichier{e.nuageDemo.fichiers > 1 ? 's' : ''}, {e.nuageDemo.evenements} événement{e.nuageDemo.evenements > 1 ? 's' : ''} Outlook. Synchronisez d’abord, puis simulez un autre appareil :</p>
          <div className="synchro-actions">
            <Button disabled={occupe} onClick={() => { synchro.modifierAilleurs(); }}>Une séance est modifiée sur un autre appareil</Button>
            <Button disabled={occupe} onClick={() => { synchro.supprimerAilleurs(); }}>Une séance est supprimée sur un autre appareil</Button>
            <Button variante="discret" disabled={occupe} onClick={() => { void synchro.viderNuageDemo(); }}>Vider le faux OneDrive</Button>
          </div>
          <p className="synchro-discret">Astuce : modifiez la même séance ici avant de synchroniser pour voir apparaître un conflit.</p>
        </Section>
      ) : null}

      <CopieDeSecours synchro={synchro} />
    </div>
  );
}
