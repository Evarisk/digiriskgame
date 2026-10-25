import snapshotData from '../data/digiriskSnapshot.json';

const DEFAULT_API_KEY = '';
const PUBLIC_HOST = import.meta.env.VITE_DIGIRISK_PUBLIC_URL || 'https://demodoli.digirisk.com/htdocs';

export function getCotationScale(score) {
  if (score >= 81) {
    return {
      scale: 4,
      level: 'critical',
      label: 'Critique (81-100)',
      shortLabel: 'Critique',
      color: '#ef4444',
      emissive: '#dc2626',
      bgBadge: 'rgba(239, 68, 68, 0.18)',
      borderBadge: '#ef4444',
    };
  }
  if (score >= 51) {
    return {
      scale: 3,
      level: 'high',
      label: 'Élevé (51-80)',
      shortLabel: 'Élevé',
      color: '#f97316',
      emissive: '#ea580c',
      bgBadge: 'rgba(249, 115, 22, 0.18)',
      borderBadge: '#f97316',
    };
  }
  if (score >= 48) {
    return {
      scale: 2,
      level: 'medium',
      label: 'Modéré (48-50)',
      shortLabel: 'Modéré',
      color: '#eab308',
      emissive: '#ca8a04',
      bgBadge: 'rgba(234, 179, 8, 0.18)',
      borderBadge: '#eab308',
    };
  }
  return {
    scale: 1,
    level: 'low',
    label: 'Faible (0-47)',
    shortLabel: 'Faible',
    color: '#10b981',
    emissive: '#059669',
    bgBadge: 'rgba(16, 185, 129, 0.16)',
    borderBadge: '#10b981',
  };
}

/**
 * Enrichit l'arbre hiérarchique avec des coordonnées spatiales 3D
 * pour positionner chaque Groupement (bâtiment) et chaque Unité de Travail (atelier/poste).
 */
export function attachSpatialLayout(hierarchy) {
  const buildings = hierarchy.buildings || [];

  // Quadrants sur le campus industriel (X, Z)
  const buildingPresets = [
    { center: [-17, -12], themeColor: '#3b82f6', roofStyle: 'office', iconType: 'office' },     // GP1 Bureaux
    { center: [17, -12], themeColor: '#f59e0b', roofStyle: 'factory', iconType: 'production' }, // GP2 Production
    { center: [-17, 13], themeColor: '#8b5cf6', roofStyle: 'chemical', iconType: 'paint' },     // GP3 Peinture
    { center: [17, 13], themeColor: '#06b6d4', roofStyle: 'logistics', iconType: 'logistics' }, // GP4 Logistique
  ];

  const allWorkUnitsWorld = [];

  const positionedBuildings = buildings.map((b, idx) => {
    const preset = buildingPresets[idx % buildingPresets.length] || {
      center: [(idx % 2 === 0 ? -17 : 17), Math.floor(idx / 2) * 24 - 12],
      themeColor: '#3b82f6',
      roofStyle: 'factory',
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

      const utType = detectWorkUnitArchetype(ut.label, b.label);

      const enrichedUt = {
        ...ut,
        parentBuildingRef: b.ref,
        parentBuildingLabel: b.label,
        archetype: utType,
        layout3D: {
          localPosition: [localX, 0.15, localZ],
          worldPosition: [worldX, 0.15, worldZ],
          size: [4.8, 2.2, 4.0],
        },
      };

      allWorkUnitsWorld.push(enrichedUt);
      return enrichedUt;
    });

    return {
      ...b,
      children: positionedWorkUnits,
      layout3D: {
        position: [preset.center[0], 0, preset.center[1]],
        size: [width, 4.8, depth],
        themeColor: preset.themeColor,
        roofStyle: preset.roofStyle,
      },
    };
  });

  return {
    ...hierarchy,
    buildings: positionedBuildings,
    allWorkUnitsWorld,
  };
}

function detectWorkUnitArchetype(utLabel = '', buildingLabel = '') {
  const txt = `${utLabel} ${buildingLabel}`.toLowerCase();
  if (txt.includes('soudeur') || txt.includes('chaudronnerie')) return 'welding';
  if (txt.includes('cariste')) return 'forklift';
  if (txt.includes('peinture') || txt.includes('accrochage')) return 'paint_booth';
  if (txt.includes('épuration') || txt.includes('epuration') || txt.includes('dépotage') || txt.includes('depotage'))
    return 'chemical_tank';
  if (txt.includes('fret') || txt.includes('bateau') || txt.includes('coursier') || txt.includes('logistique'))
    return 'logistics_dock';
  if (txt.includes('informatique') || txt.includes('étude') || txt.includes('etude')) return 'tech_office';
  return 'office_desk';
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

    const [tree, risks, assessments, creationOptions, tasks] = await Promise.all([
      fetchJson('/digiriskdolibarr/digiriskelements/tree'),
      fetchJson('/digiriskdolibarr/risks?limit=500'),
      fetchJson('/digiriskdolibarr/riskassessments?limit=500'),
      fetchJson('/digiriskdolibarr/risks/creation-options'),
      fetchJson('/tasks?limit=500').catch(() => []),
    ]);

    const hierarchy = transformRawToHierarchy({
      tree,
      risks,
      assessments,
      creationOptions,
      tasks,
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

function transformRawToHierarchy({ tree, risks, assessments, creationOptions, tasks }) {
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

    const rawCotation = Math.max(initialEval.cotation, latestEval.cotation);
    const residualCotation =
      evals.length > 1
        ? latestEval.cotation
        : avgTaskProgress > 0
        ? Math.max(10, Math.round(rawCotation * (1 - (avgTaskProgress / 100) * 0.45)))
        : latestEval.cotation;

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
    sourceUrl: 'https://demodoli.digirisk.com/htdocs/api/index.php',
    entityName: creationOptions?.entity_name || 'MetalOandCo-Industrie',
    rootEntity,
    buildings,
    totalElements: Object.keys(nodesById).length,
    totalRisks: enrichedRisks.length,
    totalAssessments: (assessments || []).length,
    totalTasks: (tasks || []).length,
  };
}
