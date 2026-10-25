import React, { useState } from 'react';
import {
  Box,
  Layers,
  RefreshCw,
  ShieldAlert,
  Users,
  Route,
  Compass,
  KeyRound,
  CheckCircle2,
  Database,
  Eye,
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
}) {
  const [showApiPopover, setShowApiPopover] = useState(false);

  const isLive = data?.connectionMode === 'live';

  return (
    <header className="top-hud">
      {/* Bloc Identité & Statut API DigiRisk */}
      <div className="hud-brand">
        <div className="brand-logo">
          <ShieldAlert size={20} />
        </div>
        <div>
          <div className="brand-title-row">
            <h1>DigiRiskGame</h1>
            <span className={`api-status-badge ${isLive ? 'live' : 'snapshot'}`}>
              {isLive ? (
                <>
                  <CheckCircle2 size={12} /> API Live (demodoli.digirisk.com)
                </>
              ) : (
                <>
                  <Database size={12} /> Snapshot DigiRisk
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

      {/* Contrôles de rendu 3D & Logique Métier */}
      <div className="hud-controls">
        {/* Bascule Étape 2 (Boîtes blanches) / Étape 3 (Assets 3D) */}
        <div className="control-pill-group" title="Basculer entre Boîtes Blanches (Étape 2) et Assets 3D (Étape 3)">
          <button
            type="button"
            className={`hud-btn ${visualMode === 'whitebox' ? 'active' : ''}`}
            onClick={() => setVisualMode('whitebox')}
          >
            <Box size={15} />
            <span>Boîtes Blanches</span>
          </button>
          <button
            type="button"
            className={`hud-btn ${visualMode === 'detailed' ? 'active' : ''}`}
            onClick={() => setVisualMode('detailed')}
          >
            <Layers size={15} />
            <span>Assets 3D</span>
          </button>
        </div>

        {/* Bascule Cotation Résiduelle / Brute */}
        <div className="control-pill-group" title="Type de cotation affiché sur les ateliers">
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
          <Users size={15} />
          <span>Agents</span>
        </button>

        <button
          type="button"
          className={`hud-btn icon-toggle ${showPaths ? 'active' : ''}`}
          onClick={() => setShowPaths(!showPaths)}
          title="Afficher / Masquer les splines de déplacement entre UT"
        >
          <Route size={15} />
          <span>Flux</span>
        </button>

        <button
          type="button"
          className={`hud-btn icon-toggle ${showRoof ? 'active' : ''}`}
          onClick={() => setShowRoof(!showRoof)}
          title="Afficher / Masquer les toitures des bâtiments"
        >
          <Eye size={15} />
          <span>Toits</span>
        </button>

        {/* Recentrage Caméra */}
        <button
          type="button"
          className="hud-btn"
          onClick={onResetCamera}
          title="Recentrer la caméra sur l'ensemble du site"
        >
          <Compass size={15} />
          <span>Vue Campus</span>
        </button>

        {/* Configuration Clé API & Synchronisation */}
        <div className="api-config-wrapper">
          <button
            type="button"
            className="hud-btn"
            onClick={() => setShowApiPopover(!showApiPopover)}
            title="Configurer la clé DOLAPIKEY ou synchroniser l'API"
          >
            <KeyRound size={15} />
          </button>
          <button
            type="button"
            className="hud-btn primary-sync"
            onClick={() => onRefreshApi(false)}
            disabled={loading}
            title="Rafraîchir depuis demodoli.digirisk.com"
          >
            <RefreshCw size={15} className={loading ? 'spin' : ''} />
            <span>Sync API</span>
          </button>

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
                  type="text"
                  value={apiKey}
                  onChange={(e) => setApiKey(e.target.value)}
                  placeholder="Votre clé DOLAPIKEY"
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
        </div>
      </div>
    </header>
  );
}
