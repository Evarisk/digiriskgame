/**
 * Détection des archétypes 3D à partir des libellés DigiRisk.
 * - Groupements : bureaux, usine (production), atelier peinture / chimie, entrepôt logistique.
 * - Unités de Travail : poste métier détaillé (soudure, perceuse, cabine de peinture, VRP...).
 * Les libellés sont normalisés (minuscules, sans accents) avant comparaison.
 */

export const BUILDING_ARCHETYPES = {
  office: { themeColor: '#3b82f6', defaultWorkUnit: 'admin_office' },
  factory: { themeColor: '#f59e0b', defaultWorkUnit: 'machining' },
  paint: { themeColor: '#8b5cf6', defaultWorkUnit: 'chemical_storage' },
  logistics: { themeColor: '#06b6d4', defaultWorkUnit: 'warehouse_storage' },
};

const BUILDING_RULES = [
  ['paint', /\b(peinture|traitement de surface|chimi|laboratoire|thermolaquage|galvani)/],
  ['logistics', /\b(logistique|entrepot|stockage|expedition|quai|magasin|transport|fret)/],
  ['office', /\b(bureau|administrati|siege|direction|tertiaire|accueil|commercial)/],
  ['factory', /\b(atelier|production|usine|fabrication|usinage|montage|assemblage|maintenance|chaudronnerie)/],
];

const WORKUNIT_RULES = [
  ['welding', /\b(soud|chaudronn|metallerie)/],
  ['drill_press', /\b(perceuse|percage|taraud)/],
  ['shear', /\b(cisaille|guillotine|poinconn|plieuse|pliage)/],
  ['saw_cutting', /\b(debit|scie|sciage|troncon)/],
  ['machining', /\b(usinage|tours?\b|tournage|fraisage|fraiseuse|cnc|commande numerique|rectif)/],
  ['forklift', /\b(cariste|chariot|manutention|gerbeur)/],
  ['paint_booth', /\b(cabine|poudre|thermolaquage|laquage|pistolage)/],
  ['curing_oven', /\b(fours?\b|polymerisation|etuve|cuisson)/],
  ['hanging_line', /\b(accrochage|decrochage|convoyeur|chaine de)/],
  ['wastewater', /\b(epuration|effluent|eaux usees|traitement des eaux|step\b)/],
  ['unloading', /\b(depotage|citerne|cuve)/],
  ['chemical_storage', /\b(produits? chimique|chimique|laboratoire|stockage produit)/],
  ['air_freight', /\b(aerien|avion|aeroport)/],
  ['sea_freight', /\b(bateau|maritime|conteneur|portuaire|navire)/],
  ['courier', /\b(coursier|livreur|livraison|messagerie|colis)/],
  ['warehouse_storage', /\b(stock|entrepot|magasin|expedition|reception|logistique|quai|preparat)/],
  ['it_support', /\b(informatique|reseau|serveur|helpdesk|support|systeme)/],
  ['design_office', /\b(etude|conception|methodes|dessin|ingenierie|r ?& ?d)/],
  ['trade_show', /\b(salon|representation|evenement|exposition|stand)/],
  ['road_sales', /\b(vrp|itinerant|route|routier|deplacement|terrain|mission)/],
  ['meeting_room', /\b(reunion|direction|formation|salle)/],
  ['sales_office', /\b(commerci|vente|teleconseil|service client|accueil|telephon)/],
  ['admin_office', /\b(administrati|finance|comptab|secretariat|ressources humaines|rh\b|paie|achat|bureau)/],
];

const PRESET_ORDER = ['office', 'factory', 'paint', 'logistics'];

const WORKUNIT_FAMILY = {
  welding: 'factory',
  drill_press: 'factory',
  shear: 'factory',
  saw_cutting: 'factory',
  machining: 'factory',
  forklift: 'factory',
  paint_booth: 'paint',
  curing_oven: 'paint',
  hanging_line: 'paint',
  wastewater: 'paint',
  unloading: 'paint',
  chemical_storage: 'paint',
  air_freight: 'logistics',
  sea_freight: 'logistics',
  courier: 'logistics',
  warehouse_storage: 'logistics',
  it_support: 'office',
  design_office: 'office',
  trade_show: 'office',
  road_sales: 'office',
  meeting_room: 'office',
  sales_office: 'office',
  admin_office: 'office',
};

export function normalizeLabel(label = '') {
  return label
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[’']/g, ' ');
}

function matchRules(rules, label) {
  const txt = normalizeLabel(label);
  const found = rules.find(([, pattern]) => pattern.test(txt));
  return found ? found[0] : null;
}

/** Archétype d'une Unité de Travail d'après son seul libellé (null si inconnu). */
export function matchWorkUnitArchetype(utLabel) {
  return matchRules(WORKUNIT_RULES, utLabel);
}

/**
 * Archétype d'un Groupement : libellé du bâtiment, sinon famille majoritaire de ses UT,
 * sinon ordre de présentation historique (bureaux, production, peinture, logistique).
 */
export function detectBuildingArchetype(building, index = 0) {
  const byLabel = matchRules(BUILDING_RULES, building?.label);
  if (byLabel) return byLabel;

  const votes = {};
  for (const ut of building?.children || []) {
    const family = WORKUNIT_FAMILY[matchWorkUnitArchetype(ut.label)];
    if (family) votes[family] = (votes[family] || 0) + 1;
  }
  const best = Object.entries(votes).sort((a, b) => b[1] - a[1])[0];
  return best ? best[0] : PRESET_ORDER[index % PRESET_ORDER.length];
}

/** Archétype d'une Unité de Travail, avec repli sur le poste type du bâtiment parent. */
export function detectWorkUnitArchetype(utLabel, buildingArchetype) {
  return (
    matchWorkUnitArchetype(utLabel) ||
    BUILDING_ARCHETYPES[buildingArchetype]?.defaultWorkUnit ||
    'workshop'
  );
}
