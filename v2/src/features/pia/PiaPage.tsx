import { useEffect, useMemo, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import type { Aller } from '../../app/useRoute.ts';
import { deIdentifierPia, PARTIES_PIA } from '../../domain/export/index.ts';
import type { PartiePia } from '../../domain/export/index.ts';
import { telechargerPia } from '../../domain/export/telecharger.ts';
import { anneeScolaire } from '../../domain/export/journalier.ts';
import { anneesDisponibles, bornesAnnee, seancesDuJournalier } from '../../domain/journalier/index.ts';
import { idPia, piaVierge } from '../../domain/pia/index.ts';
import type { Pia } from '../../domain/pia/index.ts';
import type { Magasin } from '../../state/store.ts';
import { useMagasin } from '../../state/store.ts';
import { exempleDemo } from '../../data/demo.ts';
import { Button } from '../../ui/Button.tsx';
import { Field, Select } from '../../ui/Field.tsx';
import { useToast } from '../../ui/Toast.tsx';
import { aujourdhuiISO } from '../seance/brouillon.ts';
import { nomEleve } from './contexte.ts';
import { OngletAmenagements } from './OngletAmenagements.tsx';
import { OngletIdentite } from './OngletIdentite.tsx';
import { OngletProfil } from './OngletProfil.tsx';
import { OngletPv1 } from './OngletPv1.tsx';
import { OngletPv2 } from './OngletPv2.tsx';
import { ImpressionPia } from './ImpressionPia.tsx';
import { filtreInitial, Preparer } from './Preparer.tsx';
import type { FiltrePreparer } from './Preparer.tsx';

const ONGLETS = [
  { id: 'preparer', libelle: 'Préparer' },
  { id: 'identite', libelle: 'Identité' },
  { id: 'profil', libelle: 'Profil' },
  { id: 'pv1', libelle: 'Procès-verbal 1' },
  { id: 'pv2', libelle: 'Procès-verbal 2' },
  { id: 'amenagements', libelle: 'Aménagements' }
] as const;
type IdOnglet = (typeof ONGLETS)[number]['id'];
const estOnglet = (v: string | undefined): v is IdOnglet => ONGLETS.some((o) => o.id === v);

const heure = (iso: string): string => {
  const d = new Date(iso);
  return `${String(d.getHours()).padStart(2, '0')} h ${String(d.getMinutes()).padStart(2, '0')}`;
};

interface Props { magasin: Magasin; onAller: Aller; parametres: Record<string, string> }

export function PiaPage({ magasin, onAller, parametres }: Props) {
  const eleves = useMagasin(magasin, (e) => e.eleves);
  const seances = useMagasin(magasin, (e) => e.seances);
  const pias = useMagasin(magasin, (e) => e.pias);
  const statut = useMagasin(magasin, (e) => e.statutPia);
  const { annoncer } = useToast();
  const aujourdhui = aujourdhuiISO();

  const eleveId = parametres.eleve ?? '';
  const annee = parametres.annee || anneeScolaire(aujourdhui);
  const onglet: IdOnglet = estOnglet(parametres.onglet) ? parametres.onglet : 'preparer';
  const eleve = eleves.find((e) => e.id === eleveId);

  // Écrit tout de suite ce qui attend quand on quitte l'écran.
  useEffect(() => () => { void magasin.viderEnregistrements(); }, [magasin]);

  const [filtre, setFiltre] = useState<FiltrePreparer>(() => filtreInitial(annee, aujourdhui));
  const [export_, setExport] = useState(false);
  const [parties, setParties] = useState<ReadonlySet<PartiePia>>(() => new Set(PARTIES_PIA.map((p) => p.id)));
  const [deidentifie, setDeidentifie] = useState(false);
  const [enImpression, setEnImpression] = useState(false);
  const bascule = (id: PartiePia) => setParties((x) => { const n = new Set(x); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  const choisies = PARTIES_PIA.map((p) => p.id).filter((id) => parties.has(id));

  // L'impression se lance une fois la version imprimable affichée ; le navigateur propose « Enregistrer en PDF ».
  useEffect(() => {
    if (!enImpression) return;
    globalThis.print();
    setEnImpression(false);
  }, [enImpression]);
  const refsOnglets = useRef<Record<string, HTMLButtonElement | null>>({});

  const triees = useMemo(() => [...eleves].sort((a, b) => nomEleve(a).localeCompare(nomEleve(b), 'fr')), [eleves]);
  const annees = useMemo(() => {
    const set = new Set([...anneesDisponibles(seances, aujourdhui), ...pias.map((p) => p.annee), annee]);
    return [...set].sort().reverse();
  }, [seances, pias, aujourdhui, annee]);

  const aller = (suite: Partial<{ eleve: string; annee: string; onglet: string }>) => {
    const p = { eleve: eleveId, annee, onglet, ...suite };
    const sortie: Record<string, string> = {};
    for (const [k, v] of Object.entries(p)) if (v) sortie[k] = v;
    onAller('pia', sortie);
  };

  const pia: Pia | null = eleve ? (pias.find((p) => p.id === idPia(eleve.id, annee)) ?? piaVierge(eleve.id, annee, new Date().toISOString())) : null;

  const changer = (modification: (p: Pia) => Pia) => {
    if (!eleve) return;
    const base = magasin.lire().pias.find((p) => p.id === idPia(eleve.id, annee)) ?? piaVierge(eleve.id, annee, new Date().toISOString());
    magasin.enregistrerPia({ ...modification(base), modifieLe: new Date().toISOString() });
  };

  const seancesEleve = useMemo(() => (eleve ? seances.filter((s) => s.eleveId === eleve.id) : []), [seances, eleve]);
  const seancesAnnee = useMemo(() => {
    const b = bornesAnnee(annee);
    return eleve && b ? seancesDuJournalier(seances, eleve.id, b) : [];
  }, [seances, eleve, annee]);

  const chargerExemple = async () => {
    await magasin.chargerExemple(exempleDemo(aujourdhui));
    annoncer('Exemple fictif chargé : élèves Alpha et Bêta, leurs séances et un PIA');
    onAller('pia', { eleve: 'demo-alpha', annee: anneeScolaire(aujourdhui), onglet: 'preparer' });
  };

  const exporter = async () => {
    if (!eleve || !pia) return;
    setExport(true);
    try {
      await magasin.viderEnregistrements();
      const nom = await telechargerPia(pia, eleve, { parties: choisies, deidentifie });
      annoncer(`PIA Word créé : ${nom}`);
    } catch (e) {
      annoncer(e instanceof Error ? e.message : 'Export impossible');
    } finally {
      setExport(false);
    }
  };

  const touche = (ev: KeyboardEvent<HTMLButtonElement>, i: number) => {
    const delta = ev.key === 'ArrowRight' ? 1 : ev.key === 'ArrowLeft' ? -1 : 0;
    const direct = ev.key === 'Home' ? 0 : ev.key === 'End' ? ONGLETS.length - 1 : null;
    if (!delta && direct === null) return;
    ev.preventDefault();
    const n = direct ?? (i + delta + ONGLETS.length) % ONGLETS.length;
    const cible = ONGLETS[n];
    if (!cible) return;
    aller({ onglet: cible.id });
    refsOnglets.current[cible.id]?.focus();
  };

  const messageStatut = statut.etat === 'erreur' ? `Enregistrement impossible : ${statut.message}`
    : statut.etat === 'attente' ? 'Enregistrement…'
    : statut.le ? `Brouillon enregistré à ${heure(statut.le)}` : pia && pias.some((p) => p.id === pia.id) ? 'Brouillon enregistré' : 'Rien d’enregistré pour l’instant';

  return (
    <div className="page">
      <header className="page-entete">
        <h1>PIA</h1>
        <p className="page-sous-titre">Le plan individuel d’apprentissage de l’élève, rempli pas à pas, puis exporté dans le modèle Word officiel.</p>
      </header>

      <section className="liste-carte pia-choix" aria-label="Choix de l’élève et de l’année">
        <div className="reunion-grille">
          <Field label="Élève">
            {(id) => (
              <Select id={id} value={eleveId} onChange={(ev) => aller({ eleve: ev.target.value })}>
                <option value="">Choisir un élève…</option>
                {triees.map((e) => <option key={e.id} value={e.id}>{nomEleve(e)}{e.classe ? ` (${e.classe})` : ''}{e.archiveLe ? ' — archivé' : ''}</option>)}
              </Select>
            )}
          </Field>
          <Field label="Année scolaire">
            {(id) => (
              <Select id={id} value={annee} onChange={(ev) => aller({ annee: ev.target.value })}>
                {annees.map((a) => <option key={a} value={a}>{a}</option>)}
              </Select>
            )}
          </Field>
        </div>
      </section>

      {!eleve || !pia ? (
        <section className="liste-carte pia-demo">
          <p className="vide-texte reunion-vide">Choisissez un élève pour ouvrir ou commencer son PIA.</p>
          <div className="pia-demo-corps">
            <p className="field-hint">Pour essayer sans données réelles : deux élèves fictifs (Alpha et Bêta), leurs séances et un PIA d’Alpha à moitié rempli. Vous pourrez les supprimer ensuite depuis l’écran Élèves.</p>
            <div><Button onClick={() => { void chargerExemple(); }}>Charger un exemple fictif</Button></div>
          </div>
        </section>
      ) : (
        <>
          <div className="pia-barre">
            <p className={`pia-statut${statut.etat === 'erreur' ? ' pia-statut-erreur' : ''}`} role="status" aria-live="polite">{messageStatut}</p>
            <div className="pia-actions">
              <Button variante="primaire" disabled={export_ || !choisies.length} onClick={() => { void exporter(); }}>{export_ ? 'Création du fichier…' : 'Exporter en Word'}</Button>
              <Button disabled={!choisies.length} onClick={() => setEnImpression(true)}>Imprimer / PDF</Button>
            </div>
          </div>
          <details className="liste-carte pia-export">
            <summary>Choisir les parties à exporter</summary>
            <div className="pia-export-corps">
              <p className="field-hint">L’identité (première page) est toujours incluse. Les parties décochées sont retirées du fichier.</p>
              {PARTIES_PIA.map((p) => (
                <label key={p.id} className="reunion-choix"><input type="checkbox" checked={parties.has(p.id)} onChange={() => bascule(p.id)} /><span>{p.libelle}</span></label>
              ))}
              <label className="reunion-choix">
                <input type="checkbox" checked={deidentifie} onChange={(ev) => setDeidentifie(ev.target.checked)} />
                <span>Version dé-identifiée (sans nom ni coordonnées : pour partager hors de l’équipe)<small className="reunion-raison">Le nom de l’élève est remplacé par « l’élève » dans les textes ; des personnes présentes, seule la fonction est gardée.</small></span>
              </label>
              <p className="field-hint">« Imprimer / PDF » imprime les mêmes parties dans une mise en page simple (ce n’est pas le modèle officiel). Pour le PDF du modèle officiel, exportez en Word puis enregistrez en PDF depuis Word.</p>
            </div>
          </details>

          <div className="pia-onglets" role="tablist" aria-label="Parties du PIA">
            {ONGLETS.map((o, i) => (
              <button
                key={o.id}
                ref={(el) => { refsOnglets.current[o.id] = el; }}
                type="button"
                role="tab"
                id={`pia-onglet-${o.id}`}
                aria-selected={onglet === o.id}
                aria-controls="pia-panneau"
                tabIndex={onglet === o.id ? 0 : -1}
                className="pia-onglet"
                onClick={() => aller({ onglet: o.id })}
                onKeyDown={(ev) => touche(ev, i)}
              >{o.libelle}</button>
            ))}
          </div>

          <div id="pia-panneau" role="tabpanel" aria-labelledby={`pia-onglet-${onglet}`} className="pia-panneau">
            {onglet === 'preparer' ? (
              <Preparer eleve={eleve} pia={pia} changer={changer} seancesEleve={seancesEleve} filtre={filtre} onFiltre={setFiltre} onAller={onAller} onPv1={() => aller({ onglet: 'pv1' })} />
            ) : null}
            {onglet === 'identite' ? <OngletIdentite eleve={eleve} pia={pia} seances={seancesAnnee} changer={changer} /> : null}
            {onglet === 'profil' ? <OngletProfil eleve={eleve} pia={pia} seances={seancesAnnee} changer={changer} /> : null}
            {onglet === 'pv1' ? <OngletPv1 eleve={eleve} pia={pia} seances={seancesAnnee} changer={changer} /> : null}
            {onglet === 'pv2' ? <OngletPv2 eleve={eleve} pia={pia} seances={seancesAnnee} changer={changer} /> : null}
            {onglet === 'amenagements' ? <OngletAmenagements eleve={eleve} pia={pia} seances={seancesAnnee} changer={changer} /> : null}
          </div>
        </>
      )}
      {enImpression && eleve && pia ? <ImpressionPia pia={deidentifie ? deIdentifierPia(pia, eleve) : pia} eleve={eleve} parties={parties} deidentifie={deidentifie} /> : null}
    </div>
  );
}
