import React, { useEffect, useState, useCallback } from 'react';
import { loadDigiRiskData } from './services/digiriskApi';
import DigitalTwinCanvas from './components/3d/DigitalTwinCanvas';
import TopHudBar from './components/ui/TopHudBar';
import HierarchyNavigator from './components/ui/HierarchyNavigator';
import RiskSidebar from './components/ui/RiskSidebar';

export default function App() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [apiKey, setApiKey] = useState(
    import.meta.env.VITE_DOLAPIKEY || ''
  );

  // Modes d'affichage 3D et métier
  const [visualMode, setVisualMode] = useState('detailed'); // 'detailed' (Étape 3) | 'whitebox' (Étape 2)
  const [cotationMode, setCotationMode] = useState('residuelle'); // 'residuelle' | 'brute'
  const [agentsEnabled, setAgentsEnabled] = useState(true);
  const [showPaths, setShowPaths] = useState(true);
  const [showRoof, setShowRoof] = useState(false);

  // Sélection & Caméra
  const [selectedElement, setSelectedElement] = useState(null);
  const [cameraTarget, setCameraTarget] = useState({ type: 'overview' });

  const fetchTwinData = useCallback(
    async (forceSnapshot = false) => {
      setLoading(true);
      const result = await loadDigiRiskData({ apiKey, forceSnapshot });
      setData(result);
      setLoading(false);

      // Sélectionner par défaut l'atelier le plus critique (UT14 Soudeurs - 100/100) au premier chargement
      setSelectedElement((prev) => {
        if (prev) return prev;
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
    if (!element) return;

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

  return (
    <div className="app-shell">
      {/* Barre supérieure HUD */}
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
      />

      {/* Scène WebGL 3D (React Three Fiber) */}
      <DigitalTwinCanvas
        data={data}
        visualMode={visualMode}
        cotationMode={cotationMode}
        selectedElement={selectedElement}
        onSelectElement={handleSelectElement}
        showPaths={showPaths}
        agentsEnabled={agentsEnabled}
        agentSpeed={1}
        showRoof={showRoof}
        cameraTarget={cameraTarget}
      />

      {/* Explorateur Arborescent (Groupements > Unités de Travail) */}
      <HierarchyNavigator
        data={data}
        cotationMode={cotationMode}
        selectedElement={selectedElement}
        onSelectElement={handleSelectElement}
      />

      {/* Panneau latéral droit : Détail des Risques INRS & Plan d'Actions */}
      <RiskSidebar
        selectedElement={selectedElement}
        cotationMode={cotationMode}
        onClose={() => setSelectedElement(null)}
        onSelectElement={handleSelectElement}
      />
    </div>
  );
}
