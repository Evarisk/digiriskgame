import snapshotData from '../data/digiriskSnapshot.json';
import {
  DEFAULT_DEMO_RISKSIGNS,
  enrichRiskSign,
} from '../data/signalisationCategories';
import {
  BUILDING_ARCHETYPES,
  detectBuildingArchetype,
  detectWorkUnitArchetype,
} from './archetypes';

const DEFAULT_API_KEY = '';
const PUBLIC_HOST = import.meta.env.VITE_DIGIRISK_PUBLIC_URL || 'https://demodoli.digirisk.com/htdocs';

// Instance Dolibarr ciblée (demodoli par défaut, ou Dolibarr local via .env)
export const API_BASE_URL =
  import.meta.env.VITE_DIGIRISK_BASE_URL || 'https://demodoli.digirisk.com/htdocs/api/index.php';
export const API_HOST_LABEL = (() => {
  const url = new URL(API_BASE_URL);
  return `${url.host}${url.pathname.replace(/(\/htdocs)?\/api\/index\.php$/, '')}`;
})();

export function getCotationScale(score) {
  if (score >= 81) {
    return {
      scale: 4,
      level: 'critical',
      label: 'Critique (81-100)',
      shortLabel: 'Critique',
      color: '#111827',
      strokeColor: '#e2e8f0',
      textColor: '#ffffff',
      scoreTextColor: '#f8fafc',
      emissive: '#09090b',
      bgBadge: '#09090b',
      borderBadge: '#cbd5e1',
    };
  }
  if (score >= 51) {
    return {
      scale: 3,
      level: 'high',
      label: 'Élevé (51-80)',
      shortLabel: 'Élevé',
      color: '#ef4444',
      strokeColor: '#ef4444',
      textColor: '#ffffff',
      scoreTextColor: '#ef4444',
      emissive: '#dc2626',
      bgBadge: 'rgba(239, 68, 68, 0.2)',
      borderBadge: '#ef4444',
    };
  }
  if (score >= 48) {
    return {
      scale: 2,
      level: 'medium',
      label: 'Modéré (48-50)',
      shortLabel: 'Modéré',
      color: '#f97316',
      strokeColor: '#f97316',
      textColor: '#ffffff',
      scoreTextColor: '#f97316',
      emissive: '#ea580c',
      bgBadge: 'rgba(249, 115, 22, 0.2)',
      borderBadge: '#f97316',
    };
  }
  return {
    scale: 1,
    level: 'low',
    label: 'Faible (0-47)',
    shortLabel: 'Faible',
    color: '#94a3b8',
    strokeColor: '#94a3b8',
    textColor: '#0f172a',
    scoreTextColor: '#cbd5e1',
    emissive: '#475569',
    bgBadge: 'rgba(148, 163, 184, 0.18)',
    borderBadge: '#94a3b8',
  };
}

/**
 * Enrichit l'arbre hiérarchique avec des coordonnées spatiales 3D
 * pour positionner chaque Groupement (bâtiment) et chaque Unité de Travail (atelier/poste).
 */
export function attachSpatialLayout(hierarchy) {
  const buildings = hierarchy.buildings || [];
  const rawSigns =
    hierarchy.rawRiskSigns && hierarchy.rawRiskSigns.length > 0
      ? hierarchy.rawRiskSigns
      : DEFAULT_DEMO_RISKSIGNS;

  const signsByElement = {};
  for (const s of rawSigns) {
    const enriched = enrichRiskSign(s);
    if (!signsByElement[enriched.fkElement]) {
      signsByElement[enriched.fkElement] = [];
    }
    signsByElement[enriched.fkElement].push(enriched);
  }

  // Quadrants sur le campus industriel (X, Z) ; le style du bâtiment dépend de son libellé
  const buildingCenters = [
    [-17, -12],
    [17, -12],
    [-17, 13],
    [17, 13],
  ];

  const allWorkUnitsWorld = [];

  const positionedBuildings = buildings.map((b, idx) => {
    const buildingArchetype = detectBuildingArchetype(b, idx);
    const preset = {
      center: buildingCenters[idx] || [idx % 2 === 0 ? -17 : 17, Math.floor(idx / 2) * 24 - 12],
      themeColor: BUILDING_ARCHETYPES[buildingArchetype].themeColor,
    };

    const workUnits = b.children || [];
    const cols = workUnits.length > 4 ? 3 : 2;
    const rows = Math.max(1, Math.ceil(workUnits.length / cols));

    const cellW = 6.2;
    const cellD = 5.4;
    const padX = 2.6;
    const padZ = 3.0;

    const width = Math.max(13, cols * cellW + padX * 2);
    const depth = Math.max(11, rows * cellD + padZ * 2);

    const positionedWorkUnits = workUnits.map((ut, uIdx) => {
      const col = uIdx % cols;
      const row = Math.floor(uIdx / cols);
      const localX = (col - (cols - 1) / 2) * cellW;
      const localZ = (row - (rows - 1) / 2) * cellD + 0.4;
      const worldX = preset.center[0] + localX;
      const worldZ = preset.center[1] + localZ;

      const utType = detectWorkUnitArchetype(ut.label, buildingArchetype);
      const utDirectSigns = signsByElement[ut.id] || ut.directRiskSigns || [];

      const enrichedUt = {
        ...ut,
        parentBuildingRef: b.ref,
        parentBuildingLabel: b.label,
        archetype: utType,
        directRiskSigns: utDirectSigns,
        allRiskSigns: utDirectSigns,
        layout3D: {
          localPosition: [localX, 0.15, localZ],
          worldPosition: [worldX, 0.15, worldZ],
          size: [4.8, 2.2, 4.0],
        },
      };

      allWorkUnitsWorld.push(enrichedUt);
      return enrichedUt;
    });

    const bDirectSigns = signsByElement[b.id] || b.directRiskSigns || [];
    const bAllSigns = [
      ...bDirectSigns,
      ...positionedWorkUnits.flatMap((u) => u.directRiskSigns || []),
    ];

    return {
      ...b,
      directRiskSigns: bDirectSigns,
      allRiskSigns: bAllSigns,
      children: positionedWorkUnits,
      layout3D: {
        position: [preset.center[0], 0, preset.center[1]],
        size: [width, 4.8, depth],
        themeColor: preset.themeColor,
        archetype: buildingArchetype,
        // Côté extérieur du campus (parking, quais, cheminée... sont placés de ce côté)
        outward: [Math.sign(preset.center[0]) || 1, Math.sign(preset.center[1]) || 1],
      },
    };
  });

  const rootDirectSigns =
    hierarchy.rootEntity && signsByElement[hierarchy.rootEntity.id]
      ? signsByElement[hierarchy.rootEntity.id]
      : [];

  return {
    ...hierarchy,
    rootEntity: hierarchy.rootEntity
      ? {
          ...hierarchy.rootEntity,
          directRiskSigns: rootDirectSigns,
          allRiskSigns: [
            ...rootDirectSigns,
            ...positionedBuildings.flatMap((b) => b.allRiskSigns || []),
          ],
        }
      : null,
    buildings: positionedBuildings,
    allWorkUnitsWorld,
  };
}

/**
 * Interroge directement l'API REST Dolibarr/DigiRisk via le proxy Vite (/digirisk-api)
 * ou bascule sur le snapshot local en cas d'indisponibilité réseau.
 */
export async function loadDigiRiskData({ apiKey = DEFAULT_API_KEY, forceSnapshot = false } = {}) {
  if (forceSnapshot) {
    return {
      ...attachSpatialLayout(snapshotData),
      connectionMode: 'snapshot',
    };
  }

  try {
    const headers = {
      Accept: 'application/json',
      ...(apiKey ? { DOLAPIKEY: apiKey } : {}),
    };

    const fetchJson = async (endpoint) => {
      const url = import.meta.env.DEV
        ? `/digirisk-api${endpoint}`
        : `./api-proxy.php?endpoint=${encodeURIComponent(endpoint)}`;
      const res = await fetch(url, { headers });
      if (!res.ok) throw new Error(`API HTTP ${res.status} (${endpoint})`);
      return res.json();
    };

    const [tree, risks, assessments, creationOptions, tasks, riskSigns] = await Promise.all([
      fetchJson('/digiriskdolibarr/digiriskelements/tree'),
      fetchJson('/digiriskdolibarr/risks?limit=500'),
      fetchJson('/digiriskdolibarr/riskassessments?limit=500'),
      fetchJson('/digiriskdolibarr/risks/creation-options'),
      fetchJson('/tasks?limit=500').catch(() => []),
      fetchJson('/digiriskdolibarr/risksigns?limit=500').catch(() => DEFAULT_DEMO_RISKSIGNS),
    ]);

    const hierarchy = transformRawToHierarchy({
      tree,
      risks,
      assessments,
      creationOptions,
      tasks,
      riskSigns,
    });

    return {
      ...attachSpatialLayout(hierarchy),
      connectionMode: 'live',
    };
  } catch (error) {
    console.warn('Repli sur le snapshot local DigiRisk suite à erreur API :', error.message);
    return {
      ...attachSpatialLayout(snapshotData),
      connectionMode: 'snapshot-fallback',
      apiError: error.message,
    };
  }
}

function transformRawToHierarchy({ tree, risks, assessments, creationOptions, tasks, riskSigns }) {
  const categoriesByPos = {};
  for (const cat of creationOptions?.categories || []) {
    categoriesByPos[Number(cat.position)] = {
      position: Number(cat.position),
      name: cat.name,
      ref: cat.ref || `CAT-${cat.position}`,
      thumbnailName: cat.thumbnail_name,
      iconUrl: cat.thumbnail_name
        ? `${PUBLIC_HOST}/custom/digiriskdolibarr/img/categorieDangers/${cat.thumbnail_name}.png`
        : null,
    };
  }

  const assessmentsByRisk = {};
  for (const ra of assessments || []) {
    const fkRisk = Number(ra.fk_risk);
    if (!assessmentsByRisk[fkRisk]) assessmentsByRisk[fkRisk] = [];
    assessmentsByRisk[fkRisk].push({
      id: Number(ra.id),
      ref: ra.ref,
      cotation: Number(ra.cotation ?? 0),
      method: ra.method || 'standard',
      gravite: Number(ra.gravite ?? 1),
      exposition: Number(ra.exposition ?? 1),
      occurrence: Number(ra.occurrence ?? 1),
      formation: Number(ra.formation ?? 1),
      protection: Number(ra.protection ?? 1),
      comment: ra.comment || '',
      photo: ra.photo || null,
      dateCreation: Number(ra.date_creation || 0),
      status: Number(ra.status || 1),
    });
  }

  for (const fkRisk of Object.keys(assessmentsByRisk)) {
    assessmentsByRisk[fkRisk].sort((a, b) => a.dateCreation - b.dateCreation || a.id - b.id);
  }

  const tasksByRisk = {};
  for (const t of tasks || []) {
    const fkRisk = Number(t.array_options?.options_fk_risk || 0);
    if (!fkRisk) continue;
    if (!tasksByRisk[fkRisk]) tasksByRisk[fkRisk] = [];
    tasksByRisk[fkRisk].push({
      id: Number(t.id),
      ref: t.ref,
      label: t.label,
      description: t.description || '',
      progress: Number(t.progress ?? 0),
      budget: Number(t.budget_amount ?? 0),
      color: t.array_options?.options_ganttprocolor || '#3b82f6',
    });
  }

  const risksByElement = {};
  const enrichedRisks = [];

  for (const r of risks || []) {
    const riskId = Number(r.id);
    const fkElement = Number(r.fk_element);
    const evals = assessmentsByRisk[riskId] || [];
    const initialEval = evals[0] || {
      id: 0,
      ref: 'RA-INIT',
      cotation: 20,
      method: 'standard',
      gravite: 1,
      exposition: 1,
      occurrence: 1,
      formation: 1,
      protection: 1,
      comment: '',
    };
    const latestEval = evals[evals.length - 1] || initialEval;
    const evalWithPhoto = [...evals].reverse().find((e) => e.photo) || latestEval;
    const safePhotoSlug = evalWithPhoto.photo
      ? `${evalWithPhoto.ref}_${evalWithPhoto.photo.replace(/[^a-zA-Z0-9._-]/g, '_')}`
      : null;

    const categoryInfo = categoriesByPos[Number(r.category)] || {
      position: Number(r.category),
      name: 'Risque professionnel',
      iconUrl: null,
    };
    const linkedTasks = tasksByRisk[riskId] || [];
    const avgTaskProgress =
      linkedTasks.length > 0
        ? linkedTasks.reduce((acc, item) => acc + item.progress, 0) / linkedTasks.length
        : 0;

    const rawCotation = latestEval.cotation;
    const residualCotation = latestEval.cotation;

    const enriched = {
      id: riskId,
      ref: r.ref,
      fkElement,
      categoryPosition: Number(r.category),
      categoryName: categoryInfo.name,
      categoryIcon: categoryInfo.iconUrl,
      description: r.description || categoryInfo.name,
      cotationBrute: rawCotation,
      cotationResiduelle: residualCotation,
      scaleBrute: getCotationScale(rawCotation),
      scaleResiduelle: getCotationScale(residualCotation),
      photoUrl: safePhotoSlug ? `./risk-photos/${safePhotoSlug}` : null,
      photoFallbackPath: evalWithPhoto.photo
        ? `riskassessment/${evalWithPhoto.ref}/${evalWithPhoto.photo}`
        : null,
      photoRaRef: evalWithPhoto.photo ? evalWithPhoto.ref : null,
      photoRawName: evalWithPhoto.photo || null,
      latestEvaluation: latestEval,
      initialEvaluation: initialEval,
      evaluationsCount: evals.length,
      evaluations: evals,
      tasks: linkedTasks,
    };

    if (!risksByElement[fkElement]) risksByElement[fkElement] = [];
    risksByElement[fkElement].push(enriched);
    enrichedRisks.push(enriched);
  }

  for (const elId of Object.keys(risksByElement)) {
    risksByElement[elId].sort((a, b) => b.cotationResiduelle - a.cotationResiduelle);
  }

  const nodesById = {};
  for (const item of tree || []) {
    const id = Number(item.id);
    nodesById[id] = {
      id,
      ref: item.ref,
      label: item.label,
      description: item.description || '',
      elementType: item.element_type,
      fkParent: Number(item.fk_parent || 0),
      depth: Number(item.depth ?? 0),
      ranks: Number(item.ranks ?? 0),
      photo: item.photo || null,
      directRisks: risksByElement[id] || [],
      children: [],
    };
  }

  const rootNodes = [];
  for (const node of Object.values(nodesById)) {
    if (node.fkParent && nodesById[node.fkParent]) {
      nodesById[node.fkParent].children.push(node);
    } else {
      rootNodes.push(node);
    }
  }

  function computeStats(node) {
    for (const child of node.children) computeStats(child);
    const allRisks = [...node.directRisks, ...node.children.flatMap((c) => c.allRisks || [])];
    node.allRisks = allRisks;

    const maxBrute = allRisks.reduce((m, r) => Math.max(m, r.cotationBrute), 0);
    const maxResiduelle = allRisks.reduce((m, r) => Math.max(m, r.cotationResiduelle), 0);
    const avgResiduelle =
      allRisks.length > 0
        ? Math.round(allRisks.reduce((s, r) => s + r.cotationResiduelle, 0) / allRisks.length)
        : 0;
    const avgBrute =
      allRisks.length > 0
        ? Math.round(allRisks.reduce((s, r) => s + r.cotationBrute, 0) / allRisks.length)
        : 0;

    node.stats = {
      totalRisks: allRisks.length,
      directRisksCount: node.directRisks.length,
      maxBrute,
      maxResiduelle,
      avgBrute,
      avgResiduelle,
      scaleBrute: getCotationScale(maxBrute),
      scaleResiduelle: getCotationScale(maxResiduelle),
      criticalCount: allRisks.filter((r) => r.cotationResiduelle >= 81).length,
      highCount: allRisks.filter((r) => r.cotationResiduelle >= 51 && r.cotationResiduelle <= 80).length,
      mediumCount: allRisks.filter((r) => r.cotationResiduelle >= 48 && r.cotationResiduelle <= 50).length,
      lowCount: allRisks.filter((r) => r.cotationResiduelle < 48).length,
      totalTasks: allRisks.reduce((s, r) => s + r.tasks.length, 0),
    };
  }

  rootNodes.forEach(computeStats);
  const rootEntity = rootNodes[0] || null;
  const buildings = rootEntity ? rootEntity.children.filter((c) => c.elementType === 'groupment') : [];

  return {
    fetchedAt: new Date().toISOString(),
    sourceUrl: API_BASE_URL,
    entityName: creationOptions?.entity_name || 'MetalOandCo-Industrie',
    // Logo de la société (data URI fourni par l'API DigiRisk, vide si non configuré)
    entityLogo: creationOptions?.entity_logo || null,
    rootEntity,
    buildings,
    totalElements: Object.keys(nodesById).length,
    totalRisks: enrichedRisks.length,
    totalAssessments: (assessments || []).length,
    totalTasks: (tasks || []).length,
    rawRiskSigns: riskSigns || DEFAULT_DEMO_RISKSIGNS,
  };
}
