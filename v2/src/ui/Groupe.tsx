import type { ReactNode } from 'react';

interface GroupeProps {
  titre: string;
  /** Texte court à droite du titre (« 2 observés ») ; rien quand il n'y a encore rien à compter. */
  compte?: string | undefined;
  /** Mention après le titre (« facultatif »). */
  mention?: string;
  /** Boutons à droite du titre (Lexique). */
  actions?: ReactNode;
  children: ReactNode;
}

/**
 * Sous-partie nommée d'une rubrique de la séance : un filet fin au-dessus, un titre net, l'espace fait le reste.
 * Jamais de cadre (pas de carte dans une carte) ni de lettres a, b, c.
 */
export function Groupe({ titre, compte, mention, actions, children }: GroupeProps) {
  return (
    <div className="rubrique groupe" id={idDeGroupe(titre)}>
      <div className="groupe-entete">
        <h3 className="groupe-titre">
          {titre}
          {mention ? <span className="opt"> {mention}</span> : null}
        </h3>
        {compte || actions ? (
          <span className="groupe-droite">
            {compte ? <span className="groupe-compte">{compte}</span> : null}
            {actions}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}

/** Identifiant d'un groupe d'après son titre (sans accents ni espaces) : les raccourcis s'en servent pour y défiler. */
export function idDeGroupe(titre: string): string {
  return `groupe-${titre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`;
}

/** Nombre de groupes à partir duquel une rubrique reçoit sa barre de raccourcis : en dessous, tout tient sous les yeux. */
export const GROUPES_POUR_RACCOURCIS = 3;

/** Barre de raccourcis d'une rubrique : un bouton par groupe, pour y défiler sans parcourir tout le reste. N'affiche rien sous 3 groupes. */
export function Raccourcis({ groupes, avantDeDefiler }: { groupes: readonly string[]; avantDeDefiler?: () => void }) {
  if (groupes.length < GROUPES_POUR_RACCOURCIS) return null;
  const aller = (titre: string) => {
    avantDeDefiler?.();
    document.getElementById(idDeGroupe(titre))?.scrollIntoView({ block: 'start' });
  };
  return (
    <nav className="raccourcis" aria-label="Aller à un groupe">
      {groupes.map((titre) => (
        <button key={titre} type="button" className="raccourci" onClick={() => aller(titre)}>{titre}</button>
      ))}
    </nav>
  );
}

/** « 1 observé », « 2 observés » ; undefined à zéro. */
export function compteDe(n: number, singulier: string, pluriel = `${singulier}s`): string | undefined {
  return n > 0 ? `${n} ${n > 1 ? pluriel : singulier}` : undefined;
}
