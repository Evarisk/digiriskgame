import React, { useState } from 'react';
import { Building2, Wrench, ChevronDown, ChevronRight, FolderTree } from 'lucide-react';

/**
 * Arborescence interactive DigiRisk (Groupement > Unité de Travail)
 * Permet de sélectionner et de cibler la caméra 3D sur n'importe quel bâtiment ou atelier.
 */
export default function HierarchyNavigator({
  data,
  cotationMode,
  selectedElement,
  onSelectElement,
}) {
  const [collapsed, setCollapsed] = useState(false);
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

  return (
    <aside className={`hierarchy-panel ${collapsed ? 'collapsed' : ''}`}>
      <div
        className="hierarchy-header"
        onClick={() => setCollapsed(!collapsed)}
      >
        <div className="hierarchy-title">
          <FolderTree size={16} />
          <span>Arborescence DUER ({data?.rootEntity?.ref || 'GP'})</span>
        </div>
        <button type="button" className="collapse-btn">
          {collapsed ? <ChevronRight size={16} /> : <ChevronDown size={16} />}
        </button>
      </div>

      {!collapsed && (
        <>
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
                        backgroundColor: bScale.bgBadge,
                        color: bScale.color,
                        borderColor: bScale.color,
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
                            <Wrench size={13} style={{ color: utScale.color }} />
                            <span className="tree-ut-ref">{ut.ref}</span>
                            <span className="tree-ut-label">{ut.label}</span>
                            <span
                              className="tree-ut-dot"
                              style={{ backgroundColor: utScale.color }}
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

          {/* Légende officielle des échelles de cotation DigiRisk */}
          <div className="legend-footer">
            <div className="legend-title">Échelle de Criticité DigiRisk</div>
            <div className="legend-grid">
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: '#10b981' }} />
                <span>0–47 Faible</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: '#eab308' }} />
                <span>48–50 Modéré</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: '#f97316' }} />
                <span>51–80 Élevé</span>
              </div>
              <div className="legend-item">
                <span className="legend-swatch" style={{ background: '#ef4444' }} />
                <span>81–100 Critique</span>
              </div>
            </div>
          </div>
        </>
      )}
    </aside>
  );
}
