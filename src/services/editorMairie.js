import {
  emptyScene,
  createBuilding,
  createWall,
  createSurface,
  createWalkway,
  createElement,
  createNpc,
} from './editorScene';

/**
 * Mairie de démonstration (salon des maires) pour l'éditeur (/edit), construite sur l'arborescence de
 * l'entité « Mairie » (n° 6) de l'instance de démonstration DigiRisk (demodoli.digirisk.com, relevé du
 * 4 novembre 2026) : chaque unité de travail (WU) y a sa zone, sa référence et la couleur de sa cotation
 * maximale. Les UT « génériques » (GP8, modèles sans lieu) ne sont pas posées.
 * - GP3 Service administratif : hôtel de ville du XVIIIᵉ siècle (pierre de taille, avant-corps, fronton,
 *   toiture mansardée, campanile), intérieurs d'époque, sur deux niveaux : au rez-de-chaussée le hall
 *   d'accueil et son escalier d'honneur, l'état civil et les services ; à l'étage noble la salle du conseil
 *   et des mariages (derrière les fenêtres de l'avant-corps), le bureau de la maire et la salle de réunion ;
 * - GP6 DGS › GP4 Centre Technique Municipal (CTM, hangar et station d'épuration) et GP5 Centre Technique
 *   Environnement (CTE) ;
 * - GP7 ALP (accueil de loisirs périscolaire) : ancienne école en brique, cantine et cuisine.
 * Les façades sont percées derrière chaque fenêtre (on voit au travers) : fenêtres et mobilier sont placés
 * entre les cloisons, sans meuble devant une baie. La visite démarre sur la place, face à la façade.
 * Coordonnées en unités de scène (1 unité ≈ 1,5 m), façade principale vers +Z (sud).
 */

const el = (kind, x, z, rotation = 0, patch = {}) => createElement(kind, [x, z], { rotation, ...patch });
/** Ouverture de façade ; `level` : niveau percé (passage d'étage entre bâtiments accolés). */
const door = (edge, t, kind = 'porte', width, level = 0) => ({
  edge,
  t,
  kind,
  width: width ?? (kind === 'portail' ? 2.6 : 0.8),
  ...(level ? { level } : {}),
});
/**
 * Rangée de fenêtres plaquée sur une façade (rotation : 0 sud, 90 est, 180 nord, 270 ouest), une par niveau :
 * vitrages tous les 1,8 (centrés sur la rangée), la façade est percée derrière chacun.
 */
const windows = (x, z, rotation, length, level = 0) =>
  el('facade_windows', x, z, rotation, { params: { length, floors: 1, firstLevel: 0 }, ...(level ? { level } : {}) });
const armchair = (x, z, rotation = 0) => el('style_armchair', x, z, rotation);
/** Lustre suspendu à 2,2 m du sol, tige jusqu'au plafond (plancher de l'étage ou corniche du toit). */
const chandelier = (x, z, rod = ROD_GROUND) => el('chandelier', x, z, 0, { params: { elevation: 1.45, rod } });
/** Objets de l'étage noble (1er étage). */
const upstairs = (items) => items.map((item) => ({ ...item, level: 1 }));

/** Niveau d'échelle DigiRisk d'une cotation (0–47 faible, 48–50 modéré, 51–80 élevé, 81–100 critique). */
const level = (cotation) => (cotation >= 81 ? 'crit' : cotation >= 51 ? 'high' : cotation >= 48 ? 'med' : 'low');
const utLabel = ({ ref, label, cotation }) => `${ref} · ${label} — ${cotation}`;
/** Zone cotée d'une unité de travail DigiRisk (sans poste moderne). */
const ut = (u, x, z, width, depth) => el('ut_zone', x, z, 0, { risk: level(u.cotation), label: utLabel(u), params: { width, depth } });
/** Poste du jumeau coté avec la cotation d'une unité de travail DigiRisk. */
const utStation = (u, archetype, x, z, rotation = 0) => el(`station:${archetype}`, x, z, rotation, { risk: level(u.cotation), label: utLabel(u) });

// Unités de travail de l'entité « Mairie » (référence, libellé, cotation maximale de la dernière évaluation)
const WU = {
  accueil: { ref: 'WU1', label: 'Accueil du public', cotation: 66 },
  finance: { ref: 'WU2', label: 'Finance', cotation: 25 },
  urbanisme: { ref: 'WU3', label: 'Urbanisme / État civil / Communication', cotation: 25 },
  reunion: { ref: 'WU4', label: 'Salle de réunion / Bureau de la maire', cotation: 0 },
  pause: { ref: 'WU5', label: 'Salle de pause', cotation: 48 },
  secretariat: { ref: 'WU17', label: 'Secrétariat général', cotation: 25 },
  archives: { ref: 'WU18', label: 'Salle d’archives', cotation: 27 },
  baie: { ref: 'WU20', label: 'Baie de brassage', cotation: 51 },
  petiteReparation: { ref: 'WU6', label: 'Petite réparation', cotation: 31 },
  fosse: { ref: 'WU9', label: 'Fosse VL', cotation: 31 },
  stockage: { ref: 'WU10', label: 'Stockage', cotation: 48 },
  voirie: { ref: 'WU11', label: 'Entretien voirie', cotation: 31 },
  bureauTechnique: { ref: 'WU12', label: 'Bureau technique', cotation: 0 },
  bureauAnalyse: { ref: 'WU13', label: 'Bureau analyse', cotation: 31 },
  mezzanine: { ref: 'WU14', label: 'Stockage mezzanine', cotation: 27 },
  epuration: { ref: 'WU15', label: 'Station d’épuration', cotation: 48 },
  ateliers: { ref: 'WU16', label: 'Ateliers de réparation', cotation: 48 },
  epareuse: { ref: 'WU7', label: 'Épareuse', cotation: 42 },
  debroussaillage: { ref: 'WU8', label: 'Débroussaillage, tronçonnage', cotation: 31 },
  cuisines: { ref: 'WU21', label: 'Cuisines', cotation: 100 },
  plonge: { ref: 'WU22', label: 'Plonge', cotation: 25 },
  stockageAlp: { ref: 'WU23', label: 'Stockage', cotation: 48 },
  cantine: { ref: 'WU24', label: 'Cantine', cotation: 100 },
  directionAlp: { ref: 'WU25', label: 'Bureau direction ALP', cotation: 51 },
};

const WALL = 0.3; // épaisseur des murs de l'hôtel de ville
const OUT = WALL / 2 + 0.02; // décalage des fenêtres devant le nu de la façade
const HEIGHT = 5; // deux niveaux de 2,5 (≈ 3,75 m)
const PAVILION = 6.4; // avant-corps plus haut que les ailes
const ROOF_GAP = 0.02; // toitures posées 3 cm au-dessus des murs (pas de faces confondues avec un toit plat)
const INNER = 5.85; // nu intérieur des murs nord de l'hôtel de ville (z = −5,85)
const PARTITION = { height: 3, color: '#f1e9d8' }; // arrêtées dans le plancher de l'étage ou sous le toit
// Tiges des lustres : sous le plancher de l'étage (2,30 de hauteur libre) ou sous la corniche du toit (2,52)
const ROD_GROUND = 0.34;
const ROD_NOBLE = 0.55;
// Escalier d'honneur : au fond du hall, première marche côté entrée (z = −0,6), arrivée au palier nord (z = −5)
const STAIR = { x: 0, z: -2.8, width: 1.6, length: 4.4 };

export function buildMairieScene() {
  const scene = emptyScene('Mairie de démo — Salon des maires');
  // Visite : départ sur la place, au passage piéton, regard vers la façade (nord)
  scene.spawn = { position: [0, 16.4], rotation: 180 };

  /* ---------- Sols (dans l'ordre d'empilement : les suivants passent devant) ---------- */
  scene.surfaces = [
    createSurface([[-44, -44], [41, -44], [41, 4.1], [-44, 4.1]], 'gazon', { name: 'Espaces verts et jardin public' }),
    createSurface([[-44, 14], [50, 14], [50, 19], [-44, 19]], 'asphalte', { name: 'Rue de la Mairie' }),
    createSurface([[-20, 4.1], [18, 4.1], [18, 14], [-20, 14]], 'paves', { name: 'Place de la Mairie' }),
    createSurface([[-40, 4.1], [-20, 4.1], [-20, 13.8], [-40, 13.8]], 'beton', { name: 'Cour de l’ALP' }),
    createSurface([[41, -44], [46, -44], [46, 14], [41, 14]], 'asphalte', { name: 'Voie des services techniques' }),
    createSurface([[18, -2], [41, -2], [41, 5], [18, 5]], 'beton', { name: 'Cour du CTM' }),
    createSurface([[18, 5], [36, 5], [36, 13.6], [18, 13.6]], 'asphalte', { name: 'Parking' }),
    createSurface([[22, -27], [34, -27], [34, -20], [22, -20]], 'beton', { name: 'Station d’épuration' }),
    createSurface([[18, -31], [41, -31], [41, -28], [18, -28]], 'beton', { name: 'Aire du CTE' }),
  ];

  /* ---------- Bâtiments ---------- */
  // GP3 Service administratif — hôtel de ville sur deux niveaux. Arêtes : 0 nord · 1 est · 2 sud (façade) · 3 ouest
  const mairie = createBuilding([[-12, -6], [12, -6], [12, 4], [-12, 4]], {
    name: 'Hôtel de ville — GP3 Service administratif',
    style: 'pierre',
    wallColor: '#ffffff',
    height: HEIGHT,
    levels: 2,
    wallThickness: WALL,
    floor: 'parquet',
    floorColor: '#ffffff',
    // Grande baie ouverte derrière l'avant-corps aux deux niveaux (vestibule → hall, salle du conseil → avant-corps),
    // portes de service sur les autres façades (nord dans l'axe de la travée du secrétariat)
    doors: [door(2, 0.5, 'passage', 7.4), door(2, 0.5, 'passage', 7.4, 1), door(0, 0.7625, 'porte', 0.9), door(1, 0.5, 'porte', 0.9), door(3, 0.5, 'porte', 0.9)],
  });
  // Avant-corps central (vestibule, et à l'étage le fond de la salle du conseil) — arêtes : 0 arrière · 1 est · 2 sud (entrée) · 3 ouest
  const avantCorps = createBuilding([[-4, 3.7], [4, 3.7], [4, 5.8], [-4, 5.8]], {
    name: 'Avant-corps',
    style: 'pierre',
    wallColor: '#ffffff',
    height: PAVILION,
    levels: 2,
    wallThickness: WALL,
    floor: 'parquet',
    floorColor: '#ffffff',
    doors: [door(0, 0.5, 'passage', 7.4), door(0, 0.5, 'passage', 7.4, 1), door(2, 0.5, 'porte', 1.5)],
  });
  // GP4 Centre Technique Municipal. Arêtes : 0 nord · 1 est · 2 sud (portails) · 3 ouest
  const ctm = createBuilding([[18, -18], [38, -18], [38, -2], [18, -2]], {
    name: 'GP4 · Centre Technique Municipal (CTM)',
    style: 'bardage',
    wallColor: '#9aa8b8',
    height: 4.4,
    floor: 'beton',
    doors: [door(2, 0.25, 'portail', 3.4), door(2, 0.6, 'portail', 3.4), door(2, 0.9, 'porte', 0.9), door(3, 0.5, 'porte', 0.9), door(0, 0.5, 'porte', 0.9)],
  });
  // GP5 Centre Technique Environnement. Arêtes : 0 nord · 1 est · 2 sud · 3 ouest
  const cte = createBuilding([[18, -40], [32, -40], [32, -31], [18, -31]], {
    name: 'GP5 · Centre Technique Environnement (CTE)',
    style: 'bardage',
    wallColor: '#7c9a6d',
    height: 4,
    floor: 'beton',
    doors: [door(2, 0.55, 'portail', 3.4), door(2, 0.9, 'porte', 0.9)],
  });
  // GP7 ALP — ancienne école en brique. Arêtes : 0 nord · 1 est · 2 sud (cour) · 3 ouest
  const alp = createBuilding([[-40, -8], [-20, -8], [-20, 4], [-40, 4]], {
    name: 'GP7 · ALP — accueil de loisirs périscolaire',
    style: 'brique',
    wallColor: '#ffffff',
    height: 4.2,
    floor: 'uni',
    floorColor: '#e7e2d6',
    doors: [door(2, 0.25, 'porte', 1.2), door(2, 0.7, 'porte', 1.4), door(1, 0.3, 'porte', 0.9), door(0, 0.32, 'porte', 0.9)],
  });

  scene.buildings = [mairie, avantCorps, ctm, cte, alp];

  /* ---------- Cloisons (chaque mur s'arrête dans l'axe du mur perpendiculaire : aucune face confondue) ---------- */
  scene.walls = [
    // Hôtel de ville, rez-de-chaussée : hall sur toute la profondeur entre x = −4 et x = 4
    createWall([-4, -5.85], [-4, 3.85], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.3, width: 1.1 } }), // hall ↔ état civil
    createWall([4, -5.85], [4, 3.85], 'vitre', { height: 3, color: '#5b3a21', door: { kind: 'porte', t: 0.89, width: 0.9 } }), // hall ↔ finances
    createWall([-11.86, 1], [-4.07, 1], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.75, width: 0.9 } }), // état civil ↔ pause
    createWall([4.05, -1.5], [11.86, -1.5], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 0.9 } }), // finances ↔ secrétariat
    createWall([9, -5.85], [9, -1.57], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.6, width: 0.9 } }), // secrétariat ↔ archives
    // Local de la baie de brassage (angle sud-est du bureau des finances)
    createWall([9.8, 2.27], [9.8, 3.85], 'plein', PARTITION),
    createWall([9.87, 2.2], [11.86, 2.2], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.45, width: 0.8 } }),
    // Hôtel de ville, étage noble : galerie autour de la trémie, salle du conseil au sud, ailes est et ouest
    ...upstairs([
      createWall([-4, -5.85], [-4, 3.85], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 1.1 } }), // galerie ↔ bureau de la maire
      createWall([4, -5.85], [4, 3.85], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 1.1 } }), // galerie ↔ bureau des adjoints
      // Galerie ↔ salle du conseil : porte à deux battants dans l'axe de l'escalier, passage derrière la trémie
      createWall([-3.93, 0.4], [3.93, 0.4], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.5, width: 1.4 } }),
      createWall([-11.86, 0.4], [-4.07, 0.4], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.7, width: 0.9 } }), // bureau ↔ salle de réunion
      createWall([4.07, -1.5], [11.86, -1.5], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 0.9 } }), // adjoints ↔ commissions
    ]),
    // CTM : bureaux technique et analyse (angle sud-ouest)
    createWall([18.12, -6.5], [22.43, -6.5], 'plein', { height: 2.6, color: '#e2e8f0' }),
    createWall([18.12, -11], [22.43, -11], 'plein', { height: 2.6, color: '#e2e8f0' }),
    createWall([22.5, -10.93], [22.5, -6.57], 'plein', { height: 2.6, color: '#e2e8f0', door: { kind: 'porte', t: 0.5, width: 0.9 } }),
    createWall([22.5, -6.43], [22.5, -2.12], 'plein', { height: 2.6, color: '#e2e8f0', door: { kind: 'porte', t: 0.5, width: 0.9 } }),
    // ALP : cantine | cuisines, plonge, bureau de direction, stockage
    createWall([-30, -7.88], [-30, 3.88], 'plein', { height: 3, color: '#f5f0e6', door: { kind: 'porte', t: 0.35, width: 1.2 } }),
    createWall([-29.93, -1.5], [-20.11, -1.5], 'plein', { height: 3, color: '#f5f0e6', door: { kind: 'porte', t: 0.45, width: 0.9 } }),
    createWall([-23, -7.88], [-23, -1.57], 'plein', { height: 3, color: '#f5f0e6', door: { kind: 'porte', t: 0.6, width: 0.9 } }),
    createWall([-23, -1.43], [-23, 3.88], 'plein', { height: 3, color: '#f5f0e6', door: { kind: 'porte', t: 0.4, width: 0.9 } }),
    // Clôtures : cour de l'ALP, station d'épuration (extrémités décalées : pas de poteaux confondus)
    createWall([-40, 13.7], [-20, 13.7], 'grillage', { door: { kind: 'porte', t: 0.5, width: 2 } }),
    createWall([-20, 4.16], [-20, 13.64], 'grillage'),
    createWall([-40, 4.16], [-40, 13.64], 'grillage'),
    createWall([22, -27], [34, -27], 'grillage'),
    createWall([34, -26.94], [34, -20.06], 'grillage'),
    createWall([34, -20], [22, -20], 'grillage', { door: { kind: 'porte', t: 0.5, width: 2.4 } }),
    createWall([22, -20.06], [22, -26.94], 'grillage'),
  ];

  /* ---------- Allées ---------- */
  scene.walkways = [
    createWalkway([12.4, -1], [15, -1], { width: 1 }),
    createWalkway([15, -1], [15, -10], { width: 1 }),
    createWalkway([15, -10], [17.75, -10], { width: 1 }),
    createWalkway([6.3, -6.4], [6.3, -12.5], { width: 1.2 }),
    createWalkway([28, -18.3], [28, -19.7], { width: 1, zebra: true }),
    createWalkway([0, 14.3], [0, 18.7], { width: 2.2, zebra: true }),
    createWalkway([-30, 14.3], [-30, 18.7], { width: 2.2, zebra: true }),
    createWalkway([16.6, 13.8], [16.6, 5.4], { width: 1.2 }),
  ];

  /* ---------- Façades : fenêtres (percées), fronton, toitures, campanile ---------- */
  // Fenêtres de l'hôtel de ville dans les travées, jamais au droit d'une cloison (x = ±4, x = 9, x = 9,8) ni d'une porte
  const facades = [
    // Façade principale : ailes et flancs de l'avant-corps aux deux niveaux, étage noble au-dessus de l'entrée
    ...[0, 1].flatMap((lv) => [
      windows(-8, 4 + OUT, 0, 7.4, lv),
      windows(8, 4 + OUT, 0, 7.4, lv),
      windows(4 + OUT, 4.9, 90, 1.6, lv),
      windows(-4 - OUT, 4.9, 270, 1.6, lv),
    ]),
    windows(0, 5.8 + OUT, 0, 7.4, 1),
    // Façade nord : au rez-de-chaussée, ni derrière l'escalier ni au droit de la porte de service (x = 6,3)
    windows(-7.2, -6 - OUT, 180, 7.2),
    windows(-2.7, -6 - OUT, 180, 1.6),
    windows(2.7, -6 - OUT, 180, 1.6),
    windows(4.5, -6 - OUT, 180, 1.6),
    windows(9, -6 - OUT, 180, 3.6),
    windows(0, -6 - OUT, 180, 21.6, 1),
    // Pignons est et ouest (portes au milieu, fenêtre d'étage au-dessus)
    ...[0, 1].flatMap((lv) => [
      windows(12 + OUT, -4, 90, 3.6, lv),
      windows(12 + OUT, 2.1, 90, 3.6, lv),
      windows(-12 - OUT, -4, 270, 3.6, lv),
      windows(-12 - OUT, 2.1, 270, 3.6, lv),
    ]),
    windows(12 + OUT, -1, 90, 1.6, 1),
    windows(-12 - OUT, -1, 270, 1.6, 1),
    // Fronton devant le bandeau de l'étage de l'avant-corps (10 cm en avant : pas de faces confondues)
    el('sign_mairie', 0, 5.8 + OUT + 0.1, 0, { params: { elevation: 1.98 } }),
    el('roof_mansard', 0, -1, 0, { params: { width: 24, depth: 10, height: 2.4, elevation: HEIGHT + ROOF_GAP } }),
    el('roof_mansard', 0, 4.75, 0, { params: { width: 8, depth: 2.1, height: 1.6, elevation: PAVILION + ROOF_GAP } }),
    // Campanile posé sur le terrasson de zinc (corniche 0,22 + toiture 2,4 + zinc 0,07)
    el('belfry', 0, -1, 0, { params: { elevation: HEIGHT + ROOF_GAP + 0.22 + 2.4 + 0.07 } }),
    // ALP : fenêtres entre les portes (façade sur cour) et au nord, hors des cloisons et des équipements de cuisine
    windows(-37.3, 4 + 0.14, 0, 4.2),
    windows(-29.5, 4 + 0.14, 0, 6.6),
    windows(-21.5, 4 + 0.14, 0, 3.4),
    windows(-37.4, -8 - 0.14, 180, 5.4),
    windows(-23.9, -8 - 0.14, 180, 1.6),
    el('roof_mansard', -30, -2, 0, { params: { width: 20, depth: 12, height: 2, elevation: 4.2 + ROOF_GAP } }),
  ];

  /* ---------- GP3 Service administratif, rez-de-chaussée ---------- */
  const administratif = [
    // Vestibule (avant-corps)
    el('carpet', 0, 4.8, 0, { params: { width: 2.2, depth: 1.4 } }),
    el('plant', -3.2, 5.3),
    el('plant', 3.2, 5.3),

    // WU1 Accueil du public : hall sur toute la profondeur, guichet sur le côté, escalier d'honneur au fond
    ut(WU.accueil, 0, -1, 7.2, 9.2),
    el('grand_stairs', STAIR.x, STAIR.z, 0, { params: { width: STAIR.width, length: STAIR.length } }),
    // Guichet face au hall : l'agent passe derrière (≈ 1,1 m jusqu'à la cloison vitrée)
    el('wooden_counter', 2.9, -0.2, 270, { params: { length: 2.4, screens: 1 } }),
    el('carpet', 0, 1.7, 0, { params: { width: 1.6, depth: 4.2 } }),
    armchair(-2.9, 1.7, 90),
    armchair(-2.9, 2.5, 90),
    armchair(-2.9, 3.3, 90),
    el('grandfather_clock', -3.75, 0.1, 90),
    chandelier(0, 1.6),
    el('extinguisher', -3.8, 3.2, 90),
    el('firstaid', 3.82, -5.4, 270),
    el('plant', -3.4, -5.3),

    // WU3 Urbanisme / État civil / Communication (aile ouest) : bureaux anciens, registres, cheminée
    ut(WU.urbanisme, -8, -2.45, 7.2, 6.4),
    // Bâtiment d'époque, postes d'aujourd'hui : chaque bureau d'agent a son ordinateur
    el('antique_desk', -9.6, -3.6, 0, { params: { screens: 2 } }),
    el('antique_desk', -6.4, -3.6, 0, { params: { screens: 1 } }),
    el('copier', -4.36, 0.2, 270),
    el('register_shelf', -4.28, -4.6, 270),
    el('register_shelf', -4.28, -1.2, 270),
    el('fireplace', -8.6, 0.74, 180),
    el('portrait', -11.84, -4, 90, { params: { elevation: 1.25 } }),
    chandelier(-8, -2.4),
    el('extinguisher', -11.82, -0.2, 90),

    // WU5 Salle de pause
    ut(WU.pause, -8, 2.45, 7.2, 2.4),
    el('council_table', -8.6, 2.45, 0, { params: { length: 2.2 } }),
    armchair(-9.3, 1.75),
    armchair(-7.9, 1.75),
    armchair(-9.3, 3.15, 180),
    armchair(-7.9, 3.15, 180),
    el('inox_worktable', -11.5, 2.45, 90),
    el('plant', -4.6, 3.3),

    // WU17 Secrétariat général
    ut(WU.secretariat, 6.5, -3.7, 4.6, 3.8),
    el('antique_desk', 7.2, -3.9, 0, { params: { screens: 2 } }),
    el('copier', 5.35, -5.56),
    el('register_shelf', 7.9, -1.78, 180),
    chandelier(6.5, -3.7),
    el('extinguisher', 4.18, -5.3, 90),

    // WU18 Salle d'archives : registres, coffre-fort
    ut(WU.archives, 10.45, -3.7, 2.6, 3.8),
    el('register_shelf', 9.28, -4.9, 90),
    el('register_shelf', 10.6, -1.78, 180),
    el('old_safe', 11.4, -4, 270),

    // WU2 Finance : registres contre la cloison du secrétariat (la façade sud reste dégagée)
    ut(WU.finance, 6.9, 1.2, 5, 4.6),
    el('antique_desk', 7, 0.3, 0, { params: { screens: 2 } }),
    el('antique_desk', 9.2, 0.3, 0, { params: { screens: 1 } }),
    el('register_shelf', 7.6, -1.22),
    el('register_shelf', 9.1, -1.22),
    chandelier(7.2, 1.2),

    // WU20 Baie de brassage (local fermé)
    ut(WU.baie, 10.8, 3.05, 1.9, 1.5),
    el('server_rack', 11.15, 3.52, 180),
  ];

  /* ---------- GP3 Service administratif, étage noble ---------- */
  const etageNoble = upstairs([
    // Galerie d'honneur autour de la trémie (palier d'arrivée de l'escalier au nord)
    el('portrait', 0, -5.84, 0, { params: { elevation: 1.4 } }),
    el('marianne_bust', -3.45, -5.3),
    el('grandfather_clock', 3.6, -5.4, 270),
    el('bench', -3.55, -1.6, 90),
    el('bench', 3.55, -1.6, 270),
    el('plant', -3.5, -0.75),
    chandelier(-2.4, -3, ROD_NOBLE),
    chandelier(2.4, -3, ROD_NOBLE),

    // Salle du conseil municipal et des mariages, ouverte sur l'avant-corps (chaises des invités, allée centrale) ;
    // entrée par la porte dans l'axe de l'escalier, table en retrait pour dégager le passage
    el('carpet', 0, 2.1, 0, { params: { width: 6, depth: 3 } }),
    el('council_table', 0, 2.1, 0, { params: { length: 4.8 }, label: 'Salle du conseil et des mariages' }),
    ...[-1.8, -0.6, 0.6, 1.8].flatMap((x) => [armchair(x, 1.35), armchair(x, 2.85, 180)]),
    armchair(-2.95, 2.1, 90),
    el('marianne_bust', -3.55, 2.1, 90),
    el('portrait', -3.92, 2.1, 90, { params: { elevation: 1.4 } }),
    el('fireplace', 3.74, 2.1, 270),
    ...[-2.6, -1.8, -1, 1, 1.8, 2.6].flatMap((x) => [armchair(x, 4.5, 180), armchair(x, 5.2, 180)]),
    chandelier(-1.5, 2.1, ROD_NOBLE),
    chandelier(1.5, 2.1, ROD_NOBLE),
    chandelier(0, 4.75, 1.9),

    // WU4 Salle de réunion / Bureau de la maire (aile ouest de l'étage)
    ut(WU.reunion, -8, -1, 7.2, 9.2),
    el('antique_desk', -8, -3, 180, { label: 'Bureau de la maire', params: { screens: 1 } }),
    // Jeu de cartes sécurité DigiRisk sur le sous-main, à côté de l'écran, présenté aux visiteurs
    el('card_game', -8.345, -3, 0, { params: { elevation: 0.52 } }),
    armchair(-8.55, -2.1, 180),
    armchair(-7.45, -2.1, 180),
    el('fireplace', -8.8, 0.14, 180),
    el('portrait', -11.84, -4, 90, { params: { elevation: 1.4 } }),
    el('register_shelf', -4.28, -1.4, 270),
    chandelier(-8, -2.6, ROD_NOBLE),
    el('council_table', -8, 2.15, 0, { params: { length: 3.6 }, label: 'Salle de réunion' }),
    ...[-9.2, -8, -6.8].flatMap((x) => [armchair(x, 1.4), armchair(x, 2.9, 180)]),
    chandelier(-8, 2.15, ROD_NOBLE),
    el('extinguisher', -11.82, 2.1, 90),

    // Aile est de l'étage : bureau des adjoints, salle des commissions
    el('antique_desk', 6.6, -3.8, 0, { label: 'Bureau des adjoints', params: { screens: 1 } }),
    el('antique_desk', 9.6, -3.8, 0, { params: { screens: 1 } }),
    el('register_shelf', 8.6, -1.78, 180),
    chandelier(8, -3.7, ROD_NOBLE),
    el('council_table', 8, 1.3, 0, { params: { length: 3.2 }, label: 'Salle des commissions' }),
    ...[7, 8, 9].flatMap((x) => [armchair(x, 0.55), armchair(x, 2.05, 180)]),
    armchair(5.85, 1.3, 90),
    armchair(10.15, 1.3, 270),
    el('register_shelf', 9.4, -1.22),
    chandelier(8, 1.3, ROD_NOBLE),
    el('extinguisher', 4.24, 3.2, 90),
  ]);

  /* ---------- GP4 Centre Technique Municipal et station d'épuration ---------- */
  const ctmElements = [
    // WU12 Bureau technique, WU13 Bureau analyse
    ut(WU.bureauTechnique, 20.3, -4.3, 4.0, 4.0),
    el('workstation_dual', 20, -5.6),
    el('cabinet', 18.5, -2.9, 90),
    ut(WU.bureauAnalyse, 20.3, -8.75, 4.0, 4.1),
    el('workstation', 20.3, -7.6),
    el('shelving', 18.45, -7.4, 90),
    // WU16 Ateliers de réparation, WU6 Petite réparation
    utStation(WU.ateliers, 'workshop', 25.2, -15.5),
    utStation(WU.petiteReparation, 'drill_press', 31.2, -15.5),
    // WU14 Stockage mezzanine (angle nord-est)
    ut(WU.mezzanine, 35.9, -15.5, 3.6, 4.6),
    el('rack', 37.5, -15.5, 90, { params: { bays: 4, levels: 4 } }),
    el('guardrail', 35.6, -13.4, 0, { params: { length: 2.4 } }),
    el('sign_warning', 34.2, -13.4, 0, { label: 'Mezzanine' }),
    // WU10 Stockage
    ut(WU.stockage, 35.9, -9.75, 3.6, 5.2),
    el('rack', 37.5, -9.75, 90, { params: { bays: 5, levels: 3 } }),
    el('loaded_pallet', 35.2, -8.2),
    el('loaded_pallet', 35.2, -11.2, 0, { color: '#2563eb' }),
    el('palletjack', 34.6, -9.7, 90),
    // WU9 Fosse VL (devant le portail ouest)
    ut(WU.fosse, 26, -5.5, 4, 6),
    el('floorzone', 26, -5.5, 0, { params: { width: 1.6, depth: 4.2 } }),
    el('car', 26, -5.5, 90, { color: '#f8fafc' }),
    // WU11 Entretien voirie (devant le portail est)
    ut(WU.voirie, 32, -5.2, 4, 5.6),
    el('van', 32.5, -5.4, 90, { color: '#f8fafc' }),
    el('loaded_pallet', 35.6, -3.3, 0, { color: '#64748b' }),
    el('sign_warning', 36.4, -2.6, 180, { label: 'Signalisation temporaire' }),
    // Sécurité
    el('extinguisher', 18.3, -12.5, 90),
    el('extinguisher', 37.7, -4, 270),
    el('firstaid', 18.3, -13.5, 90),
    el('sign_mandatory', 28.5, -12.6, 0, { label: 'EPI obligatoires' }),
    // WU15 Station d'épuration (dehors, au nord du CTM)
    utStation(WU.epuration, 'wastewater', 31.4, -23.6),
    el('ibc', 23.2, -26.2),
    el('ibc', 24.3, -26.2),
    el('barrel', 33.2, -21, 0, { color: '#16a34a' }),
    el('sign_warning', 29.4, -20.3, 0, { label: 'Produits chimiques' }),
  ];

  /* ---------- GP5 Centre Technique Environnement ---------- */
  const cteElements = [
    ut(WU.epareuse, 22.2, -35.5, 7.4, 8),
    el('tractor_mower', 22.6, -34.6),
    utStation(WU.debroussaillage, 'saw_cutting', 28.6, -36),
    el('shelving', 31.6, -32.4, 270),
    el('gas', 31.6, -33.6),
    el('sign_mandatory', 29.4, -31.5, 0, { label: 'EPI tronçonnage' }),
    el('extinguisher', 18.3, -32.5, 90),
  ];

  /* ---------- GP7 ALP : cantine, cuisines, plonge, stockage, bureau de direction ---------- */
  const alpElements = [
    // WU24 Cantine
    ut(WU.cantine, -35, -2, 9.4, 11.4),
    ...[-37.8, -35.6, -31.6].flatMap((x) => [-5.5, -2.5, 0.5].map((z) => el('canteen_table', x, z))),
    el('extinguisher', -39.82, 2, 90),
    // WU21 Cuisines
    ut(WU.cuisines, -26.5, -4.7, 6.6, 6.0),
    el('kitchen_range', -28, -7.28),
    el('kitchen_range', -25.6, -7.28),
    el('inox_worktable', -27.4, -4.3),
    el('inox_worktable', -25.2, -4.3),
    el('extinguisher', -29.82, -6.2, 90),
    // WU22 Plonge
    ut(WU.plonge, -21.5, -4.7, 2.6, 6.0),
    el('dish_station', -21.5, -7.5),
    // WU23 Stockage
    ut(WU.stockageAlp, -21.5, 1.2, 2.6, 4.8),
    el('shelving', -20.34, 0, 270),
    el('shelving', -20.34, 1.9, 270),
    el('loaded_pallet', -21.5, 3.2),
    // WU25 Bureau direction ALP
    ut(WU.directionAlp, -26.5, 1.2, 6.6, 4.8),
    el('workstation_dual', -27.5, 0.6),
    el('cabinet', -29.65, 2.8, 90),
    el('plant', -23.6, 3.4),
    // Cour de l'ALP
    el('tree', -37.5, 11.2),
    el('tree', -22.5, 11.2),
    el('bench', -26, 9.5),
  ];

  /* ---------- Place, jardin, parking ---------- */
  const outdoors = [
    el('steps', 0, 6.5, 0, { params: { width: 4.4 } }),
    el('flag_fr', -5.6, 7.4),
    el('flag_eu', 5.6, 7.4, 180),
    el('fountain', 0, 10.6),
    el('bench', -3.4, 10.6, 90),
    el('bench', 3.4, 10.6, 270),
    el('bench', 0, 13.2, 180),
    el('planter', -8, 5),
    el('planter', 8, 5),
    el('planter', -3.4, 8.2),
    el('planter', 3.4, 8.2),
    ...[[-7.5, 12.8], [7.5, 12.8], [-14.6, 5.2], [14.6, 5.2], [16.6, 4.6], [-14.6, 13], [-18.4, 9]].map(([x, z]) => el('townlamp', x, z)),
    ...[-12, -8, -4, 4, 8, 12].map((x) => el('bollard', x, 13.75)),
    // Alignements d'arbres de la place et jardin public
    ...[[-14.6, 8], [-14.6, 10.8], [14.6, 8], [14.6, 10.8]].map(([x, z]) => el('tree', x, z)),
    ...[[-12.5, -10], [-7, -12.8], [-1, -10.4], [9.5, -12.4], [14.5, -8.5], [-14.5, -13.6], [-30, -14], [-36, -18], [10, -22], [0, -28]].map(([x, z], i) =>
      el(i % 2 ? 'conifer' : 'tree', x, z)
    ),
    el('bench', -4, -9.4),
    el('bench', 2, -9.4),
    el('planter', 6, -13.4, 90),
    ...[[19.5, 8.4, '#2563eb'], [21.7, 8.4, '#f8fafc'], [23.9, 8.4, '#dc2626'], [28.3, 8.4, '#111827'], [30.5, 8.4, '#eab308'], [19.5, 11.6, '#64748b'], [23.9, 11.6, '#16a34a'], [26.1, 11.6, '#f8fafc'], [32.7, 11.6, '#1d4ed8']].map(([x, z, color]) =>
      el('car', x, z, 90, { color })
    ),
  ];

  scene.elements = [...facades, ...administratif, ...etageNoble, ...ctmElements, ...cteElements, ...alpElements, ...outdoors];

  /* ---------- Personnages ---------- */
  scene.npcs = [
    // Hôtel de ville : rez-de-chaussée
    createNpc('office', [3.55, -0.2], { name: 'Sophie — accueil du public', rotation: 270, variant: 1 }),
    createNpc('office', [-9.6, -3.1], { name: 'Paul — état civil', pose: 'type', rotation: 180, variant: 5 }),
    createNpc('office', [7.2, -3.4], { name: 'Nicolas — secrétaire général', pose: 'type', rotation: 180, variant: 3 }),
    createNpc('office', [7, 0.8], { name: 'Fatima — finances', pose: 'type', rotation: 180, variant: 6 }),
    createNpc('officeAlt', [9.2, 0.8], { name: 'Camille — comptabilité', pose: 'type', rotation: 180, variant: 3 }),
    createNpc('officeAlt', [-6.4, -3.1], { name: 'Thomas — urbanisme', pose: 'type', rotation: 180, variant: 6 }),
    createNpc('officeAlt', [-1.8, 13.4], { name: 'Marc — administré', variant: 4, route: [[-1.8, 8.4], [0, 7.3], [0, 4.8], [1.9, 0.5]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('office', [16.6, 12.6], { name: 'Lucie — habitante', variant: 7, route: [[2.4, 12.6], [2.4, 8.4], [0.6, 7.3], [0.6, 4.8], [1.9, -0.9]], routeMode: 'pingpong', speed: 0.85 }),
    // Hôtel de ville : étage noble
    createNpc('officeAlt', [-8, -3.5], { name: 'Claire — maire', pose: 'sit', rotation: 0, variant: 2, level: 1 }),
    createNpc('officeAlt', [6.6, -3.3], { name: 'Bernard — adjoint', pose: 'type', rotation: 180, variant: 0, level: 1 }),
    createNpc('office', [9.6, -3.3], { name: 'Hélène — adjointe', pose: 'type', rotation: 180, variant: 2, level: 1 }),
    // CTM, CTE, station d'épuration
    createNpc('worker', [17.6, -10], { name: 'Hugo — agent technique', variant: 0, route: [[15, -10], [15, -1], [11, -0.6]], routeMode: 'pingpong', speed: 0.9 }),
    createNpc('worker', [25.2, -13.3], { name: 'Karim — mécanicien', pose: 'work', rotation: 180, variant: 2 }),
    createNpc('worker', [27.2, -5.5], { name: 'Yanis — fosse VL', pose: 'work', rotation: 270, variant: 6 }),
    createNpc('driver', [33, -1.4], { name: 'Julie — entretien voirie', variant: 3, route: [[33, 3], [39, 3]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('worker', [27, -21.2], { name: 'Mathis — station d’épuration', variant: 5, route: [[27, -25.6]], routeMode: 'pingpong', speed: 0.6 }),
    createNpc('worker', [25.8, -30], { name: 'Inès — espaces verts', pose: 'carry', variant: 4, route: [[25.8, -27.2], [12, -27.2], [12, -16]], routeMode: 'pingpong', speed: 0.7 }),
    // ALP
    createNpc('officeAlt', [-26.4, -5.1], { name: 'Sami — cuisinier', pose: 'work', rotation: 180, variant: 1 }),
    createNpc('logistics', [-21.5, -6.7], { name: 'Nadia — plonge', pose: 'work', rotation: 180, variant: 7 }),
    createNpc('office', [-27.5, 1.05], { name: 'Léa — direction ALP', pose: 'type', rotation: 180, variant: 5 }),
    createNpc('office', [-34, 5.6], { name: 'Emma — animatrice', variant: 0, route: [[-34, 3.2], [-33.6, -1], [-31, -1]], routeMode: 'pingpong', speed: 0.7 }),
  ];

  return scene;
}
