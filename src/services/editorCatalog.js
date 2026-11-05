import { WORKUNIT_SKIN_GROUPS, BUILDING_SKINS } from './skins';

/**
 * Catalogue de l'éditeur de site (/edit) : éléments posables, tenues et poses des PNJ, bâtiments modèles
 * (enveloppes du jumeau), formes de base des bâtiments personnalisés et matériaux.
 * Empreinte `size` = [largeur X, hauteur, profondeur Z] en unités de scène (1 unité ≈ 1,5 m), avant
 * rotation ; `center` décale la boîte de sélection quand le modèle n'est pas centré sur son origine.
 */

/** Échelle de cotation DigiRisk (zone au sol des postes de travail, gyrophare si critique). */
export const RISK_LEVELS = {
  low: { label: 'Faible (0-47)', color: '#94a3b8' },
  med: { label: 'Modéré (48-50)', color: '#f97316' },
  high: { label: 'Élevé (51-80)', color: '#ef4444' },
  crit: { label: 'Critique (81-100)', color: '#111827' },
};

export const ELEMENT_CATEGORIES = [
  { id: 'postes', label: 'Postes de travail' },
  { id: 'bureau', label: 'Mobilier de bureau' },
  { id: 'stockage', label: 'Stockage & manutention' },
  { id: 'securite', label: 'Sécurité' },
  { id: 'vehicules', label: 'Véhicules' },
  { id: 'exterieur', label: 'Extérieur' },
  { id: 'collectivite', label: 'Mairie & espace public' },
  { id: 'patrimoine', label: 'Mobilier ancien & patrimoine' },
  { id: 'restauration', label: 'Restauration collective' },
  { id: 'circulation', label: 'Escaliers & étages' },
];

/** Hauteur d'un niveau (voir LEVEL_HEIGHT dans editorScene.js, qui importe ce catalogue). */
const STOREY = 2.5;

/** Escalier droit montant d'un niveau (largeur et longueur de la volée réglables, étirables dans la vue). */
const stairsKind = (label, width, length, color) => ({
  label,
  category: 'circulation',
  stairs: true,
  color,
  params: [
    { key: 'width', label: 'Largeur (m)', min: 0.8, max: 4, step: 0.1, default: width, meters: true },
    { key: 'length', label: 'Longueur de la volée (m)', min: 3, max: 12, step: 0.1, default: length, meters: true },
  ],
  size: ({ width: w, length: l }) => [w + 0.2, STOREY + 0.7, l + 0.2],
  center: [0, (STOREY + 0.7) / 2, 0],
  stretch: { x: { key: 'width' }, z: { key: 'length' } },
});

const STATION_SIZE = [4.4, 2.2, 3.6];

const stationKinds = Object.fromEntries(
  WORKUNIT_SKIN_GROUPS.flatMap((group) =>
    group.skins.map(([archetype, label]) => [
      `station:${archetype}`,
      { label, group: group.label, category: 'postes', size: STATION_SIZE, risk: true, archetype },
    ])
  )
);

const SIGN_KINDS = {
  sign_warning: 'Panneau danger',
  sign_mandatory: 'Panneau obligation (EPI)',
  sign_prohibition: 'Panneau interdiction',
  sign_fire: 'Panneau incendie',
  sign_firstaid: 'Panneau premiers secours',
};

/**
 * `params` : réglages numériques propres au modèle (longueur d'un garde-corps, travées d'un rack...) ;
 * `default` est en unités de scène, `min` / `max` dans l'unité affichée (mètres si `meters`).
 * `color` : couleur par défaut quand le modèle en accepte une.
 */
export const ELEMENT_KINDS = {
  ...stationKinds,
  // Unité de travail cotée sans mobilier (marquage et voile de la couleur de cotation) : pour coter un espace
  // meublé librement, par exemple à l'ancienne
  ut_zone: {
    label: 'Zone d’unité de travail (cotée)',
    category: 'postes',
    risk: true,
    overhead: true,
    params: [
      { key: 'width', label: 'Largeur (m)', min: 1, max: 60, step: 0.5, default: 4.4, meters: true },
      { key: 'depth', label: 'Profondeur (m)', min: 1, max: 60, step: 0.5, default: 3.6, meters: true },
    ],
    size: ({ width, depth }) => [width, 0.7, depth],
    stretch: { x: { key: 'width' }, z: { key: 'depth' } },
  },

  workstation: { label: 'Poste informatique', category: 'bureau', size: [1.1, 1.0, 1.25], center: [0, 0.5, 0.17], color: '#334155' },
  workstation_dual: { label: 'Poste double écran', category: 'bureau', size: [1.1, 1.0, 1.25], center: [0, 0.5, 0.17], color: '#334155' },
  desk: { label: 'Bureau', category: 'bureau', size: [1.1, 0.5, 0.55], color: '#d9c4a3' },
  chair: { label: 'Fauteuil', category: 'bureau', size: [0.4, 0.75, 0.42], color: '#334155' },
  cabinet: { label: 'Armoire à tiroirs', category: 'bureau', size: [0.5, 0.87, 0.34], color: '#cbd5e1' },
  shelving: { label: 'Étagère', category: 'bureau', size: [1.2, 1.25, 0.42], color: '#94a3b8' },
  plant: { label: 'Plante verte', category: 'bureau', size: [0.45, 0.75, 0.45] },
  bench: { label: 'Banc', category: 'bureau', size: [1.1, 0.62, 0.35] },
  server_rack: { label: 'Baie de brassage (réseau)', category: 'bureau', size: [0.6, 1.4, 0.62] },
  copier: { label: 'Photocopieur multifonction', category: 'bureau', size: [0.62, 0.9, 0.56] },
  // Jeu de cartes sécurité Evarisk / DigiRisk (boîte et éventail de cartes), posé sur un bureau
  card_game: {
    label: 'Jeu de cartes DigiRisk (boîte et cartes)',
    category: 'bureau',
    overhead: true,
    params: [{ key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 3, step: 0.01, default: 0.52, meters: true }],
    size: [0.2, 0.08, 0.1],
    center: ({ elevation }) => [0, elevation + 0.04, 0],
  },

  rack: {
    label: 'Rack à palettes',
    category: 'stockage',
    params: [
      { key: 'bays', label: 'Travées', min: 1, max: 8, step: 1, default: 2 },
      { key: 'levels', label: 'Niveaux', min: 1, max: 4, step: 1, default: 2 },
    ],
    size: ({ bays, levels }) => [bays * 0.95 + 0.06, levels * 0.72 + 0.15, 0.66],
    // Étiré dans la vue : la longueur avance d'une travée à la fois
    stretch: { x: { key: 'bays', unit: 0.95, base: 0.06 } },
  },
  pallet: { label: 'Palette vide', category: 'stockage', size: [0.8, 0.1, 0.53] },
  loaded_pallet: { label: 'Palette chargée', category: 'stockage', size: [0.8, 0.68, 0.53], color: '#c08a4f' },
  carton: { label: 'Carton', category: 'stockage', size: [0.3, 0.23, 0.25], color: '#c08a4f' },
  barrel: { label: 'Fût', category: 'stockage', size: [0.42, 0.6, 0.42], color: '#2563eb' },
  gas: { label: 'Bouteille de gaz', category: 'stockage', size: [0.16, 0.97, 0.16], color: '#64748b' },
  ibc: { label: 'Cuve IBC 1000 L', category: 'stockage', size: [0.82, 0.92, 0.68] },
  palletjack: { label: 'Transpalette', category: 'stockage', size: [1.3, 0.9, 0.55], center: [0.2, 0.45, 0], color: '#dc2626' },

  extinguisher: { label: 'Extincteur', category: 'securite', size: [0.3, 1.0, 0.3] },
  firstaid: { label: 'Trousse de secours', category: 'securite', size: [0.32, 0.9, 0.22] },
  shower: { label: 'Douche de sécurité', category: 'securite', size: [0.65, 1.65, 0.35], center: [0.15, 0.82, 0] },
  bollard: { label: 'Potelet', category: 'securite', size: [0.14, 0.6, 0.14] },
  guardrail: {
    label: 'Garde-corps',
    category: 'securite',
    params: [{ key: 'length', label: 'Longueur (m)', min: 0.8, max: 12, step: 0.1, default: 2.4, meters: true }],
    size: ({ length }) => [length, 0.76, 0.16],
    stretch: { x: { key: 'length' } },
  },
  floorzone: {
    label: 'Zone balisée au sol',
    category: 'securite',
    color: '#facc15',
    params: [
      { key: 'width', label: 'Largeur (m)', min: 0.5, max: 30, step: 0.1, default: 4.5, meters: true },
      { key: 'depth', label: 'Profondeur (m)', min: 0.5, max: 30, step: 0.1, default: 3, meters: true },
    ],
    size: ({ width, depth }) => [width, 0.03, depth],
    stretch: { x: { key: 'width' }, z: { key: 'depth' } },
  },
  ...Object.fromEntries(
    Object.entries(SIGN_KINDS).map(([kind, label]) => [kind, { label, category: 'securite', size: [0.3, 1.3, 0.1], center: [0, 0.65, 0] }])
  ),

  forklift: { label: 'Chariot élévateur', category: 'vehicules', size: [2.0, 1.6, 0.82], center: [0.35, 0.8, 0], color: '#f59e0b' },
  car: { label: 'Voiture', category: 'vehicules', size: [2.66, 1.0, 1.1], color: '#2563eb' },
  van: { label: 'Fourgon', category: 'vehicules', size: [3.3, 1.6, 1.35], color: '#f8fafc' },
  truck: { label: 'Poids lourd', category: 'vehicules', size: [7.8, 3.0, 1.9], color: '#c81e1e' },
  tractor_mower: { label: 'Tracteur et épareuse', category: 'vehicules', size: [2.3, 1.65, 2.6], center: [-0.1, 0.82, -0.65], color: '#15803d' },

  // Restauration collective (cantine, cuisine centrale)
  kitchen_range: { label: 'Piano de cuisson et hotte', category: 'restauration', size: [1.8, 2.2, 1.0], center: [0, 1.1, -0.05] },
  inox_worktable: { label: 'Table de travail inox', category: 'restauration', size: [1.6, 0.68, 0.68] },
  dish_station: { label: 'Plonge et lave-vaisselle', category: 'restauration', size: [1.7, 1.15, 0.7] },
  canteen_table: { label: 'Table de cantine et bancs', category: 'restauration', size: [1.8, 0.5, 1.22] },

  tree: { label: 'Arbre', category: 'exterieur', size: [1.5, 2.2, 1.5] },
  conifer: { label: 'Conifère', category: 'exterieur', size: [1.5, 2.65, 1.5] },
  lamp: { label: 'Lampadaire', category: 'exterieur', size: [0.95, 3.25, 0.2], center: [0.35, 1.62, 0] },

  // Escaliers : une volée monte du niveau de l'élément au niveau supérieur ; la trémie est découpée dans le
  // plancher d'arrivée, la visite suit les marches (garde-corps le long de la volée et autour de la trémie)
  stairs: stairsKind('Escalier droit (monte d’un niveau)', 0.8, 4.2, '#b9b4aa'),
  grand_stairs: stairsKind('Escalier d’honneur (pierre, rampe en fer forgé)', 1.4, 4.6, '#8b1e2d'),

  // Mairie & espace public. `elevation` : hauteur de pose au-dessus du sol de l'élément (dessus de dalle
  // dans un bâtiment) ; `overhead` : hors collisions de la visite (posé en hauteur ou plaqué sur une façade) ;
  // `upper` : posé en partie haute (toiture, fenêtres, fronton, lustre, tableau), masqué en vue « murs arasés » ;
  // `roof` : posé sur le bâtiment (toiture, campanile), masqué dès qu'un niveau est choisi pour voir l'intérieur
  facade_windows: {
    label: 'Fenêtres de façade',
    category: 'collectivite',
    overhead: true,
    upper: true,
    params: [
      { key: 'length', label: 'Longueur (m)', min: 1.5, max: 90, step: 0.5, default: 8, meters: true },
      { key: 'floors', label: 'Niveaux', min: 1, max: 4, step: 1, default: 2 },
      { key: 'firstLevel', label: 'Premier niveau percé', min: 0, max: 3, step: 1, default: 0 },
    ],
    size: ({ length, floors }) => [length, floors * 2.5, 0.25],
    center: ({ floors }) => [0, 0.16 + floors * 1.25, 0.1],
    stretch: { x: { key: 'length' } },
  },
  roof_mansard: {
    label: 'Toiture mansardée',
    category: 'collectivite',
    overhead: true,
    upper: true,
    roof: true,
    color: '#4b5563',
    params: [
      { key: 'width', label: 'Largeur (m)', min: 3, max: 90, step: 0.5, default: 16, meters: true },
      { key: 'depth', label: 'Profondeur (m)', min: 3, max: 60, step: 0.5, default: 8, meters: true },
      { key: 'height', label: 'Hauteur (m)', min: 1, max: 9, step: 0.25, default: 2, meters: true },
      { key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 30, step: 0.25, default: 3.2, meters: true },
    ],
    size: ({ width, depth, height }) => [width + 0.4, height + 0.3, depth + 0.4],
    center: ({ height, elevation }) => [0, elevation + (height + 0.3) / 2, 0],
    stretch: { x: { key: 'width' }, z: { key: 'depth' } },
  },
  belfry: {
    label: 'Campanile et horloge',
    category: 'collectivite',
    overhead: true,
    upper: true,
    roof: true,
    params: [{ key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 40, step: 0.25, default: 5.2, meters: true }],
    size: [1.9, 4.95, 1.9],
    center: ({ elevation }) => [0, elevation + 2.47, 0],
  },
  sign_mairie: {
    label: 'Fronton « MAIRIE »',
    category: 'collectivite',
    overhead: true,
    upper: true,
    params: [{ key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 20, step: 0.1, default: 1.95, meters: true }],
    size: [4.4, 0.92, 0.12],
    center: ({ elevation }) => [0, elevation + 0.46, 0.05],
  },
  flag_fr: { label: 'Mât et drapeau français', category: 'collectivite', overhead: true, size: [1.4, 4.45, 0.3], center: [0.55, 2.22, 0] },
  flag_eu: { label: 'Mât et drapeau européen', category: 'collectivite', overhead: true, size: [1.4, 4.45, 0.3], center: [0.55, 2.22, 0] },
  fountain: { label: 'Fontaine', category: 'collectivite', size: [2.6, 1.85, 2.6] },
  planter: { label: 'Jardinière fleurie', category: 'collectivite', size: [1.6, 0.85, 0.6], color: '#d8ccb4' },
  townlamp: { label: 'Lanterne de ville', category: 'collectivite', size: [0.5, 3.4, 0.5], color: '#1f2937' },
  // Mobilier ancien & patrimoine (intérieurs d'une mairie du XVIIIᵉ siècle)
  marianne_bust: { label: 'Buste de Marianne', category: 'patrimoine', size: [0.5, 1.32, 0.5] },
  portrait: {
    label: 'Portrait officiel (cadre doré)',
    category: 'patrimoine',
    overhead: true,
    upper: true,
    params: [{ key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 10, step: 0.1, default: 1.5, meters: true }],
    size: [0.72, 0.92, 0.08],
    center: ({ elevation }) => [0, elevation + 0.46, 0.04],
  },
  fireplace: { label: 'Cheminée de marbre et trumeau', category: 'patrimoine', size: [1.45, 2.22, 0.6] },
  chandelier: {
    label: 'Lustre à pampilles',
    category: 'patrimoine',
    overhead: true,
    upper: true,
    params: [
      { key: 'elevation', label: 'Hauteur de pose (m)', min: 0.5, max: 15, step: 0.1, default: 2.2, meters: true },
      // Tige de suspension jusqu'au plafond (à raccourcir sous un plancher d'étage)
      { key: 'rod', label: 'Tige de suspension (m)', min: 0.1, max: 4, step: 0.05, default: 0.7, meters: true },
    ],
    size: ({ rod }) => [0.8, 0.5 + rod, 0.8],
    center: ({ elevation, rod }) => [0, elevation + (0.5 + rod) / 2, 0],
  },
  grandfather_clock: { label: 'Horloge comtoise', category: 'patrimoine', size: [0.5, 1.87, 0.32] },
  council_table: {
    label: 'Table du conseil',
    category: 'patrimoine',
    params: [{ key: 'length', label: 'Longueur (m)', min: 1.5, max: 15, step: 0.1, default: 4.5, meters: true }],
    size: ({ length }) => [length, 0.62, 1.0],
    stretch: { x: { key: 'length' } },
  },
  style_armchair: { label: 'Fauteuil de style', category: 'patrimoine', size: [0.45, 0.8, 0.42] },
  // Mobilier ancien équipé : écrans et clavier posés dessus (0 : sans poste informatique)
  antique_desk: {
    label: 'Bureau ancien et fauteuil',
    category: 'patrimoine',
    params: [{ key: 'screens', label: 'Écrans (poste informatique)', min: 0, max: 2, step: 1, default: 0 }],
    size: [1.12, 0.85, 1.05],
    center: [0, 0.42, 0.2],
  },
  wooden_counter: {
    label: 'Guichet en bois',
    category: 'patrimoine',
    params: [
      { key: 'length', label: 'Longueur (m)', min: 1, max: 12, step: 0.1, default: 2.4, meters: true },
      { key: 'screens', label: 'Écrans côté agent', min: 0, max: 2, step: 1, default: 0 },
    ],
    size: ({ length }) => [length + 0.06, 1.3, 0.58],
    stretch: { x: { key: 'length' } },
  },
  register_shelf: { label: 'Bibliothèque de registres', category: 'patrimoine', size: [1.3, 1.65, 0.38] },
  old_safe: { label: 'Coffre-fort ancien', category: 'patrimoine', size: [0.56, 0.95, 0.5] },
  carpet: {
    label: 'Tapis d’apparat',
    category: 'patrimoine',
    overhead: true,
    params: [
      { key: 'width', label: 'Largeur (m)', min: 0.6, max: 30, step: 0.1, default: 3, meters: true },
      { key: 'depth', label: 'Profondeur (m)', min: 0.6, max: 30, step: 0.1, default: 2, meters: true },
    ],
    size: ({ width, depth }) => [width, 0.03, depth],
    stretch: { x: { key: 'width' }, z: { key: 'depth' } },
  },
  steps: {
    label: 'Perron (3 marches)',
    category: 'collectivite',
    overhead: true,
    params: [{ key: 'width', label: 'Largeur (m)', min: 1, max: 20, step: 0.1, default: 3.4, meters: true }],
    size: ({ width }) => [width, 0.17, 1.05],
    stretch: { x: { key: 'width' } },
  },
};

/** Valeurs par défaut des réglages d'un modèle. */
export function defaultParams(kind) {
  return Object.fromEntries((ELEMENT_KINDS[kind]?.params || []).map((p) => [p.key, p.default]));
}

/** Empreinte [X, hauteur, Z] et centre de la boîte de sélection d'un élément. */
export function elementBox(element) {
  const def = ELEMENT_KINDS[element.kind];
  if (!def) return { size: [0.5, 0.5, 0.5], center: [0, 0.25, 0] };
  const params = { ...defaultParams(element.kind), ...element.params };
  const size = typeof def.size === 'function' ? def.size(params) : def.size;
  // Centre fixe, ou calculé (éléments posés en hauteur : toiture, campanile, fronton)
  const center = typeof def.center === 'function' ? def.center(params) : def.center;
  return { size, center: center || [0, size[1] / 2, 0] };
}

/** Tenues des PNJ (voir models/people.jsx). */
export const NPC_OUTFITS = {
  worker: 'Opérateur (EPI)',
  office: 'Employé de bureau',
  officeAlt: 'Cadre',
  welder: 'Soudeur',
  painter: 'Peintre',
  driver: 'Cariste',
  logistics: 'Logisticien',
};

export const NPC_POSES = {
  stand: 'Debout',
  work: 'Au poste',
  type: 'Au clavier (assis)',
  sit: 'Assis',
  carry: 'Porte une charge',
};

/** Trajet d'un PNJ : boucle (retour au départ) ou aller-retour. */
export const NPC_ROUTE_MODES = { loop: 'Boucle', pingpong: 'Aller-retour' };

/** Bâtiments modèles : enveloppes du jumeau (bureaux, usine, peinture, entrepôt) et leurs finitions. */
export const PREFAB_SKINS = BUILDING_SKINS;
export const PREFAB_DEFAULT_SIZE = { office: [18, 16.8], factory: [22, 18], paint: [18, 16.8], logistics: [20, 18] };
/** Largeur et profondeur admises (unités, soit 15 à 90 m). */
export const PREFAB_SIZE_RANGE = [10, 60];
export const PREFAB_THEME = { office: '#3b82f6', factory: '#f59e0b', paint: '#8b5cf6', logistics: '#06b6d4' };

/** Formes de base des bâtiments personnalisés (contour en unités, centré sur l'origine). */
export const SHAPE_PRESETS = {
  rect: {
    label: 'Rectangle',
    polygon: [[-8, -6], [8, -6], [8, 6], [-8, 6]],
  },
  l: {
    label: 'En L',
    polygon: [[-8, -7], [0, -7], [0, 0], [8, 0], [8, 7], [-8, 7]],
  },
  u: {
    label: 'En U',
    polygon: [[-9, -7], [-3, -7], [-3, 1], [3, 1], [3, -7], [9, -7], [9, 7], [-9, 7]],
  },
  t: {
    label: 'En T',
    polygon: [[-9, -7], [9, -7], [9, -1], [3, -1], [3, 7], [-3, 7], [-3, -1], [-9, -1]],
  },
  hexagon: {
    label: 'Hexagone',
    polygon: Array.from({ length: 6 }, (_, i) => {
      const a = (i * Math.PI) / 3;
      return [Math.round(Math.cos(a) * 7 * 2) / 2, Math.round(Math.sin(a) * 7 * 2) / 2];
    }),
  },
  octagon: {
    label: 'Octogone',
    polygon: [[-3, -7], [3, -7], [7, -3], [7, 3], [3, 7], [-3, 7], [-7, 3], [-7, -3]],
  },
};

/** Façades des bâtiments personnalisés (`map` : texture procédurale de models/textures.js). */
export const BUILDING_STYLES = {
  bardage: { label: 'Bardage acier', map: 'panel', color: '#9ca3af', roof: '#475569' },
  brique: { label: 'Brique', map: 'brick', color: '#ffffff', roof: '#57534e' },
  beton: { label: 'Béton', map: 'concrete', color: '#e2e8f0', roof: '#64748b' },
  enduit: { label: 'Enduit', map: null, color: '#e7e5e4', roof: '#78716c' },
  pierre: { label: 'Pierre de taille', map: 'ashlar', color: '#ffffff', roof: '#4b5563' },
  vitre: { label: 'Mur-rideau vitré', glass: true, color: '#334155', roof: '#334155' },
};

export const FLOOR_STYLES = {
  beton: { label: 'Béton lissé', map: 'concrete', color: '#cbd5e1' },
  epoxy: { label: 'Résine époxy', map: 'epoxy', color: '#ffffff' },
  parquet: { label: 'Parquet ancien', map: 'parquet', color: '#ffffff' },
  uni: { label: 'Sol uni', map: null, color: '#d6d3d1' },
};

/** Murs intérieurs et clôtures (dessinés segment par segment). */
export const WALL_TYPES = {
  plein: { label: 'Cloison pleine', height: 2.0, thickness: 0.14, color: '#e2e8f0' },
  vitre: { label: 'Cloison vitrée', height: 2.0, thickness: 0.1, color: '#334155' },
  grillage: { label: 'Grillage', height: 1.6, thickness: 0.06, color: '#64748b' },
  muret: { label: 'Muret', height: 0.7, thickness: 0.2, color: '#94a3b8' },
};

/** Ouvertures : porte piétonne ou portail (dimensions en unités). */
export const DOOR_KINDS = {
  porte: { label: 'Porte', width: 0.8, height: 1.45 },
  portail: { label: 'Portail', width: 2.6, height: 2.6 },
  // Baie ouverte (vestibule, grande arcade) : ni encadrement ni rideau
  passage: { label: 'Passage (sans menuiserie)', width: 1.6, height: 2.6 },
};

export const SURFACE_MATERIALS = {
  asphalte: { label: 'Enrobé', map: 'asphalt', color: '#ffffff' },
  paves: { label: 'Pavés', map: 'pavers', color: '#ffffff' },
  beton: { label: 'Béton', map: 'concrete', color: '#d1d5db' },
  gazon: { label: 'Gazon', map: 'grass', color: '#d9f99d' },
  epoxy: { label: 'Résine', map: 'epoxy', color: '#ffffff' },
};
