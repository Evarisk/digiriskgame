/**
 * Étape 1 — Script d'extraction et de structuration de l'arbre hiérarchique DigiRisk
 * Groupement > Unité de Travail > Risques INRS > Cotations (Brute/Résiduelle) > Plan d'Actions
 *
 * Exécution : npm run sync:digirisk
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = process.env.VITE_DIGIRISK_BASE_URL || 'https://demodoli.digirisk.com/htdocs/api/index.php';
const PUBLIC_HOST = process.env.VITE_DIGIRISK_PUBLIC_URL || 'https://demodoli.digirisk.com/htdocs';
const API_KEY = process.env.VITE_DOLAPIKEY || '';

async function fetchEndpoint(endpoint) {
  const url = `${BASE_URL}${endpoint}`;
  const res = await fetch(url, {
    headers: {
      DOLAPIKEY: API_KEY,
      Accept: 'application/json',
    },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} on ${url}`);
  }
  return res.json();
}

export function buildDigiRiskHierarchy({ tree, risks, assessments, creationOptions, tasks }) {
  // 1. Index INRS Categories by position
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

  // 2. Index Risk Assessments by fk_risk (sorted chronologically)
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

  // 3. Index Action Plan Tasks by options_fk_risk
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

  // Helper for DigiRisk scale (1..4) : Gris, Orange, Rouge, Noir
  function getCotationScale(score) {
    if (score >= 81) {
      return {
        scale: 4,
        level: 'critical',
        label: 'Critique (Noir)',
        color: '#111827',
        strokeColor: '#e2e8f0',
        textColor: '#ffffff',
        scoreTextColor: '#f8fafc',
        bgBadge: '#09090b',
        borderBadge: '#cbd5e1',
      };
    }
    if (score >= 51) {
      return {
        scale: 3,
        level: 'high',
        label: 'Élevé (Rouge)',
        color: '#ef4444',
        strokeColor: '#ef4444',
        textColor: '#ffffff',
        scoreTextColor: '#ef4444',
        bgBadge: 'rgba(239, 68, 68, 0.2)',
        borderBadge: '#ef4444',
      };
    }
    if (score >= 48) {
      return {
        scale: 2,
        level: 'medium',
        label: 'Modéré (Orange)',
        color: '#f97316',
        strokeColor: '#f97316',
        textColor: '#ffffff',
        scoreTextColor: '#f97316',
        bgBadge: 'rgba(249, 115, 22, 0.2)',
        borderBadge: '#f97316',
      };
    }
    return {
      scale: 1,
      level: 'low',
      label: 'Faible (Gris)',
      color: '#94a3b8',
      strokeColor: '#94a3b8',
      textColor: '#0f172a',
      scoreTextColor: '#cbd5e1',
      bgBadge: 'rgba(148, 163, 184, 0.18)',
      borderBadge: '#94a3b8',
    };
  }

  // 4. Enrich Risks & group by fk_element
  const risksByElement = {};
  const enrichedRisks = [];

  for (const r of risks || []) {
    const riskId = Number(r.id);
    const fkElement = Number(r.fk_element);
    const evals = assessmentsByRisk[riskId] || [];
    const initialEval = evals[0] || {
      id: 0,
      ref: 'RA-INIT',
      cotation: 25,
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

    // Compute simulated residual score if tasks have progress and only 1 assessment exists
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

  // Sort risks inside each element by highest cotation first
  for (const elId of Object.keys(risksByElement)) {
    risksByElement[elId].sort((a, b) => b.cotationResiduelle - a.cotationResiduelle);
  }

  // 5. Build Elements Map & Tree (Root -> Groupments -> WorkUnits)
  const nodesById = {};
  for (const item of tree || []) {
    const id = Number(item.id);
    const elementRisks = risksByElement[id] || [];
    nodesById[id] = {
      id,
      ref: item.ref,
      label: item.label,
      description: item.description || '',
      elementType: item.element_type, // 'groupment' | 'workunit'
      fkParent: Number(item.fk_parent || 0),
      depth: Number(item.depth ?? 0),
      ranks: Number(item.ranks ?? 0),
      photo: item.photo || null,
      directRisks: elementRisks,
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

  // Recursive stats computation for each node (both brute and residual)
  function computeStats(node) {
    for (const child of node.children) {
      computeStats(child);
    }
    const allRisks = [
      ...node.directRisks,
      ...node.children.flatMap((c) => c.allRisks || []),
    ];
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

  // Extract main buildings (depth 1 groupments, or root if flat)
  const rootEntity = rootNodes[0] || null;
  const buildings = rootEntity ? rootEntity.children.filter((c) => c.elementType === 'groupment') : [];

  return {
    fetchedAt: new Date().toISOString(),
    sourceUrl: BASE_URL,
    entityName: creationOptions?.entity_name || 'MetalOandCo-Industrie (DigiRisk Demo)',
    rootEntity,
    buildings,
    totalElements: Object.keys(nodesById).length,
    totalRisks: enrichedRisks.length,
    totalAssessments: (assessments || []).length,
    totalTasks: (tasks || []).length,
    cotationScales: creationOptions?.cotation_scales || {},
  };
}

async function main() {
  console.log(`🔌 Connexion à l'API DigiRisk : ${BASE_URL} ...`);
  const [tree, risks, assessments, creationOptions, tasks] = await Promise.all([
    fetchEndpoint('/digiriskdolibarr/digiriskelements/tree'),
    fetchEndpoint('/digiriskdolibarr/risks?limit=500'),
    fetchEndpoint('/digiriskdolibarr/riskassessments?limit=500'),
    fetchEndpoint('/digiriskdolibarr/risks/creation-options'),
    fetchEndpoint('/tasks?limit=500').catch(() => []),
  ]);

  const structured = buildDigiRiskHierarchy({
    tree,
    risks,
    assessments,
    creationOptions,
    tasks,
  });

  console.log(`\n✅ Entité : ${structured.entityName}`);
  console.log(
    `📊 Bilan : ${structured.totalElements} éléments | ${structured.totalRisks} risques | ${structured.totalAssessments} évaluations | ${structured.totalTasks} tâches\n`
  );

  if (structured.rootEntity) {
    console.log(`🏛️  [${structured.rootEntity.ref}] ${structured.rootEntity.label}`);
    for (const b of structured.buildings) {
      console.log(
        `  ├── 🏢 [${b.ref}] ${b.label} (${b.children.length} UT | ${b.stats.totalRisks} risques | Max cotation: ${b.stats.maxResiduelle}/100 - ${b.stats.scaleResiduelle.label})`
      );
      for (const ut of b.children) {
        console.log(
          `  │     ├── 🛠️  [${ut.ref}] ${ut.label} -> ${ut.stats.totalRisks} risque(s) | Max: ${ut.stats.maxResiduelle}/100 (${ut.stats.scaleResiduelle.label})`
        );
      }
    }
  }

  const outDir = path.join(__dirname, '..', 'src', 'data');
  fs.mkdirSync(outDir, { recursive: true });
  const outFile = path.join(outDir, 'digiriskSnapshot.json');
  fs.writeFileSync(outFile, JSON.stringify(structured, null, 2), 'utf8');
  console.log(`\n💾 Snapshot JSON sauvegardé dans : ${outFile}`);

  // Téléchargement des miniatures des photos de risques dans public/risk-photos/
  const photosDir = path.join(__dirname, '..', 'public', 'risk-photos');
  fs.mkdirSync(photosDir, { recursive: true });

  const allRisks = structured.rootEntity?.allRisks || [];
  const risksWithPhoto = allRisks.filter((r) => r.photoRaRef && r.photoRawName);
  console.log(`📸 Téléchargement de ${risksWithPhoto.length} photos de risques...`);

  for (const r of risksWithPhoto) {
    const safePhotoSlug = `${r.photoRaRef}_${r.photoRawName.replace(/[^a-zA-Z0-9._-]/g, '_')}`;
    const destPath = path.join(photosDir, safePhotoSlug);
    if (fs.existsSync(destPath)) continue;

    const extIdx = r.photoRawName.lastIndexOf('.');
    const baseName = extIdx !== -1 ? r.photoRawName.slice(0, extIdx) : r.photoRawName;
    const ext = extIdx !== -1 ? r.photoRawName.slice(extIdx) : '';
    const candidateRefs = [
      r.photoRaRef,
      ...(r.evaluations || []).filter((e) => e.photo).map((e) => e.ref),
    ].filter((v, idx, arr) => v && arr.indexOf(v) === idx);

    let saved = false;
    for (const refCandidate of candidateRefs) {
      const thumbPath = `riskassessment/${refCandidate}/thumbs/${baseName}_small${ext}`;
      const origPath = `riskassessment/${refCandidate}/${r.photoRawName}`;
      try {
        let doc = await fetchEndpoint(
          `/documents/download?modulepart=digiriskdolibarr&original_file=${encodeURIComponent(thumbPath)}`
        ).catch(() => null);
        if (!doc || !doc.content) {
          doc = await fetchEndpoint(
            `/documents/download?modulepart=digiriskdolibarr&original_file=${encodeURIComponent(origPath)}`
          ).catch(() => null);
        }
        if (doc && doc.content) {
          fs.writeFileSync(destPath, Buffer.from(doc.content, 'base64'));
          console.log(`  ✔ [${r.ref}/${refCandidate}] -> ${safePhotoSlug}`);
          saved = true;
          break;
        }
      } catch {
        // try next candidate
      }
    }
    if (!saved) {
      console.warn(`  ⚠ Photo absente sur le serveur pour ${r.ref} (${r.photoRaRef})`);
    }
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url))) {
  main().catch((err) => {
    console.error('❌ Erreur API DigiRisk :', err.message);
    process.exit(1);
  });
}
