import { useState } from 'react';
import type { ReactNode } from 'react';
import { Button } from '../../ui/Button.tsx';

/*
 * Écrans affichés tant que le Journalier est verrouillé. Rien d'autre n'est visible : aucune donnée n'est lue
 * avant la connexion (ou le choix du mode essai).
 */

function Cadre({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <main className="verrou" id="contenu">
      <section className="verrou-carte" aria-labelledby="verrou-titre">
        <img className="verrou-logo" src="./logo-poles-territoriaux.svg" alt="Logo des Pôles territoriaux" width="150" height="103" />
        <p className="verrou-marque"><strong>Journalier</strong> · Pôle territorial WBE BXL</p>
        <h1 id="verrou-titre">{titre}</h1>
        {children}
      </section>
    </main>
  );
}

export function Verrou({ occupe, message, ancienneBase, chiffrementOk, onConnecter, onAnnuler, onEssai }: {
  occupe: boolean;
  message: { genre: 'erreur' | 'info'; texte: string } | null;
  /** Des données d'avant le chiffrement existent encore sur l'appareil. */
  ancienneBase: boolean;
  chiffrementOk: boolean;
  onConnecter: () => void;
  onAnnuler: () => void;
  onEssai: () => void;
}) {
  return (
    <Cadre titre="Journalier verrouillé">
      {message ? <p className={`synchro-message synchro-message-${message.genre}`} role={message.genre === 'erreur' ? 'alert' : 'status'}>{message.texte}</p> : null}
      {!chiffrementOk ? (
        <p className="synchro-message synchro-message-erreur" role="alert">Ce navigateur ne permet pas le chiffrement des données. Ouvrez le Journalier dans un navigateur à jour, depuis l’adresse sécurisée (https).</p>
      ) : (
        <>
          <p>Les données des élèves sont chiffrées sur cet appareil. Connectez-vous avec votre compte Microsoft professionnel pour les ouvrir.</p>
          <div className="verrou-actions">
            <Button variante="primaire" disabled={occupe} onClick={onConnecter}>{occupe ? 'Fenêtre Microsoft ouverte…' : 'Se connecter avec Microsoft'}</Button>
            {occupe ? <Button variante="discret" onClick={onAnnuler}>Annuler</Button> : null}
          </div>
          <p className="synchro-discret">Se connecter ouvre vos données et active la synchronisation avec votre OneDrive (vous pourrez la couper dans l’écran Synchro).</p>
          {ancienneBase ? <p className="synchro-message synchro-message-info" role="status">Des données enregistrées avant le chiffrement se trouvent sur cet appareil. À la première ouverture, elles seront chiffrées et vérifiées, puis l’ancienne copie non chiffrée sera supprimée.</p> : null}
          <hr className="verrou-separation" />
          <h2 className="verrou-sous-titre">Pas de compte sous la main ?</h2>
          <div className="verrou-actions">
            <Button disabled={occupe} onClick={onEssai}>Essayer avec des données fictives</Button>
          </div>
          <p className="synchro-discret">Un espace à part, sans lien avec Microsoft ni avec vos vraies données. N’y écrivez jamais de vrais noms d’élèves.</p>
        </>
      )}
    </Cadre>
  );
}

export function Ouverture() {
  return (
    <Cadre titre="Ouverture du Journalier…">
      <p role="status">Déchiffrement des données de cet appareil.</p>
    </Cadre>
  );
}

export function ClePerdue({ message, occupe, onRepartir, onRetour }: { message: string; occupe: boolean; onRepartir: () => void; onRetour: () => void }) {
  const [compris, setCompris] = useState(false);
  return (
    <Cadre titre="Données illisibles sur cet appareil">
      <p className="synchro-message synchro-message-erreur" role="alert">{message}</p>
      <p>Rien n’a été supprimé. Si vos données sont dans OneDrive, ou si vous avez une copie de secours, vous pouvez repartir d’un espace vide sur cet appareil, puis les récupérer.</p>
      <label className="synchro-case">
        <input type="checkbox" checked={compris} onChange={(e) => setCompris(e.target.checked)} />
        <span>Je comprends que ce qui est enregistré sur cet appareil sera effacé (les données de OneDrive et mes copies de secours ne sont pas touchées).</span>
      </label>
      <div className="verrou-actions">
        <Button variante="primaire" disabled={!compris || occupe} onClick={onRepartir}>Repartir d’un espace vide</Button>
        <Button variante="discret" disabled={occupe} onClick={onRetour}>Retour</Button>
      </div>
    </Cadre>
  );
}

export function ErreurOuverture({ message, onReessayer, onRetour }: { message: string; onReessayer: () => void; onRetour: () => void }) {
  return (
    <Cadre titre="Ouverture impossible">
      <p className="synchro-message synchro-message-erreur" role="alert">{message}</p>
      <div className="verrou-actions">
        <Button variante="primaire" onClick={onReessayer}>Réessayer</Button>
        <Button variante="discret" onClick={onRetour}>Retour</Button>
      </div>
    </Cadre>
  );
}
