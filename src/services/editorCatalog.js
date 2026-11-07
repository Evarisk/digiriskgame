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
  { id: 'ville', label: 'Ville, commerces & voirie' },
  { id: 'loisirs', label: 'École & loisirs' },
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
// Postes dont le modèle déborde de l'emprise standard (mesuré sur le rendu)
const STATION_SIZES = { air_freight: [5.0, 2.3, 3.6] };

const stationKinds = Object.fromEntries(
  WORKUNIT_SKIN_GROUPS.flatMap((group) =>
    group.skins.map(([archetype, label]) => [
      `station:${archetype}`,
      { label, group: group.label, category: 'postes', size: STATION_SIZES[archetype] || STATION_SIZE, risk: true, archetype },
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
    label: 'Jeu de cartes DigiRisk (présentoir, boîtes et cartes)',
    category: 'bureau',
    overhead: true,
    params: [{ key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 3, step: 0.01, default: 0.52, meters: true }],
    size: [0.2, 0.25, 0.26],
    center: ({ elevation }) => [0, elevation + 0.125, 0.05],
  },
  rollup_banner: {
    label: 'Kakémono DigiRisk (jeu de cartes)',
    category: 'bureau',
    size: [0.6, 1.4, 0.3],
    center: [0, 0.7, 0],
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
  car: { label: 'Voiture', category: 'vehicules', size: [3.1, 1.12, 1.22], color: '#2563eb' },
  van: { label: 'Fourgon', category: 'vehicules', size: [3.3, 1.35, 1.24], color: '#f8fafc' },
  truck: { label: 'Poids lourd', category: 'vehicules', size: [7.8, 3.0, 1.9], color: '#c81e1e' },
  tractor_mower: { label: 'Tracteur et épareuse', category: 'vehicules', size: [2.3, 1.65, 2.6], center: [-0.1, 0.82, -0.65], color: '#15803d' },

  // Restauration collective (cantine, cuisine centrale)
  kitchen_range: { label: 'Piano de cuisson et hotte', category: 'restauration', size: [1.8, 2.2, 1.0], center: [0, 1.1, -0.05] },
  inox_worktable: { label: 'Table de travail inox', category: 'restauration', size: [1.6, 0.68, 0.68] },
  dish_station: { label: 'Plonge et lave-vaisselle', category: 'restauration', size: [1.7, 1.15, 0.7] },
  canteen_table: { label: 'Table de cantine et bancs', category: 'restauration', size: [1.8, 0.5, 1.22] },

  tree: { label: 'Arbre', category: 'exterieur', size: [0.5, 3.0, 0.5], center: [0, 1.5, 0] },
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
      { key: 'balconnet', label: 'Balconnets aux étages (0 / 1)', min: 0, max: 1, step: 1, default: 1 },
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

  // Ville : bâtiments (toiture à deux pans, bandeau vitré, enseigne au libellé de l'élément), maisons de ville à
  // commerces, terrasse, abribus, circulation animée, mobilier urbain ; école et loisirs ; cours techniques
  roof_gable: {
    label: 'Toiture à deux pans (bac acier)',
    category: 'ville',
    overhead: true,
    upper: true,
    roof: true,
    color: '#6b7480',
    params: [
      { key: 'width', label: 'Longueur (faîtage, m)', min: 2, max: 80, step: 0.5, default: 20, meters: true },
      { key: 'depth', label: 'Profondeur (m)', min: 2, max: 40, step: 0.5, default: 16, meters: true },
      { key: 'height', label: 'Hauteur au faîtage (m)', min: 0.3, max: 8, step: 0.1, default: 2.4, meters: true },
      { key: 'elevation', label: 'Hauteur des murs (m)', min: 0, max: 20, step: 0.1, default: 4.4, meters: true },
      { key: 'gable', label: 'Teinte des pignons (0 gris, 1 vert, 2 brique, 3 crème)', min: 0, max: 3, step: 1, default: 0 },
      { key: 'skylights', label: 'Plaques translucides (0 / 1)', min: 0, max: 1, step: 1, default: 1 },
    ],
    size: ({ width, depth, height }) => [width + 0.7, height + 0.3, depth + 0.7],
    center: ({ height, elevation }) => [0, elevation + height / 2, 0],
    stretch: { x: { key: 'width' }, z: { key: 'depth' } },
  },
  ribbon_windows: {
    label: 'Bandeau vitré (bâtiment d\u2019activité)',
    category: 'ville',
    overhead: true,
    upper: true,
    params: [
      { key: 'length', label: 'Longueur (m)', min: 1, max: 60, step: 0.5, default: 6, meters: true },
      { key: 'height', label: 'Hauteur du vitrage (m)', min: 0.3, max: 3, step: 0.1, default: 0.9, meters: true },
      { key: 'elevation', label: 'Hauteur d\u2019allège (m)', min: 0, max: 12, step: 0.1, default: 1.0, meters: true },
    ],
    size: ({ length, height }) => [length + 0.2, height + 0.1, 0.15],
    center: ({ height, elevation }) => [0, elevation + height / 2, 0.07],
    stretch: { x: { key: 'length' } },
  },
  wall_sign: {
    label: 'Enseigne murale (texte : libellé)',
    category: 'ville',
    overhead: true,
    upper: true,
    params: [
      { key: 'width', label: 'Largeur (m)', min: 0.5, max: 20, step: 0.1, default: 6, meters: true },
      { key: 'style', label: 'Style (0 municipal, 1 pierre gravée)', min: 0, max: 1, step: 1, default: 0 },
      { key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 15, step: 0.1, default: 3, meters: true },
    ],
    size: ({ width, style }) => [width + 0.06, width * (style ? 0.14 : 0.12) + 0.06, 0.08],
    center: ({ width, style, elevation }) => [0, elevation + (width * (style ? 0.14 : 0.12)) / 2, 0.04],
  },
  townhouse: {
    label: 'Maison de ville (commerce au rez-de-chaussée)',
    category: 'ville',
    params: [
      { key: 'width', label: 'Largeur de façade (m)', min: 3, max: 14, step: 0.5, default: 6, meters: true },
      { key: 'floors', label: 'Niveaux', min: 2, max: 5, step: 1, default: 3 },
      { key: 'shop', label: 'Commerce (0 aucun, 1 boulangerie, 2 café, 3 pharmacie, 4 tabac-presse, 5 fleuriste, 6 boucherie, 7 coiffure, 8 librairie, 9 épicerie)', min: 0, max: 9, step: 1, default: 1 },
      { key: 'facade', label: 'Teinte de l\u2019enduit (0–5)', min: 0, max: 5, step: 1, default: 0 },
      { key: 'slate', label: 'Couverture (0 tuiles, 1 ardoises)', min: 0, max: 1, step: 1, default: 0 },
    ],
    size: ({ width, floors }) => [width, floors * 2 + 1.95, 5.5],
    center: ({ floors }) => [0, (floors * 2 + 1.95) / 2, -2.4],
    stretch: { x: { key: 'width' } },
  },
  cafe_terrace: {
    label: 'Terrasse de café (guéridons, parasols)',
    category: 'ville',
    color: '#6f1d22',
    params: [{ key: 'tables', label: 'Guéridons', min: 1, max: 10, step: 1, default: 4 }],
    // Emprise des guéridons et chaises (les parasols, à 2,2 m, ne gênent pas la marche)
    size: ({ tables }) => [tables * 1.25 - 0.05, 1.9, 0.75],
    center: [0, 0.95, 0],
  },
  bus_shelter: { label: 'Abribus (affiche DigiRisk)', category: 'ville', size: [3.4, 2.3, 1.2], center: [-0.3, 1.15, 0] },
  traffic: {
    label: 'Circulation (voitures animées)',
    category: 'ville',
    overhead: true,
    params: [
      { key: 'length', label: 'Longueur de rue (m)', min: 10, max: 300, step: 1, default: 90, meters: true },
      { key: 'count', label: 'Véhicules', min: 2, max: 24, step: 1, default: 8 },
      { key: 'crossA', label: 'Passage piéton 1 (abscisse locale, m)', min: -150, max: 999, step: 0.5, default: 0, meters: true },
      { key: 'crossB', label: 'Passage piéton 2 (999 : aucun)', min: -150, max: 999, step: 0.5, default: 999, meters: true },
    ],
    size: ({ length }) => [length, 1, 2.8],
    center: [0, 0.5, 0],
    stretch: { x: { key: 'length' } },
  },
  road_markings: {
    label: 'Marquage de chaussée (axe, rive, stationnement)',
    category: 'ville',
    overhead: true,
    params: [
      { key: 'length', label: 'Longueur (m)', min: 4, max: 300, step: 1, default: 90, meters: true },
      { key: 'width', label: 'Largeur de chaussée (m)', min: 3, max: 15, step: 0.5, default: 5, meters: true },
      { key: 'crossA', label: 'Passage piéton 1 (abscisse locale, m)', min: -150, max: 999, step: 0.5, default: 999, meters: true },
      { key: 'crossB', label: 'Passage piéton 2 (999 : aucun)', min: -150, max: 999, step: 0.5, default: 999, meters: true },
      { key: 'parking', label: 'Ligne de stationnement (0 / 1)', min: 0, max: 1, step: 1, default: 1 },
      { key: 'junction', label: 'Débouché d\u2019une voie côté rive (abscisse locale, 999 : aucun)', min: -150, max: 999, step: 0.5, default: 999, meters: true },
    ],
    size: ({ length, width }) => [length, 0.02, width],
    center: [0, 0.01, 0],
    stretch: { x: { key: 'length' } },
  },
  notice_board: { label: 'Panneau d\u2019affichage municipal', category: 'ville', size: [1.5, 1.95, 0.2], center: [0, 0.97, 0] },
  post_box: { label: 'Boîte aux lettres', category: 'ville', size: [0.45, 1.5, 0.35], center: [0, 0.75, 0] },
  litter_bin: { label: 'Corbeille de rue', category: 'ville', size: [0.45, 0.95, 0.45], center: [0, 0.47, 0] },
  bike_rack: {
    label: 'Arceaux et vélos',
    category: 'ville',
    params: [{ key: 'bikes', label: 'Vélos garés', min: 0, max: 4, step: 1, default: 3 }],
    size: [2.2, 0.8, 1.6],
    center: [0, 0.4, 0],
  },
  recycling_point: { label: 'Point de tri (verre, emballages, papiers)', category: 'ville', size: [3.6, 1.6, 1.4], center: [0, 0.8, 0] },
  preau: {
    label: 'Préau',
    category: 'loisirs',
    overhead: true,
    params: [{ key: 'length', label: 'Longueur (m)', min: 3, max: 30, step: 0.5, default: 8, meters: true }],
    size: ({ length }) => [length + 0.6, 2.8, 4.3],
    center: [0, 1.4, 0],
    stretch: { x: { key: 'length' } },
  },
  play_structure: { label: 'Structure de jeux (toboggan)', category: 'loisirs', size: [3.0, 2.4, 1.4], center: [0.4, 1.2, 0] },
  hopscotch: { label: 'Marelle', category: 'loisirs', overhead: true, size: [0.85, 0.02, 2.5], center: [0, 0.01, 0] },
  playing_children: {
    label: 'Enfants qui jouent (animés)',
    category: 'loisirs',
    overhead: true,
    params: [
      { key: 'count', label: 'Enfants', min: 1, max: 12, step: 1, default: 6 },
      { key: 'spread', label: 'Étendue du jeu (m)', min: 1, max: 12, step: 0.5, default: 3, meters: true },
    ],
    size: ({ spread }) => [spread * 2, 0.8, spread * 1.4],
    center: [0, 0.4, 0],
  },
  tool_wall: {
    label: 'Établi et panneau à outils',
    category: 'stockage',
    params: [{ key: 'length', label: 'Longueur (m)', min: 1, max: 6, step: 0.1, default: 2.4, meters: true }],
    size: ({ length }) => [length + 0.06, 2.0, 0.72],
    center: [0, 1.0, -0.04],
    stretch: { x: { key: 'length' } },
  },
  tire_stack: { label: 'Piles de pneus', category: 'stockage', size: [1.3, 0.9, 0.5], center: [0, 0.45, 0] },
  cones_stock: { label: 'Stock de cônes et barrières de chantier', category: 'stockage', size: [2.6, 1.0, 0.8], center: [0.15, 0.5, -0.05] },
  lockers: {
    label: 'Vestiaires (casiers et banc)',
    category: 'bureau',
    params: [{ key: 'count', label: 'Casiers', min: 2, max: 12, step: 1, default: 6 }],
    size: ({ count }) => [count * 0.32, 1.2, 0.95],
    center: [0, 0.6, 0.15],
  },
  coffee_corner: { label: 'Coin café des agents', category: 'bureau', size: [3.05, 1.2, 1.5], center: [0.75, 0.6, 0.25] },
  riding_mower: { label: 'Tondeuse autoportée', category: 'vehicules', size: [1.6, 0.95, 0.85], center: [-0.1, 0.47, 0] },
  garden_tools_rack: {
    label: 'Râtelier d\u2019outils de jardin',
    category: 'stockage',
    params: [{ key: 'length', label: 'Longueur (m)', min: 1, max: 6, step: 0.1, default: 2.2, meters: true }],
    size: ({ length }) => [length, 1.7, 0.3],
    center: [0, 0.85, -0.17],
    stretch: { x: { key: 'length' } },
  },
  compost_bags: { label: 'Palette de sacs de terreau', category: 'stockage', size: [1.2, 0.8, 0.8], center: [0, 0.4, 0] },
  kids_lunch: { label: 'Enfants qui déjeunent (à poser sur une table de cantine)', category: 'loisirs', overhead: true, size: [1.8, 0.9, 1.3], center: [0, 0.45, 0] },
  material_bays: { label: 'Alvéoles de matériaux (sable, gravier, sel)', category: 'stockage', size: [5.2, 1.3, 2.2], center: [0, 0.6, 0] },
  skip: { label: 'Benne à gravats', category: 'stockage', size: [2.8, 1.1, 1.7], center: [0, 0.5, 0] },
  green_waste: { label: 'Déchets verts (branchages)', category: 'exterieur', size: [2.2, 1.0, 1.8], center: [0, 0.5, 0] },
  hedge: {
    label: 'Haie taillée',
    category: 'exterieur',
    params: [{ key: 'length', label: 'Longueur (m)', min: 1, max: 40, step: 0.5, default: 4, meters: true }],
    size: ({ length }) => [length, 0.9, 0.6],
    center: [0, 0.45, 0],
    stretch: { x: { key: 'length' } },
  },
  entrance_portal: {
    label: 'Portail d’honneur (porte, balcon, attique)',
    category: 'collectivite',
    overhead: true,
    upper: true,
    params: [{ key: 'width', label: 'Largeur de l’avant-corps (m)', min: 4, max: 20, step: 0.5, default: 8, meters: true }],
    size: ({ width }) => [width + 0.1, 6, 0.6],
    center: [0, 3, 0.25],
  },
  balcony_flag: {
    label: 'Drapeau de balcon (France, Europe, Occitanie)',
    category: 'collectivite',
    overhead: true,
    upper: true,
    params: [
      { key: 'flag', label: 'Drapeau (0 France, 1 Europe, 2 Occitanie)', min: 0, max: 2, step: 1, default: 0 },
      { key: 'elevation', label: 'Hauteur du support (m)', min: 0, max: 20, step: 0.1, default: 3.3, meters: true },
      { key: 'side', label: 'Toile vers la droite (0) ou la gauche (1)', min: 0, max: 1, step: 1, default: 0 },
    ],
    // Toile flottant d'un côté de la hampe : boîte décalée de ce côté
    size: [1.15, 1.6, 1.2],
    center: ({ elevation, side }) => [side ? -0.4 : 0.4, elevation + 0.8, 0.45],
  },
  flag_fr: { label: 'Mât et drapeau français', category: 'collectivite', overhead: true, size: [1.4, 4.45, 0.3], center: [0.55, 2.22, 0] },
  flag_eu: { label: 'Mât et drapeau européen', category: 'collectivite', overhead: true, size: [1.4, 4.45, 0.3], center: [0.55, 2.22, 0] },
  fountain: { label: 'Fontaine', category: 'collectivite', size: [2.6, 1.85, 2.6] },
  // Vie de la place : pigeons qui marchent et picorent (hors collisions de la visite), outils des jardiniers
  pigeons: { label: 'Pigeons (animés)', category: 'collectivite', overhead: true, size: [3, 0.2, 3] },
  watering_can: { label: 'Arrosoir', category: 'collectivite', overhead: true, size: [0.18, 0.3, 0.42], center: [0, 0.15, 0.06], color: '#4f6f46' },
  wheelbarrow: { label: 'Brouette de jardinier', category: 'collectivite', size: [0.45, 0.62, 1.2], center: [0, 0.31, -0.1] },
  planter: { label: 'Jardinière fleurie', category: 'collectivite', size: [1.6, 0.85, 0.6], color: '#d8ccb4' },
  townlamp: { label: 'Lanterne de ville', category: 'collectivite', size: [0.5, 3.4, 0.5], color: '#1f2937' },
  // Mobilier ancien & patrimoine (intérieurs d'une mairie du XVIIIᵉ siècle)
  marianne_bust: { label: 'Buste de Marianne', category: 'patrimoine', size: [0.5, 1.32, 0.5] },
  portrait: {
    label: 'Portrait officiel de la maire (cadre doré)',
    category: 'patrimoine',
    overhead: true,
    upper: true,
    params: [
      { key: 'elevation', label: 'Hauteur de pose (m)', min: 0, max: 10, step: 0.1, default: 1.5, meters: true },
      { key: 'variant', label: 'Apparence de la maire (0–7)', min: 0, max: 7, step: 1, default: 1 },
    ],
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
  mayor: 'Maire (écharpe tricolore)',
  gardener: 'Jardinier (espaces verts)',
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
  meet: 'Assis à une table (réunion, pause)',
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
  beton: { label: 'Béton', map: 'concreteCity', color: '#e2e8f0', roof: '#64748b' },
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
  asphalte: { label: 'Enrobé', map: 'asphaltCity', color: '#ffffff' },
  paves: { label: 'Pavés', map: 'granite', color: '#ffffff' },
  beton: { label: 'Béton', map: 'concrete', color: '#ffffff' },
  gazon: { label: 'Gazon', map: 'lawn', color: '#ffffff' },
  epoxy: { label: 'Résine', map: 'epoxy', color: '#ffffff' },
};
