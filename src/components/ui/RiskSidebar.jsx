import React, { useState } from 'react';
import {
  X,
  AlertTriangle,
  CheckSquare,
  Shield,
  TrendingDown,
  Building2,
  Wrench,
  Euro,
  MessageSquare,
  Sliders,
} from 'lucide-react';

/**
 * Étape 5 — Panneau latéral (Sidebar HTML) affiché lors du clic (raycasting)
 * sur une Unité de Travail (UT) ou un Groupement (GP).
 * Détaille les risques INRS, les cotations (gravité, exposition, occurrence, formation, protection)
 * et le plan d'actions associé.
 */
export default function RiskSidebar({
  selectedElement,
  cotationMode,
  activeRisk,
  onHoverRisk,
  onClose,
  onSelectElement,
}) {
  const [activeTab, setActiveTab] = useState('risks'); // 'risks' | 'actions'

  if (!selectedElement) return null;

  const isGroupment = selectedElement.elementType === 'groupment';
  const risks = isGroupment
    ? selectedElement.allRisks || []
    : selectedElement.directRisks || [];

  const allTasks = risks.flatMap((r) =>
    (r.tasks || []).map((t) => ({
      ...t,
      riskRef: r.ref,
      riskCategory: r.categoryName,
      riskScore:
        cotationMode === 'brute' ? r.cotationBrute : r.cotationResiduelle,
    }))
  );

  const scaleObj =
    cotationMode === 'brute'
      ? selectedElement.stats?.scaleBrute
      : selectedElement.stats?.scaleResiduelle;
  const maxScore =
    cotationMode === 'brute'
      ? selectedElement.stats?.maxBrute
      : selectedElement.stats?.maxResiduelle;
  const avgScore =
    cotationMode === 'brute'
      ? selectedElement.stats?.avgBrute
      : selectedElement.stats?.avgResiduelle;

  return (
    <aside className="risk-sidebar">
      {/* En-tête de l'élément sélectionné */}
      <div className="sidebar-header">
        <div className="sidebar-breadcrumb">
          {selectedElement.parentBuildingRef && (
            <span className="crumb-parent">
              {selectedElement.parentBuildingRef} •{' '}
              {selectedElement.parentBuildingLabel}
            </span>
          )}
          <span className="crumb-type">
            {isGroupment ? (
              <>
                <Building2 size={13} /> Groupement (Bâtiment)
              </>
            ) : (
              <>
                <Wrench size={13} /> Unité de Travail (Atelier)
              </>
            )}
          </span>
        </div>

        <div className="sidebar-title-row">
          <div className="sidebar-title-left">
            <span
              className="sidebar-ref-badge"
              style={{
                backgroundColor: scaleObj?.color || '#3b82f6',
                color: scaleObj?.textColor || '#ffffff',
                border: maxScore >= 81 ? '1px solid #cbd5e1' : 'none',
              }}
            >
              {selectedElement.ref}
            </span>
            <h2>{selectedElement.label}</h2>
          </div>
          <button
            type="button"
            className="sidebar-close-btn"
            onClick={onClose}
            title="Fermer le panneau"
          >
            <X size={18} />
          </button>
        </div>

        {selectedElement.description && (
          <p className="sidebar-description">{selectedElement.description}</p>
        )}

        {/* KPIs de cotation de l'UT / Groupement */}
        <div className="sidebar-kpi-grid">
          <div
            className="kpi-card"
            style={{ borderColor: scaleObj?.borderBadge || scaleObj?.color || '#334155' }}
          >
            <span className="kpi-label">Cotation Max</span>
            <span
              className="kpi-value"
              style={{ color: scaleObj?.scoreTextColor || scaleObj?.color || '#f8fafc' }}
            >
              {maxScore}/100
            </span>
            <span className="kpi-sub">{scaleObj?.label}</span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Moyenne / Risques</span>
            <span className="kpi-value">{avgScore}/100</span>
            <span className="kpi-sub">
              {risks.length} risque{risks.length > 1 ? 's' : ''} identifié
              {risks.length > 1 ? 's' : ''}
            </span>
          </div>

          <div className="kpi-card">
            <span className="kpi-label">Plan d’Actions</span>
            <span className="kpi-value">{allTasks.length}</span>
            <span className="kpi-sub">
              tâche{allTasks.length > 1 ? 's' : ''} de prévention
            </span>
          </div>
        </div>

        {/* Sous-unités rapides si un bâtiment (Groupement) est sélectionné */}
        {isGroupment && selectedElement.children?.length > 0 && (
          <div className="sub-units-strip">
            <span className="strip-label">Sous-espaces (UT) :</span>
            <div className="strip-chips">
              {selectedElement.children.map((ut) => (
                <button
                  key={ut.id}
                  type="button"
                  className="ut-chip"
                  style={{
                    borderColor: ut.stats?.scaleResiduelle?.color,
                  }}
                  onClick={() => onSelectElement(ut)}
                >
                  <strong>{ut.ref}</strong> {ut.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Onglets Risques INRS / Plan d'Actions */}
        <div className="sidebar-tabs">
          <button
            type="button"
            className={`tab-btn ${activeTab === 'risks' ? 'active' : ''}`}
            onClick={() => setActiveTab('risks')}
          >
            <AlertTriangle size={15} />
            <span>Risques INRS ({risks.length})</span>
          </button>
          <button
            type="button"
            className={`tab-btn ${activeTab === 'actions' ? 'active' : ''}`}
            onClick={() => setActiveTab('actions')}
          >
            <CheckSquare size={15} />
            <span>Plan d’Actions ({allTasks.length})</span>
          </button>
        </div>
      </div>

      {/* Corps scrollable du panneau latéral */}
      <div className="sidebar-body">
        {activeTab === 'risks' ? (
          risks.length === 0 ? (
            <div className="empty-state">
              <Shield size={36} className="empty-icon" />
              <h4>Aucun risque coté sur cette unité</h4>
              <p>
                Cette unité de travail ne comporte aucune évaluation de risque
                active dans DigiRisk.
              </p>
            </div>
          ) : (
            <div className="risk-cards-list">
              {risks.map((risk) => (
                <RiskDetailCard
                  key={risk.id}
                  risk={risk}
                  cotationMode={cotationMode}
                  isHighlighted={activeRisk?.id === risk.id}
                  onHoverRisk={onHoverRisk}
                />
              ))}
            </div>
          )
        ) : allTasks.length === 0 ? (
          <div className="empty-state">
            <CheckSquare size={36} className="empty-icon" />
            <h4>Aucune tâche de prévention</h4>
            <p>
              Aucune action corrective n’est encore rattachée aux risques de
              cette unité dans le projet DUER.
            </p>
          </div>
        ) : (
          <div className="tasks-list">
            {allTasks.map((task) => (
              <div key={task.id} className="action-task-card">
                <div className="task-card-top">
                  <span className="task-ref">{task.ref}</span>
                  <span className="task-linked-risk">
                    Lié à <strong>{task.riskRef}</strong> ({task.riskCategory})
                  </span>
                </div>
                <div className="task-label">{task.label}</div>
                <div className="task-metrics">
                  <div className="task-progress-block">
                    <div className="task-progress-row">
                      <span>Avancement</span>
                      <strong>{task.progress}%</strong>
                    </div>
                    <div className="progress-bar-bg">
                      <div
                        className="progress-bar-fill"
                        style={{
                          width: `${Math.min(100, task.progress)}%`,
                          backgroundColor: task.color || '#10b981',
                        }}
                      />
                    </div>
                  </div>
                  {task.budget > 0 && (
                    <div className="task-budget">
                      <Euro size={13} />
                      <span>
                        {task.budget.toLocaleString('fr-FR', {
                          maximumFractionDigits: 0,
                        })}{' '}
                        €
                      </span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </aside>
  );
}

function RiskDetailCard({ risk, cotationMode, isHighlighted, onHoverRisk }) {
  const evalData = risk.latestEvaluation || {};
  const activeScale =
    cotationMode === 'brute' ? risk.scaleBrute : risk.scaleResiduelle;
  const activeScore =
    cotationMode === 'brute' ? risk.cotationBrute : risk.cotationResiduelle;
  const hasReduction = risk.cotationResiduelle < risk.cotationBrute;

  return (
    <div
      className={`risk-card ${isHighlighted ? 'highlighted' : ''}`}
      style={{ borderLeftColor: activeScale.borderBadge || activeScale.color }}
      onMouseEnter={() => onHoverRisk && onHoverRisk(risk)}
      onClick={() => onHoverRisk && onHoverRisk(risk)}
    >
      <div className="risk-card-header">
        <div className="risk-category-info">
          {risk.categoryIcon ? (
            <img
              src={risk.categoryIcon}
              alt={risk.categoryName}
              className="inrs-picto"
              onError={(e) => {
                e.currentTarget.style.display = 'none';
              }}
            />
          ) : (
            <div className="inrs-picto-fallback">
              <AlertTriangle size={18} />
            </div>
          )}
          <div>
            <div className="risk-ref-line">
              <span className="risk-ref-tag">{risk.ref}</span>
              <span className="eval-ref-tag">{evalData.ref}</span>
              <span className="eval-method-tag">{evalData.method}</span>
            </div>
            <h4 className="risk-cat-title">{risk.categoryName}</h4>
          </div>
        </div>

        {/* Badge de Cotation (0-100) */}
        <div
          className="risk-score-box"
          style={{
            backgroundColor: activeScale.bgBadge || activeScale.color,
            borderColor: activeScale.borderBadge || activeScale.color,
            color: activeScale.scoreTextColor || activeScale.color,
          }}
        >
          <span className="score-num">{activeScore}</span>
          <span className="score-max">/100</span>
        </div>
      </div>

      {/* Photo du risque (issue de l'évaluation RA) + Description */}
      {(risk.photoUrl || risk.description) && (
        <div className="risk-media-row">
          {risk.photoUrl && (
            <div className="risk-photo-wrapper">
              <img
                src={risk.photoUrl}
                alt={`Photo ${risk.ref}`}
                className="risk-photo-thumb"
                loading="lazy"
                onError={(e) => {
                  const fallback = risk.photoFallbackPath
                    ? `./api-proxy.php?photo=${encodeURIComponent(risk.photoFallbackPath)}`
                    : null;
                  if (fallback && !e.currentTarget.dataset.retried) {
                    e.currentTarget.dataset.retried = '1';
                    e.currentTarget.src = fallback;
                  } else {
                    e.currentTarget.parentElement.style.display = 'none';
                  }
                }}
              />
            </div>
          )}
          {risk.description && (
            <p className="risk-desc-text">{risk.description}</p>
          )}
        </div>
      )}

      {/* 5 Critères d'évaluation avancée DigiRisk */}
      {evalData.method === 'advanced' && (
        <div className="criteria-grid">
          <CriterionBar label="Gravité" value={evalData.gravite} max={4} />
          <CriterionBar label="Exposition" value={evalData.exposition} max={4} />
          <CriterionBar label="Occurrence" value={evalData.occurrence} max={4} />
          <CriterionBar label="Formation" value={evalData.formation} max={4} />
          <CriterionBar label="Protection" value={evalData.protection} max={4} />
        </div>
      )}

      {/* Commentaire de l'évaluateur */}
      {evalData.comment && (
        <div className="evaluator-comment">
          <MessageSquare size={13} />
          <span>{evalData.comment}</span>
        </div>
      )}

      {/* Actions correctives rattachées à ce risque */}
      {risk.tasks?.length > 0 && (
        <div className="risk-inline-tasks">
          <div className="inline-tasks-title">
            <Sliders size={12} /> Plan d’actions associé ({risk.tasks.length})
          </div>
          {risk.tasks.map((t) => (
            <div key={t.id} className="inline-task-item">
              <span className="inline-task-ref">{t.ref}</span>
              <span className="inline-task-label">{t.label}</span>
              <span className="inline-task-pct">{t.progress}%</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function CriterionBar({ label, value = 1, max = 4 }) {
  const pct = Math.min(100, Math.round((value / max) * 100));
  return (
    <div className="criterion-item">
      <div className="criterion-top">
        <span>{label}</span>
        <strong>
          {value}/{max}
        </strong>
      </div>
      <div className="criterion-track">
        <div
          className="criterion-fill"
          style={{
            width: `${pct}%`,
            backgroundColor:
              value >= 4 ? '#ef4444' : value === 3 ? '#f97316' : '#38bdf8',
          }}
        />
      </div>
    </div>
  );
}
