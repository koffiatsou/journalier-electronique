import { piaBrutV75 } from './lecture.ts';
import type { LectureV75 } from './lecture.ts';
import type { Ecart, PiaBrutV75 } from './types.ts';

/*
 * Lecture de ce que la V75 range dans OneDrive (dossier privé de l'application), en LECTURE SEULE.
 * Organisation de la V75, à la racine de ce dossier : eleves/<id>/profil.json, eleves/<id>/seances/<id>.json, agenda/agenda.json,
 * pia/<id>/pia.json (la V75 appelle cette racine « Journalier » en interne ; dans OneDrive il n'y a pas de sous-dossier de ce nom).
 * Les dossiers de la V2 (« v2 ») et les anciens dossiers (« Journalier-legacy »…) sont ignorés.
 * Le résultat a exactement la forme de la lecture du coffre local (`LectureV75`) : tout le reste de la reprise
 * (conversion, vérification élève par élève, import, contrôle) est le même, quelle que soit la source.
 */

export interface ElementOneDrive { nom: string; id: string; dossier: boolean }

/** Accès en lecture aux données de la V75 dans OneDrive (remplacé par un faux dans les tests). */
export interface LecteurOneDriveV75 {
  /** Contenu d'un dossier, chemin relatif à la racine du dossier de l'application ('' = la racine). `null` si le dossier n'existe pas. */
  lister(chemin: string): Promise<ElementOneDrive[] | null>;
  /** Texte d'un fichier. */
  lire(id: string): Promise<string>;
}

export interface LectureOneDriveV75 extends LectureV75 {
  /** Faux si OneDrive ne contient aucun dossier de la V75 (rien n'est alors créé). */
  trouve: boolean;
}

const ESSAIS_PARALLELES = 4;
const DOSSIERS_V75 = ['eleves', 'agenda', 'pia', 'profil'];

async function enParallele<T>(liste: readonly T[], action: (x: T) => Promise<void>): Promise<void> {
  let i = 0;
  const ouvriers = Array.from({ length: Math.min(ESSAIS_PARALLELES, liste.length) }, async () => {
    while (i < liste.length) { const x = liste[i]!; i += 1; await action(x); }
  });
  await Promise.all(ouvriers);
}

const fichierJson = (liste: readonly ElementOneDrive[] | null, nom: string): ElementOneDrive | undefined =>
  liste?.find((x) => !x.dossier && x.nom.toLowerCase() === nom);

/**
 * Lit tout ce que la V75 a envoyé dans OneDrive. Un fichier illisible est signalé (jamais ignoré en silence) ;
 * un problème d'accès (connexion expirée, réseau coupé) arrête tout : mieux vaut ne rien montrer qu'un résultat incomplet.
 */
export async function lireOneDriveV75(l: LecteurOneDriveV75, progres?: (texte: string) => void): Promise<LectureOneDriveV75> {
  const racine = await l.lister('');
  const vide: LectureOneDriveV75 = { trouve: false, etat: { eleves: [], seances: [], agenda: { __events: [], __exceptions: {}, __config: {} }, pias: {} }, illisibles: [] };
  // La racine existe toujours : la V75 y est reconnue à ses dossiers.
  if (!racine?.some((x) => x.dossier && DOSSIERS_V75.includes(x.nom.toLowerCase()))) return vide;

  const illisibles: Ecart[] = [];
  const json = async (el: ElementOneDrive, quoi: string): Promise<unknown | undefined> => {
    try { return JSON.parse(await l.lire(el.id)) as unknown; } catch (e) {
      if (e instanceof SyntaxError) { illisibles.push({ quoi, raison: 'fichier abîmé (contenu illisible)' }); return undefined; }
      throw e;
    }
  };

  /* Élèves et séances */
  const dossiersEleves = ((await l.lister('eleves')) ?? []).filter((x) => x.dossier);
  const eleves: unknown[] = [];
  const seances: unknown[] = [];
  let faits = 0;
  await enParallele(dossiersEleves, async (d) => {
    const contenu = await l.lister(`eleves/${d.nom}`);
    const profil = fichierJson(contenu, 'profil.json');
    if (profil) {
      const p = await json(profil, `Élève (${d.nom})`);
      if (p && typeof p === 'object' && !Array.isArray(p)) {
        const o = p as Record<string, unknown>;
        // Comme la V75 : à défaut d'identifiant dans le fichier, le nom du dossier en tient lieu.
        eleves.push(!o.studentId && !o.id ? { ...o, studentId: d.nom } : o);
      } else if (p !== undefined) illisibles.push({ quoi: `Élève (${d.nom})`, raison: 'fichier inattendu' });
    }
    const dossierSeances = contenu?.find((x) => x.dossier && x.nom.toLowerCase() === 'seances');
    if (dossierSeances) {
      const fichiers = ((await l.lister(`eleves/${d.nom}/seances`)) ?? []).filter((x) => !x.dossier && x.nom.toLowerCase().endsWith('.json'));
      for (const f of fichiers) {
        const s = await json(f, `Séance (${d.nom}/${f.nom})`);
        if (s && typeof s === 'object' && !Array.isArray(s)) seances.push(s);
        else if (s !== undefined) illisibles.push({ quoi: `Séance (${d.nom}/${f.nom})`, raison: 'fichier inattendu' });
      }
    }
    faits += 1;
    progres?.(`${faits} / ${dossiersEleves.length} dossiers d’élèves lus…`);
  });

  /* Agenda */
  let agenda: unknown = { __events: [], __exceptions: {}, __config: {} };
  const fa = fichierJson(await l.lister('agenda'), 'agenda.json');
  if (fa) {
    const a = await json(fa, 'Agenda');
    if (a && typeof a === 'object' && !Array.isArray(a)) agenda = a;
    else if (a !== undefined) illisibles.push({ quoi: 'Agenda', raison: 'fichier inattendu' });
  }

  /* PIA */
  const pias: Record<string, PiaBrutV75> = {};
  const dossiersPia = ((await l.lister('pia')) ?? []).filter((x) => x.dossier);
  await enParallele(dossiersPia, async (d) => {
    const f = fichierJson(await l.lister(`pia/${d.nom}`), 'pia.json');
    if (!f) return;
    const v = await json(f, `PIA (${d.nom})`);
    const p = v === undefined ? null : piaBrutV75(v);
    if (p) pias[d.nom] = p;
  });

  // Ordre stable (la lecture en parallèle ne doit pas changer le résultat d'une fois à l'autre).
  const cle = (v: unknown): string => { const o = (v ?? {}) as Record<string, unknown>; return String(o.studentId ?? o.id ?? ''); };
  eleves.sort((a, b) => cle(a).localeCompare(cle(b)));
  seances.sort((a, b) => cle(a).localeCompare(cle(b)));
  illisibles.sort((a, b) => a.quoi.localeCompare(b.quoi));
  return { trouve: true, etat: { eleves, seances, agenda, pias }, illisibles };
}
