import { useEffect, useMemo, useRef, useState } from 'react';
import {
  NB_COULEURS, NOMS_COULEURS, TYPES_LIBELLES, creer, ecoleDeEleve, ecoleParDefaut, editer, heuresLibresDe, jourComplet, libelle, nbPeriodesUtilisees,
  periodesCouvertes, verifierHeuresLibres
} from '../../domain/agenda/index.ts';
import type { Activite, Changement, Ecole, Edition, Occurrence, Portee, TypeActivite } from '../../domain/agenda/index.ts';
import { activiteSaisie } from '../../domain/brouillons/index.ts';
import type { BrouillonFormulaire, ChampsActivite } from '../../domain/brouillons/index.ts';
import { elevesProposes, languesDe, nomAffiche } from '../../domain/eleves/index.ts';
import type { Eleve } from '../../domain/types.ts';
import { BrouillonRetrouve } from '../../ui/BrouillonRetrouve.tsx';
import { Button } from '../../ui/Button.tsx';
import { ChampSuggestions } from '../../ui/ChampSuggestions.tsx';
import { ConfirmerAbandon } from '../../ui/ConfirmerAbandon.tsx';
import { Field, Input, Select, Textarea } from '../../ui/Field.tsx';
import { useTiroir } from '../../ui/useTiroir.ts';

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
  /** Nouvelle activité seulement : brouillon retrouvé (proposé, jamais appliqué sans accord), garde de la saisie, effacement. */
  brouillon?: BrouillonFormulaire<ChampsActivite> | null;
  onSaisie?: (c: ChampsActivite) => void;
  onEffacerBrouillon?: () => void;
}

const TYPES = Object.keys(TYPES_LIBELLES) as TypeActivite[];

/** Panneau d'une activité : création et modification, sans fenêtre modale. */
export function Panneau({ occurrence, ecoles, nouveau, eleves, onChanger, onFermer, onEncoder, onDupliquer, onAnnuler, onRealiser, onSupprimer, brouillon = null, onSaisie, onEffacerBrouillon }: Props) {
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
  const libresDeBase = heuresLibresDe(base);
  const [libre, setLibre] = useState(Boolean(libresDeBase));
  const [heureDebut, setHeureDebut] = useState(libresDeBase?.debut ?? '');
  const [heureFin, setHeureFin] = useState(libresDeBase?.fin ?? '');
  const racine = useRef<HTMLElement>(null);
  // Quitter sans enregistrer : on ne demande que si quelque chose a changé depuis l'ouverture.
  const saisie = JSON.stringify([type, eleveId, nomLibre, titre, matiere, lieu, note, date, debut, fin, repetition, jusquau, couleur ?? null, ecoleId, libre, heureDebut, heureFin]);
  const saisieInitiale = useRef(saisie);
  const [confirmation, setConfirmation] = useState(false);
  const [proposition, setProposition] = useState(brouillon);
  const ouverture = useRef(true);
  // Nouvelle activité : on garde la saisie (jamais avant la première frappe ni avant la réponse à la proposition de reprise).
  useEffect(() => {
    if (ouverture.current) { ouverture.current = false; return; }
    if (occurrence || proposition || !onSaisie) return;
    const champs: ChampsActivite = {
      type, eleveId, nomLibre, titre, matiere, lieu, note, date, debut, fin, repetition, jusquau, couleur: couleur ?? null, ecoleId, libre, heureDebut, heureFin
    };
    if (activiteSaisie(champs)) onSaisie(champs);
  }, [saisie]); // eslint-disable-line react-hooks/exhaustive-deps
  const reprendre = (c: ChampsActivite) => {
    setType(c.type); setEleveId(eleves.some((e) => e.id === c.eleveId) ? c.eleveId : ''); setNomLibre(c.nomLibre); setTitre(c.titre); setMatiere(c.matiere);
    setLieu(c.lieu); setNote(c.note); setDate(c.date); setDebut(c.debut); setFin(c.fin); setRepetition(c.repetition); setJusquau(c.jusquau);
    setCouleur(c.couleur ?? undefined); setEcoleId(c.ecoleId); setLibre(c.libre); setHeureDebut(c.heureDebut); setHeureFin(c.heureFin);
    setProposition(null);
  };
  const fermer = () => { if (saisie !== saisieInitiale.current) setConfirmation(true); else onFermer(); };
  const recouvre = useTiroir(racine, { actif: true, onFermer: fermer });
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
  // Les heures libres ne concernent pas un accompagnement d'élève (il suit les périodes, comme sa séance).
  const libreActif = libre && type !== 'eleve';
  const erreurHeures = libreActif ? verifierHeuresLibres(heureDebut, heureFin) : null;
  const raisonSansElement = type === 'eleve' ? (eleveId || nomLibre.trim() ? undefined : 'Choisissez d’abord l’élève.') : !titre.trim() ? 'Indiquez d’abord le titre.' : date === '' ? 'Indiquez d’abord le jour.' : undefined;
  const raisonInvalide = raisonSansElement ?? erreurHeures ?? undefined;
  const valide = (type === 'eleve' ? Boolean(eleveId || nomLibre.trim()) : Boolean(titre.trim()) && date !== '') && !erreurHeures;

  const enregistrer = () => {
    if (!valide) return;
    const couvertes = libreActif ? periodesCouvertes(ecole.periodes, { debut: heureDebut, fin: heureFin }) : { debut, fin: Math.max(debut, fin) };
    const champs: Edition & { type: TypeActivite } = {
      type, titre: titre.trim(), lieu: lieu.trim(), note: note.trim(), date, debut: couvertes.debut, fin: couvertes.fin, repetition,
      ...(libreActif ? { heureDebut, heureFin } : {}),
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
        if (!libreActif) { delete act.heureDebut; delete act.heureFin; }
      }
      onChanger(c);
    } else {
      const act = creer({ ...champs });
      onChanger({ enregistrer: [act], supprimer: [] });
    }
    onEffacerBrouillon?.();
    onFermer();
  };

  const nom = eleve ? `${eleve.prenom} ${eleve.nom}` : undefined;
  return (
    <section ref={racine} className="panneau feuille-bas" aria-label={occurrence ? 'Modifier l’activité' : 'Nouvelle activité'}
      {...(recouvre ? { role: 'dialog', 'aria-modal': true } : {})}>
      <div className="en-tete">
        <h2>{occurrence ? libelle(base, nom) : 'Nouvelle activité'}</h2>
        <Button onClick={fermer} aria-label="Fermer le panneau">Fermer</Button>
      </div>
      {proposition ? (
        <BrouillonRetrouve quoi="Une activité" enregistreLe={proposition.enregistreLe} onReprendre={() => reprendre(proposition.donnees)}
          onRepartir={() => { onEffacerBrouillon?.(); setProposition(null); }} />
      ) : null}
      {occurrence && occurrence.activite.type === 'eleve' && occurrence.statut !== 'annule' ? (
        <div className="actions encoder-haut">
          <Button variante="primaire" onClick={() => onEncoder(occurrence)}>{occurrence.statut === 'realise' ? 'Ouvrir la séance' : 'Encoder la séance'}</Button>
        </div>
      ) : null}
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
                {elevesProposes(eleves, eleveId).map((e) => <option key={e.id} value={e.id}>{nomAffiche(e)}</option>)}
              </Select>
            )}
          </Field>
          {!eleveId ? <Field label="Nom saisi librement">{(id) => <Input id={id} value={nomLibre} onChange={(e) => setNomLibre(e.target.value)} placeholder="Prénom ou initiales" />}</Field> : null}
          {plusieurs ? <p className="field-hint">École : {ecole.nom} (celle du dossier de l’élève).</p> : null}
          <Field label="Matière" optionnel>
            {(id) => <ChampSuggestions id={id} value={matiere} onChange={setMatiere} suggestions={matieres} placeholder="Choisir ou saisir" />}
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
      {type !== 'eleve' ? (
        <label className="horaire-libre">
          <input type="checkbox" checked={libre} onChange={(e) => setLibre(e.target.checked)} /> Horaire libre (en dehors des périodes)
        </label>
      ) : null}
      {libreActif ? (
        <>
          <div className="ligne2">
            <Field label="De">{(id) => <Input id={id} type="time" step={300} value={heureDebut} onChange={(e) => setHeureDebut(e.target.value)} />}</Field>
            <Field label="À">{(id) => <Input id={id} type="time" step={300} value={heureFin} onChange={(e) => setHeureFin(e.target.value)} />}</Field>
          </div>
          {erreurHeures && (heureDebut || heureFin) ? <p className="field-hint" role="alert">{erreurHeures}</p> : null}
        </>
      ) : (
        <div className="ligne2">
          <Field label="De">
            {(id) => <Select id={id} value={debut} onChange={(e) => { const v = Number(e.target.value); setDebut(v); if (fin < v) setFin(v); }}>{OPTIONS_PERIODES.map((p) => <option key={p.i} value={p.i}>{p.texte}</option>)}</Select>}
          </Field>
          <Field label="À">
            {(id) => <Select id={id} value={fin} onChange={(e) => setFin(Number(e.target.value))}>{OPTIONS_PERIODES.filter((p) => p.i >= debut).map((p) => <option key={p.i} value={p.i}>{p.texte}</option>)}</Select>}
          </Field>
        </div>
      )}

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
        <p className="field-hint">Couleur choisie : {typeof couleur === 'number' ? NOMS_COULEURS[couleur] : 'automatique'}</p>
      </div>

      {serie ? (
        <fieldset className="portee">
          <legend>Cette activité se répète chaque semaine : appliquer à…</legend>
          <label><input type="radio" name="portee" checked={portee === 'occurrence'} onChange={() => setPortee('occurrence')} /> cette date seulement</label>
          <label><input type="radio" name="portee" checked={portee === 'serie'} onChange={() => setPortee('serie')} /> toute la série</label>
        </fieldset>
      ) : null}

      <div className="actions barre-fixe">
        <Button variante="primaire" raison={raisonInvalide} onClick={enregistrer}>{occurrence ? (serie ? (portee === 'serie' ? 'Enregistrer toute la série' : 'Enregistrer cette date') : 'Enregistrer') : 'Ajouter à l’agenda'}</Button>
        {occurrence && occurrence.activite.type !== 'eleve' && occurrence.statut !== 'annule' ? <Button onClick={() => onRealiser(occurrence)}>{occurrence.statut === 'realise' ? 'Remettre à prévu' : 'Marquer réalisé'}</Button> : null}
      </div>
      {occurrence ? (
        <div className="actions">
          <Button onClick={() => onDupliquer(occurrence)}>Dupliquer à la semaine suivante</Button>
          <Button onClick={() => onAnnuler(occurrence)}>{occurrence.statut === 'annule' ? 'Rétablir' : 'Annuler l’activité'}</Button>
          <Button variante="discret" onClick={() => onSupprimer(occurrence, portee)}>Supprimer{serie ? (portee === 'serie' ? ' la série' : ' cette date') : ''}</Button>
        </div>
      ) : null}
      <ConfirmerAbandon ouvert={confirmation} perte="Les changements faits dans ce panneau ne sont pas enregistrés." onContinuer={() => setConfirmation(false)} onAbandonner={() => { onEffacerBrouillon?.(); onFermer(); }} />
    </section>
  );
}
