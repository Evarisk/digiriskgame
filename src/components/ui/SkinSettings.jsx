import React, { useState } from 'react';
import { Palette, RotateCcw, X } from 'lucide-react';
import {
  BUILDING_LABELS,
  BUILDING_SKINS,
  WORKUNIT_SKIN_GROUPS,
  WORKUNIT_SKIN_LABELS,
  buildingSkinLabel,
} from '../../services/skins';

/**
 * Paramètres · Skins 3D : choix du skin de chaque Groupement (enveloppe + finition) et de chaque
 * Unité de Travail (modèle de poste). « Auto » reprend l'archétype déduit du libellé DigiRisk.
 */
export default function SkinSettings({ data, skins, onChange, onReset, onFocus, onClose, cotationMode }) {
  const [tab, setTab] = useState('gp');
  const buildings = data?.buildings || [];
  const utCount = buildings.reduce((n, b) => n + b.children.length, 0);
  const customCount = Object.keys(skins).length;

  const setSkin = (id, value) => onChange(id, value === 'auto' ? null : value);

  const scaleOf = (el) => (cotationMode === 'brute' ? el.stats.scaleBrute : el.stats.scaleResiduelle);

  return (
    <div className="skin-settings" role="dialog" aria-label="Paramètres des skins 3D">
      <div className="skin-settings-header">
        <Palette size={16} />
        <h4>Paramètres · Skins 3D</h4>
        <button type="button" className="skin-close" onClick={onClose} title="Fermer">
          <X size={16} />
        </button>
      </div>
      <p className="skin-settings-help">
        Choisissez l’apparence de chaque groupement (bâtiment) et de chaque unité de travail (poste). « Auto » suit le
        libellé DigiRisk. Les choix sont mémorisés dans ce navigateur.
      </p>

      <div className="skin-tabs">
        <button type="button" className={tab === 'gp' ? 'active' : ''} onClick={() => setTab('gp')}>
          Groupements ({buildings.length})
        </button>
        <button type="button" className={tab === 'ut' ? 'active' : ''} onClick={() => setTab('ut')}>
          Unités de travail ({utCount})
        </button>
      </div>

      <div className="skin-list">
        {tab === 'gp' &&
          buildings.map((b) => {
            const custom = skins[b.id];
            const autoArchetype = b.layout3D.autoArchetype || b.layout3D.archetype;
            return (
              <div key={b.id} className={`skin-row ${custom ? 'custom' : ''}`}>
                <button
                  type="button"
                  className="skin-ref"
                  style={{ background: b.layout3D.themeColor }}
                  onClick={() => onFocus(b)}
                  title="Centrer la vue sur ce groupement"
                >
                  {b.ref}
                </button>
                <span className="skin-label" title={b.label}>
                  {b.label}
                </span>
                <select value={custom || 'auto'} onChange={(e) => setSkin(b.id, e.target.value)}>
                  <option value="auto">Auto · {buildingSkinLabel(autoArchetype)}</option>
                  {Object.entries(BUILDING_LABELS).map(([archetype, label]) => (
                    <optgroup key={archetype} label={label}>
                      {BUILDING_SKINS.filter((s) => s.archetype === archetype).map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.label}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
              </div>
            );
          })}

        {tab === 'ut' &&
          buildings.map((b) => (
            <div key={b.id} className="skin-group">
              <div className="skin-group-title">
                <span style={{ background: b.layout3D.themeColor }} />
                {b.ref} · {b.label}
              </div>
              {b.children.map((ut) => {
                const custom = skins[ut.id];
                const scale = scaleOf(ut);
                return (
                  <div key={ut.id} className={`skin-row ${custom ? 'custom' : ''}`}>
                    <button
                      type="button"
                      className="skin-ref"
                      style={{ background: scale.color, color: scale.textColor, borderColor: scale.borderBadge }}
                      onClick={() => onFocus(ut)}
                      title="Centrer la vue sur cette unité de travail"
                    >
                      {ut.ref}
                    </button>
                    <span className="skin-label" title={ut.label}>
                      {ut.label}
                    </span>
                    <select value={custom || 'auto'} onChange={(e) => setSkin(ut.id, e.target.value)}>
                      <option value="auto">Auto · {WORKUNIT_SKIN_LABELS[ut.autoArchetype] || ut.autoArchetype}</option>
                      {WORKUNIT_SKIN_GROUPS.map((group) => (
                        <optgroup key={group.label} label={group.label}>
                          {group.skins.map(([id, label]) => (
                            <option key={id} value={id}>
                              {label}
                            </option>
                          ))}
                        </optgroup>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          ))}
      </div>

      <div className="skin-settings-footer">
        <span>
          {customCount} skin{customCount > 1 ? 's' : ''} personnalisé{customCount > 1 ? 's' : ''}
        </span>
        <button type="button" className="hud-btn icon-toggle" onClick={onReset} disabled={!customCount}>
          <RotateCcw size={13} />
          <span>Tout remettre en Auto</span>
        </button>
      </div>
    </div>
  );
}
