/**
 * Personas de test : profils de joueurs visés par Cité Prévention et robots qui jouent comme eux, uniquement par
 * les commandes du joueur (applyCommand). Ils servent à mesurer l'intérêt du jeu pour chaque public (script
 * scripts/simulate-aoe.mjs) ; la « démo automatique » du stand reprend l'un d'eux (mode vitrine de la page /aoe).
 */
import { BUILDINGS, NODES, TECHS, UNITS, TRAIN, POP_MAX } from './config.js';
import { applyCommand, kpis, population, ageStatus, nextHint, suggestSpot, exploredAt, findTarget, scoutPoint } from './engine.js';

export const PERSONAS = [
  {
    id: 'claire',
    name: 'Claire, maire d’une commune de 3 000 habitants',
    role: 'Visiteuse du salon des maires, ne joue jamais aux jeux vidéo',
    attentes: 'Comprendre en 10 minutes à quoi sert le document unique et ce que la prévention change aux accidents ; ne pas se sentir perdue.',
    jeu: 'Lit le panneau « Prochaine étape » et suit le conseil, une décision toutes les 8 secondes environ.',
    every: 8,
  },
  {
    id: 'karim',
    name: 'Karim, responsable prévention (QSE)',
    role: 'Connaît le DUER par cœur, joueur occasionnel',
    attentes: 'Retrouver la logique du métier : évaluer d’abord, former, traiter les remontées ; que les bonnes pratiques paient.',
    jeu: 'Évalue toutes les UT au plus tôt (même avant l’ouverture des bâtiments), forme tout le monde, deux préventeurs, améliorations de prévention en priorité.',
    every: 3,
  },
  {
    id: 'sophie',
    name: 'Sophie, directrice générale des services',
    role: 'Pilote le budget de la commune, joueuse de jeux de gestion',
    attentes: 'Voir que la prévention est un investissement : arbitrer budget, temps des agents et indicateurs.',
    jeu: 'Économie d’abord (commerces, outillage, beaucoup d’agents), prévention juste ce qu’il faut pour franchir les paliers.',
    every: 4,
  },
  {
    id: 'lucas',
    name: 'Lucas, joueur de stratégie confirmé',
    role: 'Joue aux jeux de stratégie en temps réel, cherche l’optimisation',
    attentes: 'De la profondeur : ordre de construction, rythme, choix d’améliorations ; une partie qui ne se gagne pas toute seule.',
    jeu: 'Ordre de construction serré, paliers dès que possible, indicateurs remplis au plus juste, une décision par seconde.',
    every: 1,
  },
  {
    id: 'marc',
    name: 'Marc, agent technique « la production d’abord »',
    role: 'Sur le terrain, la paperasse l’agace',
    attentes: 'Que ça bouge ; il joue pour produire et construire.',
    jeu: 'Récolte, construit et recrute, mais n’évalue rien, ne forme personne et ignore les dangers.',
    every: 3,
  },
  {
    id: 'demo',
    name: 'Démo automatique du stand',
    role: 'Commercial Evarisk qui laisse tourner le jeu sur l’écran du stand',
    attentes: 'Une partie qui montre tous les mécanismes et les quatre indicateurs en une dizaine de minutes, et qui se termine bien.',
    jeu: 'Joueur équilibré : économie, évaluations, formations et améliorations de prévention au fil de l’eau.',
    every: 2,
  },
];

/* ------------------------------------------------------------------ */
/* Outils communs des robots                                            */
/* ------------------------------------------------------------------ */

const RES = ['heures', 'budget'];
const ready = (u) => !u.injured && !u.hidden;
const agentsOf = (s) => s.units.filter((u) => u.type === 'agent' && ready(u));
const has = (s, kind, done = false) => s.buildings.some((b) => b.kind === kind && (!done || b.done));
const count = (s, kind) => s.buildings.filter((b) => b.kind === kind).length;
const mairieOf = (s) => s.buildings.find((b) => b.kind === 'mairie');
const queuedUnits = (s, id) => s.buildings.reduce((n, b) => n + b.queue.filter((q) => q.kind === 'unit' && (!id || q.id === id)).length, 0);
const queuedTech = (s, id) => s.buildings.some((b) => b.queue.some((q) => q.kind === 'tech' && q.id === id));

/** Ressources disponibles une fois la réserve de l'objectif mise de côté. */
const spare = (s, reserve) => Object.fromEntries(['heures', 'budget', 'remontees'].map((r) => [r, s.res[r] - (reserve[r] || 0)]));
const groves = (s) => s.nodes.filter((n) => n.kind === 'arbre' && n.amount > 0 && exploredAt(s, n.x, n.z));
const fits = (have, cost = {}) => Object.entries(cost).every(([r, v]) => have[r] >= v);

function resourceTargets(s, resource, from = [0, 0]) {
  const out = [];
  s.nodes.forEach((n) => {
    if (n.amount > 0 && NODES[n.kind].resource === resource && exploredAt(s, n.x, n.z)) out.push({ id: n.id, x: n.x, z: n.z, d: Math.hypot(n.x - from[0], n.z - from[1]) });
  });
  s.buildings.forEach((b) => {
    const f = BUILDINGS[b.kind].field;
    if (b.done && f && f.resource === resource && b.fieldLeft > 0) out.push({ id: b.id, x: b.x, z: b.z, d: Math.hypot(b.x - from[0], b.z - from[1]) * 0.8, field: true, left: b.fieldLeft });
  });
  return out.sort((a, b) => a.d - b.d);
}

function targetResource(s, task) {
  const n = s.nodes.find((x) => x.id === task.target.id);
  if (n) return NODES[n.kind].resource;
  const b = s.buildings.find((x) => x.id === task.target.id);
  return b ? BUILDINGS[b.kind].field?.resource : null;
}
const gatherersOn = (s, resource) => agentsOf(s).filter((u) => u.task?.kind === 'gather' && targetResource(s, u.task) === resource);

/**
 * Ressource à faire récolter : celle dont le stock (plus la production en cours) couvre le moins bien le besoin du
 * moment (objectif + base de croisière).
 */
function neediest(s, need) {
  let best = null;
  let bestV = Infinity;
  RES.forEach((r) => {
    if (!resourceTargets(s, r).length) return;
    const v = (s.res[r] + gatherersOn(s, r).length * 35) / Math.max(1, need[r] || 0);
    if (v < bestV) {
      bestV = v;
      best = r;
    }
  });
  return best;
}

/**
 * Répartition des agents entre les trois récoltes : parts cibles du palier, réduites pour une ressource déjà
 * largement couverte ; les inoccupés vont là où il manque le plus de monde, et un agent par tour change de
 * récolte si l'écart dépasse une personne.
 */
function allocate(s, shares, need, taken, cmds) {
  const avail = RES.filter((r) => resourceTargets(s, r).length);
  if (!avail.length) return;
  // Parts du palier, déplacées vers ce qui manque réellement pour le prochain achat ; une ressource déjà bien
  // pourvue perd la moitié de ses récolteurs
  const deficit = Object.fromEntries(avail.map((r) => [r, Math.max(0, (need[r] || 0) - s.res[r])]));
  const totalDef = avail.reduce((n, r) => n + deficit[r], 0);
  const f = {};
  avail.forEach((r) => {
    f[r] = (shares[r] || 0.1) * (totalDef > 0 ? 0.4 + (2.5 * deficit[r]) / totalDef : 1) * (deficit[r] === 0 && s.res[r] > (need[r] || 0) + 150 ? 0.5 : 1);
  });
  const sum = avail.reduce((n, r) => n + f[r], 0);
  const cur = Object.fromEntries(avail.map((r) => [r, gatherersOn(s, r).length]));
  const idle = agentsOf(s).filter((u) => !u.task && !taken.has(u.id));
  const total = avail.reduce((n, r) => n + cur[r], 0) + idle.length;
  const want = Object.fromEntries(avail.map((r) => [r, (total * f[r]) / sum]));
  idle.forEach((u) => {
    const r = avail.sort((a, b) => cur[a] - want[a] - (cur[b] - want[b]))[0];
    cur[r] += 1;
    sendGather(s, [u], r, cmds);
    taken.add(u.id);
  });
  const over = [...avail].sort((a, b) => cur[b] - want[b] - (cur[a] - want[a]))[0];
  const under = [...avail].sort((a, b) => cur[a] - want[a] - (cur[b] - want[b]))[0];
  if (over !== under && cur[over] - want[over] >= 1 && want[under] - cur[under] >= 1) {
    const mover = gatherersOn(s, over).find((u) => !taken.has(u.id) && !(u.carry?.amount > 3));
    if (mover) {
      sendGather(s, [mover], under, cmds);
      taken.add(mover.id);
    }
  }
}

function sendGather(s, units, resource, cmds) {
  if (!units.length || !resource) return;
  const t = resourceTargets(s, resource);
  if (!t.length) return;
  // Répartit sur les cibles proches (arbres, jardin, potagers)
  units.forEach((u, i) => cmds.push({ type: 'gather', unitIds: [u.id], nodeId: t[i % Math.max(1, Math.min(t.length, 5))].id }));
}

function place(s, kind, near, builders, cmds) {
  if (!builders.length) return false;
  const rot = (Math.round(near[0] + near[1]) + s.buildings.length) % 2 ? 90 : 0;
  const spot = suggestSpot(s, kind, near, rot) || suggestSpot(s, kind, near, 90 - rot) || suggestSpot(s, kind, [0, 24], 0);
  if (!spot) return false;
  cmds.push({ type: 'place', kind, x: spot[0], z: spot[1], rot: suggestSpot(s, kind, near, rot) ? rot : 90 - rot, unitIds: builders.map((u) => u.id) });
  return true;
}

function pickBuilders(s, n, taken) {
  const ag = agentsOf(s).filter((u) => !taken.has(u.id) && u.task?.kind !== 'train' && u.task?.kind !== 'build');
  const idle = ag.filter((u) => !u.task);
  const busy = ag.filter((u) => u.task?.kind === 'gather').sort((a, b) => (a.carry?.amount || 0) - (b.carry?.amount || 0));
  return [...idle, ...busy].slice(0, n);
}

/** Emplacement d'un bâtiment : dépôt près des bosquets, potager près de la cantine, point sécurité près d'un chantier. */
function nearFor(s, kind) {
  const m = mairieOf(s);
  if (kind === 'depot') {
    const g = groves(s).sort((a, b) => Math.hypot(a.x, a.z) - Math.hypot(b.x, b.z))[0];
    return g ? [g.x, g.z] : [m.x - 20, m.z - 16];
  }
  if (kind === 'cantine') {
    const j = s.nodes.find((n) => n.kind === 'jardin');
    return [j.x, j.z + 9];
  }
  if (kind === 'potager') {
    const c = s.buildings.find((b) => b.kind === 'cantine') || m;
    return [c.x + 8, c.z + 4];
  }
  if (kind === 'point') {
    const site = s.nodes.find((n) => n.kind === 'chantier' && n.amount > 0 && exploredAt(s, n.x, n.z));
    return site ? [site.x + 5, site.z + 5] : [m.x, m.z + 20];
  }
  if (kind === 'maison' || kind === 'commerce') return [m.x + 20, m.z + 18];
  return [m.x - 20, m.z + 20];
}

/* ------------------------------------------------------------------ */
/* Planificateur à objectif courant                                     */
/* ------------------------------------------------------------------ */

/**
 * Joueur qui se fixe un objectif (prochain bâtiment de son plan, sinon le palier suivant) et met de côté de quoi
 * le payer ; il ne dépense le reste (recrutements, formations, améliorations, potagers) que s'il en a les moyens.
 * Réglages par persona : plan de construction par palier, améliorations, effectifs, exigence en prévention.
 */
function planner(p) {
  return (s) => {
    const cmds = [];
    const taken = new Set();
    const k = kpis(s);
    const { pop, cap } = population(s);
    const mairie = mairieOf(s);
    const agents = agentsOf(s);
    const st = ageStatus(s);

    // Objectif : prochain bâtiment du plan du palier, puis le palier suivant
    const plan = p.plan[s.age] || [];
    const nextBuilding = plan.find((kind) => !has(s, kind));
    let reserve = {};
    if (st.ok && p.ageUp !== false) cmds.push({ type: 'queue', buildingId: mairie.id, item: { kind: 'age' } });
    else if (nextBuilding && BUILDINGS[nextBuilding].age <= s.age) {
      if (fits(s.res, BUILDINGS[nextBuilding].cost)) place(s, nextBuilding, nearFor(s, nextBuilding), pickBuilders(s, p.builders || 2, taken), cmds) && pickBuilders(s, p.builders || 2, taken).forEach((u) => taken.add(u.id));
      else reserve = BUILDINGS[nextBuilding].cost;
    } else if (st.next && p.ageUp !== false && !st.upgrading) reserve = st.next.cost;
    const have = spare(s, reserve);

    // Préventeurs : évaluer (UT en activité, puis bâtiments en chantier), sinon explorer
    const prev = s.units.filter((u) => u.type === 'preventeur' && ready(u));
    if (p.evaluate) {
      const targetDu = p.evaluate === 'min' ? (st.next?.needs?.du ?? 1) : 1;
      const pending = [...Object.values(s.uts).filter((u) => u.active && !u.evaluated), ...(p.evaluate === 'all' ? Object.values(s.uts).filter((u) => !u.active && !u.evaluated && u.kind === 'building' && s.buildings.some((b) => b.id === u.refId)) : [])];
      if (k.du.ratio < targetDu - 1e-9 || p.evaluate === 'all' || s.time > 7.5 * 60) {
        prev.forEach((u) => {
          if (u.task && !u.task.auto) return;
          const ut = pending.find((x) => !s.units.some((o) => o.task?.kind === 'evaluate' && o.task.utId === x.id));
          if (ut) {
            cmds.push({ type: 'evaluate', unitIds: [u.id], utId: ut.id });
            taken.add(u.id);
          }
        });
      }
    }
    // Dangers signalés : un préventeur libre va les neutraliser (le plus proche d'abord)
    if (p.evaluate) {
      prev.forEach((u) => {
        if ((u.task && !u.task.auto) || taken.has(u.id)) return;
        const h = s.hazards
          .filter((x) => x.revealed && !s.units.some((o) => o.task?.kind === 'neutralize' && o.task.id === x.id))
          .sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z))[0];
        if (h) {
          cmds.push({ type: 'neutralize', unitIds: [u.id], hazardId: h.id });
          taken.add(u.id);
        }
      });
    }
    const lacking = !findTarget(s, 'budget', [0, 0]) || groves(s).length < 3 || (s.time > 120 && resourceTargets(s, 'budget').length < 2);
    if (lacking && !s.units.some((u) => u.task?.kind === 'move' && u.task.scout)) {
      const scout = prev.find((u) => !u.task && !taken.has(u.id)) || agents.find((u) => !u.task && !taken.has(u.id));
      const to = scout && scoutPoint(s, [scout.x, scout.z]);
      if (to) {
        cmds.push({ type: 'move', unitIds: [scout.id], to, scout: true });
        taken.add(scout.id);
      }
    }

    // Besoin de travail : objectif + croisière (heures pour construire et recruter, budget pour former)
    const need = { heures: 210 + (reserve.heures || 0), budget: (s.age >= 2 ? 120 : 40) + (reserve.budget || 0) };
    if (p.trainFirst && s.age >= 2) need.budget += 80;
    allocate(s, p.shares ? p.shares(s) : s.age >= 2 ? { heures: 0.66, budget: 0.34 } : { heures: 0.8, budget: 0.2 }, need, taken, cmds);

    // Logements
    const queued = queuedUnits(s);
    // (peu chers et indispensables : ils ne respectent pas la réserve de l'objectif)
    if (pop + queued >= cap - 1 && cap < POP_MAX && !s.buildings.some((b) => b.kind === 'maison' && !b.done) && (pop >= cap ? s.res.heures : have.heures) >= BUILDINGS.maison.cost.heures) {
      if (place(s, 'maison', nearFor(s, 'maison'), pickBuilders(s, 1, taken), cmds)) {
        have.heures -= BUILDINGS.maison.cost.heures;
      }
    }
    // Recrutement
    const [minA, maxA] = p.agents(s);
    const n = agents.length + queuedUnits(s, 'agent');
    if (n < maxA && pop + queued < cap && mairie.queue.filter((q) => q.kind === 'unit').length < 2 && (n < minA ? s.res.heures >= 50 : have.heures >= 50)) {
      cmds.push({ type: 'queue', buildingId: mairie.id, item: { kind: 'unit', id: 'agent' } });
      have.heures -= 50;
    }
    // Potagers : le travail le moins risqué ; un pour cinq agents environ, construits même pendant l'épargne quand
    // le jardin est épuisé (comme les maisons, ils ne respectent alors pas la réserve)
    const gardenLeft = s.nodes.filter((x) => x.kind === 'jardin').reduce((sum, x) => sum + x.amount, 0) + s.buildings.filter((b) => b.kind === 'potager').reduce((sum, b) => sum + (b.done ? b.fieldLeft : 600), 0);
    const activeFields = s.buildings.filter((b) => b.kind === 'potager' && (b.fieldLeft > 0 || !b.done)).length;
    const wantedFields = Math.max(p.potagers(s), Math.ceil((agents.length * 0.4) / 2));
    const starving = gardenLeft < 150 || activeFields === 0;
    if (has(s, 'cantine', true) && (activeFields < wantedFields || starving) && count(s, 'potager') < 8 && (starving ? s.res.heures : have.heures) >= BUILDINGS.potager.cost.heures && !s.buildings.some((b) => b.kind === 'potager' && !b.done)) {
      if (place(s, 'potager', nearFor(s, 'potager'), pickBuilders(s, 1, taken), cmds)) have.heures -= BUILDINGS.potager.cost.heures;
    }
    // Bâtiments facultatifs du plan au-delà des deux premiers (avec le surplus)
    (p.extra?.[s.age] || []).forEach((kind) => {
      if (has(s, kind) && kind !== 'commerce') return;
      if (kind === 'commerce' && count(s, 'commerce') >= (p.commerces || 0)) return;
      if (cmds.some((c) => c.type === 'place') || !fits(have, BUILDINGS[kind].cost)) return;
      if (place(s, kind, nearFor(s, kind), pickBuilders(s, 2, taken), cmds)) Object.entries(BUILDINGS[kind].cost).forEach(([r, v]) => (have[r] -= v));
    });

    // Formation des agents
    const formation = s.buildings.find((b) => b.kind === 'formation' && b.done);
    if (formation && p.train) {
      const want = p.train === 'min' ? Math.min(1, (st.next?.needs?.sensibilises ?? 0.85) + 0.08) : 1;
      const inTraining = s.units.filter((u) => u.task?.kind === 'train' || u.task?.kind === 'training').length;
      const places = (s.techs.formateurs ? 9 : TRAIN.places) - inTraining;
      const budget = p.trainFirst ? s.res.budget : have.budget;
      if (k.sensibilises.ratio < want && places > 0 && budget >= TRAIN.cost.budget) {
        const pupils = agents.filter((u) => !u.sens && !taken.has(u.id) && u.task?.kind !== 'train' && u.task?.kind !== 'build').slice(0, Math.min(places, Math.floor(budget / TRAIN.cost.budget), p.trainBatch || 3));
        if (pupils.length) {
          cmds.push({ type: 'train', unitIds: pupils.map((u) => u.id), buildingId: formation.id });
          pupils.forEach((u) => taken.add(u.id));
          have.budget -= pupils.length * TRAIN.cost.budget;
        }
      }
    }

    // Améliorations (dans l'ordre de la persona, avec le surplus)
    for (const id of p.techs(s)) {
      const t = TECHS[id];
      if (s.techs[id] || queuedTech(s, id) || t.age > s.age) continue;
      const at = s.buildings.find((b) => b.kind === t.at && b.done && b.queue.length < 2);
      if (!at || !fits(have, t.cost)) continue;
      cmds.push({ type: 'queue', buildingId: at.id, item: { kind: 'tech', id } });
      Object.entries(t.cost).forEach(([r, v]) => (have[r] -= v));
      break;
    }

    // Préventeurs supplémentaires
    const prevBuilding = s.buildings.find((b) => b.kind === 'prevention' && b.done && !b.queue.length);
    if (prevBuilding && prev.length + queuedUnits(s, 'preventeur') < p.preventeurs(s) && fits(have, UNITS.preventeur.cost) && pop + queued < cap) cmds.push({ type: 'queue', buildingId: prevBuilding.id, item: { kind: 'unit', id: 'preventeur' } });
    return cmds;
  };
}

/** Claire : suit le conseil du panneau « Prochaine étape ». */
function hintFollower(s) {
  const h = nextHint(s);
  if (h.action) return [h.action];
  if (h.build) {
    const cmds = [];
    place(s, h.build, nearFor(s, h.build), pickBuilders(s, 2, new Set()), cmds);
    return cmds;
  }
  return [];
}

export const STRATEGIES = {
  claire: hintFollower,
  karim: planner({
    plan: { 1: ['cantine', 'depot'], 2: ['formation', 'prevention'], 3: [] },
    extra: { 2: ['infirmerie', 'point', 'atelier'], 3: ['entrepot'] },
    evaluate: 'all',
    train: 'all',
    trainFirst: true,
    trainBatch: 3,
    agents: (s) => (s.age >= 3 ? [16, 24] : s.age === 2 ? [12, 20] : [9, 12]),
    potagers: (s) => (s.age >= 2 ? 4 : 2),
    preventeurs: (s) => (s.age >= 3 ? 3 : 2),
    techs: () => ['methode', 'appli', 'accueil', 'plan', 'epi', 'formateurs', 'outils', 'gestes', 'analyse', 'balisage', 'suivi', 'epc', 'jardins'],
  }),
  sophie: planner({
    plan: { 1: ['cantine', 'depot'], 2: ['formation', 'commerce'], 3: [] },
    extra: { 2: ['commerce', 'atelier'], 3: [] },
    commerces: 3,
    evaluate: 'min',
    train: 'min',
    trainBatch: 3,
    agents: (s) => (s.age >= 3 ? [20, 28] : s.age === 2 ? [14, 24] : [10, 14]),
    potagers: (s) => (s.age >= 2 ? 5 : 2),
    preventeurs: () => 1,
    techs: () => ['outils', 'jardins', 'chariots', 'formateurs', 'appli', 'epi'],
  }),
  lucas: planner({
    // Optimisation : le point sécurité, peu cher, remplit la condition des deux bâtiments de l'âge 2
    plan: { 1: ['cantine', 'depot'], 2: ['formation', 'point'], 3: [] },
    extra: { 2: ['prevention', 'commerce'], 3: [] },
    commerces: 2,
    evaluate: 'min',
    train: 'min',
    trainFirst: true,
    trainBatch: 6,
    builders: 3,
    agents: (s) => (s.age >= 3 ? [18, 26] : s.age === 2 ? [14, 22] : [10, 13]),
    potagers: (s) => (s.age >= 2 ? 5 : 3),
    preventeurs: (s) => (s.age >= 2 ? 2 : 1),
    techs: (s) => (s.age >= 3 ? ['appli', 'analyse', 'formateurs', 'methode', 'accueil'] : ['jardins', 'methode', 'formateurs', 'appli', 'accueil', 'outils']),
  }),
  marc: planner({
    plan: { 1: ['cantine', 'depot'], 2: ['atelier', 'commerce'], 3: [] },
    extra: { 2: ['commerce'], 3: [] },
    commerces: 3,
    evaluate: false,
    train: false,
    agents: (s) => (s.age >= 2 ? [14, 26] : [10, 16]),
    potagers: () => 4,
    preventeurs: () => 1,
    techs: () => ['outils', 'jardins', 'chariots'],
  }),
  demo: planner({
    plan: { 1: ['cantine', 'depot'], 2: ['formation', 'point'], 3: [] },
    extra: { 2: ['prevention', 'infirmerie', 'commerce'], 3: ['entrepot'] },
    commerces: 1,
    evaluate: 'all',
    train: 'all',
    trainFirst: true,
    trainBatch: 3,
    agents: (s) => (s.age >= 3 ? [16, 22] : s.age === 2 ? [12, 20] : [9, 12]),
    potagers: (s) => (s.age >= 2 ? 4 : 2),
    preventeurs: () => 2,
    techs: () => ['methode', 'jardins', 'appli', 'accueil', 'outils', 'plan', 'formateurs', 'epi', 'analyse', 'gestes', 'epc'],
  }),
};

/** Joue une décision du robot `id` si son heure est venue ; renvoie les commandes appliquées et leur résultat. */
export function botTick(state, id, memo) {
  const persona = PERSONAS.find((x) => x.id === id);
  if (state.time < (memo.next || 0)) return [];
  memo.next = state.time + persona.every;
  return STRATEGIES[id](state).map((c) => ({ c, r: applyCommand(state, c) }));
}
