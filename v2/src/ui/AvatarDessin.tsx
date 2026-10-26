import { dessiner } from '../domain/avatar/index.ts';
import type { AvatarEleve, Forme } from '../domain/avatar/index.ts';

/**
 * « fond » et « haut » prennent la couleur de l'élève (variables --c-fond et --c-bord posées par la classe c-0 … c-9
 * d'un parent) : le dessin suit le thème clair/sombre. Aucun style dans le texte de la page (CSP stricte).
 */
const jeton = (f: string): string | undefined => (f === 'fond' ? 'av-fond' : f === 'haut' ? 'av-haut' : undefined);

function Element({ forme }: { forme: Forme }) {
  const classe = jeton(forme.f);
  const trait = forme.s
    ? { stroke: forme.s, strokeWidth: forme.sw ?? 1 }
    : {};
  const commun = { className: classe, fill: classe ? undefined : forme.f, opacity: forme.o, ...trait };
  switch (forme.t) {
    case 'rect': return <rect x={forme.x} y={forme.y} width={forme.w} height={forme.h} rx={forme.rx} {...commun} />;
    case 'circle': return <circle cx={forme.cx} cy={forme.cy} r={forme.r} {...commun} />;
    case 'ellipse': return <ellipse cx={forme.cx} cy={forme.cy} rx={forme.rx} ry={forme.ry} {...commun} />;
    case 'path': return <path d={forme.d} {...commun} />;
  }
}

/** Le dessin seul (décoratif : le nom de l'élève est toujours écrit à côté). */
export function AvatarDessin({ avatar }: { avatar: AvatarEleve }) {
  return (
    <svg className="avatar-svg" viewBox="0 0 64 64" focusable="false" aria-hidden="true" strokeLinecap="round" strokeLinejoin="round">
      {dessiner(avatar).map((forme, i) => <Element key={i} forme={forme} />)}
    </svg>
  );
}
