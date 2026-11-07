/**
 * Moteur de Cité Prévention : état de la partie, pas de simulation, commandes du joueur, indicateurs et score.
 * Pur JavaScript (ni React, ni three, ni DOM) : il tourne sous Node pour les robots « personas » d'équilibrage.
 *
 * createGame({ seed }) → state
 * step(state, dt)      → notifications[]   (fait avancer `state` en place ; dt ≤ 0,25 s)
 * applyCommand(state, command) → { ok: true } | { ok: false, error }
 * kpis(state), scoreOf(state), ageStatus(state), canPlace(state, …), nextHint(state)…
 */
import {
  MAP_HALF,
  MONTH,
  YEAR_MONTHS,
  POP_MAX,
  CARRY,
  CARRY_TECH,
  START,
  UNITS,
  BUILDINGS,
  NODES,
  AGES,
  TECHS,
  HAZARD,
  ACCIDENT,
  EVAL_TIME,
  TRAIN,
  CONSTRUCTION_RISK,
  EVENTS,
  SCORE,
  RESOURCES,
  PREV_TIME,
  jours,
} from './config.js';
import { nextRandom, makeRandom } from './rng.js';
import { createGrid, markRect, findPath, nearestFree, centerOf } from './grid.js';

const FIRST_NAMES = ['Paul', 'Léa', 'Karim', 'Sophie', 'Lucas', 'Inès', 'Hugo', 'Chloé', 'Yanis', 'Manon', 'Théo', 'Camille', 'Nadia', 'Julien', 'Emma', 'Mehdi', 'Sarah', 'Louis', 'Zoé', 'Antoine', 'Jade', 'Rayan', 'Lina', 'Maxime', 'Clara', 'Nathan', 'Alice', 'Bilal', 'Margaux', 'Enzo'];
const FOG = 2; // taille d'une case de brouillard (unités)
export const FOG_N = (MAP_HALF * 2) / FOG;
const NEAR = 1.7; // distance d'interaction avec un bâtiment ou une ressource
const REPLANT = 30; // heures d'équipe pour replanter un potager épuisé
/** Famille d'une source d'heures : on reste sur le même type de travail quand une ressource s'épuise. */
const familyOf = (kind) => (kind === 'arbre' || kind === 'chantier' ? kind : 'jardin');

/* ------------------------------------------------------------------ */
/* Géométrie                                                            */
/* ------------------------------------------------------------------ */

/** Dimensions au sol d'un bâtiment selon sa rotation (0, 90, 180, 270). */
export function footprint(kind, rot = 0) {
  const [w, d] = BUILDINGS[kind].size;
  return rot % 180 === 0 ? [w, d] : [d, w];
}

export function rectOf(b) {
  const [w, d] = footprint(b.kind, b.rot);
  return [b.x - w / 2, b.z - d / 2, b.x + w / 2, b.z + d / 2];
}

function distToRect(x, z, r) {
  const dx = Math.max(r[0] - x, 0, x - r[2]);
  const dz = Math.max(r[1] - z, 0, z - r[3]);
  return Math.hypot(dx, dz);
}

/** Point d'approche d'un rectangle depuis (x, z) : bord le plus proche, un peu à l'extérieur. */
function approach(x, z, r, out = 0.9) {
  const px = Math.max(r[0], Math.min(r[2], x));
  const pz = Math.max(r[1], Math.min(r[3], z));
  if (px > r[0] && px < r[2] && pz > r[1] && pz < r[3]) {
    // Point à l'intérieur : on sort par le bord le plus proche
    const m = [px - r[0], r[2] - px, pz - r[1], r[3] - pz];
    const i = m.indexOf(Math.min(...m));
    return [[r[0] - out, pz], [r[2] + out, pz], [px, r[1] - out], [px, r[3] + out]][i];
  }
  // Point extérieur : projection sur le bord, poussée vers l'extérieur du ou des côtés concernés
  const ox = px === r[0] ? -out : px === r[2] ? out : 0;
  const oz = pz === r[1] ? -out : pz === r[3] ? out : 0;
  return [px + ox, pz + oz];
}

/** Devant d'un bâtiment (sortie des unités formées). */
function frontOf(b) {
  const r = rectOf(b);
  const a = (b.rot * Math.PI) / 180;
  const fx = Math.sin(a);
  const fz = Math.cos(a);
  const cx = (r[0] + r[2]) / 2;
  const cz = (r[1] + r[3]) / 2;
  const half = Math.abs(fx) > 0.5 ? (r[2] - r[0]) / 2 : (r[3] - r[1]) / 2;
  return [cx + fx * (half + 1.6), cz + fz * (half + 1.6)];
}

const nodeRect = (n) => (n.kind === 'chantier' ? [n.x - 2.5, n.z - 1.5, n.x + 2.5, n.z + 1.5] : n.kind === 'jardin' ? [n.x - 2.5, n.z - 2.5, n.x + 2.5, n.z + 2.5] : [n.x - 0.5, n.z - 0.5, n.x + 0.5, n.z + 0.5]);

/* ------------------------------------------------------------------ */
/* Création de la partie                                                */
/* ------------------------------------------------------------------ */

function newId(state, prefix) {
  state.nextId += 1;
  return `${prefix}${state.nextId}`;
}

function addUt(state, ut) {
  const id = ut.id || newId(state, 'ut');
  state.uts[id] = { id, active: false, evaluated: false, progress: 0, ...ut };
  return id;
}

function addUnit(state, type, x, z, extra = {}) {
  const id = newId(state, 'u');
  const name = FIRST_NAMES[(state.unitCount * 7 + state.seed) % FIRST_NAMES.length];
  state.unitCount += 1;
  const sens = type !== 'agent' || Boolean(state.techs.accueil);
  const unit = { id, type, name, x, z, heading: 0, sens, carry: null, reports: [], task: null, path: [], injured: 0, hidden: false, moving: false, idleSince: state.time, ...extra };
  state.units.push(unit);
  return unit;
}

function addBuilding(state, kind, x, z, rot, done) {
  const b = { id: newId(state, 'b'), kind, x, z, rot, done, progress: done ? 1 : 0, queue: [], garrison: [], fieldLeft: BUILDINGS[kind].field?.amount ?? 0 };
  state.buildings.push(b);
  markRect(state.grid, rectOf(b), BUILDINGS[kind].field ? 0 : 1);
  if (done) onBuildingDone(state, b, true);
  return b;
}

/** Carte : hôtel de ville au centre, jardin, bosquets et chantiers de voirie répartis en anneaux selon la graine. */
function generateMap(state) {
  const rand = makeRandom(state.seed * 7919 + 13);
  addBuilding(state, 'mairie', 0, 0, 0, true);
  // Jardin de la mairie (premières heures d'équipe, travail peu risqué)
  const jardinUt = addUt(state, { id: 'jardins', name: NODES.jardin.ut, risk: NODES.jardin.risk, kind: 'jardins', pos: [-19, 15] });
  state.nodes.push({ id: newId(state, 'n'), kind: 'jardin', x: -19, z: 15, amount: NODES.jardin.amount, utId: jardinUt });
  addUt(state, { id: 'construction', name: 'Travaux de construction', risk: CONSTRUCTION_RISK, kind: 'construction', pos: [0, 0] });

  // Zones occupées : hôtel de ville (demi-diagonale ≈ 15) et jardin ; 2 unités d'écart entre deux ressources
  const taken = [
    [0, 0, 15],
    [-19, 15, 4],
  ];
  const free = (x, z, r) => Math.abs(x) < MAP_HALF - r - 3 && Math.abs(z) < MAP_HALF - r - 3 && taken.every(([tx, tz, tr]) => Math.hypot(x - tx, z - tz) > tr + r + 2);
  const place = (ring, r) => {
    for (let k = 0; k < 60; k += 1) {
      const a = rand() * Math.PI * 2;
      const d = ring[0] + rand() * (ring[1] - ring[0]);
      const x = Math.round(Math.cos(a) * d);
      const z = Math.round(Math.sin(a) * d);
      if (free(x, z, r)) {
        taken.push([x, z, r]);
        return [x, z];
      }
    }
    return null;
  };
  let grove = 0;
  let site = 0;
  const addGrove = (ring, count) => {
    const at = place(ring, 5);
    if (!at) return;
    grove += 1;
    const utId = addUt(state, { name: `${NODES.arbre.ut} ${grove}`, risk: NODES.arbre.risk, kind: 'node', pos: at });
    for (let i = 0; i < count; i += 1) {
      const a = (i / count) * Math.PI * 2 + rand() * 0.6;
      const d = i === 0 ? 0 : 1.8 + rand() * 2.6;
      const x = Math.round(at[0] + Math.cos(a) * d);
      const z = Math.round(at[1] + Math.sin(a) * d);
      if (state.nodes.some((n) => n.x === x && n.z === z)) continue;
      state.nodes.push({ id: newId(state, 'n'), kind: 'arbre', x, z, amount: NODES.arbre.amount, utId, variant: Math.floor(rand() * 3) });
      markRect(state.grid, [x - 0.5, z - 0.5, x + 0.5, z + 0.5], 1);
    }
  };
  const addSite = (ring) => {
    const at = place(ring, 4);
    if (!at) return;
    site += 1;
    const utId = addUt(state, { name: `${NODES.chantier.ut} ${site}`, risk: NODES.chantier.risk, kind: 'node', pos: at });
    const n = { id: newId(state, 'n'), kind: 'chantier', x: at[0], z: at[1], amount: NODES.chantier.amount, utId, rot: rand() < 0.5 ? 0 : 90 };
    state.nodes.push(n);
    markRect(state.grid, nodeRect(n), 1);
  };
  addGrove([22, 26], 8); // premier bosquet en vue de l’hôtel de ville
  addSite([21, 25]); // premier chantier de voirie en vue de l’hôtel de ville
  addGrove([42, 54], 9);
  addGrove([42, 54], 8);
  addSite([44, 56]);
  addGrove([60, 72], 10);
  addGrove([60, 72], 9);
  addSite([60, 72]);
  addSite([60, 72]);
}

/**
 * Nouvelle partie. `calm` (didacticiel) : ni danger aléatoire ni accident, calendrier de l'année arrêté (pics
 * d'activité, inspection, fin d'année) tant que `state.calm` reste vrai.
 */
export function createGame({ seed = 1, calm = false } = {}) {
  const state = {
    version: 1,
    seed,
    rng: seed * 2654435761,
    time: 0,
    calm,
    calmTime: 0,
    nextId: 0,
    unitCount: 0,
    res: { heures: START.heures, budget: START.budget, remontees: START.remontees, temps: START.temps },
    age: 1,
    techs: {},
    units: [],
    buildings: [],
    nodes: [],
    uts: {},
    hazards: [],
    grid: createGrid(),
    explored: new Uint8Array(FOG_N * FOG_N),
    visible: new Uint8Array(FOG_N * FOG_N),
    kpi: { accidents: 0, registres: 0, lastAccident: -1e9 },
    timers: { hazard: 0, accident: 0, fog: 0 },
    eventIndex: 0,
    rushUntil: -1,
    pendingEvent: null,
    outcome: null,
    log: [],
    stats: {
      ageAt: { 1: 0 },
      gathered: { heures: 0, budget: 0 },
      prevShort: 0, // secondes de travail de préventeur en attente de temps préventeur
      hazards: { spawned: 0, revealed: 0, neutralized: 0, expired: 0, reported: 0 },
      accidentsByUt: {},
      trainings: 0,
      evaluations: 0,
      idleAgentSeconds: 0,
      agentSeconds: 0,
      inspection: null,
      commands: 0,
      refused: 0,
    },
    revision: 0,
  };
  generateMap(state);
  for (let i = 0; i < START.agents; i += 1) addUnit(state, 'agent', -4.5 + i * 3, 11.5);
  for (let i = 0; i < START.preventeurs; i += 1) addUnit(state, 'preventeur', 0, 14);
  updateFog(state);
  return state;
}

/* ------------------------------------------------------------------ */
/* Indicateurs, population, paliers                                     */
/* ------------------------------------------------------------------ */

export function population(state) {
  const pop = state.units.length;
  const cap = Math.min(POP_MAX, state.buildings.filter((b) => b.done).reduce((n, b) => n + (BUILDINGS[b.kind].pop || 0), 0));
  return { pop, cap };
}

/** Les quatre indicateurs standard. */
export function kpis(state) {
  const active = Object.values(state.uts).filter((u) => u.active);
  const evaluated = active.filter((u) => u.evaluated).length;
  const people = state.units.length;
  const sens = state.units.filter((u) => u.sens).length;
  return {
    du: { evaluated, total: active.length, ratio: active.length ? evaluated / active.length : 0, done: active.length > 0 && evaluated === active.length },
    sensibilises: { n: sens, total: people, ratio: people ? sens / people : 0 },
    accidents: state.kpi.accidents,
    registres: state.kpi.registres,
  };
}

/** Bâtiments terminés qui comptent pour le passage du palier `age` (bâtiments de l'âge précédent, hors logements). */
function ageBuildings(state, age) {
  const kinds = new Set(state.buildings.filter((b) => b.done && BUILDINGS[b.kind].age === age - 1 && b.kind !== 'maison' && b.kind !== 'mairie').map((b) => b.kind));
  return kinds.size;
}

/** Conditions du palier suivant : liste des manques (vide = possible). */
export function ageStatus(state) {
  const next = AGES[state.age];
  if (!next) return { next: null, missing: [], ok: false };
  const k = kpis(state);
  const missing = [];
  const n = next.needs;
  if (n.du !== undefined && k.du.ratio < n.du - 1e-9) missing.push(n.du >= 1 ? `DU fait (${k.du.evaluated}/${k.du.total} UT évaluées)` : `DU à ${Math.round(n.du * 100)} % (${Math.round(k.du.ratio * 100)} %)`);
  if (n.sensibilises !== undefined && k.sensibilises.ratio < n.sensibilises - 1e-9) missing.push(`${Math.round(n.sensibilises * 100)} % de sensibilisés (${Math.round(k.sensibilises.ratio * 100)} %)`);
  if (n.registres !== undefined && k.registres < n.registres) missing.push(`${n.registres} registres remontés (${k.registres})`);
  if (n.calm !== undefined && state.time - state.kpi.lastAccident < n.calm) missing.push(`aucun accident depuis ${jours(n.calm)} (dernier il y a ${jours(state.time - state.kpi.lastAccident)})`);
  if (n.buildings !== undefined && ageBuildings(state, next.id) < n.buildings) missing.push(`${n.buildings} bâtiments de l’âge ${next.id - 1} (${ageBuildings(state, next.id)})`);
  // Conditions remplies hors coût : il ne reste qu'à réunir les ressources
  const needsOk = missing.length === 0;
  Object.entries(next.cost).forEach(([r, v]) => {
    if (state.res[r] < v) missing.push(`${v} ${RESOURCES[r].unit}`);
  });
  const upgrading = state.buildings.some((b) => b.queue.some((q) => q.kind === 'age'));
  return { next, missing, needsOk, upgrading, ok: missing.length === 0 && !upgrading };
}

export function scoreOf(state) {
  const k = kpis(state);
  const du = Math.round(250 * k.du.ratio);
  const sens = Math.round(250 * k.sensibilises.ratio);
  const acc = Math.round(250 * Math.max(0, 1 - k.accidents / ACCIDENT.defeatAt));
  const reg = Math.round(250 * Math.min(1, k.registres / SCORE.registresTarget));
  const total = du + sens + acc + reg;
  const stars = SCORE.stars.filter((s) => total >= s).length;
  return { total, stars, parts: { du, sensibilises: sens, accidents: acc, registres: reg } };
}

/* ------------------------------------------------------------------ */
/* Placement des bâtiments                                              */
/* ------------------------------------------------------------------ */

const isExplored = (state, x, z) => {
  const fx = Math.floor((x + MAP_HALF) / FOG);
  const fz = Math.floor((z + MAP_HALF) / FOG);
  return fx >= 0 && fz >= 0 && fx < FOG_N && fz < FOG_N && state.explored[fz * FOG_N + fx] === 1;
};
export const exploredAt = isExplored;
export const visibleAt = (state, x, z) => {
  const fx = Math.floor((x + MAP_HALF) / FOG);
  const fz = Math.floor((z + MAP_HALF) / FOG);
  return fx >= 0 && fz >= 0 && fx < FOG_N && fz < FOG_N && state.visible[fz * FOG_N + fx] === 1;
};

const overlaps = (a, b, m = 0) => a[0] < b[2] + m && a[2] + m > b[0] && a[1] < b[3] + m && a[3] + m > b[1];

/** Peut-on poser ce bâtiment ici ? (carte explorée, rien dessous, à 1 unité des autres constructions) */
export function canPlace(state, kind, x, z, rot = 0) {
  const def = BUILDINGS[kind];
  if (!def || def.buildable === false) return { ok: false, reason: 'Bâtiment non constructible' };
  if (def.age > state.age) return { ok: false, reason: `Disponible au palier ${def.age} (${AGES[def.age - 1].name})` };
  const [w, d] = footprint(kind, rot);
  const r = [x - w / 2, z - d / 2, x + w / 2, z + d / 2];
  if (r[0] < -MAP_HALF + 1 || r[1] < -MAP_HALF + 1 || r[2] > MAP_HALF - 1 || r[3] > MAP_HALF - 1) return { ok: false, reason: 'Hors de la carte' };
  for (const [cx, cz] of [[r[0], r[1]], [r[2], r[1]], [r[0], r[3]], [r[2], r[3]], [x, z]]) if (!isExplored(state, cx, cz)) return { ok: false, reason: 'Zone inexplorée' };
  if (state.buildings.some((b) => overlaps(r, rectOf(b), 1))) return { ok: false, reason: 'Trop près d’un autre bâtiment' };
  if (state.nodes.some((n) => n.amount > 0 && overlaps(r, nodeRect(n), 1))) return { ok: false, reason: 'Une ressource occupe la place' };
  if (state.units.some((u) => !u.hidden && u.x > r[0] && u.x < r[2] && u.z > r[1] && u.z < r[3] && u.task?.kind !== 'build')) return { ok: false, reason: 'Des personnes sont sur l’emplacement' };
  return { ok: true };
}

/* ------------------------------------------------------------------ */
/* Commandes                                                            */
/* ------------------------------------------------------------------ */

const fail = (state, error) => {
  state.stats.refused += 1;
  return { ok: false, error };
};

function canPay(state, cost = {}) {
  return Object.entries(cost).every(([r, v]) => state.res[r] >= v);
}
function pay(state, cost = {}) {
  Object.entries(cost).forEach(([r, v]) => {
    state.res[r] -= v;
  });
}
function refund(state, cost = {}) {
  Object.entries(cost).forEach(([r, v]) => {
    state.res[r] += v;
  });
}
const costText = (cost) => Object.entries(cost).map(([r, v]) => `${v} ${RESOURCES[r].unit}`).join(', ');

/** Temps préventeur maximal : la réserve grandit avec chaque préventeur. */
export const prevTimeCap = (state) => PREV_TIME.cap * Math.max(1, state.units.filter((u) => u.type === 'preventeur').length);

/** Une seconde de travail de préventeur consomme du temps préventeur ; sans réserve, le travail attend. */
function spendPrevTime(state, u, dt, out) {
  const need = PREV_TIME.use * dt;
  if (state.res.temps >= need) {
    state.res.temps -= need;
    u.short = false;
    return true;
  }
  u.short = true;
  state.stats.prevShort += dt;
  if (state.time - (state.stats.shortWarned ?? -1e9) > 30) {
    state.stats.shortWarned = state.time;
    notify(state, out, 'warn', `${u.name} n’a plus de temps préventeur : son travail attend que la réserve se recharge. Un préventeur de plus (service prévention) l’agrandit.`, [u.x, u.z]);
  }
  return false;
}

function unitsOf(state, ids, type) {
  return ids.map((id) => state.units.find((u) => u.id === id)).filter((u) => u && !u.injured && !u.hidden && (!type || u.type === type));
}

function setTask(state, unit, task) {
  unit.task = task;
  unit.path = [];
  unit.moving = false;
  unit.repath = true;
  if (!task) unit.idleSince = state.time;
}

export function applyCommand(state, cmd) {
  if (state.outcome) return { ok: false, error: 'Partie terminée' };
  state.stats.commands += 1;
  const ids = cmd.unitIds || [];
  switch (cmd.type) {
    case 'move': {
      const units = unitsOf(state, ids);
      if (!units.length) return fail(state, 'Aucune unité disponible');
      units.forEach((u, i) => {
        const a = (i / Math.max(1, units.length)) * Math.PI * 2;
        const r = units.length > 1 ? 0.9 + Math.floor(i / 6) * 0.9 : 0;
        setTask(state, u, { kind: 'move', to: [cmd.to[0] + Math.cos(a) * r, cmd.to[1] + Math.sin(a) * r], scout: Boolean(cmd.scout) });
      });
      return { ok: true };
    }
    case 'stop':
      unitsOf(state, ids).forEach((u) => setTask(state, u, null));
      return { ok: true };
    case 'gather': {
      const units = unitsOf(state, ids, 'agent');
      if (!units.length) return fail(state, 'Seuls les agents récoltent');
      const node = state.nodes.find((n) => n.id === cmd.nodeId);
      const field = state.buildings.find((b) => b.id === cmd.nodeId && BUILDINGS[b.kind].field);
      if (node) {
        if (node.amount <= 0) return fail(state, 'Ressource épuisée');
        if (!isExplored(state, node.x, node.z)) return fail(state, 'Zone inexplorée');
        units.forEach((u) => setTask(state, u, { kind: 'gather', target: { type: 'node', id: node.id }, phase: 'go' }));
      } else if (field) {
        if (!field.done) return fail(state, 'Le potager n’est pas encore construit');
        if (field.fieldLeft <= 0) return fail(state, 'Potager épuisé');
        units.forEach((u) => setTask(state, u, { kind: 'gather', target: { type: 'field', id: field.id }, phase: 'go' }));
      } else return fail(state, 'Ressource introuvable');
      return { ok: true };
    }
    case 'place': {
      const def = BUILDINGS[cmd.kind];
      if (!def) return fail(state, 'Bâtiment inconnu');
      const where = canPlace(state, cmd.kind, cmd.x, cmd.z, cmd.rot || 0);
      if (!where.ok) return fail(state, where.reason);
      if (!canPay(state, def.cost)) return fail(state, `Ressources insuffisantes (${costText(def.cost)})`);
      const units = unitsOf(state, ids, 'agent');
      if (!units.length) return fail(state, 'Il faut au moins un agent pour construire');
      pay(state, def.cost);
      const b = addBuilding(state, cmd.kind, cmd.x, cmd.z, cmd.rot || 0, false);
      // UT prévue dès la pose : on peut l'évaluer avant que l'activité ne démarre (comme le veut la règle)
      if (def.ut) b.utId = addUt(state, { name: def.ut.name, risk: def.ut.risk, kind: 'building', refId: b.id, pos: [b.x, b.z], active: false });
      // Personnes déjà sur l'emprise (bâtisseurs) : déplacées au bord
      state.units.forEach((u) => {
        if (!u.hidden && distToRect(u.x, u.z, rectOf(b)) === 0) [u.x, u.z] = approach(u.x, u.z, rectOf(b));
      });
      activate(state, 'construction');
      units.forEach((u) => setTask(state, u, { kind: 'build', id: b.id }));
      state.revision += 1;
      return { ok: true, id: b.id };
    }
    case 'build': {
      const b = state.buildings.find((x) => x.id === cmd.buildingId && !x.done);
      if (!b) return fail(state, 'Aucun chantier à cet endroit');
      const units = unitsOf(state, ids, 'agent');
      if (!units.length) return fail(state, 'Seuls les agents construisent');
      units.forEach((u) => setTask(state, u, { kind: 'build', id: b.id }));
      return { ok: true };
    }
    case 'train': {
      const b = state.buildings.find((x) => x.id === cmd.buildingId && x.done && x.kind === 'formation');
      if (!b) return fail(state, 'Envoyez les agents dans une salle de formation terminée');
      const units = unitsOf(state, ids, 'agent').filter((u) => !u.sens);
      if (!units.length) return fail(state, 'Ces agents sont déjà sensibilisés');
      units.forEach((u) => setTask(state, u, { kind: 'train', id: b.id }));
      return { ok: true };
    }
    case 'evaluate': {
      const units = unitsOf(state, ids, 'preventeur');
      if (!units.length) return fail(state, 'Seuls les préventeurs évaluent les unités de travail');
      const ut = state.uts[cmd.utId];
      if (!ut) return fail(state, 'Unité de travail inconnue');
      if (ut.evaluated) return fail(state, 'Cette unité de travail est déjà évaluée');
      units.forEach((u) => setTask(state, u, { kind: 'evaluate', utId: ut.id }));
      return { ok: true };
    }
    case 'neutralize': {
      const units = unitsOf(state, ids, 'preventeur');
      if (!units.length) return fail(state, 'Seuls les préventeurs neutralisent les dangers');
      const h = state.hazards.find((x) => x.id === cmd.hazardId);
      if (!h || !h.revealed) return fail(state, 'Danger introuvable');
      units.forEach((u) => setTask(state, u, { kind: 'neutralize', id: h.id }));
      return { ok: true };
    }
    case 'queue': {
      const b = state.buildings.find((x) => x.id === cmd.buildingId);
      if (!b || !b.done) return fail(state, 'Bâtiment non terminé');
      if (b.queue.length >= 5) return fail(state, 'File d’attente pleine');
      const def = BUILDINGS[b.kind];
      const item = cmd.item;
      if (item.kind === 'unit') {
        const u = UNITS[item.id];
        if (!u || !(def.trains || []).includes(item.id)) return fail(state, 'Unité non disponible ici');
        if ((u.age || 1) > state.age) return fail(state, `Disponible au palier ${u.age}`);
        const { pop, cap } = population(state);
        const queued = state.buildings.reduce((n, x) => n + x.queue.filter((q) => q.kind === 'unit').length, 0);
        if (pop + queued >= cap) return fail(state, cap >= POP_MAX ? 'Population maximale atteinte' : 'Pas assez de logements : construisez une maison');
        if (!canPay(state, u.cost)) return fail(state, `Ressources insuffisantes (${costText(u.cost)})`);
        pay(state, u.cost);
        b.queue.push({ kind: 'unit', id: item.id, left: u.time, total: u.time, cost: u.cost });
      } else if (item.kind === 'tech') {
        const t = TECHS[item.id];
        if (!t || t.at !== b.kind) return fail(state, 'Amélioration non disponible ici');
        if (state.techs[item.id] || state.buildings.some((x) => x.queue.some((q) => q.kind === 'tech' && q.id === item.id))) return fail(state, 'Déjà acquise ou en cours');
        if (t.age > state.age) return fail(state, `Disponible au palier ${t.age}`);
        if (!canPay(state, t.cost)) return fail(state, `Ressources insuffisantes (${costText(t.cost)})`);
        pay(state, t.cost);
        b.queue.push({ kind: 'tech', id: item.id, left: t.time, total: t.time, cost: t.cost });
      } else if (item.kind === 'age') {
        if (b.kind !== 'mairie') return fail(state, 'Le palier se franchit à l’hôtel de ville');
        const st = ageStatus(state);
        if (!st.next) return fail(state, 'Dernier palier atteint');
        if (!st.ok) return fail(state, `Conditions manquantes : ${st.missing.join(' ; ')}`);
        pay(state, st.next.cost);
        b.queue.push({ kind: 'age', id: st.next.id, left: st.next.time, total: st.next.time, cost: st.next.cost });
      } else return fail(state, 'Commande inconnue');
      return { ok: true };
    }
    case 'cancel': {
      const b = state.buildings.find((x) => x.id === cmd.buildingId);
      const q = b?.queue[cmd.index];
      if (!q) return fail(state, 'Rien à annuler');
      refund(state, q.cost);
      b.queue.splice(cmd.index, 1);
      return { ok: true };
    }
    default:
      return fail(state, 'Commande inconnue');
  }
}

/* ------------------------------------------------------------------ */
/* Simulation                                                           */
/* ------------------------------------------------------------------ */

function notify(state, out, level, text, pos = null) {
  const n = { t: state.time, level, text, pos };
  out.push(n);
  state.log.push(n);
  if (state.log.length > 80) state.log.shift();
}

/** Une UT entre en activité (elle compte désormais dans le document unique). */
function activate(state, utId) {
  const ut = state.uts[utId];
  if (!ut || ut.active) return;
  ut.active = true;
  ut.activeSince = state.time;
  state.revision += 1;
}

function onBuildingDone(state, b, silent, out) {
  const def = BUILDINGS[b.kind];
  b.done = true;
  b.progress = 1;
  if (def.ut) {
    if (!b.utId) b.utId = addUt(state, { name: def.ut.name, risk: def.ut.risk, kind: 'building', refId: b.id, pos: [b.x, b.z] });
    activate(state, b.utId);
  } else if (def.utShared) {
    b.utId = def.utShared;
  }
  state.revision += 1;
  if (!silent && out) notify(state, out, 'success', `${def.label} : construction terminée`, [b.x, b.z]);
}

/** Cible de récolte d'une tâche : ressource de la carte ou potager. */
function gatherTarget(state, task) {
  if (task.target.type === 'node') {
    const n = state.nodes.find((x) => x.id === task.target.id);
    return n ? { kind: 'node', ref: n, rect: nodeRect(n), resource: NODES[n.kind].resource, rate: NODES[n.kind].rate, left: n.amount, utId: n.utId } : null;
  }
  const b = state.buildings.find((x) => x.id === task.target.id);
  if (!b) return null;
  const f = BUILDINGS[b.kind].field;
  return { kind: 'field', ref: b, rect: rectOf(b), resource: f.resource, rate: f.rate, left: b.fieldLeft, utId: b.utId || 'jardins' };
}

/** Ressource de même type la plus proche (après épuisement), de préférence le même travail (`family`). */
function nextTarget(state, unit, resource, from, family = null) {
  let best = null;
  let bestD = 26;
  const away = (kind) => (family && familyOf(kind) !== family ? 12 : 0);
  state.nodes.forEach((n) => {
    if (n.amount <= 0 || NODES[n.kind].resource !== resource || !isExplored(state, n.x, n.z)) return;
    const d = Math.hypot(n.x - from[0], n.z - from[1]) + away(n.kind);
    if (d < bestD) {
      bestD = d;
      best = { type: 'node', id: n.id };
    }
  });
  state.buildings.forEach((b) => {
    const f = BUILDINGS[b.kind].field;
    if (!b.done || !f || f.resource !== resource || b.fieldLeft <= 0) return;
    const d = Math.hypot(b.x - from[0], b.z - from[1]) + away('potager');
    if (d < bestD) {
      bestD = d;
      best = { type: 'field', id: b.id };
    }
  });
  return best;
}

function nearestDropoff(state, resource, x, z) {
  let best = null;
  let bestD = Infinity;
  state.buildings.forEach((b) => {
    if (!b.done || !(BUILDINGS[b.kind].dropoff || []).includes(resource)) return;
    const d = distToRect(x, z, rectOf(b));
    if (d < bestD) {
      bestD = d;
      best = b;
    }
  });
  return best;
}

/** Avance une unité vers (tx, tz) en suivant son chemin ; vrai à l'arrivée. */
function moveTo(state, u, tx, tz, dt, arrive = 0.35) {
  if (u.repath || !u.path.length || u.goal?.[0] !== tx || u.goal?.[1] !== tz) {
    u.path = findPath(state.grid, u.x, u.z, tx, tz) || [[tx, tz]];
    u.goal = [tx, tz];
    u.repath = false;
  }
  let budget = UNITS[u.type].speed * dt;
  while (budget > 0 && u.path.length) {
    const [px, pz] = u.path[0];
    const dx = px - u.x;
    const dz = pz - u.z;
    const d = Math.hypot(dx, dz);
    if (d <= budget) {
      u.x = px;
      u.z = pz;
      budget -= d;
      u.path.shift();
    } else {
      u.x += (dx / d) * budget;
      u.z += (dz / d) * budget;
      u.heading = Math.atan2(dx, dz);
      budget = 0;
    }
  }
  u.moving = u.path.length > 0;
  const g = u.goal;
  return !u.path.length || Math.hypot(g[0] - u.x, g[1] - u.z) < arrive;
}

/** Va jusqu'au bord d'un rectangle ; vrai quand on y est. */
function reachRect(state, u, rect, dt) {
  if (distToRect(u.x, u.z, rect) <= NEAR) {
    u.moving = false;
    u.path = [];
    return true;
  }
  // Point d'approche recalculé à chaque nouvelle cible (ressource, puis dépôt, puis ressource…)
  const key = rect.join(',');
  if (!u.approach || u.repath || u.approachKey !== key) {
    u.approach = approach(u.x, u.z, rect);
    u.approachKey = key;
  }
  const arrived = moveTo(state, u, u.approach[0], u.approach[1], dt);
  if (arrived) {
    u.approach = null;
    // Point d'approche inaccessible : on se contente de ce qu'on a atteint si on est proche (et l'on s'arrête :
    // un agent au travail n'est plus « en mouvement », sinon dangers et accidents l'ignoreraient)
    if (distToRect(u.x, u.z, rect) > NEAR + 1.2) return false;
    u.moving = false;
    u.path = [];
    return true;
  }
  return false;
}

function updateUnit(state, u, dt, out, builders) {
  if (u.injured > 0) {
    u.injured -= dt;
    if (u.injured <= 0) {
      u.injured = 0;
      u.hidden = false;
      const inf = state.buildings.find((b) => b.done && BUILDINGS[b.kind].heals);
      const back = inf ? frontOf(inf) : frontOf(state.buildings[0]);
      const free = nearestFree(state.grid, back[0], back[1]);
      [u.x, u.z] = free ? centerOf(...free) : back;
      u.repath = true;
      notify(state, out, 'info', `${u.name} reprend le travail`, [u.x, u.z]);
    }
    return;
  }
  const t = u.task;
  if (!t) {
    u.moving = false;
    return;
  }
  switch (t.kind) {
    case 'move':
      if (moveTo(state, u, t.to[0], t.to[1], dt)) setTask(state, u, null);
      break;
    case 'gather': {
      const g = gatherTarget(state, t);
      if (!g) {
        setTask(state, u, null);
        break;
      }
      const capacity = state.techs.chariots ? CARRY_TECH : CARRY;
      // Au travail seulement sur place (pas en chemin ni au dépôt)
      if (t.phase !== 'work') u.working = null;
      if (t.phase === 'go') {
        if (g.left <= 0) {
          const nt = nextTarget(state, u, g.resource, [g.ref.x, g.ref.z], familyOf(g.ref.kind));
          if (nt) t.target = nt;
          else if (u.carry?.amount) t.phase = 'return';
          else setTask(state, u, null);
          break;
        }
        if (reachRect(state, u, g.rect, dt)) t.phase = 'work';
      } else if (t.phase === 'work') {
        activate(state, g.utId);
        if (g.left <= 0 || (u.carry && u.carry.amount >= capacity)) {
          t.phase = u.carry?.amount ? 'return' : 'go';
          break;
        }
        if (!u.carry || u.carry.res !== g.resource) u.carry = { res: g.resource, amount: 0 };
        let mult = 1;
        if (g.ref.kind === 'arbre' && state.techs.outils) mult *= 1.2;
        if (familyOf(g.ref.kind) === 'jardin' && state.techs.jardins) mult *= 1.25;
        const take = Math.min(g.rate * mult * dt, g.left, capacity - u.carry.amount);
        u.carry.amount += take;
        if (g.kind === 'node') g.ref.amount -= take;
        else g.ref.fieldLeft -= take;
        state.stats.gathered[g.resource] += take;
        u.heading = Math.atan2(g.ref.x - u.x, g.ref.z - u.z);
        u.working = g.utId;
        if (g.kind === 'node' && g.ref.amount <= 0) {
          g.ref.amount = 0;
          if (g.ref.kind === 'arbre') markRect(state.grid, nodeRect(g.ref), 0);
          state.revision += 1;
        }
        // Potager épuisé : replanté automatiquement s'il y a de quoi (30 heures d'équipe)
        if (g.kind === 'field' && g.ref.fieldLeft <= 0) {
          g.ref.fieldLeft = 0;
          if (state.res.heures >= REPLANT) {
            state.res.heures -= REPLANT;
            g.ref.fieldLeft = BUILDINGS[g.ref.kind].field.amount;
            notify(state, out, 'info', `Potager replanté (−${REPLANT} h d’équipe)`, [g.ref.x, g.ref.z]);
          }
          state.revision += 1;
        }
        if (u.carry.amount >= capacity - 1e-6 || (g.kind === 'node' ? g.ref.amount : g.ref.fieldLeft) <= 0) t.phase = 'return';
      } else if (t.phase === 'return') {
        const drop = nearestDropoff(state, u.carry?.res || g.resource, u.x, u.z);
        if (!drop) {
          setTask(state, u, null);
          break;
        }
        if (reachRect(state, u, rectOf(drop), dt)) {
          deposit(state, u, out);
          t.phase = 'go';
          u.repath = true;
        }
      }
      break;
    }
    case 'build': {
      const b = state.buildings.find((x) => x.id === t.id);
      if (!b || b.done) {
        // Bâtiment terminé : un potager ou un dépôt fait récolter tout de suite, sinon on attend
        if (b && BUILDINGS[b.kind].field) setTask(state, u, { kind: 'gather', target: { type: 'field', id: b.id }, phase: 'go' });
        else if (b && BUILDINGS[b.kind].dropoff && b.kind !== 'mairie') {
          const res = BUILDINGS[b.kind].dropoff[0];
          const nt = nextTarget(state, u, res, [b.x, b.z], b.kind === 'cantine' ? 'jardin' : 'arbre');
          setTask(state, u, nt ? { kind: 'gather', target: nt, phase: 'go' } : null);
        } else setTask(state, u, null);
        break;
      }
      if (reachRect(state, u, rectOf(b), dt)) {
        u.working = 'construction';
        builders[b.id] = (builders[b.id] || 0) + 1;
        u.heading = Math.atan2(b.x - u.x, b.z - u.z);
      }
      break;
    }
    case 'train': {
      const b = state.buildings.find((x) => x.id === t.id);
      if (!b) {
        setTask(state, u, null);
        break;
      }
      if (reachRect(state, u, rectOf(b), dt)) {
        const cap = state.techs.formateurs ? 9 : BUILDINGS.formation.garrison;
        if (b.garrison.length >= cap) break; // attend une place
        if (!canPay(state, TRAIN.cost)) {
          notify(state, out, 'warn', `Formation de ${u.name} impossible : budget insuffisant (${TRAIN.cost.budget} €)`, [b.x, b.z]);
          setTask(state, u, null);
          break;
        }
        pay(state, TRAIN.cost);
        b.garrison.push({ unitId: u.id, left: state.techs.formateurs ? 9 : TRAIN.time });
        u.hidden = true;
        u.task = { kind: 'training', id: b.id };
      }
      break;
    }
    case 'training':
      break;
    case 'evaluate': {
      const ut = state.uts[t.utId];
      if (!ut || ut.evaluated) {
        setTask(state, u, null);
        break;
      }
      const rect = utRect(state, ut, u);
      if (!rect) {
        setTask(state, u, null);
        break;
      }
      if (reachRect(state, u, rect, dt)) {
        u.working = null;
        if (!spendPrevTime(state, u, dt, out)) break;
        ut.progress += dt / (state.techs.methode ? EVAL_TIME / 2 : EVAL_TIME);
        u.evaluating = ut.id;
        if (ut.progress >= 1) {
          ut.evaluated = true;
          ut.progress = 1;
          state.stats.evaluations += 1;
          state.hazards.forEach((h) => {
            if (h.utId === ut.id && !h.revealed) reveal(state, h);
          });
          const k = kpis(state);
          notify(state, out, 'success', `Document unique : « ${ut.name} » évaluée (${k.du.evaluated}/${k.du.total})${k.du.done ? ' — DU fait !' : ''}`, ut.pos);
          state.revision += 1;
          setTask(state, u, null);
        }
      }
      break;
    }
    case 'neutralize': {
      const h = state.hazards.find((x) => x.id === t.id);
      if (!h) {
        setTask(state, u, null);
        break;
      }
      if (Math.hypot(h.x - u.x, h.z - u.z) <= 1.4 || moveTo(state, u, h.x, h.z, dt, 1.2)) {
        u.moving = false;
        if (!spendPrevTime(state, u, dt, out)) break;
        h.work += dt;
        if (h.work >= (state.techs.plan ? HAZARD.neutralize / 2 : HAZARD.neutralize)) {
          state.hazards = state.hazards.filter((x) => x !== h);
          state.stats.hazards.neutralized += 1;
          notify(state, out, 'success', `Danger neutralisé (${state.uts[h.utId]?.name || 'site'})`, [h.x, h.z]);
          state.revision += 1;
          setTask(state, u, null);
        }
      }
      break;
    }
    default:
      setTask(state, u, null);
  }
}

/** Zone à rejoindre pour évaluer une UT : son bâtiment, sa ressource, ou le chantier de construction le plus proche. */
function utRect(state, ut, u) {
  if (ut.kind === 'building') {
    const b = state.buildings.find((x) => x.id === ut.refId);
    return b ? rectOf(b) : null;
  }
  if (ut.kind === 'construction') {
    // Sur un chantier en cours, sinon sur plans à l'hôtel de ville
    const sites = state.buildings.filter((b) => !b.done);
    if (!sites.length) return rectOf(state.buildings.find((b) => b.kind === 'mairie'));
    sites.sort((a, b) => Math.hypot(a.x - u.x, a.z - u.z) - Math.hypot(b.x - u.x, b.z - u.z));
    return rectOf(sites[0]);
  }
  if (ut.kind === 'jardins') {
    const n = state.nodes.find((x) => x.kind === 'jardin');
    return n ? nodeRect(n) : null;
  }
  const nodes = state.nodes.filter((n) => n.utId === ut.id);
  if (!nodes.length) return null;
  const [x, z] = ut.pos;
  return [x - 2, z - 2, x + 2, z + 2];
}

function deposit(state, u, out) {
  if (u.carry?.amount) {
    state.res[u.carry.res] += u.carry.amount;
    u.carry = null;
  }
  if (u.reports.length) {
    const n = u.reports.length;
    u.reports.forEach((utId) => record(state, utId));
    notify(state, out, 'success', `${u.name} remonte ${n > 1 ? `${n} fiches` : 'une fiche'} au registre (${state.kpi.registres})`, [u.x, u.z]);
    u.reports = [];
  }
}

/** Une remontée arrive au registre : indicateur, ressource « remontées », et le risque de son UT baisse un peu. */
function record(state, utId) {
  state.kpi.registres += 1;
  state.res.remontees += 1;
  const ut = state.uts[utId];
  if (ut) {
    ut.baseRisk ??= ut.risk;
    ut.risk = Math.max(ut.baseRisk * 0.5, ut.risk * HAZARD.remonteeEffect);
  }
  state.revision += 1;
}

/** Fiche de remontée d'un agent (danger repéré ou observation) : à l'instant avec l'application, sinon au dépôt. */
function addReport(state, u, utId, out, text) {
  if (state.techs.appli) {
    record(state, utId);
    notify(state, out, 'success', `${u.name} ${text} avec l’application DigiRisk (registres : ${state.kpi.registres})`, [u.x, u.z]);
  } else if (u.reports.length < 3) {
    u.reports.push(utId);
    notify(state, out, 'info', `${u.name} ${text} : fiche à remonter au registre`, [u.x, u.z]);
  }
}

function reveal(state, h) {
  if (h.revealed) return;
  h.revealed = true;
  h.revealedAt = state.time;
  state.stats.hazards.revealed += 1;
  state.revision += 1;
}

/* Dangers : apparition, accidents, signalements */

function spawnFactor(state, ut, x, z) {
  let f = HAZARD.spawn * ut.risk * (ut.evaluated ? HAZARD.evaluated * (state.techs.plan ? 0.75 : 1) : HAZARD.unevaluated);
  if ((ut.kind === 'node' && ut.name.startsWith('Chantier')) || ut.kind === 'construction') f *= state.techs.balisage ? 0.6 : 1;
  if (state.techs.epc) f *= 0.6;
  if (state.techs.analyse) f *= 1 - Math.min(0.36, 0.03 * state.kpi.registres);
  if (state.time < state.rushUntil) f *= 2;
  if (state.buildings.some((b) => b.done && b.kind === 'point' && Math.hypot(b.x - x, b.z - z) < BUILDINGS.point.aura)) f *= 0.5;
  return f;
}

function hazardStep(state, out) {
  const workers = state.units.filter((u) => !u.hidden && !u.injured && u.type === 'agent' && u.working && !u.moving);
  // Apparition par lieu de travail (UT) où quelqu'un travaille
  const byUt = {};
  workers.forEach((u) => (byUt[u.working] ||= []).push(u));
  Object.entries(byUt).forEach(([utId, list]) => {
    const ut = state.uts[utId];
    if (!ut) return;
    const pick = list[Math.floor(nextRandom(state) * list.length)];
    const p = spawnFactor(state, ut, pick.x, pick.z) * Math.min(2, 0.5 + list.length * 0.25);
    if (nextRandom(state) >= p) return;
    if (state.hazards.filter((h) => h.utId === utId && Math.hypot(h.x - pick.x, h.z - pick.z) < 10).length >= HAZARD.maxPerSite) return;
    const a = nextRandom(state) * Math.PI * 2;
    const d = 1 + nextRandom(state) * 1.6;
    const h = { id: newId(state, 'h'), utId, x: pick.x + Math.cos(a) * d, z: pick.z + Math.sin(a) * d, sev: 0.5 + ut.risk, revealed: false, born: state.time, work: 0, kind: hazardKind(state, ut) };
    // Même dans une UT évaluée, une situation dangereuse nouvelle doit être repérée sur le terrain (signalement
    // d'un agent sensibilisé, regard du préventeur, point sécurité) : c'est ce qui alimente les registres
    state.hazards.push(h);
    state.stats.hazards.spawned += 1;
    state.revision += 1;
  });
}

const HAZARD_KINDS = {
  chantier: ['Circulation d’engins', 'Tranchée non balisée', 'Charge lourde', 'Bruit du marteau-piqueur'],
  arbre: ['Branche instable', 'Tronçonneuse sans protection', 'Échelle mal calée', 'Sol glissant'],
  construction: ['Échafaudage incomplet', 'Trémie ouverte', 'Port de charge', 'Outil électrique abîmé'],
  jardins: ['Outil qui traîne', 'Posture courbée prolongée', 'Produit phytosanitaire'],
  building: ['Câble au sol', 'Sol mouillé', 'Rayonnage surchargé', 'Écran mal réglé'],
};
function hazardKind(state, ut) {
  const list = ut.kind === 'node' ? (ut.name.startsWith('Chantier') ? HAZARD_KINDS.chantier : HAZARD_KINDS.arbre) : HAZARD_KINDS[ut.kind] || HAZARD_KINDS.building;
  return list[Math.floor(nextRandom(state) * list.length)];
}

function accidentStep(state, out) {
  const agents = state.units.filter((u) => !u.hidden && !u.injured && u.type === 'agent');
  const sst = state.units.filter((u) => u.type === 'sst' && !u.hidden && !u.injured);
  agents.forEach((u) => {
    if (u.sens && u.working && !u.moving && nextRandom(state) < HAZARD.observation) {
      state.stats.observations = (state.stats.observations || 0) + 1;
      addReport(state, u, u.working, out, 'propose une amélioration');
    }
  });
  for (const h of [...state.hazards]) {
    // Signalement par un agent sensibilisé qui voit le danger
    if (!h.revealed) {
      const witness = agents.find((u) => u.sens && Math.hypot(u.x - h.x, u.z - h.z) < HAZARD.reportRadius);
      // Près d'un point sécurité (affichage, boîte à remontées), le signalement est deux fois plus probable
      const nearPoint = state.buildings.some((b) => b.done && b.kind === 'point' && Math.hypot(b.x - h.x, b.z - h.z) < BUILDINGS.point.aura);
      if (witness && nextRandom(state) < HAZARD.report * (nearPoint ? 2 : 1)) {
        reveal(state, h);
        state.stats.hazards.reported += 1;
        addReport(state, witness, h.utId, out, `signale « ${h.kind} »`);
      }
    }
    // Accident d'un agent au travail à portée du danger (jamais pendant le didacticiel)
    if (state.calm) continue;
    for (const u of agents) {
      if (u.injured || !u.working || u.moving || Math.hypot(u.x - h.x, u.z - h.z) > HAZARD.radius) continue;
      let p = HAZARD.accident * h.sev;
      if (u.sens) p *= HAZARD.sensibilise * (state.techs.gestes ? 0.6 : 1);
      if (state.techs.epi) p *= 0.65;
      if (h.revealed) p *= HAZARD.revealedFactor;
      if (state.uts[h.utId]?.evaluated) p *= HAZARD.evaluatedAccident;
      if (state.techs.outils && state.uts[h.utId]?.name.startsWith('Espaces verts')) p *= 0.7;
      if (nextRandom(state) >= p) continue;
      // Accident
      state.kpi.accidents += 1;
      state.kpi.lastAccident = state.time;
      state.stats.accidentsByUt[h.utId] = (state.stats.accidentsByUt[h.utId] || 0) + 1;
      let down = ACCIDENT.downtime;
      if (state.buildings.some((b) => b.done && BUILDINGS[b.kind].heals)) down /= 2;
      if (state.techs.suivi) down /= 2;
      if (sst.some((s) => Math.hypot(s.x - u.x, s.z - u.z) < 10)) down = Math.min(down, 10);
      u.injured = down;
      u.hidden = true;
      u.moving = false;
      u.working = null;
      if (u.carry) u.carry = null;
      state.res.budget = Math.max(0, state.res.budget - ACCIDENT.cost);
      reveal(state, h);
      notify(state, out, 'danger', `Accident : ${u.name} (${state.uts[h.utId]?.name || 'site'}) — « ${h.kind} ». Arrêt de ${jours(down)}, −${ACCIDENT.cost} €`, [u.x, u.z]);
      state.revision += 1;
    }
  }
}

function expireHazards(state) {
  const before = state.hazards.length;
  state.hazards = state.hazards.filter((h) => state.time - h.born < (h.revealed ? HAZARD.life * 2 : HAZARD.life));
  if (state.hazards.length !== before) {
    state.stats.hazards.expired += before - state.hazards.length;
    state.revision += 1;
  }
}

/**
 * Premier presqu'accident, scénarisé vers 50 s près d'un agent au travail : il montre tout de suite la boucle du
 * jeu (un danger apparaît, on le voit, le préventeur le neutralise) sans faire de blessé.
 */
function firstNearMiss(state, out) {
  if (state.calm || state.stats.firstNearMiss != null || state.time < 50) return;
  nearMiss(state, out);
}

/**
 * Presqu'accident près d'un agent au travail (danger déjà signalé). Renvoie le danger, ou null si personne ne
 * travaille encore ; le didacticiel s'en sert pour sa leçon sur les dangers.
 */
export function nearMiss(state, out = []) {
  const u = state.units.find((x) => x.type === 'agent' && x.working && !x.moving && !x.hidden);
  if (!u) return null;
  const ut = state.uts[u.working];
  const h = { id: newId(state, 'h'), utId: u.working, x: u.x + 1.5, z: u.z + 0.5, sev: 0.5 + (ut?.risk || 0.3), revealed: false, born: state.time, work: 0, kind: ut ? hazardKind(state, ut) : 'Sol glissant' };
  state.hazards.push(h);
  reveal(state, h);
  state.stats.hazards.spawned += 1;
  state.stats.firstNearMiss ??= state.time;
  notify(state, out, 'warn', `Presqu’accident : ${u.name} a failli se blesser (« ${h.kind} »). Sélectionnez le préventeur et clic droit sur le danger pour le neutraliser`, [h.x, h.z]);
  return h;
}

/** Temps écoulé dans l'année de jeu (le didacticiel ne compte pas). */
export const yearTime = (state) => state.time - (state.calmTime || 0);

/** Les préventeurs voient les dangers à portée ; inoccupés, ils traitent d'eux-mêmes les dangers signalés proches. */
function preventerStep(state) {
  state.hazards.forEach((h) => {
    if (h.revealed) return;
    if (state.units.some((u) => u.type === 'preventeur' && !u.hidden && Math.hypot(u.x - h.x, u.z - h.z) < HAZARD.preventerReveal)) reveal(state, h);
  });
  // Pendant le didacticiel, c'est au joueur d'envoyer le préventeur
  if (state.calm) return;
  state.units.forEach((u) => {
    if (u.type !== 'preventeur' || u.task || u.hidden) return;
    let best = null;
    let bestD = HAZARD.autoRange;
    state.hazards.forEach((h) => {
      if (!h.revealed || state.units.some((o) => o.task?.kind === 'neutralize' && o.task.id === h.id)) return;
      const d = Math.hypot(h.x - u.x, h.z - u.z);
      if (d < bestD) {
        bestD = d;
        best = h;
      }
    });
    if (best) setTask(state, u, { kind: 'neutralize', id: best.id, auto: true });
  });
}

function queueStep(state, b, dt, out) {
  const q = b.queue[0];
  if (!q) return;
  if (q.kind === 'unit') {
    const { pop, cap } = population(state);
    if (pop >= cap) return; // attend un logement
  }
  q.left -= dt;
  if (q.left > 0) return;
  b.queue.shift();
  if (q.kind === 'unit') {
    const [fx, fz] = frontOf(b);
    const free = nearestFree(state.grid, fx, fz);
    const [x, z] = free ? centerOf(...free) : [fx, fz];
    const u = addUnit(state, q.id, x, z);
    notify(state, out, 'info', `${UNITS[q.id].label} recruté : ${u.name}${u.sens && u.type === 'agent' ? ' (sensibilisé dès l’accueil)' : ''}`, [x, z]);
  } else if (q.kind === 'tech') {
    state.techs[q.id] = true;
    notify(state, out, 'success', `Amélioration acquise : ${TECHS[q.id].label}`, [b.x, b.z]);
    if (q.id === 'accueil') {
      /* les agents déjà présents restent à former */
    }
  } else if (q.kind === 'age') {
    state.age = q.id;
    state.stats.ageAt[q.id] = state.time;
    notify(state, out, 'success', `Palier ${q.id} atteint : ${AGES[q.id - 1].name}`, [b.x, b.z]);
  }
  state.revision += 1;
}

export function updateFog(state) {
  state.visible.fill(0);
  const mark = (x, z, r) => {
    const r2 = (r / FOG) ** 2;
    const cx = (x + MAP_HALF) / FOG;
    const cz = (z + MAP_HALF) / FOG;
    const R = Math.ceil(r / FOG);
    for (let dz = -R; dz <= R; dz += 1) {
      for (let dx = -R; dx <= R; dx += 1) {
        const fx = Math.floor(cx + dx);
        const fz = Math.floor(cz + dz);
        if (fx < 0 || fz < 0 || fx >= FOG_N || fz >= FOG_N) continue;
        if ((fx + 0.5 - cx) ** 2 + (fz + 0.5 - cz) ** 2 > r2) continue;
        state.visible[fz * FOG_N + fx] = 1;
        state.explored[fz * FOG_N + fx] = 1;
      }
    }
  };
  state.units.forEach((u) => !u.hidden && mark(u.x, u.z, UNITS[u.type].vision));
  state.buildings.forEach((b) => mark(b.x, b.z, (BUILDINGS[b.kind].vision || 5) + Math.max(...footprint(b.kind, b.rot)) / 2));
}

function eventStep(state, out) {
  const ev = EVENTS[state.eventIndex];
  if (!ev || state.calm) return;
  const now = yearTime(state);
  if (ev.kind === 'rush' && !ev.warned && now >= ev.at - ev.warn && state.warnedIndex !== state.eventIndex) {
    state.warnedIndex = state.eventIndex;
    notify(state, out, 'warn', `${ev.label} dans ${jours(ev.warn)} : plus de dangers sur tous les sites pendant ${jours(ev.duration)}`);
  }
  if (now < ev.at) return;
  state.eventIndex += 1;
  if (ev.kind === 'rush') {
    state.rushUntil = state.time + ev.duration;
    notify(state, out, 'warn', `${ev.label} : deux fois plus de dangers pendant ${jours(ev.duration)}`);
  } else if (ev.kind === 'inspection') {
    const k = kpis(state);
    const late = Object.values(state.uts).filter((u) => u.active && !u.evaluated && state.time - (u.activeSince ?? 0) > 40);
    if (!late.length) {
      state.res.budget += 150;
      state.stats.inspection = 'ok';
      notify(state, out, 'success', `${ev.label} : document unique à jour, aucune observation. Subvention prévention +150 €`);
    } else {
      state.res.budget = Math.max(0, state.res.budget - 250);
      state.stats.inspection = 'demeure';
      notify(state, out, 'danger', `${ev.label} : document unique incomplet (${k.du.evaluated}/${k.du.total} UT évaluées, dont « ${late[0].name} »). Mise en demeure, −250 €`);
    }
  }
}

function checkOutcome(state, out) {
  if (state.outcome) return;
  if (state.kpi.accidents >= ACCIDENT.defeatAt) {
    state.outcome = { result: 'defeat', reason: `${state.kpi.accidents} accidents : l’inspection du travail suspend l’activité`, score: scoreOf(state), at: state.time };
  } else if (state.age >= 4) {
    state.outcome = { result: 'victory', reason: 'Culture de prévention atteinte', score: scoreOf(state), at: state.time };
  } else if (yearTime(state) >= YEAR_MONTHS * MONTH) {
    const s = scoreOf(state);
    state.outcome = { result: 'yearEnd', reason: s.total >= SCORE.stars[1] ? 'Année réussie' : 'Fin de l’année', score: s, at: state.time };
  }
  if (state.outcome) notify(state, out, state.outcome.result === 'defeat' ? 'danger' : 'success', `${state.outcome.reason} — score ${state.outcome.score.total} / 1 000`);
}

/** Avance la partie de `dt` secondes (fixer dt ≤ 0,25 s). */
export function step(state, dt) {
  const out = [];
  if (state.outcome) return out;
  state.time += dt;
  if (state.calm) state.calmTime += dt;
  // Chantiers : bâtisseurs présents (rendement décroissant)
  const builders = {};
  state.units.forEach((u) => {
    if (!u.task || u.task.kind !== 'gather') u.working = null;
    u.evaluating = null;
  });
  state.units.forEach((u) => updateUnit(state, u, dt, out, builders));
  // Temps préventeur : se recharge pour chaque préventeur, jusqu'au plafond
  const preventeurs = state.units.filter((u) => u.type === 'preventeur').length;
  const timeCap = prevTimeCap(state);
  if (state.res.temps < timeCap) state.res.temps = Math.min(timeCap, state.res.temps + PREV_TIME.regen * preventeurs * dt);
  state.buildings.forEach((b) => {
    if (!b.done && builders[b.id]) {
      const n = builders[b.id];
      b.progress += (dt * n ** 0.8) / BUILDINGS[b.kind].time;
      if (b.progress >= 1) onBuildingDone(state, b, false, out);
    }
    if (b.done) queueStep(state, b, dt, out);
    // Formation en cours
    if (b.garrison.length) {
      b.garrison.forEach((g) => {
        g.left -= dt;
      });
      b.garrison
        .filter((g) => g.left <= 0)
        .forEach((g) => {
          const u = state.units.find((x) => x.id === g.unitId);
          if (!u) return;
          u.sens = true;
          u.hidden = false;
          const [fx, fz] = frontOf(b);
          const free = nearestFree(state.grid, fx, fz);
          [u.x, u.z] = free ? centerOf(...free) : [fx, fz];
          setTask(state, u, null);
          state.stats.trainings += 1;
          notify(state, out, 'success', `${u.name} est sensibilisé (${kpis(state).sensibilises.n} salariés)`, [u.x, u.z]);
          state.revision += 1;
        });
      b.garrison = b.garrison.filter((g) => g.left > 0);
    }
    if (b.done && BUILDINGS[b.kind].income) state.res.budget += BUILDINGS[b.kind].income * dt;
  });
  // Dangers
  if (!state.calm) state.timers.hazard += dt;
  if (state.timers.hazard >= HAZARD.checkEvery) {
    state.timers.hazard -= HAZARD.checkEvery;
    hazardStep(state, out);
  }
  state.timers.accident += dt;
  if (state.timers.accident >= HAZARD.accidentEvery) {
    state.timers.accident -= HAZARD.accidentEvery;
    accidentStep(state, out);
    expireHazards(state);
  }
  firstNearMiss(state, out);
  preventerStep(state);
  state.timers.fog += dt;
  if (state.timers.fog >= 0.5) {
    state.timers.fog = 0;
    updateFog(state);
  }
  // Statistiques d'activité des agents (inoccupés)
  state.units.forEach((u) => {
    if (u.type !== 'agent' || u.injured) return;
    state.stats.agentSeconds += dt;
    if (!u.task) state.stats.idleAgentSeconds += dt;
  });
  eventStep(state, out);
  checkOutcome(state, out);
  return out;
}

/* ------------------------------------------------------------------ */
/* Guide « prochaine étape » (joueurs débutants, robot persona novice)  */
/* ------------------------------------------------------------------ */

/**
 * Conseil du moment, avec l'action correspondante quand elle est simple : le panneau d'objectifs l'affiche, le
 * robot « débutant » l'exécute tel quel.
 */
/** Ressource découverte la plus proche, sans limite de distance (nœud de la carte ou potager). */
export function findTarget(state, resource, from) {
  let best = null;
  let bestD = Infinity;
  state.nodes.forEach((n) => {
    if (n.amount <= 0 || NODES[n.kind].resource !== resource || !isExplored(state, n.x, n.z)) return;
    const d = Math.hypot(n.x - from[0], n.z - from[1]);
    if (d < bestD) {
      bestD = d;
      best = { type: 'node', id: n.id, x: n.x, z: n.z };
    }
  });
  state.buildings.forEach((b) => {
    const f = BUILDINGS[b.kind].field;
    if (!b.done || !f || f.resource !== resource || b.fieldLeft <= 0) return;
    const d = Math.hypot(b.x - from[0], b.z - from[1]) * 0.8;
    if (d < bestD) {
      bestD = d;
      best = { type: 'field', id: b.id, x: b.x, z: b.z };
    }
  });
  return best;
}

/** Point inexploré le plus proche d'une position (anneaux autour de l'hôtel de ville). */
export function scoutPoint(state, from) {
  let best = null;
  let bestD = Infinity;
  [30, 44, 58, 70].forEach((r) => {
    for (let k = 0; k < 16; k += 1) {
      const a = (k / 16) * Math.PI * 2;
      const x = Math.cos(a) * r;
      const z = Math.sin(a) * r;
      if (Math.abs(x) > MAP_HALF - 4 || Math.abs(z) > MAP_HALF - 4 || isExplored(state, x, z)) continue;
      const d = Math.hypot(x - from[0], z - from[1]);
      if (d < bestD) {
        bestD = d;
        best = [Math.round(x), Math.round(z)];
      }
    }
  });
  return best;
}

/** Nombre d'agents qui récoltent une ressource. */
function onGather(state, resource) {
  return state.units.filter((u) => u.task?.kind === 'gather' && gatherTarget(state, u.task)?.resource === resource).length;
}

/** Ressource à privilégier : le stock le plus bas rapporté à son poids du moment. */
function wantedResource(state) {
  const w = { heures: 2, budget: state.age >= 2 ? 1.2 : 0.7 };
  return Object.keys(w).sort((a, b) => state.res[a] / w[a] - state.res[b] / w[b]);
}

export function nextHint(state) {
  const k = kpis(state);
  const agents = state.units.filter((u) => u.type === 'agent' && !u.injured && !u.hidden);
  const idle = agents.filter((u) => !u.task);
  const prev = state.units.filter((u) => u.type === 'preventeur' && !u.hidden && !u.injured);
  const freePrev = prev.find((u) => !u.task || u.task.auto);
  const toEval = Object.values(state.uts).filter((u) => u.active && !u.evaluated);
  const mairie = state.buildings.find((b) => b.kind === 'mairie');
  const { pop, cap } = population(state);
  const has = (kind, done = true) => state.buildings.some((b) => b.kind === kind && (!done || b.done));
  const st = ageStatus(state);

  // Agents inoccupés d'abord : c'est l'oubli le plus fréquent
  if (idle.length) {
    for (const want of wantedResource(state)) {
      const target = findTarget(state, want, [idle[0].x, idle[0].z]);
      if (target) {
        const where = want === 'budget' ? 'au chantier de voirie (budget)' : 'au bosquet ou au jardin (heures d’équipe)';
        return { text: `${idle.length} agent${idle.length > 1 ? 's' : ''} inoccupé${idle.length > 1 ? 's' : ''} : envoyez-les travailler ${where}`, action: { type: 'gather', unitIds: idle.map((u) => u.id), nodeId: target.id } };
      }
    }
  }
  // Jardin épuisé : un potager près de la cantine (travail peu risqué)
  const gardenLeft = state.nodes.filter((n) => n.kind === 'jardin' && n.amount > 0).reduce((t, n) => t + n.amount, 0) + state.buildings.filter((b) => BUILDINGS[b.kind].field && (b.fieldLeft > 0 || !b.done)).reduce((t, b) => t + (b.done ? b.fieldLeft : 600), 0);
  if (state.res.heures < 250 && gardenLeft < 150 && has('cantine') && state.buildings.filter((b) => b.kind === 'potager').length < 4 && !state.buildings.some((b) => b.kind === 'potager' && !b.done) && canPay(state, BUILDINGS.potager.cost)) return { text: 'Le jardin est épuisé : construisez un potager près de la cantine (le travail le moins risqué)', build: 'potager' };
  // Travail déséquilibré : les heures d'équipe débordent pendant que le budget manque, ou l'inverse
  const onRes = (r) => agents.filter((u) => u.task?.kind === 'gather' && gatherTarget(state, u.task)?.resource === r);
  const pool = ['heures', 'budget'];
  const rich = pool.filter((r) => state.res[r] > (r === 'heures' ? 600 : 350) && onRes(r).length >= 2).sort((a, b) => state.res[b] - state.res[a])[0];
  const poor = pool.filter((r) => state.res[r] < (r === 'heures' ? 120 : 80) && findTarget(state, r, [0, 0])).sort((a, b) => state.res[a] - state.res[b])[0];
  if (rich && poor && rich !== poor) {
    const movers = onRes(rich).slice(0, Math.min(3, Math.ceil(onRes(rich).length / 2)));
    const target = findTarget(state, poor, [movers[0].x, movers[0].z]);
    return {
      text: poor === 'budget' ? `Vous avez ${Math.round(state.res.heures)} h d’équipe mais presque plus de budget : envoyez ${movers.length} agents au chantier de voirie` : `Le budget déborde (${Math.round(state.res.budget)} €) mais les heures d’équipe manquent : envoyez ${movers.length} agents au bosquet ou au jardin`,
      action: { type: 'gather', unitIds: movers.map((u) => u.id), nodeId: target.id },
    };
  }
  // Temps préventeur épuisé avec du travail en attente : un préventeur de plus
  const prevSchool = state.buildings.find((b) => b.kind === 'prevention' && b.done);
  const flaggedCount = state.hazards.filter((h) => h.revealed).length;
  const shortOfTime = state.res.temps < 6 && toEval.length + flaggedCount >= 2;
  if (prevSchool && shortOfTime && prev.length < 3 && !prevSchool.queue.length && pop < cap && canPay(state, UNITS.preventeur.cost)) return { text: 'Vos préventeurs n’ont plus assez de temps pour tout faire : recrutez-en un autre au service prévention', action: { type: 'queue', buildingId: prevSchool.id, item: { kind: 'unit', id: 'preventeur' } } };
  if (freePrev && toEval.length) return { text: `Évaluez « ${toEval[0].name} » avec votre préventeur (DU ${k.du.evaluated}/${k.du.total})`, action: { type: 'evaluate', unitIds: [freePrev.id], utId: toEval[0].id } };
  const missing = !findTarget(state, 'budget', [0, 0]) ? 'chantier de voirie' : !state.nodes.some((n) => n.kind === 'arbre' && n.amount > 0 && isExplored(state, n.x, n.z)) ? 'bosquet' : null;
  if (freePrev && missing) {
    const to = scoutPoint(state, [freePrev.x, freePrev.z]);
    if (to) return { text: `Aucun ${missing} connu : explorez la carte avec votre préventeur`, action: { type: 'move', unitIds: [freePrev.id], to } };
  }
  // Bâtiment en chantier dont l'UT n'est pas encore évaluée : l'évaluer avant l'ouverture
  const planned = Object.values(state.uts).find((u) => !u.active && !u.evaluated && u.kind === 'building' && state.buildings.some((b) => b.id === u.refId && !b.done));
  if (freePrev && planned) return { text: `Évaluez « ${planned.name} » avant son ouverture (le chantier est en cours)`, action: { type: 'evaluate', unitIds: [freePrev.id], utId: planned.id } };
  // Danger signalé : le préventeur va le neutraliser
  const flagged = state.hazards.find((h) => h.revealed && !state.units.some((o) => o.task?.kind === 'neutralize' && o.task.id === h.id));
  if (freePrev && flagged) return { text: `Danger signalé : « ${flagged.kind} ». Envoyez le préventeur le neutraliser`, action: { type: 'neutralize', unitIds: [freePrev.id], hazardId: flagged.id } };
  if (st.ok) return { text: `Franchissez le palier ${st.next.id} « ${st.next.name} » à l’hôtel de ville`, action: { type: 'queue', buildingId: mairie.id, item: { kind: 'age' } } };
  if (pop >= cap - 1 && state.res.heures >= BUILDINGS.maison.cost.heures) return { text: 'Plus de logements : construisez une maison de ville', build: 'maison' };
  // Palier 2 : les deux bâtiments de l'âge 1
  if (state.age === 1 && ageBuildings(state, 2) < 2 && !state.buildings.some((b) => !b.done && b.kind !== 'maison')) {
    const kind = !has('cantine', false) ? 'cantine' : !has('depot', false) ? 'depot' : 'potager';
    if (canPay(state, BUILDINGS[kind].cost)) return { text: `Construisez ${kind === 'cantine' ? 'une cantine' : kind === 'depot' ? 'un dépôt près des bosquets' : 'un potager'} (palier 2 : deux bâtiments de l’âge 1)`, build: kind };
  }
  // Palier 2 atteint : la salle de formation d'abord, puis un second bâtiment de l'âge 2 (le point sécurité près
  // d'un chantier est le moins cher ; le service prévention recrute des préventeurs, donc du temps préventeur)
  if (state.age >= 2 && !has('formation', false) && canPay(state, BUILDINGS.formation.cost)) return { text: 'Construisez une salle de formation pour sensibiliser les agents', build: 'formation' };
  if (state.age === 2 && has('formation', false) && ageBuildings(state, 3) < 2 && !state.buildings.some((b) => !b.done && BUILDINGS[b.kind].age === 2)) {
    const kind = !has('point', false) ? 'point' : !has('prevention', false) ? 'prevention' : 'infirmerie';
    if (canPay(state, BUILDINGS[kind].cost)) return { text: `Construisez ${kind === 'point' ? 'un point sécurité près d’un chantier' : kind === 'prevention' ? 'un service prévention : il recrute des préventeurs, donc plus de temps préventeur' : 'une infirmerie'} (palier 3 : deux bâtiments de l’âge 2)`, build: kind };
  }
  // Formations : un agent à la fois, tant qu'il reste des places et du budget
  const formation = state.buildings.find((b) => b.kind === 'formation' && b.done);
  const inTraining = state.units.filter((u) => u.task?.kind === 'train' || u.task?.kind === 'training').length;
  if (formation && k.sensibilises.ratio < 0.9 && inTraining < (state.techs.formateurs ? 9 : TRAIN.places) && state.res.budget >= TRAIN.cost.budget + 20) {
    const pupil = agents.find((u) => !u.sens && u.task?.kind !== 'train' && u.task?.kind !== 'build');
    if (pupil) return { text: `Envoyez ${pupil.name} en formation (sensibilisés ${k.sensibilises.n}/${k.sensibilises.total})`, action: { type: 'train', unitIds: [pupil.id], buildingId: formation.id } };
  }
  // Application DigiRisk : les signalements remontent sans retour au dépôt
  if (state.age >= 2 && !state.techs.appli && mairie && mairie.queue.length < 2 && !mairie.queue.some((q) => q.id === 'appli') && canPay(state, TECHS.appli.cost) && state.res.budget >= TECHS.appli.cost.budget + 60) return { text: 'Équipez les agents de l’application DigiRisk (hôtel de ville) : leurs signalements remontent à l’instant', action: { type: 'queue', buildingId: mairie.id, item: { kind: 'tech', id: 'appli' } } };
  // Une cité qui grandit : recruter tant que les heures d'équipe le permettent (jusqu'à une vingtaine d'agents), sauf
  // si le palier n'attend plus que ses ressources (on les épargne alors)
  const queuedAgents = state.buildings.reduce((n, b) => n + b.queue.filter((q) => q.kind === 'unit').length, 0);
  const saveHours = st.next && st.needsOk && !st.upgrading ? st.next.cost.heures || 0 : 0;
  if (mairie && pop + queuedAgents < cap && agents.length < 22 && mairie.queue.length < 2 && state.res.heures >= 150 + saveHours) return { text: `Recrutez un agent à l’hôtel de ville (${agents.length} agents)`, action: { type: 'queue', buildingId: mairie.id, item: { kind: 'unit', id: 'agent' } } };
  if (st.next) return { text: `Palier ${st.next.id} « ${st.next.name} » : ${st.missing.join(' ; ')}` };
  return { text: 'Maintenez vos indicateurs jusqu’à la fin de l’année' };
}

/** Proposition d'emplacement libre pour un bâtiment, près d'un point (robots, bouton « placer auto »). */
export function suggestSpot(state, kind, near = [0, 0], rot = 0) {
  for (let r = 0; r < 60; r += 2) {
    for (let k = 0; k < Math.max(1, r * 2); k += 1) {
      const a = (k / Math.max(1, r * 2)) * Math.PI * 2;
      const x = Math.round(near[0] + Math.cos(a) * r);
      const z = Math.round(near[1] + Math.sin(a) * r);
      if (canPlace(state, kind, x, z, rot).ok) return [x, z];
    }
  }
  return null;
}

export const YEAR = YEAR_MONTHS * MONTH;
