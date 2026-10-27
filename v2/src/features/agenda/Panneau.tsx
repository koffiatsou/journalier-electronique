import { useMemo, useState } from 'react';
import {
  NB_COULEURS, NOMS_COULEURS, TYPES_LIBELLES, creer, ecoleDeEleve, ecoleParDefaut, editer, jourComplet, libelle, nbPeriodesUtilisees
} from '../../domain/agenda/index.ts';
import type { Activite, Changement, Ecole, Edition, Occurrence, Portee, TypeActivite } from '../../domain/agenda/index.ts';
import { elevesProposes, languesDe } from '../../domain/eleves/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { Button } from '../../ui/Button.tsx';
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx';

export interface Brouillon { date: string; debut: number; fin: number }

interface Props {
  occurrence: Occurrence | null;
  ecoles: readonly Ecole[];
  nouveau: Brouillon | null;
  eleves: Eleve[];
  onChanger: (c: Changement) => void;
  onFermer: () => void;
  onEncoder: (o: Occurrence) => void;
  onDupliquer: (o: Occurrence) => void;
  onAnnuler: (o: Occurrence) => void;
  onRealiser: (o: Occurrence) => void;
  onSupprimer: (o: Occurrence, portee: Portee) => void;
}

const TYPES = Object.keys(TYPES_LIBELLES) as TypeActivite[];

/** Panneau d'une activité : création et modification, sans fenêtre modale. */
export function Panneau({ occurrence, ecoles, nouveau, eleves, onChanger, onFermer, onEncoder, onDupliquer, onAnnuler, onRealiser, onSupprimer }: Props) {
  const a: Activite | null = occurrence?.activite ?? null;
  const base = useMemo<Activite>(() => a ?? creer({ type: 'eleve', date: nouveau?.date ?? '', debut: nouveau?.debut ?? 0, fin: nouveau?.fin ?? 0 }), [a, nouveau]);
  const [type, setType] = useState<TypeActivite>(base.type);
  const [eleveId, setEleveId] = useState(base.eleveId ?? '');
  const [nomLibre, setNomLibre] = useState(base.nomLibre ?? '');
  const [titre, setTitre] = useState(base.titre);
  const [matiere, setMatiere] = useState(base.matiere ?? '');
  const [lieu, setLieu] = useState(base.lieu);
  const [note, setNote] = useState(base.note);
  const [date, setDate] = useState(occurrence?.date ?? base.date);
  const [debut, setDebut] = useState(occurrence?.debut ?? base.debut);
  const [fin, setFin] = useState(occurrence?.fin ?? base.fin);
  const [repetition, setRepetition] = useState(base.repetition);
  const [jusquau, setJusquau] = useState(base.jusquau ?? '');
  const [couleur, setCouleur] = useState<number | undefined>(base.couleur);
  const [ecoleId, setEcoleId] = useState(base.ecoleId ?? '');
  const [portee, setPortee] = useState<Portee>('occurrence');
  const serie = a?.repetition === 'hebdomadaire';
  const eleve = eleves.find((e) => e.id === eleveId);
  // Les heures affichées sont celles de l'école de l'élève (ou de l'école choisie pour une autre activité).
  const plusieurs = ecoles.length > 1;
  const ecole: Ecole = type === 'eleve' ? ecoleDeEleve(eleve, ecoles) : (ecoles.find((e) => e.id === ecoleId) ?? ecoleParDefaut(ecoles));
  const OPTIONS_PERIODES = useMemo(() => {
    // Les périodes de l'école ; on garde aussi celle déjà choisie (une activité plus ancienne peut sortir des horaires actuels).
    const n = Math.max(nbPeriodesUtilisees(ecole.periodes), debut + 1, fin + 1);
    return ecole.periodes.slice(0, n).map((p, i) => ({ i, texte: p.debut && p.fin ? `${p.label} (${p.debut} – ${p.fin})` : `${p.label} (pas d’horaire pour cette école)` }));
  }, [ecole, debut, fin]);
  const matieres = eleve ? [...eleve.matieres, ...languesDe(eleve).filter((l) => !eleve.matieres.includes(l))] : [];
  const valide = type === 'eleve' ? Boolean(eleveId || nomLibre.trim()) : Boolean(titre.trim()) && date !== '';

  const enregistrer = () => {
    if (!valide) return;
    const champs: Edition & { type: TypeActivite } = {
      type, titre: titre.trim(), lieu: lieu.trim(), note: note.trim(), date, debut, fin: Math.max(debut, fin), repetition,
      ...(type === 'eleve' ? (eleveId ? { eleveId } : { nomLibre: nomLibre.trim() }) : {}),
      ...(matiere.trim() ? { matiere: matiere.trim() } : {}),
      ...(repetition === 'hebdomadaire' && jusquau ? { jusquau } : {}),
      ...(typeof couleur === 'number' ? { couleur } : {}),
      ...(type !== 'eleve' && ecoleId ? { ecoleId } : {})
    };
    if (occurrence) {
      const c = editer(occurrence, champs, portee);
      // champs vidés : on enlève ce qui n'est plus renseigné
      for (const act of c.enregistrer) {
        if (type !== 'eleve') { delete act.eleveId; delete act.nomLibre; }
        else if (eleveId) delete act.nomLibre; else delete act.eleveId;
        if (!matiere.trim()) delete act.matiere;
        if (couleur === undefined) delete act.couleur;
        if (type === 'eleve' || !ecoleId) delete act.ecoleId;
        if (repetition === 'aucune') { delete act.jusquau; }
      }
      onChanger(c);
    } else {
      const act = creer({ ...champs });
      onChanger({ enregistrer: [act], supprimer: [] });
    }
    onFermer();
  };

  const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : undefined;
  return (
    <section className="panneau feuille-bas" aria-label={occurrence ? 'Modifier l’activité' : 'Nouvelle activité'}>
      <div className="en-tete">
        <h2>{occurrence ? libelle(base, nom) : 'Nouvelle activité'}</h2>
        <Button onClick={onFermer} aria-label="Fermer le panneau">Fermer</Button>
      </div>
      {occurrence ? <p className="liste-detail">{jourComplet(occurrence.date)} · {occurrence.statut === 'annule' ? 'Annulé' : occurrence.statut === 'realise' ? 'Réalisé' : 'Prévu'}</p> : null}

      <div className="field">
        <span className="field-label">Type d’activité</span>
        <div className="chips" role="radiogroup" aria-label="Type d’activité">
          {TYPES.map((t) => <button key={t} type="button" role="radio" aria-checked={type === t} className="chip" onClick={() => setType(t)}>{TYPES_LIBELLES[t]}</button>)}
        </div>
      </div>

      {type === 'eleve' ? (
        <>
          <Field label="Élève">
            {(id) => (
              <Select id={id} value={eleveId} onChange={(e) => setEleveId(e.target.value)}>
                <option value="">Autre (nom libre)</option>
                {elevesProposes(eleves, eleveId).map((e) => <option key={e.id} value={e.id}>{e.nom} {e.prenom}</option>)}
              </Select>
            )}
          </Field>
          {!eleveId ? <Field label="Nom saisi librement">{(id) => <Input id={id} value={nomLibre} onChange={(e) => setNomLibre(e.target.value)} placeholder="Prénom ou initiales" />}</Field> : null}
          {plusieurs ? <p className="field-hint">École : {ecole.nom} (celle du dossier de l’élève).</p> : null}
          <Field label="Matière" optionnel>
            {(id) => (<><Input id={id} list={`${id}-m`} value={matiere} onChange={(e) => setMatiere(e.target.value)} placeholder="Choisir ou saisir" /><datalist id={`${id}-m`}>{matieres.map((m) => <option key={m} value={m} />)}</datalist></>)}
          </Field>
        </>
      ) : null}

      {type !== 'eleve' && plusieurs ? (
        <Field label="École" aide="Les heures des périodes sont celles de cette école.">
          {(id) => (
            <Select id={id} value={ecoleId} onChange={(e) => setEcoleId(e.target.value)}>
              <option value="">École par défaut ({ecoleParDefaut(ecoles).nom})</option>
              {ecoles.map((e) => <option key={e.id} value={e.id}>{e.nom}</option>)}
            </Select>
          )}
        </Field>
      ) : null}

      <Field label={type === 'eleve' ? 'Précision' : 'Titre'} optionnel={type === 'eleve'}>
        {(id) => <Input id={id} value={titre} onChange={(e) => setTitre(e.target.value)} placeholder={type === 'eleve' ? 'Ex. : remédiation fractions' : 'Ex. : concertation avec la titulaire'} />}
      </Field>

      <div className="ligne2">
        <Field label="Jour">{(id) => <Input id={id} type="date" value={date} onChange={(e) => setDate(e.target.value)} />}</Field>
        <Field label="Lieu" optionnel>{(id) => <Input id={id} value={lieu} onChange={(e) => setLieu(e.target.value)} placeholder="Local, visio…" />}</Field>
      </div>
      <div className="ligne2">
        <Field label="De">
          {(id) => <Select id={id} value={debut} onChange={(e) => { const v = Number(e.target.value); setDebut(v); if (fin < v) setFin(v); }}>{OPTIONS_PERIODES.map((p) => <option key={p.i} value={p.i}>{p.texte}</option>)}</Select>}
        </Field>
        <Field label="À">
          {(id) => <Select id={id} value={fin} onChange={(e) => setFin(Number(e.target.value))}>{OPTIONS_PERIODES.filter((p) => p.i >= debut).map((p) => <option key={p.i} value={p.i}>{p.texte}</option>)}</Select>}
        </Field>
      </div>

      <Field label="Répétition">
        {(id) => (
          <Select id={id} value={repetition} onChange={(e) => setRepetition(e.target.value as Activite['repetition'])}>
            <option value="aucune">Une seule fois</option>
            <option value="hebdomadaire">Chaque semaine</option>
          </Select>
        )}
      </Field>
      {repetition === 'hebdomadaire' ? <Field label="Jusqu’au" optionnel aide="Laissez vide pour répéter sans fin.">{(id) => <Input id={id} type="date" value={jusquau} min={date} onChange={(e) => setJusquau(e.target.value)} />}</Field> : null}

      <Field label="Note" optionnel>{(id) => <Textarea id={id} value={note} onChange={(e) => setNote(e.target.value)} rows={2} />}</Field>

      <div className="field">
        <span className="field-label">Couleur</span>
        <div className="pastilles-couleur" role="group" aria-label="Couleur">
          <button type="button" className="auto" aria-pressed={couleur === undefined} onClick={() => setCouleur(undefined)}>{type === 'eleve' ? 'Couleur de l’élève' : 'Automatique'}</button>
          {Array.from({ length: NB_COULEURS }, (_, i) => (
            <button key={i} type="button" className={`c-${i}`} aria-pressed={couleur === i} aria-label={NOMS_COULEURS[i]} onClick={() => setCouleur(i)} />
          ))}
        </div>
      </div>

      {serie ? (
        <fieldset className="portee">
          <legend>Cette activité se répète chaque semaine : appliquer à…</legend>
          <label><input type="radio" name="portee" checked={portee === 'occurrence'} onChange={() => setPortee('occurrence')} /> cette date seulement</label>
          <label><input type="radio" name="portee" checked={portee === 'serie'} onChange={() => setPortee('serie')} /> toute la série</label>
        </fieldset>
      ) : null}

      <div className="actions">
        <Button variante="primaire" disabled={!valide} onClick={enregistrer}>{occurrence ? 'Enregistrer' : 'Ajouter à l’agenda'}</Button>
        {occurrence && occurrence.activite.type === 'eleve' && occurrence.statut !== 'annule' ? <Button onClick={() => onEncoder(occurrence)}>Encoder la séance</Button> : null}
        {occurrence && occurrence.activite.type !== 'eleve' && occurrence.statut !== 'annule' ? <Button onClick={() => onRealiser(occurrence)}>{occurrence.statut === 'realise' ? 'Remettre à prévu' : 'Marquer réalisé'}</Button> : null}
      </div>
      {occurrence ? (
        <div className="actions">
          <Button onClick={() => onDupliquer(occurrence)}>Dupliquer à la semaine suivante</Button>
          <Button onClick={() => onAnnuler(occurrence)}>{occurrence.statut === 'annule' ? 'Rétablir' : 'Annuler l’activité'}</Button>
          <Button variante="discret" onClick={() => onSupprimer(occurrence, portee)}>Supprimer{serie ? (portee === 'serie' ? ' la série' : ' cette date') : ''}</Button>
        </div>
      ) : null}
    </section>
  );
}
