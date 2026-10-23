import { useMemo } from 'react';
import type { Eleve, Seance } from '../../domain/types.ts';
import { construireBloc } from '../../domain/redaction/index.ts';
import { IconeFeuille } from '../../ui/icons.tsx';

const dateFr = (iso: string): string => iso.split('-').reverse().join('/');

/** Dernière séance déjà enregistrée avec cet élève, avant celle en cours. */
function rappel(seance: Seance, precedentes: readonly Seance[]) {
  const derniere = [...precedentes]
    .filter((x) => x.id !== seance.id && x.date <= seance.date)
    .sort((a, b) => b.date.localeCompare(a.date) || b.creeLe.localeCompare(a.creeLe))[0];
  if (!derniere) return null;
  const prevu = derniere.suite.objectif.trim();
  const utiles = derniere.aides.filter((a) => a.effet === 2).map((a) => a.nom);
  if (!prevu && !utiles.length) return null;
  return { date: dateFr(derniere.date), matiere: derniere.matiere, prevu, utiles };
}

interface Props {
  seance: Seance;
  eleve: Eleve | undefined;
  precedentes: readonly Seance[];
  /** Petit écran : la feuille est un tiroir au-dessus de la barre d'action. */
  tiroirOuvert: boolean;
  onFermer: () => void;
}

/** Feuille du Journalier, mise à jour pendant la saisie : ce que contiendra le document Word. */
export function Apercu({ seance, eleve, precedentes, tiroirOuvert, onFermer }: Props) {
  const bloc = useMemo(
    () => construireBloc(seance, { titulaire: eleve?.titulaire ?? '', precedentes }),
    [seance, eleve, precedentes]
  );
  const dernier = useMemo(() => rappel(seance, precedentes), [seance, precedentes]);
  const vide = (v: string) => v || '—';

  return (
    <aside className="apercu" data-tiroir={tiroirOuvert} id="feuille-apercu" aria-label="Aperçu de la feuille du Journalier">
      <header className="apercu-entete">
        <IconeFeuille taille={18} />
        <h2>Feuille du Journalier</h2>
        <button type="button" className="apercu-fermer" onClick={onFermer}>Fermer</button>
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
      {dernier ? (
        <section className="rappel" aria-label="Rappel de la dernière séance">
          <h3>Dernière séance, le {dernier.date}{dernier.matiere ? ` · ${dernier.matiere}` : ''}</h3>
          {dernier.prevu ? <p><span className="etiquette">Prévu pour la suite :</span> {dernier.prevu}</p> : null}
          {dernier.utiles.length ? (
            <>
              <p className="etiquette">A bien aidé</p>
              <ul>{dernier.utiles.map((n) => <li key={n}>{n}</li>)}</ul>
            </>
          ) : null}
        </section>
      ) : null}
    </aside>
  );
}
