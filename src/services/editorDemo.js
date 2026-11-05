import {
  emptyScene,
  createBuilding,
  createPrefab,
  createWall,
  createSurface,
  createWalkway,
  createElement,
  createNpc,
} from './editorScene';

/**
 * Site de démonstration de l'éditeur (/edit) : bâtiments sur mesure (atelier en L, entrepôt en U,
 * pavillon d'accueil octogonal vitré, poste de garde), deux bâtiments modèles du jumeau, voirie,
 * parking, allées piétonnes, postes de travail cotés, équipements de sécurité et personnages en
 * mouvement. Coordonnées en unités de scène (1 unité ≈ 1,5 m), nord vers -Z.
 */

const el = (kind, x, z, rotation = 0, patch = {}) => createElement(kind, [x, z], { rotation, ...patch });
const station = (archetype, x, z, risk = 'low', patch = {}) => el(`station:${archetype}`, x, z, 0, { risk, ...patch });
const wall = (a, b, type, patch) => createWall(a, b, type, patch);
const door = (edge, t, kind = 'porte', width) => ({ edge, t, kind, width: width ?? (kind === 'portail' ? 2.6 : 0.8) });

export function buildDemoScene() {
  const scene = emptyScene('Démo — Site MetalOandCo');

  /* ---------- Voirie, parkings et cours ---------- */
  scene.surfaces = [
    createSurface([[-64, 10], [44, 10], [44, 16], [-64, 16]], 'asphalte', { name: 'Voie principale' }),
    createSurface([[30, 16], [36, 16], [36, 46], [30, 46]], 'asphalte', { name: 'Accès au site' }),
    createSurface([[36, -24], [42, -24], [42, 10], [36, 10]], 'asphalte', { name: 'Voie de desserte est' }),
    createSurface([[18.5, -24], [36, -24], [36, -18], [18.5, -18]], 'asphalte', { name: 'Voie des quais' }),
    createSurface([[18.5, -18], [27.5, -18], [27.5, -6], [18.5, -6]], 'beton', { name: 'Cour des quais' }),
    createSurface([[37, 18], [56, 18], [56, 30], [37, 30]], 'asphalte', { name: 'Parking visiteurs' }),
    createSurface([[12, 16], [28, 16], [28, 19.6], [12, 19.6]], 'paves', { name: 'Parvis de l’accueil' }),
    createSurface([[-37, -12], [-31, -12], [-31, 10], [-37, 10]], 'paves', { name: 'Allée des bureaux' }),
  ];

  /* ---------- Atelier de production (L) ---------- */
  // Sommets : 0 [-30,-18] · 1 [-8,-18] · 2 [-8,-6] · 3 [2,-6] · 4 [2,6] · 5 [-30,6]
  const atelier = createBuilding(
    [[-30, -18], [-8, -18], [-8, -6], [2, -6], [2, 6], [-30, 6]],
    {
      name: 'Atelier de production',
      style: 'bardage',
      wallColor: '#94a3b8',
      height: 3.6,
      floor: 'epoxy',
      floorColor: '#e2e8f0',
      doors: [door(4, 0.25, 'portail'), door(4, 0.55), door(5, 0.3), door(3, 0.5, 'portail')],
    }
  );

  /* ---------- Entrepôt logistique (U, cour des quais au nord) ---------- */
  // Sommets : 0 [11,-16] · 1 [19,-16] · 2 [19,-6] · 3 [27,-6] · 4 [27,-16] · 5 [35,-16] · 6 [35,3] · 7 [11,3]
  const entrepot = createBuilding(
    [[11, -16], [19, -16], [19, -6], [27, -6], [27, -16], [35, -16], [35, 3], [11, 3]],
    {
      name: 'Entrepôt logistique',
      style: 'bardage',
      wallColor: '#7ea6e0',
      height: 4.2,
      floor: 'beton',
      doors: [door(2, 0.5, 'portail', 3), door(6, 0.5), door(5, 0.4)],
    }
  );

  /* ---------- Pavillon d'accueil (octogone vitré) ---------- */
  const accueil = createBuilding(
    [[17, 19], [23, 19], [27, 23], [27, 29], [23, 33], [17, 33], [13, 29], [13, 23]],
    {
      name: 'Pavillon d’accueil',
      style: 'vitre',
      wallColor: '#1e293b',
      height: 2.6,
      floor: 'uni',
      floorColor: '#f5f5f4',
      doors: [door(0, 0.5, 'porte', 1.2), door(2, 0.5, 'porte', 1.2)],
    }
  );

  /* ---------- Poste de garde ---------- */
  const garde = createBuilding([[37, 34], [41, 34], [41, 38], [37, 38]], {
    name: 'Poste de garde',
    style: 'brique',
    height: 2.2,
    floor: 'uni',
    floorColor: '#d6d3d1',
    doors: [door(3, 0.5)],
  });

  scene.buildings = [atelier, entrepot, accueil, garde];

  /* ---------- Bâtiments du jumeau ---------- */
  scene.prefabs = [
    createPrefab('office', 'glass', [-46, -6], { name: 'Siège & bureaux', flip: true }),
    createPrefab('paint', 'white', [-19, -31], { name: 'Atelier peinture' }),
  ];

  /* ---------- Murs intérieurs, cloisons et grillages ---------- */
  scene.walls = [
    // Bureau vitré du chef d'atelier (angle nord-ouest)
    wall([-30, -12], [-23, -12], 'vitre', { door: { kind: 'porte', t: 0.7, width: 0.8 } }),
    wall([-23, -12], [-23, -18], 'vitre'),
    // Séparation atelier / magasin, portail central
    wall([-8, -6], [-8, 6], 'plein', { height: 3.4, door: { kind: 'portail', t: 0.5, width: 2.6 } }),
    // Cage grillagée de charge des batteries (entrepôt)
    wall([30, 3], [30, -1.5], 'grillage', { door: { kind: 'porte', t: 0.45, width: 1 } }),
    wall([30, -1.5], [35, -1.5], 'grillage'),
    // Salle de réunion de l'accueil
    wall([13, 27], [27, 27], 'vitre', { door: { kind: 'porte', t: 0.5, width: 0.8 } }),
    // Muret en limite du parking visiteurs
    wall([37, 30.5], [56, 30.5], 'muret'),
  ];

  /* ---------- Allées piétonnes ---------- */
  scene.walkways = [
    createWalkway([-30, 8.5], [29, 8.5]),
    createWalkway([20, 9.6], [20, 16.4], { width: 1.6, zebra: true }),
    createWalkway([29.4, 24], [36.6, 24], { width: 1.6, zebra: true }),
    createWalkway([-15.6, 6.3], [-15.6, 8.5], { zebra: true }),
    createWalkway([23, 3.3], [23, 8.5], { zebra: true }),
    createWalkway([-29.4, -11], [-8.6, -11]),
    createWalkway([-29.4, -2.6], [-8.6, -2.6]),
    createWalkway([-15.6, -11], [-15.6, -2.6]),
    createWalkway([-15.6, -2.6], [-15.6, 5.7]),
  ];

  /* ---------- Équipements, postes et décor ---------- */
  scene.elements = [
    // Atelier : postes de travail cotés
    station('welding', -18.5, -15.5, 'high', { label: 'Soudure — UT14' }),
    station('machining', -12, -15.5, 'med'),
    station('saw_cutting', -25.5, -7, 'med'),
    station('shear', -19, -7, 'crit', { label: 'Cisaille — risque critique' }),
    station('drill_press', -12.5, -7),
    station('forklift', -25.5, 1.8, 'high'),
    station('workshop', -19, 1.8),
    // Bureau du chef d'atelier
    el('workstation_dual', -27, -16),
    el('cabinet', -29.5, -17.4, 90),
    el('plant', -23.6, -17.4),
    // Magasin (aile est de l'atelier)
    el('rack', -3, -5.25, 0, { params: { bays: 4, levels: 3 } }),
    el('rack', -3, -1.2, 180, { params: { bays: 4, levels: 3 } }),
    el('loaded_pallet', -5.2, 0.8),
    el('loaded_pallet', -5.2, 1.7, 0, { color: '#2563eb' }),
    el('palletjack', -0.5, 0.8),
    el('forklift', -2.5, 2.4),
    // Sécurité de l'atelier
    el('extinguisher', -29.6, -4, 90),
    el('extinguisher', -8.4, 4, 270),
    el('extinguisher', -8.7, -17.5),
    el('firstaid', -14.2, 5.65, 180),
    el('shower', -29.5, 4.5, 90),
    el('sign_mandatory', -14.4, 6.6),
    el('sign_warning', -21.2, -4.2, 0, { label: 'Zone de coupe' }),
    // Entrepôt : rayonnages et préparation
    el('rack', 11.7, -11, 90, { params: { bays: 8, levels: 3 } }),
    el('rack', 15, -11, 90, { params: { bays: 8, levels: 3 } }),
    el('rack', 18.25, -11, 90, { params: { bays: 8, levels: 2 } }),
    station('courier', 31, -13),
    station('warehouse_storage', 31, -8.6, 'med'),
    el('loaded_pallet', 21.2, -4.6),
    el('loaded_pallet', 22.2, -4.6, 0, { color: '#16a34a' }),
    el('loaded_pallet', 23.2, -4.6),
    el('loaded_pallet', 24.2, -4.6, 0, { color: '#dc2626' }),
    el('forklift', 16, -2, 0),
    el('palletjack', 26, -2.5, 90),
    el('carton', 27.5, 1.2),
    el('carton', 27.9, 1.4, 25),
    el('forklift', 32.5, 0.9, 180, { color: '#16a34a' }),
    el('sign_warning', 30.4, -1.9, 180, { label: 'Charge batteries' }),
    el('ibc', 33.8, -0.6),
    el('extinguisher', 11.4, 1.5, 90),
    el('firstaid', 21.8, 2.6, 180),
    el('floorzone', 23, -3.4, 0, { params: { width: 5.4, depth: 2.2 } }),
    el('truck', 23, -10.9, 90, { color: '#1d4ed8' }),
    // Pavillon d'accueil
    el('workstation_dual', 20, 24.2),
    el('bench', 15.6, 24.1, 90),
    el('bench', 15.6, 25.5, 90),
    el('plant', 15.2, 21.6),
    el('plant', 24.8, 21.6),
    station('meeting_room', 20, 30.4),
    // Poste de garde
    el('desk', 38.4, 36, 90),
    el('chair', 39.1, 36, 90),
    el('extinguisher', 40.6, 34.4),
    // Extérieur : éclairage, arbres, parking, signalisation
    ...[-26, -10, 6, 26].map((x) => el('lamp', x, 9.5, 270)),
    el('lamp', 29.5, 34, 0),
    ...[-60, -52, -44, -36, -28, -20, -12, -4, 4].map((x, i) => el(i % 3 === 1 ? 'conifer' : 'tree', x, 18.6)),
    el('tree', 11, 31),
    el('conifer', 10.5, 22.5),
    el('tree', 46, 33),
    el('conifer', 52, 33.5),
    ...[[40, 21, '#2563eb'], [42.6, 21, '#dc2626'], [45.2, 21, '#f8fafc'], [50.4, 21, '#16a34a'], [40, 27, '#111827'], [45.2, 27, '#eab308'], [47.8, 27, '#64748b'], [53, 27, '#f8fafc']].map(([x, z, color]) =>
      el('car', x, z, 90, { color })
    ),
    el('van', 53, 21, 90, { color: '#f8fafc' }),
    ...[14, 16.5, 23.5, 26].map((x) => el('bollard', x, 16.3)),
    el('sign_prohibition', 30.3, 17, 0, { label: 'Accès livraisons' }),
  ];

  /* ---------- Personnages ---------- */
  scene.npcs = [
    createNpc('officeAlt', [-27, -15.5], { name: 'Marc — chef d’atelier', pose: 'type', rotation: 180, variant: 1 }),
    createNpc('worker', [-28.5, -11], { name: 'Karim — opérateur', variant: 2, route: [[-15.6, -11], [-15.6, -2.6], [-28.5, -2.6]], speed: 0.9 }),
    createNpc('driver', [-6.6, -3.2], { name: 'Julie — cariste', variant: 0, route: [[0.8, -3.2], [0.8, 4.4], [-6.6, 4.4]], speed: 0.8 }),
    createNpc('logistics', [13.35, -14], { name: 'Hugo — magasinier', pose: 'carry', variant: 3, route: [[13.35, -5], [24, -4], [24, 1]], routeMode: 'pingpong' }),
    createNpc('logistics', [28, -15], { name: 'Nadia — préparatrice', variant: 4, route: [[28, -5], [33.5, -4.2]], routeMode: 'pingpong', speed: 0.85 }),
    createNpc('office', [20, 24.65], { name: 'Léa — accueil', pose: 'type', rotation: 180, variant: 5 }),
    createNpc('officeAlt', [40, 24], { name: 'Thomas — visiteur', variant: 6, route: [[29, 24], [28.4, 26], [25.5, 26], [21.6, 23.4]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('worker', [-17, 8.5], { name: 'Inès — technicienne HSE', variant: 7, route: [[23, 8.5], [23, 1]], routeMode: 'pingpong', speed: 1.1 }),
    createNpc('worker', [39.2, 36], { name: 'Yanis — agent de sécurité', pose: 'sit', rotation: 270, variant: 1 }),
    createNpc('office', [-34, 4], { name: 'Camille — RH', variant: 3, route: [[-34, 8.5], [-18, 8.5]], routeMode: 'pingpong', speed: 0.9 }),
    createNpc('welder', [-18.5, -12.9], { name: 'Sofia — soudeuse', pose: 'work', rotation: 180, variant: 2 }),
  ];

  return scene;
}
