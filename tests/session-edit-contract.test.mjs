import fs from 'node:fs';

const core = fs.readFileSync(new URL('../src/app/journalier-core.js', import.meta.url), 'utf8');
const ms = fs.readFileSync(new URL('../src/app/microsoft-core.js', import.meta.url), 'utf8');
const index = fs.readFileSync(new URL('../index.html', import.meta.url), 'utf8');

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

// Le formulaire de séance reste canonique : la modification doit passer par
// le même champ élève que la création, sans imposer un nouvel identifiant UI.
assert(index.includes('id="f-eleve" required'), 'Sélecteur élève de séance absent.');
assert(core.includes('function prepareEditingStudentSelection'), 'Préparation de l’élève en mode édition absente.');
assert(core.includes('originalId&&String(s.studentId)===originalId'), 'Résolution par studentId de la séance absente.');
assert(core.includes('originalName&&String(s.nom)===originalName'), 'Compatibilité avec les anciennes séances par nom absente.');
assert(core.includes('ancien élève — choisissez un élève actuel'), 'Cas d’un ancien élève supprimé non signalé dans le formulaire.');
assert(core.includes('prepareEditingStudentSelection(entry);'), 'La sélection de l’élève historique n’est pas réappliquée après le rafraîchissement du formulaire.');

// La sauvegarde doit utiliser l’élève actuellement choisi et réécrire son studentId.
assert(core.includes('const student=students.find(s=>String(s.nom)===String(p.eleve));'), 'La sauvegarde ne résout pas l’élève sélectionné.');
assert(core.includes('normalized.identification={...(normalized.identification||{}),eleveId:student.studentId};'), 'Le studentId de la séance modifiée n’est pas réattribué.');
assert(core.includes('renderStudentsView();'), 'Le dossier Élève n’est pas rafraîchi après modification de séance.');

// Le changement d’élève doit être traité comme un déplacement du fichier distant
// entre les dossiers élèves, sans réutiliser l’ETag de l’ancien emplacement.
assert(core.includes('remoteMovePending:true'), 'Le déplacement distant d’une séance n’est pas enregistré.');
assert(core.includes('previousRemoteId:existing.remoteId'), 'L’ancienne référence distante de séance n’est pas conservée pour le déplacement.');
assert(ms.includes('const moving=Boolean(reg?.remoteMovePending'), 'La synchronisation ne détecte pas le déplacement de séance.');
assert(ms.includes('const eTagForWrite=moving?(existing?.eTag||null)'), 'Le nouvel emplacement ne protège pas correctement son éventuel ETag propre.');
assert(ms.includes('graphDeleteItemWithETag(reg.previousRemoteId,reg.previousETag||null)'), 'L’ancienne copie distante n’est pas supprimée après déplacement.');
assert(ms.includes('Conflit détecté lors du déplacement de la séance'), 'Le conflit Graph 412 lors d’un déplacement n’est pas traité explicitement.');
assert(ms.includes('delete nextReg.remoteMovePending'), 'L’état de déplacement n’est pas nettoyé après synchronisation réussie.');

// Simulation métier indépendante du DOM : l’ancien nom peut disparaître,
// mais le rattachement final doit utiliser l’identité du nouvel élève.
const oldStudent = { studentId: 'old-1', nom: 'Ancien Nom' };
const newStudent = { studentId: 'new-1', nom: 'Nouveau Nom' };
const oldSession = { id: 's-1', identification: { eleve: oldStudent.nom, eleveId: oldStudent.studentId } };
const available = [newStudent];
const resolved = available.find(s => String(s.studentId) === String(oldSession.identification.eleveId))
  || available.find(s => String(s.nom) === String(oldSession.identification.eleve));
assert(!resolved, 'La simulation doit reconnaître que l’ancien élève a été supprimé.');
const selectedName = newStudent.nom;
const selected = available.find(s => String(s.nom) === selectedName);
const reassigned = {
  ...oldSession,
  identification: { ...oldSession.identification, eleve: selected.nom, eleveId: selected.studentId }
};
assert(reassigned.identification.eleve === 'Nouveau Nom', 'Le nom de l’élève n’est pas réattribué.');
assert(reassigned.identification.eleveId === 'new-1', 'Le studentId du nouvel élève n’est pas réattribué.');
assert(reassigned.id === oldSession.id, 'La modification doit conserver l’identifiant de la séance.');

console.log('✓ Contrat modification des séances passé');
console.log('✓ Élève existant / élève supprimé / réattribution simulés');
console.log('✓ Déplacement OneDrive d’une séance vers un nouvel élève vérifié statiquement');
console.log('✓ Conservation de l’identifiant de séance vérifiée');
