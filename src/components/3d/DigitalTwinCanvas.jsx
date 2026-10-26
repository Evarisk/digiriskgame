import React, { useRef, useEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Environment, Lightformer } from '@react-three/drei';
import BuildingGroup from './BuildingGroup';
import WorkerAgents from './WorkerAgents';
import CampusScenery from './CampusScenery';
import { getTexture } from './models/textures';
import FirstPersonExplorer from './explorer/FirstPersonExplorer';
import { explorerStore } from './explorer/explorerStore';

export default function DigitalTwinCanvas({
  data,
  visualMode,
  cotationMode,
  selectedElement,
  activeRisk,
  onSelectElement,
  showPaths,
  agentsEnabled,
  agentSpeed,
  showRoof,
  cameraTarget,
  explorerMode = false,
  inspectedIds,
  onInspect,
}) {
  const showLabels = !explorerMode;
  return (
    <div className="canvas-wrapper">
      <Canvas
        shadows
        camera={{ position: [0, 34, 42], fov: 45, near: 0.5, far: 250 }}
        onCreated={({ gl }) => {
          explorerStore.canvas = gl.domElement;
        }}
        onPointerMissed={() => !explorerMode && onSelectElement(null)}
      >
        <color
          attach="background"
          args={[visualMode === 'whitebox' ? '#f1f5f9' : '#090d16']}
        />
        <fog
          attach="fog"
          args={[visualMode === 'whitebox' ? '#f1f5f9' : '#090d16', 55, 135]}
        />

        {/* Éclairage directionnel & ambiant */}
        <ambientLight intensity={visualMode === 'whitebox' ? 0.85 : 0.55} />
        <directionalLight
          castShadow
          position={[28, 42, 24]}
          intensity={visualMode === 'whitebox' ? 1.1 : 1.35}
          shadow-mapSize={[2048, 2048]}
          shadow-camera-left={-45}
          shadow-camera-right={45}
          shadow-camera-top={45}
          shadow-camera-bottom={-45}
        />
        <hemisphereLight
          skyColor="#38bdf8"
          groundColor="#0f172a"
          intensity={0.35}
        />

        {/* Reflets d'environnement (calculés une seule fois, sans ressource réseau) */}
        {visualMode !== 'whitebox' && <StudioEnvironment />}

        {/* Contrôleur de caméra fluide vers l'élément sélectionné */}
        {explorerMode ? (
          /* Visite en première personne (remplace la caméra orbitale) */
          <FirstPersonExplorer
            data={data}
            cameraTarget={cameraTarget}
            cotationMode={cotationMode}
            inspectedIds={inspectedIds}
            onInspect={onInspect}
          />
        ) : (
          <CameraNavigator cameraTarget={cameraTarget} />
        )}

        {/* Sol industriel, voirie & Totem central GP5 */}
        <CampusGround
          visualMode={visualMode}
          buildings={data?.buildings}
          companyName={data?.entityName}
          companyLogo={data?.entityLogo}
          rootEntity={data?.rootEntity}
          isSelected={selectedElement?.id === data?.rootEntity?.id}
          onSelectRoot={() => data?.rootEntity && onSelectElement(data.rootEntity)}
          showLabels={showLabels}
        />

        {/* Bâtiments (Groupements GP1..GP4) & Ateliers (Unités de Travail UT1..UT18) */}
        {(data?.buildings || []).map((building) => (
          <BuildingGroup
            key={building.id}
            building={building}
            visualMode={visualMode}
            cotationMode={cotationMode}
            selectedElement={selectedElement}
            activeRisk={activeRisk}
            onSelectElement={onSelectElement}
            showRoof={showRoof}
            showLabels={showLabels}
          />
        ))}

        {/* Flux cinématiques d'opérateurs entre les Unités de Travail */}
        <WorkerAgents
          allWorkUnits={data?.allWorkUnitsWorld || []}
          showPaths={showPaths}
          agentsEnabled={agentsEnabled}
          speedMultiplier={agentSpeed}
          onSelectUt={onSelectElement}
          showLabels={showLabels}
        />
      </Canvas>
    </div>
  );
}

export function StudioEnvironment() {
  return (
    <Environment resolution={128} frames={1} environmentIntensity={0.55}>
      <Lightformer intensity={1.4} position={[0, 12, 0]} rotation-x={Math.PI / 2} scale={[40, 40, 1]} color="#e2e8f0" />
      <Lightformer intensity={0.8} position={[24, 6, 12]} rotation-y={-Math.PI / 2} scale={[24, 6, 1]} color="#93c5fd" />
      <Lightformer intensity={0.6} position={[-24, 6, -12]} rotation-y={Math.PI / 2} scale={[24, 6, 1]} color="#fde68a" />
    </Environment>
  );
}

function CameraNavigator({ cameraTarget }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCameraPos = useRef(null);

  useEffect(() => {
    if (!cameraTarget) return;
    if (cameraTarget.type === 'overview') {
      desiredTarget.current.set(0, 0, 0);
      desiredCameraPos.current = new THREE.Vector3(0, 34, 42);
    } else if (cameraTarget.position) {
      const [x, y, z] = cameraTarget.position;
      desiredTarget.current.set(x, y, z);
      const offsetDist = cameraTarget.isBuilding ? 22 : 13;
      const offsetHeight = cameraTarget.isBuilding ? 16 : 9.5;
      desiredCameraPos.current = new THREE.Vector3(
        x + offsetDist * 0.45,
        y + offsetHeight,
        z + offsetDist
      );
    }
  }, [cameraTarget]);

  useFrame(() => {
    if (!controlsRef.current) return;
    controlsRef.current.target.lerp(desiredTarget.current, 0.08);
    if (desiredCameraPos.current) {
      camera.position.lerp(desiredCameraPos.current, 0.07);
      if (camera.position.distanceTo(desiredCameraPos.current) < 0.35) {
        desiredCameraPos.current = null;
      }
    }
    controlsRef.current.update();
  });

  return (
    <OrbitControls
      ref={controlsRef}
      makeDefault
      enableDamping
      dampingFactor={0.07}
      maxPolarAngle={Math.PI / 2 - 0.04}
      minDistance={5}
      maxDistance={85}
    />
  );
}

function CampusGround({ visualMode, buildings, companyName, companyLogo, rootEntity, isSelected, onSelectRoot, showLabels }) {
  return (
    <group>
      {/* Terrain autour du site industriel (l'enceinte pavée est dessinée par CampusScenery) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, -0.02, 0]}
        receiveShadow
      >
        <planeGeometry args={[160, 160]} />
        <meshStandardMaterial
          color={visualMode === 'whitebox' ? '#e2e8f0' : '#ffffff'}
          map={visualMode === 'whitebox' ? null : getTexture('grass', 40, 40)}
          roughness={0.9}
        />
      </mesh>

      {/* Grille métrique de référence */}
      <Grid
        position={[0, 0.01, 0]}
        args={[90, 90]}
        cellSize={2}
        cellThickness={0.6}
        cellColor={visualMode === 'whitebox' ? '#cbd5e1' : '#1e293b'}
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor={visualMode === 'whitebox' ? '#94a3b8' : '#334155'}
        fadeDistance={85}
        fadeStrength={1}
      />

      {/* Voirie, rond-point, éclairage, végétation et clôture d'enceinte */}
      {visualMode !== 'whitebox' && (
        <CampusScenery buildings={buildings} companyName={companyName} companyLogo={companyLogo} />
      )}

      {/* Totem Central de l'Entité Mère (GP5 Industrie Standard) */}
      {rootEntity && (
        <group
          position={[0, 0, 0]}
          onClick={(e) => {
            e.stopPropagation();
            onSelectRoot();
          }}
        >
          <mesh position={[0, 0.18, 0]} receiveShadow castShadow>
            <cylinderGeometry args={[2.8, 3.2, 0.36, 32]} />
            <meshStandardMaterial
              color={isSelected ? '#38bdf8' : '#1e293b'}
              metalness={0.5}
              roughness={0.3}
            />
          </mesh>
          <mesh position={[0, 1.35, 0]} castShadow>
            <octahedronGeometry args={[0.75, 0]} />
            <meshStandardMaterial
              color="#38bdf8"
              emissive="#0284c7"
              emissiveIntensity={0.8}
              wireframe={visualMode === 'whitebox'}
            />
          </mesh>
          {showLabels && (
            <Html position={[0, 2.65, 0]} center distanceFactor={30} zIndexRange={[15, 0]}>
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  onSelectRoot();
                }}
                className={`hq-totem-badge ${isSelected ? 'selected' : ''}`}
              >
                <span className="hq-ref">{rootEntity.ref}</span>
                <span className="hq-label">{rootEntity.label}</span>
              </div>
            </Html>
          )}
        </group>
      )}
    </group>
  );
}
