import React, { useEffect, useRef, useState } from 'react';
import { ClipboardCheck, LogOut, MapPin, Play, ShieldAlert, CheckCircle2 } from 'lucide-react';
import { explorerStore, useExplorer } from '../3d/explorer/explorerStore';
import ExplorerMinimap from './ExplorerMinimap';

/**
 * Interface du mode visite en première personne : viseur et élément visé, localisation,
 * avancement de la visite de sécurité, minicarte, alertes de zone et carte de pause.
 */

const CONTROLS = [
  ['Z Q S D / W A S D', 'Se déplacer'],
  ['Souris', 'Regarder'],
  ['Maj', 'Courir'],
  ['Espace', 'Sauter'],
  ['E / Clic', 'Inspecter l’élément visé'],
  ['Échap', 'Pause'],
];

function scaleOf(element, cotationMode) {
  return cotationMode === 'brute' ? element?.stats?.scaleBrute : element?.stats?.scaleResiduelle;
}

function scoreOf(element, cotationMode) {
  return cotationMode === 'brute' ? element?.stats?.maxBrute : element?.stats?.maxResiduelle;
}

export default function ExplorerHud({ data, cotationMode, inspectedIds, hasSelection, onExit }) {
  const locked = useExplorer((s) => s.locked);
  const target = useExplorer((s) => s.target);
  const zoneUt = useExplorer((s) => s.zoneUt);
  const zoneBuilding = useExplorer((s) => s.zoneBuilding);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef();

  const total = data?.allWorkUnitsWorld?.length || 0;
  const done = inspectedIds.size;

  const showToast = (tone, text) => {
    clearTimeout(toastTimer.current);
    setToast({ tone, text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Alerte à l'entrée d'une UT à risque élevé ou critique
  useEffect(() => {
    if (!zoneUt) return;
    const score = scoreOf(zoneUt, cotationMode);
    if (score >= 81) showToast('critical', `Zone à risque critique : ${zoneUt.ref} ${zoneUt.label} (${score}/100)`);
    else if (score >= 51) showToast('danger', `Zone à risque élevé : ${zoneUt.ref} ${zoneUt.label} (${score}/100)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneUt]);

  const previousDone = useRef(done);
  useEffect(() => {
    if (done === total && total > 0 && previousDone.current < total) {
      showToast('success', 'Visite terminée : toutes les unités de travail ont été inspectées.');
    }
    previousDone.current = done;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [done, total]);

  const targetScale = scaleOf(target, cotationMode);
  const zoneScale = scaleOf(zoneUt || zoneBuilding, cotationMode);
  const progress = total ? Math.round((done / total) * 100) : 0;

  return (
    <div className="explorer-hud">
      {locked && (
        <>
          <div
            className={`explorer-crosshair ${target ? 'targeted' : ''}`}
            style={target ? { '--aim-color': targetScale?.strokeColor || '#38bdf8' } : undefined}
          />
          {target && (
            <div className="explorer-target">
              <span
                className="explorer-target-ref"
                style={{ background: targetScale?.color, color: targetScale?.textColor, borderColor: targetScale?.borderBadge }}
              >
                {target.ref}
              </span>
              <span className="explorer-target-label">{target.label}</span>
              <span className="explorer-target-score" style={{ color: targetScale?.scoreTextColor }}>
                {scoreOf(target, cotationMode)}/100
              </span>
              <span className={`explorer-target-action ${inspectedIds.has(target.id) ? 'done' : ''}`}>
                {inspectedIds.has(target.id) ? '✓ Inspecté · E pour revoir' : 'E · Inspecter'}
              </span>
            </div>
          )}

          <div className="explorer-chip explorer-location" style={{ '--zone-color': zoneScale?.strokeColor || '#38bdf8' }}>
            <MapPin size={14} />
            {zoneBuilding ? (
              <span>
                <strong>{zoneBuilding.ref}</strong> {zoneBuilding.label}
                {zoneUt && (
                  <>
                    {' '}
                    › <strong>{zoneUt.ref}</strong> {zoneUt.label}
                  </>
                )}
              </span>
            ) : (
              <span>Extérieur · {data?.entityName || 'Site'}</span>
            )}
          </div>

          <div className="explorer-chip explorer-mission">
            <div className="explorer-mission-head">
              <ClipboardCheck size={14} />
              <span>Visite de sécurité</span>
              <strong>
                {done}/{total}
              </strong>
            </div>
            <div className="explorer-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
          </div>

          <ExplorerMinimap data={data} cotationMode={cotationMode} inspectedIds={inspectedIds} />

          <div className="explorer-hints">
            {CONTROLS.map(([keys, action]) => (
              <span key={keys}>
                <kbd>{keys}</kbd> {action}
              </span>
            ))}
          </div>
        </>
      )}

      {toast && (
        <div key={toast.key} className={`explorer-toast ${toast.tone}`}>
          {toast.tone === 'success' ? <CheckCircle2 size={16} /> : <ShieldAlert size={16} />}
          <span>{toast.text}</span>
        </div>
      )}

      {!locked && (
        <div className={`explorer-pause ${hasSelection ? 'compact' : ''}`}>
          {!hasSelection && (
            <>
              <div className="explorer-pause-title">Visite en première personne</div>
              <p className="explorer-pause-text">
                Parcourez le site à hauteur d’homme et inspectez chaque unité de travail : visez un poste, puis
                appuyez sur <kbd>E</kbd> pour ouvrir ses risques.
              </p>
              <div className="explorer-pause-progress">
                <ClipboardCheck size={14} /> {done}/{total} unités de travail inspectées
              </div>
              <ul className="explorer-controls">
                {CONTROLS.map(([keys, action]) => (
                  <li key={keys}>
                    <kbd>{keys}</kbd>
                    <span>{action}</span>
                  </li>
                ))}
              </ul>
            </>
          )}
          <div className="explorer-pause-actions">
            <button type="button" className="hud-btn primary-sync" onClick={() => explorerStore.requestLock()}>
              <Play size={14} />
              <span>{hasSelection ? 'Reprendre la visite' : 'Jouer'}</span>
            </button>
            <button type="button" className="hud-btn icon-toggle" onClick={onExit}>
              <LogOut size={14} />
              <span>{hasSelection ? 'Quitter' : 'Quitter la visite'}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
