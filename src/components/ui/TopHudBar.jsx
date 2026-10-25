import React, { useState } from 'react';
import {
  Box,
  Layers,
  RefreshCw,
  Users,
  Route,
  Compass,
  KeyRound,
  CheckCircle2,
  Database,
  Eye,
  FolderTree,
} from 'lucide-react';

export default function TopHudBar({
  data,
  loading,
  visualMode,
  setVisualMode,
  cotationMode,
  setCotationMode,
  agentsEnabled,
  setAgentsEnabled,
  showPaths,
  setShowPaths,
  showRoof,
  setShowRoof,
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
                  <span className="status-text-full">API Live (demodoli.digirisk.com)</span>
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

      {/* Contrôles de rendu 3D & Logique Métier (scrollables horizontalement sur mobile) */}
      <div className="hud-controls">
        {/* Bascule Étape 2 (Boîtes blanches) / Étape 3 (Assets 3D) */}
        <div
          className="control-pill-group"
          title="Basculer entre Boîtes Blanches (Étape 2) et Assets 3D (Étape 3)"
        >
          <button
            type="button"
            className={`hud-btn ${visualMode === 'whitebox' ? 'active' : ''}`}
            onClick={() => setVisualMode('whitebox')}
          >
            <Box size={14} />
            <span>Boîtes Blanches</span>
          </button>
          <button
            type="button"
            className={`hud-btn ${visualMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setVisualMode('detailed')}
          >
            <Layers size={14} />
            <span>Assets 3D</span>
          </button>
        </div>

        {/* Bascule Cotation Résiduelle / Brute */}
        <div
          className="control-pill-group"
          title="Type de cotation affiché sur les ateliers"
        >
          <button
            type="button"
            className={`hud-btn ${cotationMode === 'residuelle' ? 'active' : ''}`}
            onClick={() => setCotationMode('residuelle')}
          >
            <span>Cot. Résiduelle</span>
          </button>
          <button
            type="button"
            className={`hud-btn ${cotationMode === 'brute' ? 'active' : ''}`}
            onClick={() => setCotationMode('brute')}
          >
            <span>Cot. Brute</span>
          </button>
        </div>

        {/* Options Cinématique des Flux (Étape 4) & Toiture */}
        <button
          type="button"
          className={`hud-btn icon-toggle ${agentsEnabled ? 'active' : ''}`}
          onClick={() => setAgentsEnabled(!agentsEnabled)}
          title="Afficher / Masquer les opérateurs animés (Étape 4)"
        >
          <Users size={14} />
          <span>Agents</span>
        </button>

        <button
          type="button"
          className={`hud-btn icon-toggle ${showPaths ? 'active' : ''}`}
          onClick={() => setShowPaths(!showPaths)}
          title="Afficher / Masquer les splines de déplacement entre UT"
        >
          <Route size={14} />
          <span>Flux</span>
        </button>

        <button
          type="button"
          className={`hud-btn icon-toggle ${showRoof ? 'active' : ''}`}
          onClick={() => setShowRoof(!showRoof)}
          title="Afficher / Masquer les toitures des bâtiments"
        >
          <Eye size={14} />
          <span>Toits</span>
        </button>

        {/* Recentrage Caméra */}
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
            title="Rafraîchir depuis demodoli.digirisk.com"
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
              value="https://demodoli.digirisk.com/htdocs/api/index.php"
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
