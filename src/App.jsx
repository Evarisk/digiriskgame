import React, { useEffect, useState, useCallback } from 'react';
import { loadDigiRiskData } from './services/digiriskApi';
import DigitalTwinCanvas from './components/3d/DigitalTwinCanvas';
import TopHudBar from './components/ui/TopHudBar';
import HierarchyNavigator from './components/ui/HierarchyNavigator';
import RiskSidebar from './components/ui/RiskSidebar';
import ExplorerHud from './components/ui/ExplorerHud';
import { explorerStore, useExplorer, EXPLORER_SUPPORTED } from './components/3d/explorer/explorerStore';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState('');

  // Modes d'affichage 3D et métier
  const [visualMode, setVisualMode] = useState('detailed'); // 'detailed' (Étape 3) | 'whitebox' (Étape 2)
  const [cotationMode, setCotationMode] = useState('residuelle'); // 'residuelle' | 'brute'
  const [agentsEnabled, setAgentsEnabled] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showRoof, setShowRoof] = useState(false);

  // État d'ouverture de l'arborescence à gauche (fermée par défaut sur mobile)
  const [treeCollapsed, setTreeCollapsed] = useState(
    () => typeof window !== 'undefined' && window.innerWidth < 960
  );

  // Sélection & Caméra
  const [selectedElement, setSelectedElement] = useState(null);
  const [activeRisk, setActiveRisk] = useState(null);
  const [cameraTarget, setCameraTarget] = useState({ type: 'overview' });

  // Visite en première personne : UT déjà inspectées et capture de la souris (jeu en cours)
  const [explorerMode, setExplorerMode] = useState(false);
  const [inspectedIds, setInspectedIds] = useState(() => new Set());
  const explorerLocked = useExplorer((s) => s.locked);
  const playing = explorerMode && explorerLocked;

  const fetchTwinData = useCallback(
    async (forceSnapshot = false) => {
      setLoading(true);
      const result = await loadDigiRiskData({ apiKey, forceSnapshot });
      setData(result);
      setLoading(false);

      // Sur grand écran uniquement, sélectionner UT14 par défaut au premier chargement
      setSelectedElement((prev) => {
        if (prev) return prev;
        if (typeof window !== 'undefined' && window.innerWidth < 960) {
          return null;
        }
        const criticalUt = result.allWorkUnitsWorld?.find(
          (u) => u.ref === 'UT14'
        );
        return criticalUt || result.allWorkUnitsWorld?.[0] || null;
      });
    },
    [apiKey]
  );

  useEffect(() => {
    fetchTwinData(false);
  }, [fetchTwinData]);

  const handleSelectElement = (element) => {
    setSelectedElement(element);
    setActiveRisk(null);
    if (!element) return;

    // Sur mobile/tablette, refermer l'arborescence quand on sélectionne un atelier
    if (typeof window !== 'undefined' && window.innerWidth < 960) {
      setTreeCollapsed(true);
    }

    if (element.elementType === 'workunit' && element.layout3D?.worldPosition) {
      setCameraTarget({
        type: 'focus',
        isBuilding: false,
        position: element.layout3D.worldPosition,
        ts: Date.now(),
      });
    } else if (element.elementType === 'groupment' && element.layout3D?.position) {
      setCameraTarget({
        type: 'focus',
        isBuilding: true,
        position: element.layout3D.position,
        ts: Date.now(),
      });
    } else {
      setCameraTarget({ type: 'overview', ts: Date.now() });
    }
  };

  const handleResetCamera = () => {
    setCameraTarget({ type: 'overview', ts: Date.now() });
  };

  // Inspection depuis la visite : ouvre la fiche sans déplacer le joueur
  const handleInspect = (element) => {
    setSelectedElement(element);
    setActiveRisk(null);
    if (element.elementType === 'workunit') {
      setInspectedIds((prev) => (prev.has(element.id) ? prev : new Set(prev).add(element.id)));
    }
  };

  const handleToggleExplorer = () => {
    if (explorerMode) {
      explorerStore.releaseLock();
      setExplorerMode(false);
      setCameraTarget({ type: 'overview', ts: Date.now() });
      return;
    }
    setExplorerMode(true);
    // Capture immédiate de la souris (le clic sur le bouton est le geste utilisateur requis)
    explorerStore.requestLock();
  };

  return (
    <div className="app-shell">
      {/* Barre supérieure HUD (ne chevauche jamais les panneaux latéraux) */}
      <TopHudBar
        data={data}
        loading={loading}
        visualMode={visualMode}
        setVisualMode={setVisualMode}
        cotationMode={cotationMode}
        setCotationMode={setCotationMode}
        agentsEnabled={agentsEnabled}
        setAgentsEnabled={setAgentsEnabled}
        showPaths={showPaths}
        setShowPaths={setShowPaths}
        showRoof={showRoof}
        setShowRoof={setShowRoof}
        onResetCamera={handleResetCamera}
        onRefreshApi={fetchTwinData}
        apiKey={apiKey}
        setApiKey={setApiKey}
        treeCollapsed={treeCollapsed}
        setTreeCollapsed={setTreeCollapsed}
        explorerMode={explorerMode}
        explorerSupported={EXPLORER_SUPPORTED}
        onToggleExplorer={handleToggleExplorer}
      />

      {/* Zone principale 3D + Panneaux latéraux positionnés sous le bandeau */}
      <div className="stage-container">
        <DigitalTwinCanvas
          data={data}
          visualMode={visualMode}
          cotationMode={cotationMode}
          selectedElement={selectedElement}
          activeRisk={activeRisk}
          onSelectElement={handleSelectElement}
          showPaths={showPaths}
          agentsEnabled={agentsEnabled}
          agentSpeed={1}
          showRoof={showRoof}
          cameraTarget={cameraTarget}
          explorerMode={explorerMode}
          inspectedIds={inspectedIds}
          onInspect={handleInspect}
        />

        {/* HUD de la visite en première personne */}
        {explorerMode && (
          <ExplorerHud
            data={data}
            cotationMode={cotationMode}
            inspectedIds={inspectedIds}
            hasSelection={Boolean(selectedElement)}
            onExit={handleToggleExplorer}
          />
        )}

        {/* Panneaux masqués pendant la visite (souris capturée), visibles en pause */}
        {!playing && (
          <>
            {/* Explorateur Arborescent (Groupements > Unités de Travail) */}
            <HierarchyNavigator
              data={data}
              cotationMode={cotationMode}
              selectedElement={selectedElement}
              onSelectElement={handleSelectElement}
              collapsed={treeCollapsed}
              setCollapsed={setTreeCollapsed}
            />

            {/* Panneau latéral droit : Détail des Risques INRS & Plan d'Actions */}
            <RiskSidebar
              selectedElement={selectedElement}
              cotationMode={cotationMode}
              activeRisk={activeRisk}
              onHoverRisk={setActiveRisk}
              onClose={() => {
                setSelectedElement(null);
                setActiveRisk(null);
              }}
              onSelectElement={handleSelectElement}
            />
          </>
        )}
      </div>
    </div>
  );
}
