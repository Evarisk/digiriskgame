import React, { useState } from 'react';
import {
  Building2,
  Wrench,
  ChevronDown,
  ChevronRight,
  PanelLeftClose,
  FolderTree,
} from 'lucide-react';

/**
 * Arborescence interactive DigiRisk (Groupement > Unité de Travail)
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
  const [openBuildings, setOpenBuildings] = useState({
    1: true,
    3: true,
    4: true,
    15: true,
  });

  const toggleBuilding = (id, e) => {
    e.stopPropagation();
    setOpenBuildings((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const buildings = data?.buildings || [];

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
        {buildings.map((b) => {
          const isOpen = openBuildings[b.id] !== false;
          const bScale =
            cotationMode === 'brute'
              ? b.stats.scaleBrute
              : b.stats.scaleResiduelle;
          const bMax =
            cotationMode === 'brute'
              ? b.stats.maxBrute
              : b.stats.maxResiduelle;

          return (
            <div key={b.id} className="tree-group">
              <div
                className={`tree-building-row ${
                  selectedElement?.id === b.id ? 'active' : ''
                }`}
                onClick={() => onSelectElement(b)}
              >
                <button
                  type="button"
                  className="tree-expand-btn"
                  onClick={(e) => toggleBuilding(b.id, e)}
                >
                  {isOpen ? (
                    <ChevronDown size={14} />
                  ) : (
                    <ChevronRight size={14} />
                  )}
                </button>
                <Building2
                  size={15}
                  style={{ color: b.layout3D?.themeColor || '#3b82f6' }}
                />
                <span className="tree-ref">{b.ref}</span>
                <span className="tree-label">{b.label}</span>
                <span
                  className="tree-score-pill"
                  style={{
                    backgroundColor: bScale.bgBadge || bScale.color,
                    color: bScale.scoreTextColor || '#ffffff',
                    borderColor: bScale.borderBadge || bScale.color,
                  }}
                >
                  {bMax}
                </span>
              </div>

              {isOpen && (
                <div className="tree-ut-children">
                  {b.children.map((ut) => {
                    const utScale =
                      cotationMode === 'brute'
                        ? ut.stats.scaleBrute
                        : ut.stats.scaleResiduelle;
                    const utMax =
                      cotationMode === 'brute'
                        ? ut.stats.maxBrute
                        : ut.stats.maxResiduelle;

                    return (
                      <div
                        key={ut.id}
                        className={`tree-ut-row ${
                          selectedElement?.id === ut.id ? 'active' : ''
                        }`}
                        onClick={() => onSelectElement(ut)}
                      >
                        <Wrench
                          size={13}
                          style={{ color: utScale.strokeColor || utScale.color }}
                        />
                        <span className="tree-ut-ref">{ut.ref}</span>
                        <span className="tree-ut-label">{ut.label}</span>
                        <span
                          className="tree-ut-dot"
                          style={{
                            backgroundColor: utScale.color,
                            color: utScale.textColor || '#ffffff',
                            border:
                              utMax >= 81
                                ? '1px solid #cbd5e1'
                                : '1px solid transparent',
                          }}
                          title={`Cotation max : ${utMax}/100 (${utScale.label})`}
                        >
                          {utMax}
                        </span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
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
