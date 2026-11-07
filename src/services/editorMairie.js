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
const windows = (x, z, rotation, length, level = 0, extra = {}) =>
  el('facade_windows', x, z, rotation, { params: { length, floors: 1, firstLevel: 0, balconnet: 1, ...extra }, ...(level ? { level } : {}) });
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
  // Visite : départ sur le trottoir d'en face, au bout du passage piéton, regard vers la façade (nord)
  scene.spawn = { position: [0.6, 19.7], rotation: 180 };

  /* ---------- Sols (dans l'ordre d'empilement : les suivants passent devant) ---------- */
  scene.surfaces = [
    createSurface([[-70, -60], [76, -60], [76, 44], [-70, 44]], 'gazon', { name: 'Espaces verts, jardin public et jardins' }),
    createSurface([[-70, 13], [76, 13], [76, 14], [-70, 14]], 'beton', { name: 'Trottoir côté mairie' }),
    createSurface([[-70, 14], [76, 14], [76, 19], [-70, 19]], 'asphalte', { name: 'Rue de la Mairie' }),
    createSurface([[-70, 19], [76, 19], [76, 22], [-70, 22]], 'beton', { name: 'Trottoir des commerces' }),
    createSurface([[-44, 22], [50, 22], [50, 32], [-44, 32]], 'gazon', { name: 'Jardins des maisons' }),
    createSurface([[-20, 4.1], [18, 4.1], [18, 14], [-20, 14]], 'paves', { name: 'Place de la Mairie' }),
    createSurface([[-40, 4.1], [-20, 4.1], [-20, 13], [-40, 13]], 'beton', { name: 'Cour de l’ALP' }),
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
    doors: [door(0, 0.5, 'passage', 7.4), door(0, 0.5, 'passage', 7.4, 1), door(2, 0.5, 'passage', 1.6)],
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
    // Local de la baie de brassage : porte côté ouest, la baie contre le mur est (pas en face de la porte)
    createWall([9.87, 2.2], [11.86, 2.2], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.3, width: 0.8 } }),
    // Hôtel de ville, étage noble : galerie autour de la trémie, salle du conseil au sud, ailes est et ouest
    ...upstairs([
      createWall([-4, -5.85], [-4, 3.85], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 1.1 } }), // galerie ↔ bureau de la maire
      createWall([4, -5.85], [4, 3.85], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.25, width: 1.1 } }), // galerie ↔ bureau des adjoints
      // Galerie ↔ salle du conseil : porte à deux battants dans l'axe de l'escalier, passage derrière la trémie
      createWall([-3.93, 0.4], [3.93, 0.4], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.5, width: 1.4 } }),
      // bureau ↔ salle de réunion : porte au-delà du bout de la table (aucun fauteuil devant)
      createWall([-11.86, 0.4], [-4.07, 0.4], 'plein', { ...PARTITION, door: { kind: 'porte', t: 0.87, width: 0.9 } }),
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
    createWall([-40, 12.9], [-20, 12.9], 'grillage', { door: { kind: 'porte', t: 0.5, width: 2 } }),
    createWall([-20, 4.16], [-20, 12.84], 'grillage'),
    createWall([-40, 4.16], [-40, 12.84], 'grillage'),
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
    // Étage de l'avant-corps : les deux fenêtres du milieu donnent sur le balcon d'honneur (sans balconnet)
    windows(-2.75, 5.8 + OUT, 0, 1.9, 1),
    windows(0, 5.8 + OUT, 0, 3.6, 1, { balconnet: 0 }),
    windows(2.75, 5.8 + OUT, 0, 1.9, 1),
    // Rez-de-chaussée de l'avant-corps : une fenêtre de part et d'autre du portail (dans l'axe de celles de l'étage)
    windows(-2.75, 5.8 + OUT, 0, 1.6),
    windows(2.75, 5.8 + OUT, 0, 1.6),
    // Portail d'honneur : encadrement à bossages, imposte, vantaux ouverts, balcon d'honneur, attique décoré
    el('entrance_portal', 0, 5.8 + OUT, 0, { params: { width: 8 } }),
    // Pavoisement : drapeaux français et occitan croisés au balcon d'honneur, drapeaux français aux balcons des ailes
    el('balcony_flag', -1.45, 5.8 + OUT + 0.5, 340, { params: { flag: 0, elevation: 3.42, side: 1 } }),
    el('balcony_flag', 1.45, 5.8 + OUT + 0.5, 20, { params: { flag: 2, elevation: 3.42, side: 0 } }),
    el('balcony_flag', -8.9, 4 + OUT + 0.19, 345, { params: { flag: 0, elevation: 3.36, side: 1 } }),
    el('balcony_flag', 8.9, 4 + OUT + 0.19, 15, { params: { flag: 0, elevation: 3.36, side: 0 } }),
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
    // Inscription « MAIRIE » à l'attique de l'avant-corps, au-dessus de la corniche (10 cm en avant de la façade)
    el('sign_mairie', 0, 5.8 + OUT + 0.1, 0, { params: { elevation: 4.86 } }),
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
    el('plant', -3.5, 5.4),
    el('plant', 3.5, 5.4),

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
    el('extinguisher', -3.77, 3.2, 90),
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
    el('fireplace', -8.6, 0.62, 180),
    el('portrait', -11.84, -4, 90, { params: { elevation: 1.25 } }),
    chandelier(-8, -2.4),
    el('extinguisher', -11.68, -0.2, 90),

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
    el('extinguisher', 4.23, -5.3, 90),

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
    el('server_rack', 11.5, 3.52, 180),
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
    // Côté porte, allée centrale laissée libre dans l'axe de l'entrée
    ...[-1.8, 1.8].map((x) => armchair(x, 1.35)),
    ...[-1.8, -0.6, 0.6, 1.8].map((x) => armchair(x, 2.85, 180)),
    armchair(-2.95, 2.1, 90),
    el('marianne_bust', -3.55, 2.1, 90),
    el('portrait', -3.92, 2.1, 90, { params: { elevation: 1.4 } }),
    el('fireplace', 3.62, 2.1, 270),
    ...[-2.6, -1.8, -1, 1, 1.8, 2.6].flatMap((x) => [armchair(x, 4.5, 180), armchair(x, 5.2, 180)]),
    chandelier(-1.5, 2.1, ROD_NOBLE),
    chandelier(1.5, 2.1, ROD_NOBLE),
    chandelier(0, 4.75, 1.9),

    // WU4 Salle de réunion / Bureau de la maire (aile ouest de l'étage)
    ut(WU.reunion, -8, -1, 7.2, 9.2),
    el('antique_desk', -8, -3, 180, { label: 'Bureau de la maire', params: { screens: 1 } }),
    // Jeu de cartes sécurité DigiRisk sur le sous-main, à côté de l'écran, présenté aux visiteurs
    el('card_game', -8.42, -3, 0, { params: { elevation: 0.52 } }),
    armchair(-8.55, -2.1, 180),
    armchair(-7.45, -2.1, 180),
    el('fireplace', -8.8, 0.02, 180),
    el('portrait', -11.84, -4, 90, { params: { elevation: 1.4 } }),
    el('register_shelf', -4.28, -1.4, 270),
    chandelier(-8, -2.6, ROD_NOBLE),
    el('council_table', -8, 2.15, 0, { params: { length: 3.6 }, label: 'Salle de réunion' }),
    ...[-9.2, -8, -6.8].flatMap((x) => [armchair(x, 1.4), armchair(x, 2.9, 180)]),
    chandelier(-8, 2.15, ROD_NOBLE),
    el('extinguisher', -11.68, 2.1, 90),

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
    el('loaded_pallet', 35.2, -11.2, 0, { color: '#4a5f7a' }),
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
    // Atelier vivant : établi et panneau à outils contre le mur ouest, vestiaires, pneus, stock de signalisation, coin café
    el('tool_wall', 18.52, -16.0, 90, { params: { length: 2.4 } }),
    el('lockers', 22.95, -10.0, 90, { params: { count: 4 } }),
    el('tire_stack', 23.35, -3.0, 180),
    el('cones_stock', 37.35, -5.6, 270),
    // Coin café contre la cloison des bureaux, à côté des vestiaires : hors des travées et des portails des véhicules
    el('coffee_corner', 23.1, -5.775, 90),
    // WU15 Station d'épuration (dehors, au nord du CTM)
    utStation(WU.epuration, 'wastewater', 31.4, -23.6),
    el('ibc', 23.2, -26.2),
    el('ibc', 24.3, -26.2),
    el('barrel', 33.2, -21, 0, { color: '#3f6b46' }),
    el('sign_warning', 29.75, -20.3, 0, { label: 'Produits chimiques' }),
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
    // Matériel des espaces verts : tondeuse autoportée, râtelier d'outils, sacs de terreau
    el('riding_mower', 19.6, -37.6),
    el('garden_tools_rack', 21.5, -39.4, 0, { params: { length: 2.6 } }),
    el('compost_bags', 30.9, -38.9),
  ];

  /* ---------- GP7 ALP : cantine, cuisines, plonge, stockage, bureau de direction ---------- */
  const alpElements = [
    // WU24 Cantine
    ut(WU.cantine, -35, -2, 9.4, 11.4),
    ...[-37.8, -35.6, -32.2].flatMap((x) => [-5.5, -2.5, 0.5].map((z) => el('canteen_table', x, z))),
    el('extinguisher', -39.72, 2, 90),
    // Déjeuner : des enfants à trois tables de la cantine
    el('kids_lunch', -37.8, -2.5),
    el('kids_lunch', -35.6, -2.5),
    el('kids_lunch', -37.8, 0.5),
    // WU21 Cuisines
    ut(WU.cuisines, -26.5, -4.7, 6.6, 6.0),
    el('kitchen_range', -28, -7.28),
    el('kitchen_range', -25.6, -7.28),
    el('inox_worktable', -27.4, -4.3),
    el('inox_worktable', -25.2, -4.3),
    el('extinguisher', -29.75, -6.2, 90),
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
    // Pigeons qui picorent sur la place (près des bancs et du perron)
    el('pigeons', -9.2, 10.2),
    el('pigeons', 7.4, 9.9),
    el('bench', -3.4, 10.6, 90),
    el('bench', 3.4, 10.6, 270),
    el('bench', 0, 13.2, 180),
    el('planter', -8, 5),
    el('planter', 8, 5),
    // Outils des jardiniers au travail devant les jardinières
    el('watering_can', -7.45, 5.75, 90),
    el('wheelbarrow', 9.6, 6.2, 200),
    el('planter', -4.3, 8.5),
    el('planter', 4.3, 8.5),
    ...[[-7.5, 12.8], [7.5, 12.8], [-14.6, 5.2], [14.6, 5.2], [16.6, 4.6], [-14.6, 13], [-18.4, 9]].map(([x, z]) => el('townlamp', x, z)),
    ...[-12, -8, -4, 4, 8, 12].map((x) => el('bollard', x, 13.75)),
    // Alignements d'arbres de la place et jardin public
    ...[[-14.6, 8], [-14.6, 10.8], [14.6, 8], [14.6, 10.8]].map(([x, z]) => el('tree', x, z)),
    ...[[-12.5, -10], [-7, -12.8], [-1, -10.4], [9.5, -12.4], [13.3, -8.5], [-14.5, -13.6], [-30, -14], [-36, -18], [10, -22], [0, -28]].map(([x, z], i) =>
      el(i % 2 ? 'conifer' : 'tree', x, z)
    ),
    el('bench', -4, -9.4),
    el('bench', 2, -9.4),
    el('planter', 2, -11.2),
    // Voitures aux teintes courantes (gris, argent, blanc, noir, bleu nuit, bordeaux)
    ...[[19.5, 7, '#eef0f1'], [21.7, 7, '#4a4f55'], [23.9, 7, '#d9d2c3'], [28.3, 7, '#2b3f66'], [30.5, 7, '#8a2f36'], [19.5, 12, '#b03a2e'], [23.9, 12, '#6c7a5c'], [26.1, 12, '#3d6ea8'], [32.7, 12, '#c8b89a']].map(([x, z, color]) =>
      el('car', x, z, 90, { color })
    ),
  ];


  /* ---------- La ville : rue commerçante en face de la mairie, circulation, mobilier urbain ---------- */
  const town = [
    // Maisons de ville à commerces (boucherie, fleuriste, tabac-presse, café, boulangerie, pharmacie, fleuriste)
    el('townhouse', -40.5, 22, 180, { params: { width: 7, floors: 3, shop: 0, facade: 1, slate: 0 } }),
    el('townhouse', -34, 22, 180, { params: { width: 6, floors: 4, shop: 6, facade: 3, slate: 0 } }),
    el('townhouse', -28.5, 22, 180, { params: { width: 5, floors: 3, shop: 7, facade: 2, slate: 0 } }),
    el('townhouse', -22.75, 22, 180, { params: { width: 6.5, floors: 3, shop: 5, facade: 0, slate: 0 } }),
    el('townhouse', -16.5, 22, 180, { params: { width: 6, floors: 2, shop: 0, facade: 4, slate: 0 } }),
    el('townhouse', -10, 22, 180, { params: { width: 7, floors: 3, shop: 4, facade: 5, slate: 0 } }),
    el('townhouse', -3, 22, 180, { params: { width: 7, floors: 4, shop: 2, facade: 2, slate: 0 } }),
    el('townhouse', 3.5, 22, 180, { params: { width: 6, floors: 3, shop: 1, facade: 1, slate: 0 } }),
    el('townhouse', 9.25, 22, 180, { params: { width: 5.5, floors: 3, shop: 8, facade: 3, slate: 1 } }),
    el('townhouse', 15.25, 22, 180, { params: { width: 6.5, floors: 3, shop: 3, facade: 0, slate: 0 } }),
    el('townhouse', 21.5, 22, 180, { params: { width: 6, floors: 2, shop: 0, facade: 5, slate: 1 } }),
    el('townhouse', 28, 22, 180, { params: { width: 7, floors: 4, shop: 0, facade: 4, slate: 1 } }),
    el('townhouse', 34.5, 22, 180, { params: { width: 6, floors: 3, shop: 0, facade: 1, slate: 0 } }),
    el('townhouse', 40.75, 22, 180, { params: { width: 6.5, floors: 3, shop: 9, facade: 3, slate: 0 } }),
    el('townhouse', 47, 22, 180, { params: { width: 6, floors: 2, shop: 0, facade: 0, slate: 1 } }),
    // Terrasse du Café de la Mairie, abribus (affiche DigiRisk), réverbères, corbeilles, boîte aux lettres
    // Terrasse et abribus décalés : l'entrée des commerces reste dégagée jusqu'au bord du trottoir
    el('cafe_terrace', -2.65, 20.4, 0, { params: { tables: 4 } }),
    el('bus_shelter', -15.7, 19.95, 180),
    ...[-34, -22, -10, 10, 22, 34].map((x) => el('townlamp', x, 19.45)),
    el('litter_bin', -8.2, 19.4, 180),
    el('litter_bin', 9.2, 19.4, 180),
    el('litter_bin', 2.4, 13.35),
    el('litter_bin', -10.6, 13.35),
    el('post_box', 5.6, 19.45, 180),
    el('bike_rack', 15.8, 20.1, 180),
    // Voitures garées le long du trottoir nord, circulation animée (ralentit aux deux passages piétons)
    ...[[-37, '#b03a2e'], [-26.5, '#c8b89a'], [13.5, '#1c1e21'], [26, '#d9d2c3'], [41, '#b03a2e']].map(([x, color]) => el('car', x, 18.45, 0, { color })),
    el('traffic', 3, 16.5, 0, { params: { length: 146, count: 14, crossA: -3, crossB: -33 } }),
    // Marquage : axe discontinu, ligne de rive, ligne de stationnement côté commerces ; voie des services techniques
    el('road_markings', 3, 16.5, 0, { params: { length: 146, width: 5, crossA: -3, crossB: -33, parking: 1, junction: 40.5 } }),
    ...[-66, -58, -50, 56, 64, 72].flatMap((x) => [el('tree', x, 20.6), el('tree', x + 3, 12.6)]),
    ...[-62, -54, 60, 68].map((x) => el('townlamp', x, 19.45)),
    el('road_markings', 43.5, -15, 90, { params: { length: 58, width: 5, parking: 0 } }),
    // Place de la Mairie : panneau d'affichage municipal, arceaux à vélos
    el('notice_board', -12.6, 6.3),
    el('bike_rack', 12.4, 5.8),

    // Services techniques : toitures à deux pans, enseignes, bandeaux vitrés, cour (alvéoles, benne, fourgon)
    el('roof_gable', 28, -10, 0, { color: '#6b7480', params: { width: 20, depth: 16, height: 2.4, elevation: 4.42, gable: 0, skylights: 1 } }),
    el('wall_sign', 26.5, -1.86, 0, { label: 'Centre technique municipal', params: { width: 6, style: 0, elevation: 3.0 } }),
    el('ribbon_windows', 18 - 0.14, -4.3, 270, { params: { length: 3, height: 1.0, elevation: 1.0 } }),
    el('ribbon_windows', 18 - 0.14, -8.75, 270, { params: { length: 3, height: 1.0, elevation: 1.0 } }),
    el('ribbon_windows', 28, -18 - 0.14, 180, { params: { length: 18, height: 0.7, elevation: 3.1 } }),
    el('ribbon_windows', 38 + 0.14, -10, 90, { params: { length: 13, height: 0.7, elevation: 3.1 } }),
    // Cases à matériaux au bout est de la cour, ouvertes vers la cour (rien devant la porte des bureaux ni les portails)
    el('material_bays', 39.3, 1.5, 270),
    el('skip', 25.5, 3.4),
    el('van', 29.5, 2.8, 0, { color: '#f8fafc' }),
    el('roof_gable', 25, -35.5, 0, { color: '#55616b', params: { width: 14, depth: 9, height: 1.6, elevation: 4.02, gable: 1, skylights: 1 } }),
    el('wall_sign', 21, -30.86, 0, { label: 'Centre technique environnement', params: { width: 5, style: 0, elevation: 2.6 } }),
    el('ribbon_windows', 32 + 0.14, -35.5, 90, { params: { length: 6, height: 0.7, elevation: 2.8 } }),
    // Déchets verts entre la porte et le portail du CTE (aucun des deux encombré)
    el('green_waste', 21.2, -29.3, 90),
    el('skip', 36.5, -29.6),
    el('recycling_point', 34.8, 6.4),

    // École (ALP) : enseigne gravée, préau devant la porte, structure de jeux, marelle, enfants qui jouent, haies
    el('wall_sign', -30, 4.12, 0, { label: 'Accueil de loisirs', params: { width: 5, style: 1, elevation: 3.1 } }),
    el('preau', -35, 6.6, 0, { params: { length: 8 } }),
    el('play_structure', -24.5, 7.4),
    el('hopscotch', -29.6, 10.2, 90),
    el('playing_children', -28.6, 7.6, 0, { params: { count: 7, spread: 3 } }),
    el('hedge', -35.5, 12.5, 0, { params: { length: 8.6 } }),
    el('hedge', -24.5, 12.5, 0, { params: { length: 8.6 } }),

    // Jardin public derrière l'hôtel de ville : haies le long de l'allée
    el('hedge', 5.4, -9.6, 90, { params: { length: 4 } }),
    el('hedge', 7.2, -9.6, 90, { params: { length: 4 } }),
  ];

  scene.elements = [...facades, ...administratif, ...etageNoble, ...ctmElements, ...cteElements, ...alpElements, ...outdoors, ...town];

  /* ---------- Personnages ---------- */
  scene.npcs = [
    // Hôtel de ville : rez-de-chaussée
    // Apparences accordées aux prénoms (variantes 1, 3, 5, 7 : femmes ; 0, 2, 4, 6 : hommes)
    createNpc('office', [3.55, -0.2], { name: 'Sophie — accueil du public', rotation: 270, variant: 7 }),
    createNpc('office', [-9.6, -3.1], { name: 'Paul — état civil', pose: 'type', rotation: 180, variant: 0 }),
    createNpc('officeAlt', [7.2, -3.4], { name: 'Nicolas — secrétaire général', pose: 'type', rotation: 180, variant: 2 }),
    createNpc('office', [7, 0.8], { name: 'Fatima — finances', pose: 'type', rotation: 180, variant: 3 }),
    createNpc('office', [9.2, 0.8], { name: 'Camille — comptabilité', pose: 'type', rotation: 180, variant: 5 }),
    createNpc('officeAlt', [-6.4, -3.1], { name: 'Thomas — urbanisme', pose: 'type', rotation: 180, variant: 4 }),
    createNpc('officeAlt', [-1.8, 13.4], { name: 'Marc — administré', variant: 6, route: [[-1.8, 8.4], [0, 7.3], [0, 4.8], [1.9, 0.5]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('office', [16.6, 12.0], { name: 'Lucie — habitante', variant: 1, route: [[2.4, 12.0], [2.4, 8.4], [0.35, 7.3], [0.35, 4.8], [1.9, -0.9]], routeMode: 'pingpong', speed: 0.85 }),
    // Vie de la place : deux habitants qui discutent près de la fontaine, un retraité sur le banc
    createNpc('officeAlt', [-5, 9.3], { name: 'Bertrand — habitant', rotation: 58, variant: 4 }),
    createNpc('office', [-4.2, 9.8], { name: 'Nathalie — habitante', rotation: 238, variant: 5 }),
    createNpc('officeAlt', [3.32, 10.6], { name: 'Jean — retraité', pose: 'sit', rotation: 270, variant: 2 }),
    // Hall : administrés qui attendent leur tour ; salle de pause ; photocopieur ; archiviste
    createNpc('officeAlt', [-2.86, 2.5], { name: 'Gérard — administré en attente', pose: 'sit', rotation: 90, variant: 0 }),
    createNpc('officeAlt', [-2.86, 3.3], { name: 'Martine — administrée en attente', pose: 'sit', rotation: 90, variant: 3 }),
    createNpc('officeAlt', [-9.3, 1.8], { name: 'Karine — pause café', pose: 'meet', rotation: 0, variant: 1 }),
    createNpc('office', [-7.9, 3.1], { name: 'Olivier — pause café', pose: 'meet', rotation: 180, variant: 6 }),
    createNpc('officeAlt', [-10.85, 2.45], { name: 'Sandrine — machine à café', pose: 'work', rotation: 270, variant: 7 }),
    createNpc('office', [-4.95, 0.2], { name: 'Julien — photocopies', pose: 'work', rotation: 90, variant: 2 }),
    createNpc('office', [5.6, -2.4], { name: 'Pascal — archiviste', pose: 'carry', variant: 4, route: [[8.3, -2.6], [8.7, -3.28], [9.9, -3.28], [10.4, -2.7]], routeMode: 'pingpong', speed: 0.6 }),
    // Place : promeneuse autour du square aux pigeons, deux voisins qui bavardent
    createNpc('officeAlt', [-6.2, 7.6], { name: 'Odile — promeneuse', variant: 5, route: [[-12.2, 7.6], [-12.2, 12.3], [-6.2, 12.3]], routeMode: 'loop', speed: 0.6 }),
    createNpc('office', [9.1, 10.7], { name: 'Yves — habitant', rotation: 55, variant: 6 }),
    createNpc('office', [9.8, 11.2], { name: 'Monique — habitante', rotation: 235, variant: 3 }),
    // Jardiniers : soin des jardinières de la façade, brouette devant l'hôtel de ville
    createNpc('gardener', [-8.2, 5.62], { name: 'Gaël — jardinier', pose: 'work', rotation: 180, variant: 0 }),
    createNpc('gardener', [8.3, 5.62], { name: 'Aurélie — jardinière', pose: 'work', rotation: 180, variant: 5 }),
    createNpc('gardener', [-9.6, 6.7], { name: 'Rémi — jardinier', pose: 'carry', variant: 4, route: [[-3, 6.7]], routeMode: 'pingpong', speed: 0.55 }),
    // Hôtel de ville : étage noble
    createNpc('mayor', [-8, -3.5], { name: 'Claire — maire', pose: 'type', rotation: 0, variant: 1, level: 1 }),
    createNpc('officeAlt', [6.6, -3.3], { name: 'Bernard — adjoint', pose: 'type', rotation: 180, variant: 6, level: 1 }),
    createNpc('office', [9.6, -3.3], { name: 'Hélène — adjointe', pose: 'type', rotation: 180, variant: 7, level: 1 }),
    // Rendez-vous dans le bureau de la maire, préparation du conseil, directrice des services dans la galerie
    createNpc('officeAlt', [-7.45, -2.15], { name: 'Denis — chef d’entreprise reçu par la maire', pose: 'sit', rotation: 180, variant: 4, level: 1 }),
    createNpc('office', [-1.8, 1.4], { name: 'Anne — conseillère municipale', pose: 'meet', rotation: 0, variant: 5, level: 1 }),
    createNpc('officeAlt', [0.6, 2.8], { name: 'Michel — conseiller municipal', pose: 'meet', rotation: 180, variant: 2, level: 1 }),
    createNpc('office', [-6, -4.4], { name: 'Agnès — directrice générale des services', variant: 1, level: 1, route: [[-4.6, -3.43], [-2.6, -3.43], [-1.7, -5.35], [1.7, -5.35], [2.6, -3.43], [4.6, -3.43], [5.6, -2.6]], routeMode: 'pingpong', speed: 0.65 }),
    // CTM, CTE, station d'épuration
    createNpc('worker', [17.6, -10], { name: 'Hugo — agent technique', variant: 0, route: [[15, -10], [15, -1], [11.2, -1.0]], routeMode: 'pingpong', speed: 0.9 }),
    createNpc('worker', [25.2, -13.3], { name: 'Karim — mécanicien', pose: 'work', rotation: 180, variant: 4 }),
    createNpc('worker', [27.2, -5.5], { name: 'Yanis — fosse VL', pose: 'work', rotation: 270, variant: 6 }),
    createNpc('driver', [33, -1.4], { name: 'Julie — entretien voirie', variant: 3, route: [[33, 3], [37.3, 3]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('worker', [27, -21.2], { name: 'Mathis — station d’épuration', variant: 0, route: [[27, -25.6]], routeMode: 'pingpong', speed: 0.6 }),
    createNpc('gardener', [25.8, -30], { name: 'Inès — espaces verts', pose: 'carry', variant: 7, route: [[25.8, -27.2], [12, -27.2], [12, -16]], routeMode: 'pingpong', speed: 0.6 }),
    // La ville : clients en terrasse, serveur, passants, cliente de la boulangerie, voyageur à l'abribus
    createNpc('officeAlt', [-4.105, 20.4], { name: 'Hervé — client du café', pose: 'meet', rotation: 270, variant: 0 }),
    createNpc('office', [-4.945, 20.4], { name: 'Sylvie — cliente du café', pose: 'meet', rotation: 90, variant: 5 }),
    createNpc('office', [-1.195, 20.4], { name: 'Lucas — client du café', pose: 'meet', rotation: 90, variant: 2 }),
    createNpc('office', [-6.3, 21.35], { name: 'Antoine — serveur', variant: 4, route: [[0.6, 21.35], [0.75, 20.7]], routeMode: 'pingpong', speed: 0.7 }),
    createNpc('officeAlt', [-31, 21.4], { name: 'Jacqueline — passante', variant: 7, route: [[-12, 21.4]], routeMode: 'pingpong', speed: 0.55 }),
    createNpc('office', [8, 21.3], { name: 'Théo — passant', variant: 6, route: [[33, 21.3]], routeMode: 'pingpong', speed: 0.8 }),
    createNpc('officeAlt', [-41, 13.5], { name: 'Bernadette — passante', variant: 3, route: [[-21, 13.5]], routeMode: 'pingpong', speed: 0.5 }),
    createNpc('office', [3.6, 21.3], { name: 'Brigitte — cliente de la boulangerie', rotation: 0, variant: 1 }),
    createNpc('officeAlt', [-15.6, 20.2], { name: 'Étienne — attend le bus', pose: 'sit', rotation: 180, variant: 2 }),
    createNpc('office', [-29.6, 11.8], { name: 'Nadine — vient chercher son fils', variant: 5, route: [[-29.6, 19.3], [-24, 21.5]], routeMode: 'pingpong', speed: 0.7 }),
    createNpc('worker', [37.3, 0.4], { name: 'Fabien — agent de voirie', pose: 'carry', variant: 2, route: [[31.6, 1.8]], routeMode: 'pingpong', speed: 0.6 }),
    // Jardin public : lectrice sur un banc, promeneur
    createNpc('office', [-4, -9.32], { name: 'Lucienne — lit sur un banc', pose: 'sit', rotation: 0, variant: 7 }),
    createNpc('officeAlt', [4, -8.4], { name: 'Albert — promeneur', variant: 6, route: [[-8, -8.4], [-8, -15.6], [4, -15.6]], routeMode: 'loop', speed: 0.5 }),
    // CTM : techniciens au bureau, mécanicien à l'établi, magasinier, agents de voirie en pause
    createNpc('officeAlt', [20, -5.15], { name: 'Sébastien — technicien bureau d’études', pose: 'type', rotation: 180, variant: 2 }),
    createNpc('office', [20.3, -7.15], { name: 'Élodie — technicienne analyses', pose: 'type', rotation: 180, variant: 3 }),
    createNpc('worker', [19.45, -16.0], { name: 'Christophe — mécanicien', pose: 'work', rotation: 270, variant: 6 }),
    createNpc('logistics', [33.6, -12.2], { name: 'Franck — magasinier', pose: 'carry', variant: 4, route: [[33.6, -7.8]], routeMode: 'pingpong', speed: 0.55 }),
    createNpc('driver', [23.45, -5.225], { name: 'Patrick — agent de voirie en pause', pose: 'meet', rotation: 180, variant: 0 }),
    createNpc('worker', [23.45, -6.325], { name: 'Nathan — agent de voirie en pause', pose: 'meet', rotation: 0, variant: 2 }),
    // CTE : mécanicien au tracteur, agente des espaces verts
    createNpc('gardener', [24.1, -35.2], { name: 'Kévin — mécanicien espaces verts', pose: 'work', rotation: 270, variant: 6 }),
    createNpc('gardener', [21.6, -38.5], { name: 'Laura — agente espaces verts', pose: 'carry', variant: 5, route: [[25.0, -38.3], [25.0, -32.0]], routeMode: 'pingpong', speed: 0.5 }),
    // ALP : cuisinière aux fourneaux, service à la cantine, animatrice qui surveille le déjeuner
    createNpc('officeAlt', [-25.6, -6.4], { name: 'Fatou — cuisinière', pose: 'work', rotation: 180, variant: 3 }),
    createNpc('office', [-28.9, -3.4], { name: 'Christine — agente de restauration', pose: 'carry', variant: 7, route: [[-30.8, -3.76], [-33.6, -3.76], [-33.6, 1.6]], routeMode: 'pingpong', speed: 0.5 }),
    createNpc('office', [-33.6, -6.6], { name: 'Sarah — animatrice', rotation: 0, variant: 1 }),
    // ALP
    createNpc('officeAlt', [-26.4, -5.1], { name: 'Sami — cuisinier', pose: 'work', rotation: 180, variant: 6 }),
    createNpc('logistics', [-21.5, -6.7], { name: 'Nadia — plonge', pose: 'work', rotation: 180, variant: 3 }),
    createNpc('office', [-27.5, 1.05], { name: 'Léa — direction ALP', pose: 'type', rotation: 180, variant: 5 }),
    createNpc('office', [-34, 5.6], { name: 'Emma — animatrice', variant: 1, route: [[-34, 3.2], [-33.6, -1], [-31, -1]], routeMode: 'pingpong', speed: 0.7 }),
  ];

  return scene;
}
