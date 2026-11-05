import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  FilePlus,
  Sparkles,
  Upload,
  Download,
  Undo2,
  Redo2,
  Grid3x3,
  Magnet,
  Layers,
  Tag,
  Route,
  Play,
  Pause,
  Footprints,
  Home,
  X,
  Landmark,
  Building2,
} from 'lucide-react';
import EditorCanvas from './EditorCanvas';
import { walkControl, TOUCH_WALK } from './EditorWalk';
import TouchControls from './TouchControls';
import { LibraryPanel, OutlinerPanel, InspectorPanel, HelpPanel } from './EditorPanels';
import { buildDemoScene } from '../../services/editorDemo';
import { buildMairieScene } from '../../services/editorMairie';
import { ELEMENT_KINDS, NPC_OUTFITS, SHAPE_PRESETS, PREFAB_SKINS } from '../../services/editorCatalog';
import {
  addItem,
  createBuilding,
  createElement,
  createNpc,
  createPrefab,
  createSurface,
  createWall,
  createWalkway,
  duplicateItem,
  emptyScene,
  findItem,
  itemAnchor,
  levelLabel,
  loadDraft,
  moveItem,
  parseScene,
  prefabToBuilding,
  removeItem,
  rotateItem,
  rotatePoint,
  saveDraft,
  sceneBounds,
  sceneFileName,
  sceneLevels,
  serializeScene,
  updateItem,
  LIST_LABELS,
} from '../../services/editorScene';
import '../../styles/editor.css';

/**
 * Éditeur de site (/edit) : on y dessine ses propres bâtiments (contour libre ou forme de base, façades,
 * portes, murs et cloisons intérieurs), on pose bâtiments modèles, postes de travail, équipements,
 * véhicules, décor et personnages où l'on veut, on trace les trajets des personnages, puis on visite
 * le site en première personne. La scène s'exporte / s'importe en JSON (services/editorScene.js) et
 * un brouillon est gardé dans le navigateur.
 */

const HISTORY_LIMIT = 120;
const COALESCE_MS = 900;
// Pas d'aimantation (unités de scène) : 0,25 / 0,5 / 1 m ou libre
const SNAP_STEPS = [
  { value: 1 / 6, label: '0,25 m' },
  { value: 1 / 3, label: '0,5 m' },
  { value: 2 / 3, label: '1 m' },
  { value: 0, label: 'libre' },
];

function useSceneHistory(initial) {
  const [history, setHistory] = useState(() => ({ past: [], present: initial, future: [] }));
  const last = useRef({ key: null, time: 0 });

  /** Enregistre une nouvelle scène ; les modifications successives d'un même champ sont regroupées. */
  const commit = useCallback((next, coalesceKey = null) => {
    const now = Date.now();
    const merge = coalesceKey && last.current.key === coalesceKey && now - last.current.time < COALESCE_MS;
    last.current = { key: coalesceKey, time: now };
    setHistory((h) => {
      const value = typeof next === 'function' ? next(h.present) : next;
      if (value === h.present) return h;
      if (merge) return { ...h, present: value, future: [] };
      return { past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: value, future: [] };
    });
  }, []);
  /** Point de reprise avant un glissement ; les aperçus suivants ne créent pas d'étape. */
  const checkpoint = useCallback(() => {
    last.current = { key: null, time: 0 };
    setHistory((h) => ({ past: [...h.past, h.present].slice(-HISTORY_LIMIT), present: h.present, future: [] }));
  }, []);
  const preview = useCallback((next) => setHistory((h) => ({ ...h, present: next })), []);
  const undo = useCallback(() => {
    last.current = { key: null, time: 0 };
    setHistory((h) => (h.past.length ? { past: h.past.slice(0, -1), present: h.past[h.past.length - 1], future: [h.present, ...h.future] } : h));
  }, []);
  const redo = useCallback(() => {
    last.current = { key: null, time: 0 };
    setHistory((h) => (h.future.length ? { past: [...h.past, h.present], present: h.future[0], future: h.future.slice(1) } : h));
  }, []);
  return { scene: history.present, canUndo: history.past.length > 0, canRedo: history.future.length > 0, commit, checkpoint, preview, undo, redo };
}

const isTyping = (target) => target instanceof HTMLElement && (target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName));

export default function SiteEditor() {
  // /edit?mairie : ouvre directement la mairie de démonstration (lien de présentation), sinon le brouillon
  const initial = useMemo(
    () => (new URLSearchParams(window.location.search).has('mairie') ? buildMairieScene() : loadDraft() || buildDemoScene()),
    []
  );
  const { scene, canUndo, canRedo, commit, checkpoint, preview, undo, redo } = useSceneHistory(initial);
  const [selection, setSelection] = useState(null);
  const [tool, setTool] = useState({ mode: 'select' });
  // `level` : niveau affiché et modifié (null : tous les niveaux, objets posés au rez-de-chaussée)
  const [view, setView] = useState({ grid: true, snap: 1 / 3, lowWalls: false, roofs: false, labels: true, routes: false, animate: true, level: null });
  const [focus, setFocus] = useState(() => ({ ...sceneBounds(initial), instant: true }));
  const [tab, setTab] = useState('library');
  const [notice, setNotice] = useState(null);
  const [walking, setWalking] = useState(false);
  const [walkLocked, setWalkLocked] = useState(false);
  const fileInput = useRef(null);

  const selected = findItem(scene, selection);
  // Sélection disparue (annulation, suppression) : on la retire
  useEffect(() => {
    if (selection && !selected) setSelection(null);
  }, [selection, selected]);

  // Niveau affiché disparu (étages retirés, autre scène) : retour à la vue de tous les niveaux
  const levelCount = sceneLevels(scene);
  useEffect(() => {
    if (view.level != null && view.level >= levelCount) setView((v) => ({ ...v, level: null }));
  }, [levelCount, view.level]);
  const setLevel = (level) => setView((v) => ({ ...v, level }));
  // Objets posés ou tracés sur le niveau affiché
  const onLevel = view.level ? { level: view.level } : {};

  // Brouillon local, écrit après une courte pause dans les modifications
  useEffect(() => {
    const timer = setTimeout(() => saveDraft(scene), 500);
    return () => clearTimeout(timer);
  }, [scene]);

  useEffect(() => {
    if (!notice) return undefined;
    const timer = setTimeout(() => setNotice(null), notice.tone === 'error' ? 9000 : 5000);
    return () => clearTimeout(timer);
  }, [notice]);

  useEffect(() => {
    walkControl.onLockChange = setWalkLocked;
    return () => {
      walkControl.onLockChange = null;
    };
  }, []);

  const select = useCallback((ref) => setSelection(ref), []);
  const focusOn = (ref) => {
    const item = findItem(scene, ref);
    if (!item) return;
    const center = itemAnchor(ref.list, item);
    const ends = item.polygon || (item.a ? [item.a, item.b] : null);
    const radius = ends ? Math.max(5, ...ends.map((p) => Math.hypot(p[0] - center[0], p[1] - center[1]))) : ref.list === 'prefabs' ? 14 : 5;
    setFocus({ center, radius, ts: Date.now() });
  };

  /* ---------- Scène entière : nouveau, démo, import, export ---------- */
  const replaceScene = (next, message) => {
    commit(next);
    setSelection(null);
    setTool({ mode: 'select' });
    setFocus({ ...sceneBounds(next), ts: Date.now() });
    if (message) setNotice(message);
  };

  const importText = (text, fileName) => {
    try {
      const { scene: imported, warnings } = parseScene(text);
      const count = Object.keys(LIST_LABELS).reduce((n, list) => n + imported[list].length, 0);
      replaceScene(imported, {
        tone: warnings.length ? 'warning' : 'success',
        text: `« ${imported.name} » importé depuis ${fileName} : ${count} objet(s).${warnings.length ? ' Certaines entrées ont été ignorées :' : ''} (Ctrl+Z pour revenir)`,
        details: warnings,
      });
    } catch (error) {
      setNotice({ tone: 'error', text: `Import impossible (${fileName}) : ${error.message}` });
    }
  };

  const importFile = (file) => {
    if (!file) return;
    if (file.size > 8 * 1024 * 1024) {
      setNotice({ tone: 'error', text: `${file.name} est trop volumineux (8 Mo au plus).` });
      return;
    }
    file.text().then((text) => importText(text, file.name), () => setNotice({ tone: 'error', text: `Lecture de ${file.name} impossible.` }));
  };

  const exportScene = () => {
    const blob = new Blob([serializeScene(scene)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = sceneFileName(scene);
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice({ tone: 'success', text: `Scène exportée : ${sceneFileName(scene)}` });
  };

  /* ---------- Objet sélectionné ---------- */
  const removeSelected = () => {
    if (!selected) return;
    commit(removeItem(scene, selection));
    setSelection(null);
  };
  const duplicateSelected = () => {
    if (!selected) return;
    const { scene: next, ref } = duplicateItem(scene, selection, selection.list === 'buildings' || selection.list === 'prefabs' ? [4, 4] : [1, 1]);
    commit(next);
    setSelection(ref);
  };
  const convertSelected = () => {
    if (selection?.list !== 'prefabs' || !selected) return;
    const building = prefabToBuilding(selected);
    commit(addItem(removeItem(scene, selection), 'buildings', building));
    setSelection({ list: 'buildings', id: building.id });
    setNotice({ tone: 'success', text: `« ${building.name} » est maintenant un bâtiment sur mesure : sommets, façades et ouvertures modifiables (Ctrl+Z pour revenir).` });
  };
  const rotateSelected = (deg) => {
    if (selected) commit(rotateItem(scene, selection, deg), `rotate:${selection.id}`);
  };
  const nudgeSelected = (dx, dz) => {
    if (selected) commit(moveItem(scene, selection, dx, dz), `nudge:${selection.id}`);
  };

  /* ---------- Outils ---------- */
  const startTool = (next) => {
    if (walking) return;
    setTool(next);
    if (next.mode !== 'route') setSelection(null);
  };

  const finishPolygon = (points) => {
    const pts = points.filter((p, i) => i === 0 || Math.hypot(p[0] - points[i - 1][0], p[1] - points[i - 1][1]) > 0.05);
    if (pts.length > 3 && Math.hypot(pts[0][0] - pts[pts.length - 1][0], pts[0][1] - pts[pts.length - 1][1]) < 0.05) pts.pop();
    if (pts.length < 3) {
      setNotice({ tone: 'warning', text: 'Un contour demande au moins 3 sommets.' });
      return;
    }
    const item =
      tool.target === 'buildings'
        ? createBuilding(pts, { name: `Bâtiment ${scene.buildings.length + 1}` })
        : createSurface(pts, tool.material || 'asphalte');
    commit(addItem(scene, tool.target, item));
    setSelection({ list: tool.target, id: item.id });
    setTool({ mode: 'select' });
  };

  const onToolAction = (action, point) => {
    if (tool.mode === 'place') {
      const { what } = tool;
      const rotation = tool.rotation || 0;
      let item;
      if (what.list === 'elements') item = createElement(what.kind, point, { rotation, ...what.patch, ...onLevel });
      else if (what.list === 'npcs') item = createNpc(what.outfit, point, { rotation, ...onLevel });
      else if (what.list === 'prefabs') item = createPrefab(what.archetype, what.finish, point, { rotation, name: what.label });
      else if (what.list === 'buildings') {
        const polygon = SHAPE_PRESETS[what.preset].polygon.map((p) => rotatePoint([p[0] + point[0], p[1] + point[1]], rotation, point));
        item = createBuilding(polygon, { name: `Bâtiment ${scene.buildings.length + 1}` });
      }
      if (!item) return;
      commit(addItem(scene, what.list, item));
      setSelection({ list: what.list, id: item.id });
      // Les bâtiments se posent un par un ; éléments et personnages en série
      if (what.list === 'buildings' || what.list === 'prefabs') setTool({ mode: 'select' });
      return;
    }
    if (tool.mode === 'polygon') {
      const pts = tool.points;
      const closing = pts.length >= 3 && Math.hypot(point[0] - pts[0][0], point[1] - pts[0][1]) < 0.6;
      if (action === 'finish' || closing) {
        finishPolygon(closing ? pts : [...pts, point]);
        return;
      }
      const last = pts[pts.length - 1];
      if (!last || Math.hypot(point[0] - last[0], point[1] - last[1]) > 0.05) setTool({ ...tool, points: [...pts, point] });
      return;
    }
    if (tool.mode === 'segment') {
      if (!tool.start) {
        setTool({ ...tool, start: point });
        return;
      }
      if (Math.hypot(point[0] - tool.start[0], point[1] - tool.start[1]) < 0.1) return;
      const item = tool.target === 'walls' ? createWall(tool.start, point, tool.wallType || 'plein', onLevel) : createWalkway(tool.start, point, onLevel);
      commit(addItem(scene, tool.target, item));
      setTool({ ...tool, start: point });
      return;
    }
    if (tool.mode === 'route') {
      const ref = { list: 'npcs', id: tool.npcId };
      if (!findItem(scene, ref)) {
        setTool({ mode: 'select' });
        return;
      }
      commit(updateItem(scene, ref, (npc) => ({ route: [...npc.route, point] })));
    }
  };

  const cancelTool = () => {
    if (tool.mode === 'polygon' && tool.points.length) setTool({ ...tool, points: [] });
    else if (tool.mode === 'segment' && tool.start) setTool({ ...tool, start: null });
    else setTool({ mode: 'select' });
  };

  /* ---------- Visite en première personne ---------- */
  const startWalk = () => {
    setTool({ mode: 'select' });
    setWalking(true);
  };
  const stopWalk = () => {
    if (document.pointerLockElement) document.exitPointerLock?.();
    setWalking(false);
    setWalkLocked(false);
  };

  /* ---------- Clavier ---------- */
  const keyHandler = useRef(null);
  keyHandler.current = (e) => {
    if (isTyping(e.target)) return;
    const ctrl = e.ctrlKey || e.metaKey;
    if (walking) {
      if (e.code === 'Escape' && !walkLocked) stopWalk();
      return;
    }
    if (ctrl && e.code === 'KeyZ') {
      e.preventDefault();
      if (e.shiftKey) redo();
      else undo();
      return;
    }
    if (ctrl && e.code === 'KeyY') {
      e.preventDefault();
      redo();
      return;
    }
    if (ctrl && e.code === 'KeyD') {
      e.preventDefault();
      duplicateSelected();
      return;
    }
    if (ctrl) return;
    switch (e.code) {
      case 'Escape':
        if (tool.mode !== 'select') cancelTool();
        else setSelection(null);
        break;
      case 'Enter':
      case 'NumpadEnter':
        if (tool.mode === 'polygon') finishPolygon(tool.points);
        else if (tool.mode !== 'select') setTool({ mode: 'select' });
        break;
      case 'Delete':
      case 'Backspace':
        if (tool.mode === 'select') {
          e.preventDefault();
          removeSelected();
        }
        break;
      case 'KeyR': {
        const deg = e.shiftKey ? 15 : 90;
        if (tool.mode === 'place') setTool({ ...tool, rotation: ((tool.rotation || 0) + deg) % 360 });
        else rotateSelected(deg);
        break;
      }
      case 'KeyF':
        if (selection) focusOn(selection);
        else setFocus({ ...sceneBounds(scene), ts: Date.now() });
        break;
      // Niveau affiché : Pg↑ monte (depuis « tous » : rez-de-chaussée), Pg↓ descend (sous le RDC : tous)
      case 'PageUp':
        e.preventDefault();
        setLevel(view.level == null ? 0 : Math.min(levelCount - 1, view.level + 1));
        break;
      case 'PageDown':
        e.preventDefault();
        setLevel(view.level == null ? null : view.level === 0 ? null : view.level - 1);
        break;
      case 'ArrowUp':
      case 'ArrowDown':
      case 'ArrowLeft':
      case 'ArrowRight': {
        if (!selected || tool.mode !== 'select') break;
        e.preventDefault();
        const step = e.shiftKey ? 2 / 3 : view.snap || 1 / 6;
        const [dx, dz] = { ArrowUp: [0, -step], ArrowDown: [0, step], ArrowLeft: [-step, 0], ArrowRight: [step, 0] }[e.code];
        nudgeSelected(dx, dz);
        break;
      }
      default:
    }
  };
  useEffect(() => {
    const onKey = (e) => keyHandler.current(e);
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);

  /* ---------- Glisser-déposer d'un fichier JSON ---------- */
  const [dropping, setDropping] = useState(false);
  const dropHandlers = {
    onDragOver: (e) => {
      if ([...e.dataTransfer.types].includes('Files')) {
        e.preventDefault();
        setDropping(true);
      }
    },
    onDragLeave: (e) => {
      if (e.currentTarget === e.target) setDropping(false);
    },
    onDrop: (e) => {
      e.preventDefault();
      setDropping(false);
      importFile(e.dataTransfer.files?.[0]);
    },
  };

  const toggle = (key) => setView((v) => ({ ...v, [key]: !v[key] }));
  const counts = Object.keys(LIST_LABELS).reduce((n, list) => n + scene[list].length, 0);

  return (
    <div className={`editor-shell ${walking && TOUCH_WALK ? 'walk-touch-mode' : ''}`} {...dropHandlers}>
      <header className="editor-topbar">
        <div className="editor-brand">
          <a className="editor-back" href="./" title="Retour au jumeau numérique">
            <ArrowLeft size={16} />
          </a>
          <div>
            <span className="editor-kicker">DigiRisk · Éditeur de site</span>
            <input
              className="editor-scene-name"
              value={scene.name}
              maxLength={80}
              aria-label="Nom du site"
              onChange={(e) => commit({ ...scene, name: e.target.value }, 'scene-name')}
            />
          </div>
        </div>

        <div className="editor-actions">
          <div className="editor-group">
            <button type="button" onClick={() => replaceScene(emptyScene(), { tone: 'success', text: 'Nouveau site vide (Ctrl+Z pour revenir).' })} title="Nouveau site vide">
              <FilePlus size={15} /> <span>Nouveau</span>
            </button>
            <button type="button" onClick={() => replaceScene(buildDemoScene(), { tone: 'success', text: 'Site de démonstration chargé (Ctrl+Z pour revenir).' })} title="Charger le site de démonstration">
              <Sparkles size={15} /> <span>Démo</span>
            </button>
            <button
              type="button"
              onClick={() =>
                replaceScene(buildMairieScene(), {
                  tone: 'success',
                  text: 'Mairie chargée (Ctrl+Z pour revenir). Choisissez un niveau (rez-de-chaussée, 1er étage) pour voir l’intérieur ; en visite, l’escalier d’honneur du hall monte à l’étage noble.',
                })
              }
              title="Charger la mairie de démonstration (salon des maires)"
            >
              <Landmark size={15} /> <span>Mairie</span>
            </button>
            <button type="button" onClick={() => fileInput.current?.click()} title="Importer une scène JSON (ou déposer le fichier sur la page)">
              <Upload size={15} /> <span>Importer</span>
            </button>
            <button type="button" onClick={exportScene} title="Exporter la scène en JSON">
              <Download size={15} /> <span>Exporter</span>
            </button>
            <input
              ref={fileInput}
              type="file"
              accept="application/json,.json"
              hidden
              onChange={(e) => {
                importFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
          </div>
          <div className="editor-group">
            <button type="button" className="icon" onClick={undo} disabled={!canUndo} title="Annuler (Ctrl+Z)">
              <Undo2 size={15} />
            </button>
            <button type="button" className="icon" onClick={redo} disabled={!canRedo} title="Rétablir (Ctrl+Y)">
              <Redo2 size={15} />
            </button>
          </div>
          <div className="editor-group">
            <button type="button" className={`icon ${view.grid ? 'on' : ''}`} onClick={() => toggle('grid')} title="Grille (1 m)">
              <Grid3x3 size={15} />
            </button>
            <label className="editor-snap" title="Aimantation à la grille">
              <Magnet size={14} />
              <select value={view.snap} onChange={(e) => setView((v) => ({ ...v, snap: Number(e.target.value) }))}>
                {SNAP_STEPS.map((s) => (
                  <option key={s.label} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </label>
            <label className={`editor-snap editor-level ${view.level != null ? 'on' : ''}`} title="Niveau affiché et modifié : les objets posés vont sur ce niveau (Pg↑ / Pg↓)">
              <Building2 size={14} />
              <select value={view.level ?? 'all'} onChange={(e) => setLevel(e.target.value === 'all' ? null : Number(e.target.value))}>
                <option value="all">Tous les niveaux</option>
                {Array.from({ length: levelCount }, (_, level) => (
                  <option key={level} value={level}>
                    {levelLabel(level)}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className={`icon ${view.lowWalls ? 'on' : ''}`} onClick={() => toggle('lowWalls')} title="Murs arasés (vue de dessus)">
              <Layers size={15} />
            </button>
            <button type="button" className={`icon ${view.roofs ? 'on' : ''}`} onClick={() => toggle('roofs')} title="Toits">
              <Home size={15} />
            </button>
            <button type="button" className={`icon ${view.labels ? 'on' : ''}`} onClick={() => toggle('labels')} title="Étiquettes">
              <Tag size={15} />
            </button>
            <button type="button" className={`icon ${view.routes ? 'on' : ''}`} onClick={() => toggle('routes')} title="Trajets des personnages">
              <Route size={15} />
            </button>
            <button type="button" className={`icon ${view.animate ? 'on' : ''}`} onClick={() => toggle('animate')} title={view.animate ? 'Mettre les personnages en pause' : 'Animer les personnages'}>
              {view.animate ? <Pause size={15} /> : <Play size={15} />}
            </button>
          </div>
          <button type="button" className={`editor-walk ${walking ? 'on' : ''}`} onClick={walking ? stopWalk : startWalk} title="Visiter le site en première personne">
            <Footprints size={15} /> <span>{walking ? 'Quitter la visite' : 'Visiter'}</span>
          </button>
        </div>
      </header>

      <div className="editor-stage">
        <EditorCanvas
          scene={scene}
          selection={selection}
          tool={tool}
          view={view}
          walking={walking}
          focus={focus}
          onSelect={select}
          onCommit={commit}
          onPreview={preview}
          onCheckpoint={checkpoint}
          onToolAction={onToolAction}
        />

        {!walking && (
          <>
            <aside className="editor-panel editor-left">
              <div className="editor-tabs">
                <button type="button" className={tab === 'library' ? 'on' : ''} onClick={() => setTab('library')}>
                  Ajouter
                </button>
                <button type="button" className={tab === 'outliner' ? 'on' : ''} onClick={() => setTab('outliner')}>
                  Scène <em>{counts}</em>
                </button>
              </div>
              {tab === 'library' ? (
                <LibraryPanel tool={tool} onTool={startTool} />
              ) : (
                <OutlinerPanel
                  scene={scene}
                  selection={selection}
                  onSelect={(ref) => {
                    setSelection(ref);
                    setTool({ mode: 'select' });
                    focusOn(ref);
                  }}
                  onRemove={(ref) => commit(removeItem(scene, ref))}
                />
              )}
            </aside>

            <aside className="editor-panel editor-right">
              {selected ? (
                <InspectorPanel
                  key={selection.id}
                  selection={selection}
                  item={selected}
                  scene={scene}
                  tool={tool}
                  levelCount={levelCount}
                  onChange={(patch, field) => commit(updateItem(scene, selection, patch), `${selection.id}:${field}`)}
                  onScene={(next, field) => commit(next, field && `${selection.id}:${field}`)}
                  onRotate={rotateSelected}
                  onDuplicate={duplicateSelected}
                  onRemove={removeSelected}
                  onFocus={() => focusOn(selection)}
                  onTool={startTool}
                  onConvert={convertSelected}
                  onClose={() => setSelection(null)}
                />
              ) : (
                <HelpPanel scene={scene} />
              )}
            </aside>
          </>
        )}

        {/* Visite sur écran tactile : joysticks à l'écran */}
        {walking && TOUCH_WALK && <TouchControls />}

        <ToolHint tool={tool} scene={scene} selected={selected} walking={walking} level={view.level} onExitWalk={stopWalk} onFinish={() => (tool.mode === 'polygon' ? finishPolygon(tool.points) : setTool({ mode: 'select' }))} onCancel={cancelTool} />

        {walking && !walkLocked && !TOUCH_WALK && (
          <div className="editor-walk-pause">
            <h3>Visite en pause</h3>
            <p>ZQSD / WASD ou flèches pour marcher, Maj pour courir, souris pour regarder.</p>
            <div>
              <button type="button" className="primary" onClick={() => walkControl.canvas?.requestPointerLock?.()}>
                Reprendre la visite
              </button>
              <button type="button" onClick={stopWalk}>
                Quitter la visite
              </button>
            </div>
          </div>
        )}

        {notice && (
          <div className={`editor-notice ${notice.tone}`} role="status">
            <div>
              <p>{notice.text}</p>
              {notice.details?.length > 0 && (
                <ul>
                  {notice.details.slice(0, 6).map((d) => (
                    <li key={d}>{d}</li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" className="icon" onClick={() => setNotice(null)} aria-label="Fermer">
              <X size={14} />
            </button>
          </div>
        )}

        {dropping && <div className="editor-drop">Déposer le fichier JSON pour importer la scène</div>}
      </div>
    </div>
  );
}

const TOOL_LABEL = (tool, scene) => {
  if (tool.mode === 'place') {
    const { what } = tool;
    if (what.list === 'elements') return ELEMENT_KINDS[what.kind]?.label;
    if (what.list === 'npcs') return NPC_OUTFITS[what.outfit];
    if (what.list === 'prefabs') return PREFAB_SKINS.find((s) => s.archetype === what.archetype && s.finish === what.finish)?.label;
    return `le bâtiment « ${SHAPE_PRESETS[what.preset]?.label} »`;
  }
  if (tool.mode === 'route') return scene.npcs.find((n) => n.id === tool.npcId)?.name;
  return '';
};

/** Consigne de l'outil en cours (bas de l'écran). */
function ToolHint({ tool, scene, selected, walking, level, onFinish, onCancel, onExitWalk }) {
  if (walking && TOUCH_WALK) {
    // Écran tactile : la barre d'outils est masquée, la consigne porte la sortie de la visite
    return (
      <div className="editor-hint">
        <span>
          Joystick gauche : <strong>se déplacer</strong> · joystick droit ou glisser : <strong>regarder</strong> · escaliers : avancer dessus
        </span>
        <button type="button" onClick={onExitWalk}>
          Quitter
        </button>
      </div>
    );
  }
  if (walking) return <div className="editor-hint">ZQSD / WASD pour marcher · Maj : courir · souris : regarder · escaliers : avancer dessus · Échap : pause</div>;
  let text = null;
  let finish = null;
  // Bâtiments et sols se posent au sol ; le reste sur le niveau affiché
  const where = level && tool.mode !== 'polygon' && !(tool.mode === 'place' && ['buildings', 'prefabs'].includes(tool.what?.list)) ? <> au <strong>{levelLabel(level)}</strong></> : null;
  if (tool.mode === 'place') {
    text = (
      <>
        Cliquez pour poser <strong>{TOOL_LABEL(tool, scene)}</strong>
        {where} · <kbd>R</kbd> pivoter de 90° (<kbd>Maj</kbd>+<kbd>R</kbd> : 15°) · <kbd>Échap</kbd> terminer
      </>
    );
  } else if (tool.mode === 'polygon') {
    text = (
      <>
        {tool.target === 'buildings' ? 'Contour du bâtiment' : 'Contour du sol'} : cliquez les sommets ({tool.points.length}) · cliquez le premier point, double-cliquez ou <kbd>Entrée</kbd> pour fermer
      </>
    );
    finish = tool.points.length >= 3 ? 'Fermer le contour' : null;
  } else if (tool.mode === 'segment') {
    text = (
      <>
        {tool.target === 'walls' ? 'Murs' : 'Allées'}
        {where} : cliquez {tool.start ? 'la fin' : 'le début'} du segment · les segments s’enchaînent · aimantation aux sommets et aux façades · <kbd>Échap</kbd> {tool.start ? 'interrompre' : 'terminer'}
      </>
    );
  } else if (tool.mode === 'route') {
    text = (
      <>
        Trajet de <strong>{TOOL_LABEL(tool, scene)}</strong> : cliquez pour ajouter des points · <kbd>Entrée</kbd> terminer
      </>
    );
    finish = 'Terminer le trajet';
  } else if (selected) {
    text = (
      <>
        Glisser : déplacer · <kbd>R</kbd> pivoter · <kbd>Suppr</kbd> supprimer · <kbd>Ctrl</kbd>+<kbd>D</kbd> dupliquer · <kbd>F</kbd> cadrer · flèches : décaler
      </>
    );
  }
  if (!text) return null;
  return (
    <div className="editor-hint">
      <span>{text}</span>
      {finish && (
        <button type="button" className="primary" onClick={onFinish}>
          {finish}
        </button>
      )}
      {tool.mode !== 'select' && (
        <button type="button" onClick={onCancel}>
          {tool.mode === 'polygon' && tool.points.length ? 'Effacer le tracé' : 'Annuler'}
        </button>
      )}
    </div>
  );
}
