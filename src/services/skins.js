import { BUILDING_ARCHETYPES, detectWorkUnitArchetype } from './archetypes';

/**
 * Skins 3D des Groupements (GP) et Unités de Travail (UT), choisis dans les Paramètres.
 * - Skin de GP : enveloppe de bâtiment (archétype) + finition des façades (matériaux, couleurs).
 * - Skin d'UT : modèle de poste de travail.
 * Sans choix (« Auto »), l'archétype est déduit du libellé DigiRisk (services/archetypes.js).
 * Les choix sont mémorisés par navigateur, indexés par identifiant d'élément Dolibarr.
 */

export const BUILDING_LABELS = {
  office: 'Immeuble de bureaux',
  factory: 'Usine à sheds',
  paint: 'Atelier peinture',
  logistics: 'Entrepôt logistique',
};

/** Finitions de chaque enveloppe ; la première est la finition d'origine. */
export const SHELL_FINISHES = {
  office: {
    glass: { label: 'verre bleu, brise-soleil bois', glass: '#36648b', fins: '#b07a4f', core: '#f5f0e8', slab: '#f1f5f9' },
    bronze: { label: 'verre bronze, bois sombre', glass: '#5c4a3a', fins: '#6f4329', core: '#d6d3d1', slab: '#e7e5e4' },
    emerald: { label: 'verre vert, pierre blanche', glass: '#2f5d50', fins: '#cbd5e1', core: '#fafaf9', slab: '#ffffff' },
  },
  factory: {
    brick: { label: 'brique rouge', wall: { map: 'brick' }, lowWall: '#7c2d12', chimney: { map: 'brick' } },
    steel: { label: 'bardage acier', wall: { map: 'panel', color: '#9ca3af' }, lowWall: '#475569', chimney: { color: '#9ca3af', metal: 0.6 } },
    concrete: { label: 'béton préfabriqué', wall: { map: 'concrete', color: '#e2e8f0' }, lowWall: '#64748b', chimney: { map: 'concrete' } },
  },
  paint: {
    white: { label: 'panneaux blancs', wall: '#ffffff', muret: '#d1d5db' },
    anthracite: { label: 'panneaux anthracite', wall: '#6b7280', muret: '#4b5563' },
    sand: { label: 'panneaux sable', wall: '#e7d8b8', muret: '#c8b38a' },
  },
  logistics: {
    grey: { label: 'bardage gris', cladding: '#5b6b7d' },
    blue: { label: 'bardage bleu', cladding: '#1e40af' },
    green: { label: 'bardage vert', cladding: '#166534' },
  },
};

export function shellFinish(archetype, finish) {
  const finishes = SHELL_FINISHES[archetype] || SHELL_FINISHES.factory;
  return finishes[finish] || Object.values(finishes)[0];
}

export const BUILDING_SKINS = Object.entries(SHELL_FINISHES).flatMap(([archetype, finishes]) =>
  Object.entries(finishes).map(([finish, f]) => ({
    id: `${archetype}:${finish}`,
    archetype,
    finish,
    label: `${BUILDING_LABELS[archetype]} — ${f.label}`,
  }))
);

export const WORKUNIT_SKIN_GROUPS = [
  {
    label: 'Bureaux',
    skins: [
      ['admin_office', 'Bureau administratif'],
      ['sales_office', 'Plateau commercial'],
      ['design_office', 'Bureau d’études'],
      ['it_support', 'Support informatique'],
      ['road_sales', 'Commercial itinérant (VRP)'],
      ['trade_show', 'Stand de salon'],
      ['meeting_room', 'Salle de réunion'],
    ],
  },
  {
    label: 'Production',
    skins: [
      ['saw_cutting', 'Débit / scie'],
      ['shear', 'Cisaille / guillotine'],
      ['drill_press', 'Perceuse à colonne'],
      ['welding', 'Soudure / chaudronnerie'],
      ['machining', 'Centre d’usinage'],
      ['forklift', 'Zone cariste'],
      ['workshop', 'Atelier polyvalent'],
    ],
  },
  {
    label: 'Peinture & traitement',
    skins: [
      ['paint_booth', 'Cabine de peinture poudre'],
      ['curing_oven', 'Four de polymérisation'],
      ['hanging_line', 'Accrochage / convoyeur'],
      ['wastewater', 'Station d’épuration'],
      ['unloading', 'Aire de dépotage'],
      ['chemical_storage', 'Stockage produits chimiques'],
    ],
  },
  {
    label: 'Logistique',
    skins: [
      ['courier', 'Coursiers / livraison'],
      ['air_freight', 'Fret aérien'],
      ['sea_freight', 'Fret maritime'],
      ['warehouse_storage', 'Stockage / racks'],
    ],
  },
];

export const WORKUNIT_SKIN_LABELS = Object.fromEntries(WORKUNIT_SKIN_GROUPS.flatMap((g) => g.skins));

const BUILDING_SKIN_BY_ID = Object.fromEntries(BUILDING_SKINS.map((s) => [s.id, s]));

/** Libellé du skin effectif d'un groupement. */
export function buildingSkinLabel(archetype, finish) {
  return BUILDING_SKIN_BY_ID[`${archetype}:${finish}`]?.label || BUILDING_LABELS[archetype] || archetype;
}

/**
 * Applique les skins choisis aux données positionnées : archétype, finition et couleur des groupements,
 * archétype des UT (en « Auto », le repli dépend de l'archétype effectif du bâtiment parent).
 */
export function applySkins(data, skins) {
  if (!data?.buildings) return data;
  const allWorkUnitsWorld = [];
  const buildings = data.buildings.map((b) => {
    const autoArchetype = b.layout3D.autoArchetype || b.layout3D.archetype;
    const skin = BUILDING_SKIN_BY_ID[skins[b.id]];
    const archetype = skin?.archetype || autoArchetype;
    const finish = skin?.finish || Object.keys(SHELL_FINISHES[archetype] || {})[0];
    const children = b.children.map((ut) => {
      const autoUt = detectWorkUnitArchetype(ut.label, archetype);
      const enriched = { ...ut, autoArchetype: autoUt, archetype: WORKUNIT_SKIN_LABELS[skins[ut.id]] ? skins[ut.id] : autoUt };
      allWorkUnitsWorld.push(enriched);
      return enriched;
    });
    return {
      ...b,
      children,
      layout3D: {
        ...b.layout3D,
        autoArchetype,
        archetype,
        finish,
        themeColor: BUILDING_ARCHETYPES[archetype]?.themeColor || b.layout3D.themeColor,
      },
    };
  });
  return { ...data, buildings, allWorkUnitsWorld };
}

const STORAGE_KEY = 'digiriskgame.skins.v1';

export function loadSkins() {
  try {
    return JSON.parse(window.localStorage.getItem(STORAGE_KEY)) || {};
  } catch {
    return {};
  }
}

export function saveSkins(skins) {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(skins));
  } catch {
    // Stockage indisponible (navigation privée...) : les skins restent valables pour la session
  }
}
