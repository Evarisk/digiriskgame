import React, { useState } from 'react';
import {
  RefreshCw,
  Users,
  Route,
  Compass,
  KeyRound,
  CheckCircle2,
  Database,
  FolderTree,
} from 'lucide-react';
import { API_BASE_URL, API_HOST_LABEL } from '../../services/digiriskApi';

export default function TopHudBar({
  data,
  loading,
  agentsEnabled,
  setAgentsEnabled,
  showPaths,
  setShowPaths,
  onResetCamera,
  onRefreshApi,
  apiKey,
  setApiKey,
  treeCollapsed,
  setTreeCollapsed,
}) {
  const [showApiPopover, setShowApiPopover] = useState(false);

  const isLive = data?.connectionMode === 'live';

  return (
    <header className="top-hud">
      {/* Bloc Identité & Statut API DigiRisk */}
      <div className="hud-brand">
        <button
          type="button"
          className={`hud-btn mobile-tree-btn ${!treeCollapsed ? 'active' : ''}`}
          onClick={() => setTreeCollapsed(!treeCollapsed)}
          title="Afficher / Masquer l'arborescence DUER"
        >
          <FolderTree size={16} />
        </button>

        <div className="brand-logo">
          <img
            src="./digirisk-logo.png"
            alt="Logo DigiRisk"
            className="brand-logo-img"
          />
        </div>
        <div className="brand-text">
          <div className="brand-title-row">
            <h1>DigiRiskGame</h1>
            <span className={`api-status-badge ${isLive ? 'live' : 'snapshot'}`}>
              {isLive ? (
                <>
                  <CheckCircle2 size={12} />
                  <span className="status-text-full">API Live ({API_HOST_LABEL})</span>
                  <span className="status-text-short">Live</span>
                </>
              ) : (
                <>
                  <Database size={12} />
                  <span className="status-text-full">Snapshot DigiRisk</span>
                  <span className="status-text-short">Snapshot</span>
                </>
              )}
            </span>
          </div>
          <p className="brand-subtitle">
            {data?.entityName || 'Chargement...'} • {data?.totalElements || 0} éléments •{' '}
            {data?.totalRisks || 0} risques INRS • {data?.totalTasks || 0} actions
          </p>
        </div>
      </div>

      {/* Contrôles de scène épurés */}
      <div className="hud-controls">
        <button
          type="button"
          className={`hud-btn icon-toggle ${agentsEnabled ? 'active' : ''}`}
          onClick={() => setAgentsEnabled(!agentsEnabled)}
          title="Afficher / Masquer les opérateurs animés"
        >
          <Users size={14} />
          <span>Agents</span>
        </button>

        <button
          type="button"
          className={`hud-btn icon-toggle ${showPaths ? 'active' : ''}`}
          onClick={() => setShowPaths(!showPaths)}
          title="Afficher / Masquer les trajectoires entre UT"
        >
          <Route size={14} />
          <span>Flux</span>
        </button>

        <button
          type="button"
          className="hud-btn icon-toggle"
          onClick={onResetCamera}
          title="Recentrer la caméra sur l'ensemble du site"
        >
          <Compass size={14} />
          <span>Vue Campus</span>
        </button>

        {/* Configuration Clé API & Synchronisation */}
        <div className="api-config-wrapper">
          <button
            type="button"
            className="hud-btn icon-toggle"
            onClick={() => setShowApiPopover(!showApiPopover)}
            title="Configurer la clé DOLAPIKEY ou synchroniser l'API"
          >
            <KeyRound size={14} />
          </button>
          <button
            type="button"
            className="hud-btn primary-sync"
            onClick={() => onRefreshApi(false)}
            disabled={loading}
            title={`Rafraîchir depuis ${API_HOST_LABEL}`}
          >
            <RefreshCw size={14} className={loading ? 'spin' : ''} />
            <span>Sync API</span>
          </button>
        </div>
      </div>

      {showApiPopover && (
        <div className="api-popover">
          <h4>Connexion REST Dolibarr / DigiRisk</h4>
          <label>
            Endpoint
            <input
              type="text"
              readOnly
              value={API_BASE_URL}
            />
          </label>
          <label>
            Clé API (DOLAPIKEY)
            <input
              type="password"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Gérée par le serveur (.env) ou saisir ici"
            />
          </label>
          <div className="popover-actions">
            <button
              type="button"
              className="hud-btn"
              onClick={() => {
                onRefreshApi(true);
                setShowApiPopover(false);
              }}
            >
              Mode Snapshot
            </button>
            <button
              type="button"
              className="hud-btn primary-sync"
              onClick={() => {
                onRefreshApi(false);
                setShowApiPopover(false);
              }}
            >
              Tester & Charger Live
            </button>
          </div>
        </div>
      )}
    </header>
  );
}
