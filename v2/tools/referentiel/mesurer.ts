/** Mesure le moteur de pistes sur le corpus gelé : `node --import tsx tools/referentiel/mesurer.ts [--echecs]`. */
import { mesurer } from '../../tests/mesure-referentiel.ts';

const avecEchecs = process.argv.includes('--echecs');
for (const lot of ['reglage', 'controle'] as const) {
  const m = mesurer(lot);
  console.log(`${lot} : ${m.trouves}/${m.repondables} trouvés, ${m.hors_donnees} hors données, ${m.vagues_sans_piste}/${m.vagues} objectifs vagues sans piste`);
  if (avecEchecs) for (const x of m.echecs) console.log(`  - ${x}`);
}
