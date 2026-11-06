/**
 * Ordres du joueur : clic droit contextuel sur une cible (ressource, bâtiment, danger, sol) selon les unités
 * sélectionnées, sélection au clic, pose de bâtiment. Toutes les actions passent par le moteur (command).
 */
import { BUILDINGS } from '../../game/aoe/config.js';
import { canPlace, footprint } from '../../game/aoe/engine.js';
import { store, command, setUi, emit } from './aoeStore';

const selected = () => store.ui.selection.map((id) => store.game.units.find((u) => u.id === id)).filter((u) => u && !u.hidden && !u.injured);

/** Clic gauche : sélectionne (Maj : ajoute ou retire). */
export function select(id, additive = false) {
  if (store.ui.placing) return;
  const sel = store.ui.selection;
  const isUnit = store.game.units.some((u) => u.id === id);
  if (additive && isUnit && sel.every((s) => store.game.units.some((u) => u.id === s))) {
    store.ui.selection = sel.includes(id) ? sel.filter((s) => s !== id) : [...sel, id];
  } else store.ui.selection = [id];
  emit();
}

export function clearSelection() {
  store.ui.selection = [];
  emit();
}

/**
 * Clic droit sur une cible : { type: 'node' | 'building' | 'hazard' | 'ground', id?, point? }.
 * Agents : récolter, construire, aller se former, se déplacer. Préventeurs : évaluer l'UT de la cible,
 * neutraliser un danger, se déplacer.
 */
export function orderTo(target) {
  const g = store.game;
  const units = selected();
  if (!units.length) return;
  const agents = units.filter((u) => u.type === 'agent').map((u) => u.id);
  const prev = units.filter((u) => u.type === 'preventeur').map((u) => u.id);
  const others = units.filter((u) => u.type !== 'agent' && u.type !== 'preventeur').map((u) => u.id);
  const move = (ids, point) => ids.length && command({ type: 'move', unitIds: ids, to: point });
  if (target.type === 'ground') {
    move(units.map((u) => u.id), target.point);
    return;
  }
  if (target.type === 'node') {
    const n = g.nodes.find((x) => x.id === target.id);
    if (!n) return;
    if (agents.length) command({ type: 'gather', unitIds: agents, nodeId: n.id });
    if (prev.length) {
      const ut = g.uts[n.utId];
      if (ut && !ut.evaluated) command({ type: 'evaluate', unitIds: prev, utId: ut.id });
      else move(prev, [n.x, n.z + 2]);
    }
    move(others, [n.x, n.z + 2]);
    return;
  }
  if (target.type === 'building') {
    const b = g.buildings.find((x) => x.id === target.id);
    if (!b) return;
    const def = BUILDINGS[b.kind];
    if (agents.length) {
      if (!b.done) command({ type: 'build', unitIds: agents, buildingId: b.id });
      else if (b.kind === 'formation') command({ type: 'train', unitIds: agents, buildingId: b.id });
      else if (def.field) command({ type: 'gather', unitIds: agents, nodeId: b.id });
      else move(agents, [b.x, b.z + footprint(b.kind, b.rot)[1] / 2 + 2]);
    }
    if (prev.length) {
      const utId = b.utId || (def.field ? 'jardins' : !b.done ? 'construction' : null);
      const ut = utId && g.uts[utId];
      if (ut && !ut.evaluated) command({ type: 'evaluate', unitIds: prev, utId });
      else move(prev, [b.x, b.z + footprint(b.kind, b.rot)[1] / 2 + 2]);
    }
    move(others, [b.x, b.z + footprint(b.kind, b.rot)[1] / 2 + 2]);
    return;
  }
  if (target.type === 'hazard') {
    const h = g.hazards.find((x) => x.id === target.id);
    if (!h) return;
    if (prev.length) command({ type: 'neutralize', unitIds: prev, hazardId: h.id });
    move([...agents, ...others], [h.x + 1.5, h.z + 1.5]);
  }
}

/** Démarre la pose d'un bâtiment (aperçu sous la souris). */
export function startPlacing(kind) {
  setUi({ placing: kind, rot: 0, ghost: null });
}

/** Agents qui construiront : la sélection, sinon les deux agents disponibles les plus proches. */
function builders(x, z) {
  const sel = selected().filter((u) => u.type === 'agent');
  if (sel.length) return sel.map((u) => u.id);
  return store.game.units
    .filter((u) => u.type === 'agent' && !u.hidden && !u.injured && u.task?.kind !== 'train' && u.task?.kind !== 'build')
    .sort((a, b) => (a.task ? 1 : 0) - (b.task ? 1 : 0) || Math.hypot(a.x - x, a.z - z) - Math.hypot(b.x - x, b.z - z))
    .slice(0, 2)
    .map((u) => u.id);
}

/** Pose le bâtiment en cours à l'emplacement (Maj : garder l'outil pour en poser un autre). */
export function placeAt(x, z, keep = false) {
  const kind = store.ui.placing;
  if (!kind) return;
  const r = command({ type: 'place', kind, x, z, rot: store.ui.rot, unitIds: builders(x, z) });
  if (r.ok && !keep) setUi({ placing: null, ghost: null });
}

export const snap = (v) => Math.round(v);
export const ghostValid = (x, z) => (store.ui.placing ? canPlace(store.game, store.ui.placing, x, z, store.ui.rot) : { ok: false });
