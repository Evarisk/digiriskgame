import React, { useState } from 'react';
import {
  Building2,
  Wrench,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  FolderTree,
  Layers,
} from 'lucide-react';

/**
 * Arborescence interactive DigiRisk (groupements, sous-groupements et Unités de Travail, à toute profondeur)
 * Se replie complètement à gauche en un bouton compact pour libérer la vue sur mobile et desktop.
 */
export default function HierarchyNavigator({
  data,
  cotationMode,
  selectedElement,
  onSelectElement,
  collapsed,
  setCollapsed,
}) {
  // Groupements dépliés par défaut ; repli mémorisé par identifiant
  const [openGroups, setOpenGroups] = useState({});

  const toggleGroup = (id, e) => {
    e.stopPropagation();
    setOpenGroups((prev) => ({ ...prev, [id]: prev[id] === false }));
  };

  // Premier niveau de l'arborescence : groupements (bâtiments) et UT rattachées à la racine
  const topLevel = data?.rootEntity?.children || [];

  if (collapsed) {
    return (
      <button
        type="button"
        className="hierarchy-collapsed-trigger"
        onClick={() => setCollapsed(false)}
        title="Ouvrir l'arborescence DUER"
      >
        <FolderTree size={16} />
        <span>Arborescence DUER ({data?.rootEntity?.ref || 'GP'})</span>
        <ChevronRight size={15} />
      </button>
    );
  }

  return (
    <aside className="hierarchy-panel">
      <div
        className="hierarchy-header"
        onClick={() => setCollapsed(true)}
        title="Réduire l'arborescence à gauche"
      >
        <div className="hierarchy-title">
          <FolderTree size={16} />
          <span>Arborescence DUER ({data?.rootEntity?.ref || 'GP'})</span>
        </div>
        <button
          type="button"
          className="collapse-btn"
          onClick={(e) => {
            e.stopPropagation();
            setCollapsed(true);
          }}
          aria-label="Réduire le panneau"
        >
          <PanelLeftClose size={16} />
        </button>
      </div>

      <div className="hierarchy-list">
        {topLevel.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            depth={0}
            cotationMode={cotationMode}
            selectedElement={selectedElement}
            onSelectElement={onSelectElement}
            openGroups={openGroups}
            onToggle={toggleGroup}
          />
        ))}
      </div>

      {/* Légende officielle des échelles de cotation DigiRisk : Gris, Orange, Rouge, Noir */}
      <div className="legend-footer">
        <div className="legend-title">Échelle de Criticité DigiRisk</div>
        <div className="legend-grid">
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#94a3b8' }} />
            <span>0–47 Faible</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#f97316' }} />
            <span>48–50 Modéré</span>
          </div>
          <div className="legend-item">
            <span className="legend-swatch" style={{ background: '#ef4444' }} />
            <span>51–80 Élevé</span>
          </div>
          <div className="legend-item">
            <span
              className="legend-swatch"
              style={{
                background: '#09090b',
                border: '1px solid #cbd5e1',
              }}
            />
            <span>81–100 Critique</span>
          </div>
        </div>
      </div>
    </aside>
  );
}

/**
 * Élément de l'arborescence, à toute profondeur : groupement repliable (bâtiment au premier niveau,
 * sous-groupement au-delà) ou Unité de Travail.
 */
function TreeNode({ node, depth, cotationMode, selectedElement, onSelectElement, openGroups, onToggle }) {
  const scale = cotationMode === 'brute' ? node.stats.scaleBrute : node.stats.scaleResiduelle;
  const max = cotationMode === 'brute' ? node.stats.maxBrute : node.stats.maxResiduelle;
  const isActive = selectedElement?.id === node.id;

  if (node.elementType !== 'groupment') {
    return (
      <div className={`tree-ut-row ${isActive ? 'active' : ''}`} onClick={() => onSelectElement(node)}>
        <Wrench size={13} style={{ color: scale.strokeColor || scale.color }} />
        <span className="tree-ut-ref">{node.ref}</span>
        <span className="tree-ut-label">{node.label}</span>
        <span
          className="tree-ut-dot"
          style={{
            backgroundColor: scale.color,
            color: scale.textColor || '#ffffff',
            border: max >= 81 ? '1px solid #cbd5e1' : '1px solid transparent',
          }}
          title={`Cotation max : ${max}/100 (${scale.label})`}
        >
          {max}
        </span>
      </div>
    );
  }

  const isOpen = openGroups[node.id] !== false;
  const Icon = depth === 0 ? Building2 : Layers;
  return (
    <div className={depth === 0 ? 'tree-group' : 'tree-subgroup'}>
      <div className={`tree-building-row ${isActive ? 'active' : ''}`} onClick={() => onSelectElement(node)}>
        <button type="button" className="tree-expand-btn" onClick={(e) => onToggle(node.id, e)}>
          {isOpen ? <ChevronDown size={14} /> : <ChevronRight size={14} />}
        </button>
        <Icon size={depth === 0 ? 15 : 14} style={{ color: node.layout3D?.themeColor || '#3b82f6' }} />
        <span className="tree-ref">{node.ref}</span>
        <span className="tree-label">{node.label}</span>
        <span
          className="tree-score-pill"
          style={{
            backgroundColor: scale.bgBadge || scale.color,
            color: scale.scoreTextColor || '#ffffff',
            borderColor: scale.borderBadge || scale.color,
          }}
        >
          {max}
        </span>
      </div>

      {isOpen && node.children.length > 0 && (
        <div className="tree-ut-children">
          {node.children.map((child) => (
            <TreeNode
              key={child.id}
              node={child}
              depth={depth + 1}
              cotationMode={cotationMode}
              selectedElement={selectedElement}
              onSelectElement={onSelectElement}
              openGroups={openGroups}
              onToggle={onToggle}
            />
          ))}
        </div>
      )}
    </div>
  );
}
