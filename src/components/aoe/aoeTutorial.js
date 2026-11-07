/**
 * Didacticiel de Cité Prévention : une vraie partie, guidée pas à pas. Chaque étape explique un geste, montre où
 * agir (flèche jaune dans la 3D, cadre lumineux autour d'un bouton) et attend que le joueur l'ait fait. Les étapes
 * de lecture mettent la partie en pause. Pendant tout le didacticiel, le moteur est en mode calme (ni danger
 * aléatoire ni accident, calendrier de l'année arrêté) ; un presqu'accident est déclenché pour la leçon sur les
 * dangers. À la fin (ou si le joueur passe), la partie continue normalement.
 */
import { kpis, nearMiss, suggestSpot, canPlace, exploredAt } from '../../game/aoe/engine.js';
import { store, emit, lookAt, pushNotes } from './aoeStore';

const DONE_KEY = 'aoe-tutorial-done';
const ADVANCE_DELAY = 1100; // ms : la coche « bien joué » reste visible avant l'étape suivante

/* Lectures de la partie */
const agents = (g) => g.units.filter((u) => u.type === 'agent' && !u.hidden);
const prevs = (g) => g.units.filter((u) => u.type === 'preventeur' && !u.hidden);
const selUnits = (g) => store.ui.selection.map((id) => g.units.find((u) => u.id === id)).filter(Boolean);
const mairie = (g) => g.buildings.find((b) => b.kind === 'mairie');
const jardin = (g) => g.nodes.find((n) => n.kind === 'jardin' && n.amount > 0);
const centroid = (list) => (list.length ? [list.reduce((s, u) => s + u.x, 0) / list.length, list.reduce((s, u) => s + u.z, 0) / list.length] : [0, 12]);
const unitMark = (u) => u && { x: u.x, z: u.z, y: 2.7 };
const pendingUt = (g) => Object.values(g.uts).find((u) => u.active && !u.evaluated);
const MAIRIE_MARK = { x: 0, z: 7.6, y: 7, ring: false }; // au-dessus du portail d'entrée

/** Position de la flèche au-dessus d'une unité de travail. */
function utMark(g, ut) {
  if (!ut) return null;
  if (ut.kind === 'building') {
    // Devant la façade (l'entrée de l'hôtel de ville), sans cercle au sol (il se verrait à travers le bâtiment)
    const b = g.buildings.find((x) => x.id === ut.refId);
    return b && (b.kind === 'mairie' ? MAIRIE_MARK : { x: b.x, z: b.z, y: 7, ring: false });
  }
  if (ut.kind === 'jardins') {
    const j = jardin(g);
    return j && { x: j.x, z: j.z, y: 3 };
  }
  return ut.pos && { x: ut.pos[0], z: ut.pos[1], y: ut.name.startsWith('Chantier') ? 4 : 7 };
}

/**
 * Étapes. `read` : explication (pause, bouton « Suivant ») ; sinon l'étape attend `done`. `focus` : sélecteur du
 * bouton à entourer ; `mark` : position de la flèche dans la 3D ; `look` : recentrage de la caméra à l'entrée ;
 * `back` : la condition de l'étape précédente n'est plus remplie (on y revient). Le texte accepte **gras** et
 * `touche`.
 */
export const STEPS = [
  {
    id: 'bienvenue',
    title: 'Bienvenue à l’hôtel de ville !',
    read: true,
    next: 'Commencer',
    body: [
      'Vous dirigez la commune. Vos **agents** travaillent sur les sites et construisent ; votre **préventeur** veille à leur sécurité.',
      'Pour gagner, faites grandir la cité en tenant **quatre indicateurs de prévention** : document unique, salariés sensibilisés, accidents, registres.',
      'Ce didacticiel montre les gestes de base en 5 minutes. Jusqu’à la fin, aucun danger ne surgit par surprise et le calendrier de l’année est arrêté.',
    ],
  },
  {
    id: 'camera',
    title: 'Regarder la carte',
    skip: true,
    ok: 'Vous savez déplacer la vue.',
    body: [
      'Déplacez la vue avec les touches `Z` `Q` `S` `D` ou les flèches, ou en glissant avec le **bouton du milieu** de la souris.',
      'La **molette** zoome. La **minicarte**, en bas à droite, vous emmène là où vous cliquez.',
    ],
    enter: (g, b) => {
      b.cam = { ...store.camera };
    },
    done: (g, b) => Math.hypot(store.camera.x - b.cam.x, store.camera.z - b.cam.z) > 10 || Math.abs(store.camera.d - b.cam.d) > 8,
  },
  {
    id: 'agent',
    title: 'Sélectionner un agent',
    ok: 'Agent sélectionné : un anneau apparaît à ses pieds.',
    body: [
      'Vos quatre agents attendent devant l’hôtel de ville (flèche jaune). **Cliquez sur l’un d’eux** pour le sélectionner.',
      'Pour en prendre plusieurs d’un coup, **glissez un cadre** autour d’eux en maintenant le clic gauche.',
    ],
    look: (g) => centroid(agents(g)),
    mark: (g) => unitMark(agents(g)[0]),
    done: (g) => selUnits(g).some((u) => u.type === 'agent'),
  },
  {
    id: 'bois',
    title: 'Mettre un agent au travail',
    ok: 'Au travail ! Ses heures seront pointées à l’hôtel de ville.',
    body: [
      'L’agent sélectionné, faites un **clic droit sur un arbre** du bosquet (flèche jaune) : il part à l’élagage, puis revient pointer ses **heures d’équipe** à l’hôtel de ville.',
      'Le **clic droit donne les ordres** : travailler sur un site, construire, se déplacer… Si plus rien n’est sélectionné, recliquez d’abord sur un agent.',
    ],
    enter: (g, b) => {
      const c = centroid(agents(g));
      b.tree = g.nodes.filter((n) => n.kind === 'arbre' && n.amount > 0 && exploredAt(g, n.x, n.z)).sort((p, q) => Math.hypot(p.x - c[0], p.z - c[1]) - Math.hypot(q.x - c[0], q.z - c[1]))[0]?.id;
    },
    look: (g, b) => {
      const t = g.nodes.find((n) => n.id === b.tree);
      const c = centroid(agents(g));
      return t ? [(t.x + c[0]) / 2, (t.z + c[1]) / 2] : c;
    },
    mark: (g, b) => {
      const t = g.nodes.find((n) => n.id === b.tree && n.amount > 0);
      return t && { x: t.x, z: t.z, y: 6.5 };
    },
    done: (g) => agents(g).some((u) => u.task?.kind === 'gather'),
  },
  {
    id: 'inoccupes',
    title: 'Personne ne reste les bras croisés',
    ok: 'Tous les agents travaillent.',
    body: [
      'Les autres agents sont **inoccupés**. Cliquez sur le bouton « inoccupés » en bas à droite (ou touche `.`) pour les sélectionner tous.',
      'Puis **clic droit sur le jardin** (flèche jaune) : ils y travailleront aussi pour des heures d’équipe. C’est le travail le moins risqué.',
    ],
    focus: () => '[data-tuto="idle"]',
    look: (g) => {
      const j = jardin(g);
      return j ? [j.x + 8, j.z - 4] : null;
    },
    mark: (g) => {
      const j = jardin(g);
      return j && { x: j.x, z: j.z, y: 2.6 };
    },
    done: (g) => !agents(g).some((u) => !u.task && !u.injured),
  },
  {
    id: 'ressources',
    title: 'Les ressources',
    read: true,
    focus: () => '[data-tuto="res"]',
    body: [
      'Vos ressources s’affichent en haut de l’écran :',
      '**Heures d’équipe** : le travail des agents sur les bosquets, le jardin et les potagers, pointé au dépôt le plus proche ; elles servent à construire et à recruter. **Budget €** : chantiers de voirie (subventions), impôts locaux ; pour former et s’équiper.',
      '**Temps préventeur** : chaque évaluation ou danger traité en consomme ; la réserve se recharge, et grandit avec chaque préventeur. **Remontées** : les idées d’amélioration de vos agents.',
      'Le dernier compteur, **population / logements**, limite les recrutements : chaque maison loge 5 agents de plus.',
    ],
  },
  {
    id: 'preventeur',
    title: 'Votre préventeur',
    ok: 'Préventeur sélectionné.',
    body: [
      'Le **préventeur** (gilet bleu, flèche jaune) est votre expert prévention : il évalue les lieux de travail et écarte les dangers.',
      'Sélectionnez-le : **clic dessus**, ou touche `H`.',
    ],
    look: (g) => {
      const p = prevs(g)[0];
      return p ? [p.x, p.z] : null;
    },
    mark: (g) => unitMark(prevs(g)[0]),
    done: (g) => selUnits(g).some((u) => u.type === 'preventeur'),
  },
  {
    id: 'evaluer',
    title: 'Le document unique',
    ok: 'Le préventeur part évaluer.',
    body: [
      'Chaque lieu où l’on travaille (bâtiment, bosquet, jardin, chantier) est une **unité de travail** (UT). Dès qu’on y travaille, elle doit être évaluée : c’est le **document unique** (DU).',
      'Les pastilles orange **« DU ? »** les signalent. Préventeur sélectionné, cliquez sur un bouton **« Évaluer… »** en bas, ou faites un **clic droit sur le lieu**.',
    ],
    focus: () => '[data-tuto="evaluate"]',
    look: (g) => {
      const m = utMark(g, pendingUt(g));
      return m ? [m.x, m.z + 4] : null;
    },
    mark: (g) => utMark(g, pendingUt(g)),
    done: (g) => prevs(g).some((u) => u.task?.kind === 'evaluate') || kpis(g).du.evaluated > 0,
  },
  {
    id: 'du',
    title: 'Évaluation en cours',
    ok: 'Unité de travail évaluée : sa pastille passe au vert « DU ✓ ».',
    body: [
      'Le préventeur se rend sur place et évalue l’unité de travail en 6 jours, ce qui consomme une dizaine d’heures de **temps préventeur** (compteur en haut).',
      'À droite, l’indicateur **Document unique** compte les UT évaluées sur les UT en activité. Pour aller plus vite, passez en vitesse ×2 (touche `2`).',
    ],
    focus: () => '[data-tuto="kpi-du"]',
    mark: (g) => {
      const p = prevs(g).find((u) => u.task?.kind === 'evaluate');
      return p ? utMark(g, g.uts[p.task.utId]) : null;
    },
    done: (g) => kpis(g).du.evaluated > 0,
    back: (g) => kpis(g).du.evaluated === 0 && !prevs(g).some((u) => u.task?.kind === 'evaluate'),
  },
  {
    id: 'danger',
    title: 'Un danger !',
    ok: 'Danger neutralisé : personne n’est blessé.',
    body: (g, b) =>
      b.hid
        ? [
            'Un **danger** (panneau ⚠ et cercle rouge) est apparu près d’un agent au travail. S’il reste là, il peut provoquer un **accident**.',
            'Sélectionnez le préventeur (`H`), puis faites un **clic droit sur le panneau ⚠**, ou cliquez sur « Neutraliser le danger le plus proche » en bas.',
          ]
        : ['Regardez bien vos agents au travail…'],
    focus: () => '[data-tuto="neutralize"]',
    enter: (g, b) => {
      b.neut = g.stats.hazards.neutralized;
    },
    update: (g, b) => {
      // Le danger de la leçon apparaît dès qu'un agent travaille ; s'il disparaît sans être traité, il revient
      if (g.stats.hazards.neutralized > b.neut || (b.hid && g.hazards.some((h) => h.id === b.hid))) return;
      const out = [];
      const h = nearMiss(g, out);
      if (!h) return;
      b.hid = h.id;
      pushNotes(out);
      lookAt(h.x, h.z);
      emit();
    },
    mark: (g, b) => {
      const h = g.hazards.find((x) => x.id === b.hid);
      return h && { x: h.x, z: h.z, y: 3.4 };
    },
    done: (g, b) => g.stats.hazards.neutralized > b.neut,
  },
  {
    id: 'accidents',
    title: 'Les accidents',
    read: true,
    focus: () => '[data-tuto="kpi-acc"]',
    body: [
      'Bien joué ! Un accident arrête l’agent 25 jours et coûte 60 €. À **12 accidents**, l’inspection du travail suspend l’activité : la partie est **perdue**.',
      'Il y a moins de dangers dans les **UT évaluées**. Les **agents sensibilisés** (formés) se blessent moins, repèrent les dangers et les signalent eux-mêmes.',
    ],
  },
  {
    id: 'construire',
    title: 'Construire une cantine',
    ok: 'Chantier lancé : les agents choisis le construisent.',
    body: [
      'Sélectionnez un ou deux agents. Dans le menu **Construire** en bas, cliquez sur **Cantine** (100 h d’équipe).',
      'Cliquez ensuite sur la carte pour la poser, par exemple près du jardin (flèche jaune) : les équipes du jardin y pointeront leurs heures sans revenir à l’hôtel de ville. `R` la fait pivoter, `Échap` annule.',
      'Les agents sélectionnés deviennent bâtisseurs : plus ils sont nombreux, plus le chantier avance vite.',
    ],
    focus: (g) => (!store.ui.placing && selUnits(g).some((u) => u.type === 'agent') ? '[data-tuto="build-cantine"]' : null),
    enter: (g, b) => {
      b.count = g.buildings.length;
      const j = jardin(g);
      b.near = j ? [j.x, j.z - 10] : [-16, 8];
      b.spot = suggestSpot(g, 'cantine', b.near);
      b.checked = g.time;
    },
    update: (g, b) => {
      // Emplacement proposé devenu impossible (un agent passe dessus…) : on en propose un autre
      if (g.time - b.checked < 1) return;
      b.checked = g.time;
      if (!b.spot || !canPlace(g, 'cantine', b.spot[0], b.spot[1]).ok) b.spot = suggestSpot(g, 'cantine', b.near) || b.spot;
    },
    look: (g, b) => b.spot,
    mark: (g, b) => b.spot && { x: b.spot[0], z: b.spot[1], y: 1.6, r: 4.5 },
    done: (g, b) => g.buildings.length > b.count,
  },
  {
    id: 'recruter',
    title: 'Recruter un agent',
    ok: 'Recrutement lancé : le nouvel agent arrive dans 6 jours.',
    body: [
      'Plus d’agents, c’est plus d’heures d’équipe. **Cliquez sur l’hôtel de ville**, puis sur le bouton **Agent** (50 h d’équipe).',
      'À son arrivée, donnez-lui du travail : un agent inoccupé ne rapporte rien.',
    ],
    look: () => [0, 10],
    mark: () => MAIRIE_MARK,
    focus: (g) => (store.ui.selection[0] === mairie(g)?.id ? '[data-tuto="unit-agent"]' : null),
    enter: (g, b) => {
      b.units = g.units.length;
    },
    done: (g, b) => g.units.length > b.units || g.buildings.some((x) => x.queue.some((q) => q.kind === 'unit')),
  },
  {
    id: 'paliers',
    title: 'Les paliers',
    read: true,
    focus: () => '[data-tuto="next-age"]',
    body: [
      'La cité progresse par **quatre paliers**, franchis à l’hôtel de ville : Réactif, Conforme, Proactif, puis **Culture de prévention**, la victoire.',
      'L’encadré à droite liste ce qui manque pour le suivant. Palier 2 : 60 % des UT évaluées, deux bâtiments parmi cantine, dépôt et potager, 240 h d’équipe et 120 €.',
      'Au palier 2, construisez la **salle de formation** : les agents sensibilisés portent gilet et casque, se blessent moins et remplissent les **registres**.',
    ],
  },
  {
    id: 'guide',
    title: 'À vous de jouer !',
    read: true,
    next: 'Jouer',
    focus: () => '[data-tuto="hint"]',
    body: [
      'Le panneau **Prochaine étape** vous dit toujours quoi faire ; son bouton **Faire** l’exécute pour vous.',
      'Raccourcis : `Espace` pause · `1` `2` `3` vitesse · `H` préventeur · `.` agents inoccupés. Le bouton **?** en haut rappelle toutes les commandes.',
      'L’année commence maintenant, et les dangers apparaissent là où l’on travaille. Bonne partie !',
    ],
  },
];

/* ------------------------------------------------------------------ */
/* Déroulé                                                              */
/* ------------------------------------------------------------------ */

export const tutoStep = () => (store.tuto?.base ? STEPS[store.tuto.i] : null);

function enter(i) {
  const t = store.tuto;
  const g = store.game;
  const s = STEPS[i];
  t.i = i;
  t.base = {};
  t.pendingAt = 0;
  s.enter?.(g, t.base);
  const at = s.look?.(g, t.base);
  if (at) lookAt(at[0], at[1]);
  store.ui.paused = Boolean(s.read);
  emit();
}

/** Étape suivante (bouton « Suivant » ou condition remplie). */
export function tutoNext() {
  const t = store.tuto;
  if (!t) return;
  if (t.i + 1 >= STEPS.length) finishTutorial();
  else enter(t.i + 1);
}

/** Fin (ou abandon) du didacticiel : la partie continue normalement. */
export function finishTutorial(skipped = false) {
  if (!store.tuto) return;
  store.tuto = null;
  if (store.game) store.game.calm = false;
  store.ui.paused = false;
  try {
    localStorage.setItem(DONE_KEY, '1');
  } catch {
    /* stockage indisponible : sans conséquence */
  }
  pushNotes([{ level: 'success', text: skipped ? 'Didacticiel passé : l’année commence. Le bouton ? en haut rappelle les commandes.' : 'Didacticiel terminé : l’année commence. Suivez le panneau « Prochaine étape ».' }]);
  emit();
}

export function tutorialDone() {
  try {
    return localStorage.getItem(DONE_KEY) === '1';
  } catch {
    return false;
  }
}

/** Appelé à chaque image : avance le didacticiel quand l'étape en cours est réussie. */
export function tutoTick() {
  const t = store.tuto;
  const g = store.game;
  if (!t || !g || store.ui.screen !== 'game') return;
  if (!t.base) {
    enter(t.i);
    return;
  }
  const s = STEPS[t.i];
  if (t.pendingAt) {
    if (performance.now() - t.pendingAt > ADVANCE_DELAY) tutoNext();
    return;
  }
  if (s.read) return;
  s.update?.(g, t.base);
  if (s.back?.(g, t.base)) {
    enter(t.i - 1);
    return;
  }
  if (s.done?.(g, t.base)) {
    t.pendingAt = performance.now();
    emit();
  }
}

/** Flèche de la 3D pour l'étape en cours ({ x, z, y, r }) ou null. */
export function tutoMark() {
  const s = tutoStep();
  if (!s?.mark || store.tuto.pendingAt) return null;
  return s.mark(store.game, store.tuto.base) || null;
}

/** Sélecteur du bouton à entourer pour l'étape en cours, ou null. */
export function tutoFocus() {
  const s = tutoStep();
  if (!s?.focus || store.tuto.pendingAt) return null;
  return s.focus(store.game, store.tuto.base) || null;
}
