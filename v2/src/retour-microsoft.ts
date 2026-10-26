import { CANAL_RETOUR } from './synchro/connexion.ts';

/*
 * Page de retour de Microsoft : elle reçoit le code dans son adresse, le transmet à l'application restée ouverte
 * dans l'autre fenêtre (canal de diffusion, même site uniquement), efface l'adresse, puis se ferme.
 * Aucun script intégré à la page : la politique de sécurité l'interdit.
 */
const adresseRecue = { type: 'retour' as const, hash: globalThis.location.hash, search: globalThis.location.search };
const message = document.getElementById('message');
if (adresseRecue.hash || adresseRecue.search) {
  const canal = new BroadcastChannel(CANAL_RETOUR);
  canal.postMessage(adresseRecue);
  globalThis.history.replaceState(null, '', globalThis.location.pathname);
  if (message) message.textContent = 'Connexion terminée. Cette fenêtre va se fermer.';
  setTimeout(() => { canal.close(); globalThis.close(); }, 400);
} else if (message) {
  message.textContent = 'Cette page sert uniquement au retour de la connexion Microsoft. Vous pouvez la fermer.';
}
