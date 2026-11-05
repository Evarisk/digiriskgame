import React, { useEffect, useMemo, useState } from 'react';
import {
  PenTool,
  BrickWall,
  Map as MapIcon,
  Footprints,
  Search,
  Trash2,
  Copy,
  RotateCcw,
  RotateCw,
  Focus,
  X,
  Plus,
  Route,
  Eraser,
  User,
} from 'lucide-react';
import {
  ELEMENT_KINDS,
  ELEMENT_CATEGORIES,
  NPC_OUTFITS,
  NPC_POSES,
  NPC_ROUTE_MODES,
  RISK_LEVELS,
  SHAPE_PRESETS,
  PREFAB_SKINS,
  BUILDING_STYLES,
  FLOOR_STYLES,
  WALL_TYPES,
  DOOR_KINDS,
  SURFACE_MATERIALS,
  defaultParams,
} from '../../services/editorCatalog';
import { BUILDING_LABELS } from '../../services/skins';
import {
  LIST_LABELS,
  LEVEL_HEIGHT,
  MAX_LEVELS,
  UNIT_METERS,
  buildingLevels,
  levelLabel,
  levelOf,
  toMeters,
  fromMeters,
  moveItem,
  polygonArea,
  polygonEdges,
  pointInPolygon,
  segmentLength,
} from '../../services/editorScene';

/** Listes dont les objets se posent sur un niveau (les bâtiments et les sols restent au sol). */
const LEVELED = new Set(['walls', 'walkways', 'elements', 'npcs']);

function LevelSelect({ value, count, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(Number(e.target.value))}>
      {Array.from({ length: count }, (_, level) => (
        <option key={level} value={level}>
          {levelLabel(level)}
        </option>
      ))}
    </select>
  );
}

/**
 * Panneaux de l'éditeur de site : bibliothèque (outils de tracé et objets à poser), liste des objets de
 * la scène, inspecteur de l'objet sélectionné (dimensions affichées en mètres) et aide.
 */

/* ------------------------------------------------------------------ */
/* Champs                                                               */
/* ------------------------------------------------------------------ */

const fmt = (v, digits = 2) => String(Math.round(v * 10 ** digits) / 10 ** digits);

function Field({ label, children, hint }) {
  return (
    <label className="ed-field">
      <span className="ed-field-label">{label}</span>
      <span className="ed-field-input">{children}</span>
      {hint && <span className="ed-field-hint">{hint}</span>}
    </label>
  );
}

/** Saisie numérique : la valeur est appliquée dès qu'elle est valide, et reformatée en quittant le champ. */
function NumberInput({ value, onChange, step = 0.1, min = -1e4, max = 1e4, suffix, digits = 2 }) {
  const [draft, setDraft] = useState(fmt(value, digits));
  const [focused, setFocused] = useState(false);
  useEffect(() => {
    if (!focused) setDraft(fmt(value, digits));
  }, [value, focused, digits]);
  return (
    <span className="ed-number">
      <input
        type="number"
        value={draft}
        step={step}
        min={min}
        max={max}
        onFocus={() => setFocused(true)}
        onBlur={() => {
          setFocused(false);
          setDraft(fmt(value, digits));
        }}
        onChange={(e) => {
          setDraft(e.target.value);
          const n = Number(e.target.value.replace(',', '.'));
          if (e.target.value !== '' && Number.isFinite(n)) onChange(Math.min(max, Math.max(min, n)));
        }}
      />
      {suffix && <em>{suffix}</em>}
    </span>
  );
}

function SelectInput({ value, options, onChange }) {
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}>
      {Object.entries(options).map(([key, label]) => (
        <option key={key} value={key}>
          {typeof label === 'string' ? label : label.label}
        </option>
      ))}
    </select>
  );
}

function ColorInput({ value, onChange }) {
  return (
    <span className="ed-color">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} />
      <code>{value}</code>
    </span>
  );
}

function Toggle({ checked, onChange, children }) {
  return (
    <label className="ed-toggle">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} />
      <span>{children}</span>
    </label>
  );
}

/* ------------------------------------------------------------------ */
/* Bibliothèque                                                         */
/* ------------------------------------------------------------------ */

/** Miniature SVG d'un contour (formes de base). */
function ShapeIcon({ polygon }) {
  const xs = polygon.map((p) => p[0]);
  const zs = polygon.map((p) => p[1]);
  const [minX, maxX, minZ, maxZ] = [Math.min(...xs), Math.max(...xs), Math.min(...zs), Math.max(...zs)];
  const s = 26 / Math.max(maxX - minX, maxZ - minZ);
  const d = polygon.map(([x, z], i) => `${i ? 'L' : 'M'}${(x - minX) * s + 3 + (26 - (maxX - minX) * s) / 2},${(z - minZ) * s + 3 + (26 - (maxZ - minZ) * s) / 2}`).join(' ');
  return (
    <svg viewBox="0 0 32 32" width="30" height="30" aria-hidden="true">
      <path d={`${d} Z`} />
    </svg>
  );
}

const sameTool = (a, b) => JSON.stringify({ ...a, points: undefined, start: undefined, rotation: undefined }) === JSON.stringify({ ...b, points: undefined, start: undefined, rotation: undefined });

function Section({ title, children, open = true, count }) {
  return (
    <details className="ed-section" open={open}>
      <summary>
        {title}
        {count !== undefined && <em>{count}</em>}
      </summary>
      <div className="ed-section-body">{children}</div>
    </details>
  );
}

export function LibraryPanel({ tool, onTool }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  const match = (label) => !q || label.toLowerCase().includes(q);
  const item = (key, label, next, extra = null) => (
    <button key={key} type="button" className={`ed-item ${sameTool(tool, next) ? 'on' : ''}`} onClick={() => onTool(next)} title={label}>
      {extra}
      <span>{label}</span>
    </button>
  );

  const elementsByCategory = useMemo(
    () =>
      ELEMENT_CATEGORIES.map((cat) => ({
        ...cat,
        kinds: Object.entries(ELEMENT_KINDS).filter(([, def]) => def.category === cat.id),
      })),
    []
  );

  const drawTools = [
    { key: 'draw-building', label: 'Bâtiment sur mesure (contour libre)', icon: <PenTool size={15} />, next: { mode: 'polygon', target: 'buildings', points: [] } },
    { key: 'draw-walkway', label: 'Allée piétonne', icon: <Footprints size={15} />, next: { mode: 'segment', target: 'walkways', start: null } },
  ].filter((t) => match(t.label));
  const wallTools = Object.entries(WALL_TYPES).filter(([, def]) => match(def.label) || match('mur'));
  const surfaceTools = Object.entries(SURFACE_MATERIALS).filter(([, def]) => match(def.label) || match('sol'));
  const shapes = Object.entries(SHAPE_PRESETS).filter(([, def]) => match(def.label) || match('bâtiment'));
  const prefabs = PREFAB_SKINS.filter((s) => match(s.label));
  const outfits = Object.entries(NPC_OUTFITS).filter(([, label]) => match(label) || match('personnage'));

  return (
    <div className="ed-library">
      <div className="ed-search">
        <Search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Rechercher (rack, soudure, porte...)" />
        {query && (
          <button type="button" className="icon" onClick={() => setQuery('')} aria-label="Effacer la recherche">
            <X size={13} />
          </button>
        )}
      </div>

      <div className="ed-scroll">
        {(drawTools.length > 0 || wallTools.length > 0 || surfaceTools.length > 0) && (
          <Section title="Tracer">
            {drawTools.map((t) => item(t.key, t.label, t.next, t.icon))}
            {wallTools.length > 0 && (
              <div className="ed-subgroup">
                <span className="ed-subtitle">
                  <BrickWall size={13} /> Murs & cloisons
                </span>
                <div className="ed-chips">
                  {wallTools.map(([type, def]) => {
                    const next = { mode: 'segment', target: 'walls', wallType: type, start: null };
                    return (
                      <button key={type} type="button" className={`ed-chip ${sameTool(tool, next) ? 'on' : ''}`} onClick={() => onTool(next)}>
                        {def.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            {surfaceTools.length > 0 && (
              <div className="ed-subgroup">
                <span className="ed-subtitle">
                  <MapIcon size={13} /> Sols extérieurs
                </span>
                <div className="ed-chips">
                  {surfaceTools.map(([material, def]) => {
                    const next = { mode: 'polygon', target: 'surfaces', material, points: [] };
                    return (
                      <button key={material} type="button" className={`ed-chip ${sameTool(tool, next) ? 'on' : ''}`} onClick={() => onTool(next)}>
                        {def.label}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        )}

        {shapes.length > 0 && (
          <Section title="Formes de bâtiment">
            <div className="ed-shapes">
              {shapes.map(([preset, def]) => {
                const next = { mode: 'place', what: { list: 'buildings', preset } };
                return (
                  <button key={preset} type="button" className={`ed-shape ${sameTool(tool, next) ? 'on' : ''}`} onClick={() => onTool({ ...next, rotation: 0 })} title={`Bâtiment ${def.label.toLowerCase()}`}>
                    <ShapeIcon polygon={def.polygon} />
                    <span>{def.label}</span>
                  </button>
                );
              })}
            </div>
          </Section>
        )}

        {prefabs.length > 0 && (
          <Section title="Bâtiments du jumeau" open={Boolean(q)} count={prefabs.length}>
            {Object.keys(BUILDING_LABELS).map((archetype) => {
              const skins = prefabs.filter((s) => s.archetype === archetype);
              if (!skins.length) return null;
              return (
                <div key={archetype} className="ed-subgroup">
                  <span className="ed-subtitle">{BUILDING_LABELS[archetype]}</span>
                  {skins.map((s) =>
                    item(s.id, s.label.split(' — ')[1] || s.label, { mode: 'place', what: { list: 'prefabs', archetype: s.archetype, finish: s.finish, label: BUILDING_LABELS[archetype] } })
                  )}
                </div>
              );
            })}
          </Section>
        )}

        {outfits.length > 0 && (
          <Section title="Personnages" count={outfits.length}>
            {outfits.map(([outfit, label]) => item(outfit, label, { mode: 'place', what: { list: 'npcs', outfit } }, <User size={14} />))}
          </Section>
        )}

        {elementsByCategory.map((cat) => {
          const kinds = cat.kinds.filter(([, def]) => match(def.label) || match(cat.label));
          if (!kinds.length) return null;
          let group = null;
          return (
            <Section key={cat.id} title={cat.label} open={Boolean(q) || cat.id === 'postes'} count={kinds.length}>
              {kinds.map(([kind, def]) => {
                const header = def.group && def.group !== group ? (group = def.group) : null;
                return (
                  <React.Fragment key={kind}>
                    {header && <span className="ed-subtitle">{header}</span>}
                    {item(kind, def.label, { mode: 'place', what: { list: 'elements', kind } })}
                  </React.Fragment>
                );
              })}
            </Section>
          );
        })}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Liste des objets                                                     */
/* ------------------------------------------------------------------ */

export function itemTitle(list, item) {
  switch (list) {
    case 'walls':
      return `${WALL_TYPES[item.type]?.label || 'Mur'} · ${fmt(toMeters(segmentLength(item.a, item.b)), 1)} m`;
    case 'walkways':
      return `${item.zebra ? 'Passage piéton' : 'Allée piétonne'} · ${fmt(toMeters(segmentLength(item.a, item.b)), 1)} m`;
    case 'elements':
      return item.label || ELEMENT_KINDS[item.kind]?.label || item.kind;
    case 'npcs':
      return `${item.name} · ${NPC_OUTFITS[item.outfit]}`;
    default:
      return item.name;
  }
}

export function OutlinerPanel({ scene, selection, onSelect, onRemove }) {
  const [query, setQuery] = useState('');
  const q = query.trim().toLowerCase();
  return (
    <div className="ed-library">
      <div className="ed-search">
        <Search size={14} />
        <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Filtrer les objets" />
      </div>
      <div className="ed-scroll">
        {Object.entries(LIST_LABELS).map(([list, label]) => {
          const items = scene[list].filter((it) => !q || itemTitle(list, it).toLowerCase().includes(q));
          if (!items.length) return null;
          return (
            <Section key={list} title={label} count={items.length} open={list !== 'walls' && list !== 'walkways' && list !== 'surfaces'}>
              {items.map((it) => {
                const on = selection?.list === list && selection.id === it.id;
                return (
                  <div key={it.id} className={`ed-row ${on ? 'on' : ''}`}>
                    <button type="button" onClick={() => onSelect({ list, id: it.id })}>
                      {itemTitle(list, it)}
                      {levelOf(it) > 0 && <em className="ed-level-tag">{levelLabel(levelOf(it), true)}</em>}
                      {list === 'buildings' && buildingLevels(it) > 1 && <em className="ed-level-tag">R+{buildingLevels(it) - 1}</em>}
                    </button>
                    <button type="button" className="icon" onClick={() => onRemove({ list, id: it.id })} title="Supprimer">
                      <Trash2 size={13} />
                    </button>
                  </div>
                );
              })}
            </Section>
          );
        })}
        {!Object.keys(LIST_LABELS).some((list) => scene[list].length) && <p className="ed-empty">Scène vide : ajoutez un bâtiment depuis l’onglet « Ajouter ».</p>}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Inspecteur                                                           */
/* ------------------------------------------------------------------ */

const COMPASS = ['est', 'nord-est', 'nord', 'nord-ouest', 'ouest', 'sud-ouest', 'sud', 'sud-est'];

/** Orientation d'une façade (normale sortante ; le nord est vers -Z, en haut de la vue d'ensemble). */
function facing(polygon, a, b) {
  const len = segmentLength(a, b) || 1;
  const nx = (b[1] - a[1]) / len;
  const nz = -(b[0] - a[0]) / len;
  const mid = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const sign = pointInPolygon([mid[0] + nx * 0.3, mid[1] + nz * 0.3], polygon) ? -1 : 1;
  const angle = Math.atan2(-nz * sign, nx * sign);
  return COMPASS[(Math.round(angle / (Math.PI / 4)) + 8) % 8];
}

function retype(element, kind) {
  const def = ELEMENT_KINDS[kind];
  const next = { kind, params: undefined, color: undefined, risk: undefined };
  if (def.params) next.params = defaultParams(kind);
  if (def.color) next.color = ELEMENT_KINDS[element.kind]?.color === element.color || !element.color ? def.color : element.color;
  if (def.risk) next.risk = element.risk || 'low';
  return next;
}

/** Ouverture : nature, position le long du mur, largeur ; niveau percé sur une façade de bâtiment à étages. */
function DoorRow({ door, onChange, onRemove, length, levels = 1 }) {
  return (
    <div className={`ed-door ${levels > 1 ? 'leveled' : ''}`}>
      {levels > 1 && (
        <select value={Math.min(levelOf(door), levels - 1)} onChange={(e) => onChange({ level: Number(e.target.value) || undefined })} title="Niveau percé">
          {Array.from({ length: levels }, (_, level) => (
            <option key={level} value={level}>
              {levelLabel(level, true)}
            </option>
          ))}
        </select>
      )}
      <SelectInput value={door.kind} options={DOOR_KINDS} onChange={(kind) => onChange({ kind, width: DOOR_KINDS[kind].width })} />
      <input type="range" min={0} max={1} step={0.01} value={door.t} onChange={(e) => onChange({ t: Number(e.target.value) })} title="Position le long du mur" />
      <NumberInput value={toMeters(door.width)} min={0.6} max={Math.max(0.6, toMeters(length) - 0.3)} step={0.1} suffix="m" onChange={(m) => onChange({ width: fromMeters(m) })} />
      <button type="button" className="icon" onClick={onRemove} title="Supprimer l’ouverture">
        <X size={13} />
      </button>
    </div>
  );
}

function BuildingFields({ item, onChange }) {
  const area = Math.abs(polygonArea(item.polygon)) * UNIT_METERS * UNIT_METERS;
  const perimeter = polygonEdges(item.polygon).reduce((s, [a, b]) => s + segmentLength(a, b), 0) * UNIT_METERS;
  const setDoors = (doors, field) => onChange({ doors }, field);
  const levels = buildingLevels(item);
  return (
    <>
      <Field label="Nom">
        <input value={item.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value }, 'name')} />
      </Field>
      <p className="ed-info">
        {fmt(area, 0)} m² au sol · périmètre {fmt(perimeter, 1)} m · {item.polygon.length} sommets
      </p>
      <Field label="Façades">
        <SelectInput value={item.style} options={BUILDING_STYLES} onChange={(style) => onChange({ style, wallColor: BUILDING_STYLES[style].color }, 'style')} />
      </Field>
      <Field label={BUILDING_STYLES[item.style]?.glass ? 'Menuiseries' : 'Teinte des murs'}>
        <ColorInput value={item.wallColor} onChange={(wallColor) => onChange({ wallColor }, 'wallColor')} />
      </Field>
      <div className="ed-grid3">
        <Field label="Niveaux">
          <NumberInput
            value={levels}
            min={1}
            max={MAX_LEVELS}
            step={1}
            digits={0}
            onChange={(n) => {
              // La hauteur suit : au moins un niveau entier de 3,75 m par niveau
              const next = Math.round(n);
              onChange({ levels: next, height: Math.max(item.height, next * LEVEL_HEIGHT) }, 'levels');
            }}
          />
        </Field>
        <Field label="Hauteur">
          <NumberInput value={toMeters(item.height)} min={1.5} max={30} step={0.1} suffix="m" onChange={(m) => onChange({ height: fromMeters(m) }, 'height')} />
        </Field>
        <Field label="Épaisseur">
          <NumberInput value={toMeters(item.wallThickness)} min={0.1} max={2} step={0.05} suffix="m" onChange={(m) => onChange({ wallThickness: fromMeters(m) }, 'thickness')} />
        </Field>
      </div>
      {levels > 1 && (
        <p className="ed-info">
          R+{levels - 1} : niveaux de {fmt(toMeters(LEVEL_HEIGHT), 2)} m. Choisissez le niveau dans la barre d’outils pour aménager chaque étage, posez
          un escalier (catégorie « Escaliers & étages ») pour les relier : la trémie est découpée dans le plancher d’arrivée.
        </p>
      )}
      <div className="ed-grid2">
        <Field label="Sol">
          <SelectInput value={item.floor} options={FLOOR_STYLES} onChange={(floor) => onChange({ floor, floorColor: FLOOR_STYLES[floor].color }, 'floor')} />
        </Field>
        <Field label="Teinte du sol">
          <ColorInput value={item.floorColor} onChange={(floorColor) => onChange({ floorColor }, 'floorColor')} />
        </Field>
      </div>

      <h4 className="ed-heading">Façades et ouvertures</h4>
      <p className="ed-info">Faites glisser les sommets blancs pour changer la forme ; tirez un losange vert pour ajouter un sommet, double-cliquez un sommet pour le retirer.</p>
      <div className="ed-edges">
        {polygonEdges(item.polygon).map(([a, b], edge) => {
          const length = segmentLength(a, b);
          // Portail sur les grandes façades (12 m et plus), porte piétonne sinon
          const kind = length >= 8 ? 'portail' : 'porte';
          const doors = item.doors.map((d, i) => ({ d, i })).filter(({ d }) => d.edge === edge);
          return (
            <div key={edge} className="ed-edge">
              <div className="ed-edge-head">
                <span>
                  Façade {edge + 1} · {facing(item.polygon, a, b)} · {fmt(toMeters(length), 1)} m
                </span>
                <button
                  type="button"
                  className="ed-mini"
                  onClick={() => setDoors([...item.doors, { edge, kind, t: 0.5, width: DOOR_KINDS[kind].width }], `doors-add-${edge}`)}
                  disabled={length < 1}
                >
                  <Plus size={12} /> Ouverture
                </button>
              </div>
              {doors.map(({ d, i }) => (
                <DoorRow
                  key={i}
                  door={d}
                  length={length}
                  levels={levels}
                  onChange={(patch) => setDoors(item.doors.map((x, k) => (k === i ? { ...x, ...patch } : x)), `door-${i}`)}
                  onRemove={() => setDoors(item.doors.filter((_, k) => k !== i), `door-del-${i}`)}
                />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}

function PrefabFields({ item, onChange, onConvert }) {
  const skinId = `${item.archetype}:${item.finish}`;
  return (
    <>
      <Field label="Nom">
        <input value={item.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value }, 'name')} />
      </Field>
      <p className="ed-info">Tirez les poignées carrées bleues pour l’étirer : le bord opposé reste en place.</p>
      <Field label="Modèle">
        <select
          value={skinId}
          onChange={(e) => {
            const skin = PREFAB_SKINS.find((s) => s.id === e.target.value);
            onChange({ archetype: skin.archetype, finish: skin.finish }, 'skin');
          }}
        >
          {PREFAB_SKINS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </Field>
      <div className="ed-grid3">
        <Field label="Largeur">
          <NumberInput value={toMeters(item.width)} min={15} max={90} step={0.5} suffix="m" onChange={(m) => onChange({ width: fromMeters(m) }, 'width')} />
        </Field>
        <Field label="Profondeur">
          <NumberInput value={toMeters(item.depth)} min={15} max={90} step={0.5} suffix="m" onChange={(m) => onChange({ depth: fromMeters(m) }, 'depth')} />
        </Field>
        <Field label="Hauteur">
          <NumberInput value={toMeters(item.height)} min={4.5} max={18} step={0.5} suffix="m" onChange={(m) => onChange({ height: fromMeters(m) }, 'height')} />
        </Field>
      </div>
      <Toggle checked={Boolean(item.flip)} onChange={(flip) => onChange({ flip }, 'flip')}>
        Annexes (parking, quais, cuves) du côté gauche
      </Toggle>

      <h4 className="ed-heading">Forme libre</h4>
      <p className="ed-info">
        Un bâtiment du jumeau garde un plan rectangulaire. Pour changer sa forme, ses façades et ses ouvertures, convertissez-le en bâtiment sur
        mesure (même emprise et même hauteur ; son aménagement intérieur et ses annexes ne sont pas repris).
      </p>
      <div className="ed-actions">
        <button type="button" onClick={onConvert}>
          <PenTool size={14} /> Convertir en bâtiment sur mesure
        </button>
      </div>
    </>
  );
}

function WallFields({ item, onChange }) {
  const length = segmentLength(item.a, item.b);
  return (
    <>
      <Field label="Type">
        <SelectInput
          value={item.type}
          options={WALL_TYPES}
          onChange={(type) => onChange({ type, height: WALL_TYPES[type].height, thickness: WALL_TYPES[type].thickness, color: WALL_TYPES[type].color }, 'type')}
        />
      </Field>
      <p className="ed-info">Longueur {fmt(toMeters(length), 2)} m · faites glisser les poignées pour déplacer les extrémités.</p>
      <div className="ed-grid2">
        <Field label="Hauteur">
          <NumberInput value={toMeters(item.height)} min={0.3} max={30} step={0.1} suffix="m" onChange={(m) => onChange({ height: fromMeters(m) }, 'height')} />
        </Field>
        <Field label="Épaisseur">
          <NumberInput value={toMeters(item.thickness)} min={0.03} max={2} step={0.01} suffix="m" onChange={(m) => onChange({ thickness: fromMeters(m) }, 'thickness')} />
        </Field>
      </div>
      <Field label={item.type === 'vitre' ? 'Menuiseries' : 'Couleur'}>
        <ColorInput value={item.color} onChange={(color) => onChange({ color }, 'color')} />
      </Field>
      <Toggle checked={Boolean(item.door)} onChange={(on) => onChange({ door: on ? { kind: 'porte', t: 0.5, width: DOOR_KINDS.porte.width } : null }, 'door-toggle')}>
        Ouverture dans le mur
      </Toggle>
      {item.door && (
        <DoorRow door={item.door} length={length} onChange={(patch) => onChange({ door: { ...item.door, ...patch } }, 'door')} onRemove={() => onChange({ door: null }, 'door-toggle')} />
      )}
    </>
  );
}

function SurfaceFields({ item, onChange }) {
  const area = Math.abs(polygonArea(item.polygon)) * UNIT_METERS * UNIT_METERS;
  return (
    <>
      <Field label="Nom">
        <input value={item.name} maxLength={80} onChange={(e) => onChange({ name: e.target.value }, 'name')} />
      </Field>
      <Field label="Revêtement">
        <SelectInput value={item.material} options={SURFACE_MATERIALS} onChange={(material) => onChange({ material }, 'material')} />
      </Field>
      <p className="ed-info">
        {fmt(area, 0)} m² · {item.polygon.length} sommets (glisser pour modifier, losange vert pour ajouter)
      </p>
    </>
  );
}

function WalkwayFields({ item, onChange }) {
  return (
    <>
      <p className="ed-info">Longueur {fmt(toMeters(segmentLength(item.a, item.b)), 2)} m</p>
      <Field label="Largeur">
        <NumberInput value={toMeters(item.width)} min={0.5} max={6} step={0.1} suffix="m" onChange={(m) => onChange({ width: fromMeters(m) }, 'width')} />
      </Field>
      <Toggle checked={item.zebra} onChange={(zebra) => onChange({ zebra }, 'zebra')}>
        Passage piéton zébré
      </Toggle>
    </>
  );
}

function ElementFields({ item, onChange }) {
  const def = ELEMENT_KINDS[item.kind];
  const sameCategory = Object.fromEntries(Object.entries(ELEMENT_KINDS).filter(([, d]) => d.category === def.category).map(([k, d]) => [k, d.label]));
  return (
    <>
      <Field label="Modèle">
        <SelectInput value={item.kind} options={sameCategory} onChange={(kind) => onChange(retype(item, kind), 'kind')} />
      </Field>
      <Field label="Étiquette" hint="Affichée au-dessus de l’élément">
        <input value={item.label || ''} maxLength={80} placeholder={def.label} onChange={(e) => onChange({ label: e.target.value || undefined }, 'label')} />
      </Field>
      {def.risk && (
        <Field label="Cotation du risque">
          <SelectInput value={item.risk} options={RISK_LEVELS} onChange={(risk) => onChange({ risk }, 'risk')} />
        </Field>
      )}
      {def.stretch && <p className="ed-info">Tirez les poignées carrées bleues pour l’étirer.</p>}
      {def.color && !def.risk && (
        <Field label="Couleur">
          <ColorInput value={item.color} onChange={(color) => onChange({ color }, 'color')} />
        </Field>
      )}
      {(def.params || []).map((p) => (
        <Field key={p.key} label={p.label}>
          <NumberInput
            value={p.meters ? toMeters(item.params[p.key]) : item.params[p.key]}
            min={p.min}
            max={p.max}
            step={p.step}
            digits={p.meters ? 2 : 0}
            onChange={(v) => onChange({ params: { ...item.params, [p.key]: p.meters ? fromMeters(v) : Math.round(v) } }, `param-${p.key}`)}
          />
        </Field>
      ))}
    </>
  );
}

function NpcFields({ item, onChange, tool, onTool }) {
  const tracing = tool.mode === 'route' && tool.npcId === item.id;
  return (
    <>
      <Field label="Nom">
        <input value={item.name} maxLength={40} onChange={(e) => onChange({ name: e.target.value }, 'name')} />
      </Field>
      <div className="ed-grid2">
        <Field label="Tenue">
          <SelectInput value={item.outfit} options={NPC_OUTFITS} onChange={(outfit) => onChange({ outfit }, 'outfit')} />
        </Field>
        <Field label="Pose">
          <SelectInput value={item.pose} options={NPC_POSES} onChange={(pose) => onChange({ pose }, 'pose')} />
        </Field>
      </div>
      <Field label="Apparence">
        <span className="ed-stepper">
          {Array.from({ length: 8 }, (_, v) => (
            <button key={v} type="button" className={item.variant % 8 === v ? 'on' : ''} onClick={() => onChange({ variant: v }, 'variant')}>
              {v + 1}
            </button>
          ))}
        </span>
      </Field>

      <h4 className="ed-heading">Trajet</h4>
      <p className="ed-info">
        {item.route.length
          ? `${item.route.length} point(s) depuis sa position · double-cliquez un point orange pour le retirer.`
          : 'Immobile. Tracez un trajet pour qu’il circule (animation et visite).'}
      </p>
      <div className="ed-actions">
        <button type="button" className={tracing ? 'primary' : ''} onClick={() => onTool(tracing ? { mode: 'select' } : { mode: 'route', npcId: item.id })}>
          <Route size={14} /> {tracing ? 'Terminer le tracé' : item.route.length ? 'Prolonger le trajet' : 'Tracer le trajet'}
        </button>
        {item.route.length > 0 && (
          <button type="button" onClick={() => onChange({ route: [] }, 'route-clear')}>
            <Eraser size={14} /> Effacer
          </button>
        )}
      </div>
      {item.route.length > 0 && (
        <div className="ed-grid2">
          <Field label="Parcours">
            <SelectInput value={item.routeMode} options={NPC_ROUTE_MODES} onChange={(routeMode) => onChange({ routeMode }, 'routeMode')} />
          </Field>
          <Field label="Allure">
            <NumberInput value={item.speed} min={0.2} max={3} step={0.1} suffix="×" onChange={(speed) => onChange({ speed }, 'speed')} />
          </Field>
        </div>
      )}
    </>
  );
}

const INSPECTOR_TITLES = {
  buildings: 'Bâtiment sur mesure',
  prefabs: 'Bâtiment du jumeau',
  walls: 'Mur / cloison',
  surfaces: 'Sol extérieur',
  walkways: 'Allée piétonne',
  elements: 'Élément',
  npcs: 'Personnage',
};

export function InspectorPanel({ selection, item, scene, tool, levelCount = 1, onChange, onScene, onRotate, onDuplicate, onRemove, onFocus, onTool, onConvert, onClose }) {
  const { list } = selection;
  const hasPosition = Array.isArray(item.position);
  const rotatable = list !== 'surfaces' && list !== 'walkways';
  // Niveau de l'objet (proposé dès que la scène a des étages)
  const leveled = LEVELED.has(list) && (levelCount > 1 || levelOf(item) > 0);
  return (
    <div className="ed-inspector">
      <div className="ed-inspector-head">
        <div>
          <span className="editor-kicker">{INSPECTOR_TITLES[list]}</span>
          <h3>{itemTitle(list, item)}</h3>
        </div>
        <button type="button" className="icon" onClick={onClose} aria-label="Fermer">
          <X size={15} />
        </button>
      </div>
      <div className="ed-scroll">
        {list === 'buildings' && <BuildingFields item={item} onChange={onChange} />}
        {list === 'prefabs' && <PrefabFields item={item} onChange={onChange} onConvert={onConvert} />}
        {list === 'walls' && <WallFields item={item} onChange={onChange} />}
        {list === 'surfaces' && <SurfaceFields item={item} onChange={onChange} />}
        {list === 'walkways' && <WalkwayFields item={item} onChange={onChange} />}
        {list === 'elements' && <ElementFields item={item} onChange={onChange} />}
        {list === 'npcs' && <NpcFields item={item} onChange={onChange} tool={tool} onTool={onTool} />}

        {(hasPosition || rotatable || leveled) && <h4 className="ed-heading">Placement</h4>}
        {leveled && (
          <Field label="Niveau" hint={ELEMENT_KINDS[item.kind]?.stairs ? 'Niveau de départ : la volée monte au niveau supérieur' : undefined}>
            <LevelSelect value={levelOf(item)} count={Math.max(levelCount, levelOf(item) + 1)} onChange={(level) => onChange({ level: level || undefined }, 'level')} />
          </Field>
        )}
        {hasPosition && (
          <div className="ed-grid2">
            <Field label="X (est)">
              <NumberInput value={toMeters(item.position[0])} step={0.5} suffix="m" onChange={(m) => onScene(moveItem(scene, selection, fromMeters(m) - item.position[0], 0), 'x')} />
            </Field>
            <Field label="Z (sud)">
              <NumberInput value={toMeters(item.position[1])} step={0.5} suffix="m" onChange={(m) => onScene(moveItem(scene, selection, 0, fromMeters(m) - item.position[1]), 'z')} />
            </Field>
          </div>
        )}
        {rotatable && (
          <div className="ed-rotate">
            {typeof item.rotation === 'number' && (
              <Field label="Orientation">
                <NumberInput value={item.rotation} min={-360} max={360} step={15} digits={1} suffix="°" onChange={(deg) => onRotate(deg - item.rotation)} />
              </Field>
            )}
            <div className="ed-actions">
              <button type="button" onClick={() => onRotate(90)} title="Pivoter de 90° (R)">
                <RotateCcw size={14} /> 90°
              </button>
              <button type="button" onClick={() => onRotate(-90)} title="Pivoter de -90°">
                <RotateCw size={14} /> 90°
              </button>
              <button type="button" onClick={() => onRotate(15)} title="Pivoter de 15° (Maj+R)">
                <RotateCcw size={14} /> 15°
              </button>
            </div>
          </div>
        )}
        {(list === 'buildings' || list === 'prefabs') && <p className="ed-info">Les murs, éléments et personnages posés dans le bâtiment le suivent quand on le déplace, le tourne ou le duplique.</p>}
      </div>
      <div className="ed-inspector-foot">
        <button type="button" onClick={onFocus} title="Cadrer la vue (F)">
          <Focus size={14} /> Cadrer
        </button>
        <button type="button" onClick={onDuplicate} title="Dupliquer (Ctrl+D)">
          <Copy size={14} /> Dupliquer
        </button>
        <button type="button" className="danger" onClick={onRemove} title="Supprimer (Suppr)">
          <Trash2 size={14} /> Supprimer
        </button>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Aide (aucune sélection)                                              */
/* ------------------------------------------------------------------ */

export function HelpPanel({ scene }) {
  return (
    <div className="ed-inspector">
      <div className="ed-inspector-head">
        <div>
          <span className="editor-kicker">Éditeur de site</span>
          <h3>Concevez votre site</h3>
        </div>
      </div>
      <div className="ed-scroll ed-help">
        <ol>
          <li>
            <strong>Bâtiments</strong> : tracez un contour libre ou posez une forme de base, puis ajustez ses sommets, ses façades et ses portes.
          </li>
          <li>
            <strong>Intérieur</strong> : dessinez cloisons, vitrages et grillages ; posez postes de travail, rayonnages, équipements de sécurité.
          </li>
          <li>
            <strong>Personnages</strong> : posez-les puis tracez leur trajet, ils circulent pendant l’animation et la visite.
          </li>
          <li>
            <strong>Visiter</strong> : parcourez le site à hauteur d’homme. <strong>Exporter</strong> sauvegarde la scène en JSON.
          </li>
        </ol>
        <h4 className="ed-heading">Souris & clavier</h4>
        <dl className="ed-keys">
          <dt>Clic gauche</dt>
          <dd>sélectionner, glisser pour déplacer</dd>
          <dt>Glisser dans le vide</dt>
          <dd>tourner la vue (clic droit : décaler, molette : zoom)</dd>
          <dt>R / Maj+R</dt>
          <dd>pivoter de 90° / 15°</dd>
          <dt>Suppr · Ctrl+D</dt>
          <dd>supprimer · dupliquer</dd>
          <dt>Ctrl+Z · Ctrl+Y</dt>
          <dd>annuler · rétablir</dd>
          <dt>Flèches</dt>
          <dd>décaler la sélection (Maj : 1 m)</dd>
          <dt>F · Échap</dt>
          <dd>cadrer · terminer l’outil / désélectionner</dd>
          <dt>Pg↑ · Pg↓</dt>
          <dd>niveau affiché (étages)</dd>
        </dl>
        <h4 className="ed-heading">Contenu</h4>
        <ul className="ed-counts">
          {Object.entries(LIST_LABELS).map(([list, label]) => (
            <li key={list}>
              <span>{label}</span>
              <strong>{scene[list].length}</strong>
            </li>
          ))}
        </ul>
        <p className="ed-info">La scène est gardée dans ce navigateur. Exportez-la en JSON pour la partager ou la réimporter (bouton Importer ou glisser-déposer du fichier).</p>
      </div>
    </div>
  );
}
