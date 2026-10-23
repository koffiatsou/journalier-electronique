import { useMemo } from 'react';
import type { Eleve, Seance } from '../../domain/types.ts';
import { construireBloc } from '../../domain/redaction/index.ts';
import { IconeFeuille } from '../../ui/icons.tsx';

interface Props {
  seance: Seance;
  eleve: Eleve | undefined;
  precedentes: readonly Seance[];
}

/** Feuille du Journalier, mise à jour pendant la saisie : ce que contiendra le document Word. */
export function Apercu({ seance, eleve, precedentes }: Props) {
  const bloc = useMemo(
    () => construireBloc(seance, { titulaire: eleve?.titulaire ?? '', precedentes }),
    [seance, eleve, precedentes]
  );
  const vide = (v: string) => v || '—';

  return (
    <aside className="apercu" aria-label="Aperçu de la feuille du Journalier">
      <header className="apercu-entete">
        <IconeFeuille taille={18} />
        <h2>Feuille du Journalier</h2>
      </header>
      <div className="feuille" role="document">
        <p className="feuille-ligne feuille-tete">
          <span>Date : <strong>{vide(bloc.entete.date)}</strong></span>
          <span>Cours : <strong>{vide(bloc.entete.cours)}</strong></span>
          <span>Titulaire : <strong>{vide(bloc.entete.titulaire)}</strong></span>
        </p>

        {bloc.peda ? (
          <section className="feuille-zone" data-zone="peda">
            <h3>Partie pédagogique</h3>
            <p><span className="etiquette">Objectif de la leçon :</span> {vide(bloc.peda.objectifLecon)}</p>
            {bloc.peda.contenuClasse ? <p><span className="etiquette">Contenu vu en classe :</span> {bloc.peda.contenuClasse}</p> : null}
            <p><span className="etiquette">Mon objectif :</span> {vide(bloc.peda.monObjectif)}</p>
            <p><span className="etiquette">Mon intervention :</span> {vide(bloc.peda.monIntervention)}</p>
          </section>
        ) : null}

        <section className="feuille-zone" data-zone="ortho">
          {bloc.peda ? <h3>Partie orthopédagogique</h3> : <h3>Séance</h3>}
          {bloc.ortho.map((b, i) => (
            <div key={`${b.label ?? 'texte'}-${i}`} className="feuille-bloc">
              {b.lignes ? (
                <>
                  <p className="etiquette">{b.label}</p>
                  <ul>{b.lignes.map((l) => <li key={l}>{l.replace(/^•\s*/, '')}</li>)}</ul>
                </>
              ) : (
                <p>{b.label ? <span className="etiquette">{b.label} : </span> : null}{b.texte}</p>
              )}
            </div>
          ))}
        </section>
      </div>
    </aside>
  );
}
