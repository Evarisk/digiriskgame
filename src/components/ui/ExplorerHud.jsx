import React, { useEffect, useRef, useState } from 'react';
import { ArrowBigUp, CheckCircle2, Circle, ClipboardCheck, Gamepad2, LogOut, MapPin, Mouse, Navigation2, Pause, Play, ShieldAlert } from 'lucide-react';
import { explorerStore, guideTo, useExplorer } from '../3d/explorer/explorerStore';
import { canUseMouse } from '../../services/touchControls';
import ExplorerMinimap from './ExplorerMinimap';
import TouchControls from './TouchControls';

/**
 * Interface du mode visite en première personne : viseur et élément visé, localisation, mission guidée
 * (prochain poste à inspecter avec direction et distance, consigne du moment), briefing de départ,
 * minicarte, alertes de zone, confirmation des inspections et carte de pause avec la liste des postes.
 * Commandes tactiles : joysticks à l'écran et boutons Inspecter / Sauter / Pause.
 */

const KEY_CONTROLS = [
  ['Z Q S D / W A S D', 'Se déplacer'],
  ['Souris', 'Regarder'],
  ['Maj', 'Courir'],
  ['Espace', 'Sauter'],
  ['E / Clic', 'Inspecter l’élément visé'],
  ['Échap', 'Pause'],
];

const TOUCH_CONTROLS = [
  ['Joystick gauche', 'Se déplacer'],
  ['Joystick droit / glisser', 'Regarder'],
  ['Inspecter', 'Inspecter l’élément visé'],
  ['Sauter', 'Sauter'],
  ['Pause', 'Pause'],
];

const BRIEFING_SECONDS = 14;
const NEAR_METERS = 9; // en deçà, la consigne invite à viser le poste

function scaleOf(element, cotationMode) {
  return cotationMode === 'brute' ? element?.stats?.scaleBrute : element?.stats?.scaleResiduelle;
}

function scoreOf(element, cotationMode) {
  return cotationMode === 'brute' ? element?.stats?.maxBrute : element?.stats?.maxResiduelle;
}

/** Consigne du moment, selon ce que vise le joueur et la distance au prochain poste. */
function currentStep({ target, inspectedIds, nextUt, guide, total, touch }) {
  if (target?.elementType === 'workunit' && !inspectedIds.has(target.id)) {
    return { tone: 'action', text: touch ? 'Touchez Inspecter pour inspecter ce poste' : 'Appuyez sur E pour inspecter ce poste' };
  }
  if (!nextUt) {
    if (total && inspectedIds.size >= total) return { tone: 'done', text: 'Tous les postes sont inspectés : vous pouvez quitter la visite.' };
    return { tone: 'move', text: total ? 'Recherche du prochain poste…' : 'Aucun poste à inspecter.' };
  }
  if (guide && guide.meters <= NEAR_METERS) return { tone: 'aim', text: 'Vous y êtes : pointez le poste avec le viseur' };
  return { tone: 'move', text: 'Suivez la flèche et la balise bleue' };
}

/** Liste des postes à inspecter, par bâtiment, cochés une fois inspectés. */
function Checklist({ data, inspectedIds }) {
  const blocks = (data?.buildings || []).filter((b) => b.workUnits?.length);
  return (
    <div className="explorer-checklist">
      {blocks.map((b) => {
        const count = b.workUnits.filter((ut) => inspectedIds.has(ut.id)).length;
        return (
          <div key={b.id} className="explorer-checklist-group">
            <div className="explorer-checklist-title">
              <span style={{ background: b.layout3D.themeColor }} />
              <strong>{b.ref}</strong> {b.label}
              <em>
                {count}/{b.workUnits.length}
              </em>
            </div>
            <ul>
              {b.workUnits.map((ut) => {
                const done = inspectedIds.has(ut.id);
                return (
                  <li key={ut.id} className={done ? 'done' : ''}>
                    {done ? <CheckCircle2 size={12} /> : <Circle size={12} />}
                    <strong>{ut.ref}</strong> {ut.label}
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </div>
  );
}

export default function ExplorerHud({ data, cotationMode, inspectedIds, hasSelection, onExit }) {
  const locked = useExplorer((s) => s.locked);
  const touch = useExplorer((s) => s.touch);
  const target = useExplorer((s) => s.target);
  const zoneUt = useExplorer((s) => s.zoneUt);
  const zoneBuilding = useExplorer((s) => s.zoneBuilding);
  const nextUt = useExplorer((s) => s.nextUt);
  const player = useExplorer((s) => s.player);
  const [toast, setToast] = useState(null);
  const [briefing, setBriefing] = useState(true);
  const toastTimer = useRef();

  const total = data?.allWorkUnitsWorld?.length || 0;
  const done = inspectedIds.size;
  const guide = guideTo(player, nextUt);

  const showToast = (tone, text) => {
    clearTimeout(toastTimer.current);
    setToast({ tone, text, key: Date.now() });
    toastTimer.current = setTimeout(() => setToast(null), 3800);
  };
  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // Briefing de départ : masqué après quelques secondes, ou dès la première inspection
  useEffect(() => {
    const timer = setTimeout(() => setBriefing(false), BRIEFING_SECONDS * 1000);
    return () => clearTimeout(timer);
  }, []);

  // Alerte à l'entrée d'une UT à risque élevé ou critique
  useEffect(() => {
    if (!zoneUt) return;
    const score = scoreOf(zoneUt, cotationMode);
    if (score >= 81) showToast('critical', `Zone à risque critique : ${zoneUt.ref} ${zoneUt.label} (${score}/100)`);
    else if (score >= 51) showToast('danger', `Zone à risque élevé : ${zoneUt.ref} ${zoneUt.label} (${score}/100)`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [zoneUt]);

  // Confirmation de chaque poste inspecté, puis de la fin de mission
  const previousIds = useRef(inspectedIds);
  useEffect(() => {
    const added = [...inspectedIds].filter((id) => !previousIds.current.has(id));
    previousIds.current = inspectedIds;
    if (!added.length) return;
    setBriefing(false);
    if (done === total && total > 0) {
      showToast('success', 'Mission accomplie : tous les postes de travail ont été inspectés !');
    } else {
      const ut = data?.elementsById?.[added[0]];
      showToast('success', `Poste inspecté${ut ? ` : ${ut.ref} ${ut.label}` : ''} (${done}/${total})`);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inspectedIds]);

  const targetScale = scaleOf(target, cotationMode);
  const zoneScale = scaleOf(zoneUt || zoneBuilding, cotationMode);
  const progress = total ? Math.round((done / total) * 100) : 0;
  const step = currentStep({ target, inspectedIds, nextUt, guide, total, touch });
  const controls = touch ? TOUCH_CONTROLS : KEY_CONTROLS;
  const inspectKey = touch ? 'Inspecter' : 'E';

  return (
    <div className={`explorer-hud ${touch ? 'touch' : ''}`}>
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
              <span className={`explorer-target-action ${target.elementType === 'workunit' && inspectedIds.has(target.id) ? 'done' : ''}`}>
                {target.elementType !== 'workunit'
                  ? `${inspectKey} · voir la fiche`
                  : inspectedIds.has(target.id)
                    ? `✓ Déjà inspecté · ${inspectKey} pour revoir`
                    : touch
                      ? 'Touchez Inspecter'
                      : 'Appuyez sur E pour inspecter'}
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
              <span>Mission · Visite de sécurité</span>
              <strong>
                {done}/{total}
              </strong>
            </div>
            <div className="explorer-mission-goal">Inspecter chaque poste de travail (UT) du site</div>
            <div className="explorer-progress">
              <div style={{ width: `${progress}%` }} />
            </div>
            {nextUt ? (
              <div className="explorer-mission-next">
                <span className="explorer-mission-arrow" style={{ transform: `rotate(${-(guide?.angle || 0)}rad)` }}>
                  <Navigation2 size={18} />
                </span>
                <div className="explorer-mission-text">
                  <div className="explorer-mission-label">Prochain poste à inspecter</div>
                  <div className="explorer-mission-name">
                    <strong>{nextUt.ref}</strong> {nextUt.label}
                  </div>
                  <div className="explorer-mission-where">
                    {guide ? `${guide.meters} m, ${guide.turn}` : ''}
                    {nextUt.parentBuildingRef ? ` · ${nextUt.parentBuildingRef} ${nextUt.parentBuildingLabel}` : ''}
                  </div>
                </div>
              </div>
            ) : (
              total > 0 &&
              done >= total && (
                <div className="explorer-mission-done">
                  <CheckCircle2 size={15} /> Mission accomplie
                </div>
              )
            )}
            <div className={`explorer-mission-step ${step.tone}`}>{step.text}</div>
          </div>

          {briefing && (
            <div className="explorer-briefing">
              <div className="explorer-briefing-title">
                <ClipboardCheck size={16} /> Votre mission : la visite de sécurité
              </div>
              <ol>
                <li>
                  Rendez-vous au <strong>poste indiqué</strong> en haut à droite, en suivant la flèche et la{' '}
                  <strong>balise bleue</strong>.
                </li>
                <li>
                  Pointez le poste avec le <strong>viseur</strong> (le rond au centre de l’écran).
                </li>
                <li>
                  {touch ? 'Touchez' : 'Appuyez sur'} <kbd>{inspectKey}</kbd> : sa fiche de risques s’ouvre et le poste est coché.
                </li>
              </ol>
              <div className="explorer-briefing-foot">Inspectez les {total} postes pour terminer la visite.</div>
            </div>
          )}

          <ExplorerMinimap data={data} cotationMode={cotationMode} inspectedIds={inspectedIds} />

          {touch ? (
            <TouchControls>
              <button type="button" className="walk-touch-btn primary" disabled={!target} onClick={() => explorerStore.actions?.inspect()}>
                <ClipboardCheck size={20} />
                Inspecter
              </button>
              <button
                type="button"
                className="walk-touch-btn"
                onPointerDown={(e) => {
                  e.preventDefault();
                  explorerStore.actions?.jump();
                }}
              >
                <ArrowBigUp size={20} />
                Sauter
              </button>
              <button type="button" className="walk-touch-btn small" onClick={() => explorerStore.releaseLock()} aria-label="Pause">
                <Pause size={18} />
              </button>
            </TouchControls>
          ) : (
            <div className="explorer-hints">
              {controls.map(([keys, action]) => (
                <span key={keys}>
                  <kbd>{keys}</kbd> {action}
                </span>
              ))}
            </div>
          )}
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
          {hasSelection ? (
            <div className="explorer-pause-title">
              {done}/{total} postes inspectés{nextUt ? ` · prochain : ${nextUt.ref} ${nextUt.label}` : ''}
            </div>
          ) : (
            <>
              <div className="explorer-pause-title">Visite de sécurité en première personne</div>
              <p className="explorer-pause-text">
                Votre mission : inspecter chaque poste de travail (UT) du site. Suivez la flèche et la balise bleue
                jusqu’au poste indiqué, pointez-le avec le viseur puis {touch ? 'touchez' : 'appuyez sur'} <kbd>{inspectKey}</kbd> : sa
                fiche de risques s’ouvre et le poste est coché ci-dessous.
              </p>
              <div className="explorer-pause-progress">
                <ClipboardCheck size={14} /> {done}/{total} postes inspectés
              </div>
              <Checklist data={data} inspectedIds={inspectedIds} />
              <ul className="explorer-controls">
                {controls.map(([keys, action]) => (
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
            {canUseMouse() && (
              <button
                type="button"
                className="hud-btn icon-toggle"
                onClick={() => explorerStore.setTouch(!touch)}
                title={touch ? 'Regarder à la souris (capturée), marcher au clavier' : 'Se déplacer et regarder avec des joysticks à l’écran'}
              >
                {touch ? <Mouse size={14} /> : <Gamepad2 size={14} />}
                <span>{touch ? 'Souris' : 'Joysticks'}</span>
              </button>
            )}
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
