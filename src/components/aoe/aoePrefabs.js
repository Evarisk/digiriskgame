/**
 * Bâtiments préfaits de Cité Prévention, composés avec les éléments de l'éditeur de site (mêmes modèles que la
 * mairie de démonstration) : chaque type renvoie une mini-scène { buildings, elements } en coordonnées locales,
 * centrée sur l'emprise de jeu (BUILDINGS[kind].size), façade principale vers +Z.
 *   - Hôtel de ville : l'extérieur de la mairie de démonstration (pierre de taille, avant-corps, portail
 *     d'honneur, balcons pavoisés, toitures mansardées, campanile, fronton « MAIRIE ») ;
 *   - maisons, commerces et infirmerie : maisons de ville de la rue commerçante (pharmacie à croix verte) ;
 *   - dépôt (CTE), centre technique (CTM), salle de formation (ALP), cantine, service prévention, entrepôt des EPI :
 *     bâtiments sur mesure avec toiture, enseigne et ouvertures.
 */
import { createBuilding, createElement } from '../../services/editorScene';

const el = (kind, x, z, rotation = 0, patch = {}) => createElement(kind, [x, z], { rotation, ...patch });
const door = (edge, t, kind = 'porte', width) => ({ edge, t, kind, width: width ?? (kind === 'portail' ? 2.6 : 0.8) });
/** Rectangle centré (arêtes : 0 nord −Z, 1 est, 2 sud +Z = façade, 3 ouest). */
const rect = (w, d, cx = 0, cz = 0) => [
  [cx - w / 2, cz - d / 2],
  [cx + w / 2, cz - d / 2],
  [cx + w / 2, cz + d / 2],
  [cx - w / 2, cz + d / 2],
];
const windows = (x, z, rotation, length, level = 0, extra = {}) => el('facade_windows', x, z, rotation, { params: { length, floors: 1, firstLevel: 0, balconnet: 1, ...extra }, ...(level ? { level } : {}) });

// Hôtel de ville (valeurs de la mairie de démonstration, src/services/editorMairie.js)
const WALL = 0.3;
const OUT = WALL / 2 + 0.02;
const HEIGHT = 5;
const PAVILION = 6.4;
const ROOF_GAP = 0.02;

function mairie() {
  const buildings = [
    createBuilding(rect(24, 10, 0, -1), { name: 'Hôtel de ville', style: 'pierre', wallColor: '#ffffff', height: HEIGHT, levels: 2, wallThickness: WALL, floor: 'parquet', doors: [door(0, 0.76, 'porte', 0.9), door(1, 0.5, 'porte', 0.9), door(3, 0.5, 'porte', 0.9)] }),
    createBuilding([[-4, 3.7], [4, 3.7], [4, 5.8], [-4, 5.8]], { name: 'Avant-corps', style: 'pierre', wallColor: '#ffffff', height: PAVILION, levels: 2, wallThickness: WALL, floor: 'parquet', doors: [door(2, 0.5, 'passage', 1.6)] }),
  ];
  const elements = [
    ...[0, 1].flatMap((lv) => [windows(-8, 4 + OUT, 0, 7.4, lv), windows(8, 4 + OUT, 0, 7.4, lv), windows(4 + OUT, 4.9, 90, 1.6, lv), windows(-4 - OUT, 4.9, 270, 1.6, lv)]),
    windows(-2.75, 5.8 + OUT, 0, 1.9, 1),
    windows(0, 5.8 + OUT, 0, 3.6, 1, { balconnet: 0 }),
    windows(2.75, 5.8 + OUT, 0, 1.9, 1),
    windows(-2.75, 5.8 + OUT, 0, 1.6),
    windows(2.75, 5.8 + OUT, 0, 1.6),
    el('entrance_portal', 0, 5.8 + OUT, 0, { params: { width: 8 } }),
    el('balcony_flag', -1.45, 5.8 + OUT + 0.5, 340, { params: { flag: 0, elevation: 3.42, side: 1 } }),
    el('balcony_flag', 1.45, 5.8 + OUT + 0.5, 20, { params: { flag: 2, elevation: 3.42, side: 0 } }),
    el('balcony_flag', -8.9, 4 + OUT + 0.19, 345, { params: { flag: 0, elevation: 3.36, side: 1 } }),
    el('balcony_flag', 8.9, 4 + OUT + 0.19, 15, { params: { flag: 0, elevation: 3.36, side: 0 } }),
    windows(0, -6 - OUT, 180, 21.6),
    windows(0, -6 - OUT, 180, 21.6, 1),
    ...[0, 1].flatMap((lv) => [windows(12 + OUT, -4, 90, 3.6, lv), windows(12 + OUT, 2.1, 90, 3.6, lv), windows(-12 - OUT, -4, 270, 3.6, lv), windows(-12 - OUT, 2.1, 270, 3.6, lv)]),
    el('sign_mairie', 0, 5.8 + OUT + 0.1, 0, { params: { elevation: 4.86 } }),
    el('roof_mansard', 0, -1, 0, { params: { width: 24, depth: 10, height: 2.4, elevation: HEIGHT + ROOF_GAP } }),
    el('roof_mansard', 0, 4.75, 0, { params: { width: 8, depth: 2.1, height: 1.6, elevation: PAVILION + ROOF_GAP } }),
    el('belfry', 0, -1, 0, { params: { elevation: HEIGHT + ROOF_GAP + 0.22 + 2.4 + 0.07 } }),
    el('flag_fr', -5.6, 6.6),
    el('flag_eu', 5.6, 6.6, 180),
    el('planter', -8, 5.3),
    el('planter', 8, 5.3),
  ];
  return { buildings, elements };
}

/** Bâtiment simple : murs, toiture à deux pans (ou mansardée), enseigne en façade, ouvertures. */
function simple({ w, d, style, color, height, doors, roof = 'gable', gable = 0, sign, signWidth, extra = [] }) {
  const buildings = [createBuilding(rect(w, d), { name: sign, style, wallColor: color, height, wallThickness: 0.2, floor: 'beton', doors })];
  const roofEl =
    roof === 'mansard'
      ? el('roof_mansard', 0, 0, 0, { params: { width: w, depth: d, height: 1.8, elevation: height + ROOF_GAP } })
      : el('roof_gable', 0, 0, 0, { color: style === 'brique' ? '#7c4a32' : '#55616b', params: { width: w, depth: d, height: Math.min(2, d * 0.2), elevation: height + 0.02, gable, skylights: style === 'bardage' ? 1 : 0 } });
  const elements = [roofEl, el('wall_sign', 0, d / 2 + 0.05, 0, { label: sign, params: { width: signWidth || Math.min(w - 2, 6), style: style === 'brique' || style === 'enduit' ? 1 : 0, elevation: Math.min(height - 1, 2.8) } }), ...extra];
  return { buildings, elements };
}

const SHOP_BY_VARIANT = [1, 2, 5, 6, 7, 8, 9, 4];

/**
 * Mini-scène d'un bâtiment préfait. `variant` (entier) varie les maisons (enduit, couverture) et les commerces.
 */
export function prefabScene(kind, variant = 0) {
  switch (kind) {
    case 'mairie':
      return mairie();
    case 'maison':
      return { buildings: [], elements: [el('townhouse', 0, 2.6, 0, { params: { width: 6, floors: 2 + (variant % 2), shop: 0, facade: variant % 6, slate: variant % 3 === 0 ? 1 : 0 } })] };
    case 'commerce':
      return { buildings: [], elements: [el('townhouse', 0, 2.6, 0, { params: { width: 6, floors: 3, shop: SHOP_BY_VARIANT[variant % SHOP_BY_VARIANT.length], facade: (variant + 2) % 6, slate: 0 } })] };
    case 'infirmerie':
      // Pharmacie à croix verte de la rue commerçante : l'infirmerie et ses sauveteurs secouristes
      return { buildings: [], elements: [el('townhouse', 0, 2.6, 0, { params: { width: 6, floors: 2, shop: 3, facade: 1, slate: 1 } })] };
    case 'depot':
      return simple({ w: 12, d: 9, style: 'bardage', color: '#7c9a6d', height: 4, doors: [door(2, 0.4, 'portail', 3.4), door(2, 0.85, 'porte', 0.9)], gable: 1, sign: 'Dépôt des espaces verts', signWidth: 4.6 });
    case 'cantine':
      return simple({ w: 10, d: 8, style: 'brique', color: '#ffffff', height: 3.4, doors: [door(2, 0.5, 'porte', 1.2), door(1, 0.5, 'porte', 0.9)], roof: 'gable', gable: 2, sign: 'Cantine', signWidth: 3.2, extra: [windows(-3.2, 4.12, 0, 2.4), windows(3.2, 4.12, 0, 2.4)] });
    case 'formation':
      return simple({ w: 14, d: 10, style: 'brique', color: '#ffffff', height: 4.2, doors: [door(2, 0.5, 'porte', 1.4)], roof: 'mansard', sign: 'Salle de formation', signWidth: 5, extra: [windows(-4.4, 5.12, 0, 4.2), windows(4.4, 5.12, 0, 4.2)] });
    case 'prevention':
      return simple({ w: 10, d: 8, style: 'enduit', color: '#f1ece2', height: 3.6, doors: [door(2, 0.5, 'porte', 1.1)], roof: 'gable', gable: 3, sign: 'Service prévention', signWidth: 4.4, extra: [windows(-3.2, 4.12, 0, 2.2), windows(3.2, 4.12, 0, 2.2)] });
    case 'atelier':
      return simple({ w: 16, d: 12, style: 'bardage', color: '#9aa8b8', height: 4.4, doors: [door(2, 0.3, 'portail', 3.4), door(2, 0.72, 'portail', 3.4), door(2, 0.94, 'porte', 0.9)], sign: 'Centre technique municipal', signWidth: 5.6 });
    case 'entrepot':
      return simple({ w: 12, d: 10, style: 'bardage', color: '#a7b0bb', height: 5, doors: [door(2, 0.35, 'portail', 3.4), door(2, 0.85, 'porte', 0.9)], sign: 'Entrepôt des EPI', signWidth: 4.4 });
    case 'point':
      return { buildings: [], elements: [el('notice_board', 0, 0.3, 0), el('sign_warning', -0.8, -0.4, 0, { label: 'Point sécurité' })] };
    default:
      return { buildings: [], elements: [] };
  }
}
