import React, { useRef, useEffect, useLayoutEffect } from 'react';
import * as THREE from 'three';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Grid, Html, Environment, Lightformer } from '@react-three/drei';
import BuildingGroup from './BuildingGroup';
import WorkerAgents from './WorkerAgents';
import DeliveryTrucks from './DeliveryTrucks';
import CampusScenery from './CampusScenery';
import SkyDome, { SKY_HORIZON } from './SkyDome';
import { getTexture } from './models/textures';
import FirstPersonExplorer from './explorer/FirstPersonExplorer';
import { explorerStore } from './explorer/explorerStore';
import { EquipmentTooltip } from './equipment/equipment';
// Échelle de la scène selon l'emprise du site : cadrage de la vue d'ensemble, ombres, brouillard et terrain
import { siteScale } from '../../services/siteLayout';

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
  const site = data?.site;
  const k = siteScale(site);
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
        {/* Ciel de jour ; brume de l'horizon (le terrain lointain s'y fond) */}
        <color
          attach="background"
          args={[visualMode === 'whitebox' ? '#f1f5f9' : SKY_HORIZON]}
        />
        <fog
          attach="fog"
          args={[visualMode === 'whitebox' ? '#f1f5f9' : SKY_HORIZON, 55 * k, 135 * k]}
        />
        {visualMode !== 'whitebox' && <SkyDome site={site} scale={k} />}

        {/* Éclairage directionnel & ambiant (lumière de jour, rebond du ciel et de la pelouse) */}
        <ambientLight intensity={visualMode === 'whitebox' ? 0.85 : 0.5} />
        <SunLight site={site} intensity={visualMode === 'whitebox' ? 1.1 : 1.5} />
        <hemisphereLight
          args={visualMode === 'whitebox' ? ['#38bdf8', '#0f172a', 0.35] : ['#dbeafe', '#3f5f2a', 0.55]}
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
          <CameraNavigator cameraTarget={cameraTarget} site={site} />
        )}

        {/* Sol industriel, voirie & Totem central de l'entité mère */}
        <CampusGround
          visualMode={visualMode}
          site={site}
          companyName={data?.entityName}
          companyLogo={data?.entityLogo}
          rootEntity={data?.rootEntity}
          isSelected={selectedElement?.id === data?.rootEntity?.id}
          onSelectRoot={() => data?.rootEntity && onSelectElement(data.rootEntity)}
          showLabels={showLabels}
        />

        {/* Bâtiments (Groupements de premier niveau, zone extérieure) & postes (Unités de Travail) */}
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

        {/* Dates de vérification de l'extincteur / la trousse de secours survolé(e) ou visé(e) */}
        <EquipmentTooltip />

        {/* Flux cinématiques d'opérateurs entre les Unités de Travail */}
        <WorkerAgents
          buildings={data?.buildings || []}
          employees={data?.employees}
          site={site}
          showPaths={showPaths}
          agentsEnabled={agentsEnabled}
          speedMultiplier={agentSpeed}
          onSelectUt={onSelectElement}
          showLabels={showLabels}
        />

        {/* Semi-remorques des entrepôts : quai, voirie du site, portail et route départementale */}
        {visualMode !== 'whitebox' && <DeliveryTrucks site={site} enabled={agentsEnabled} speedMultiplier={agentSpeed} />}
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

/** Soleil : ombres portées cadrées sur l'emprise du site. */
function SunLight({ site, intensity }) {
  const lightRef = useRef();
  const k = siteScale(site);
  const [cx, cz] = site?.center || [0, 0];

  useLayoutEffect(() => {
    const light = lightRef.current;
    if (!light) return;
    light.target.position.set(cx, 0, cz);
    light.target.updateMatrixWorld();
    const cam = light.shadow.camera;
    cam.left = -45 * k;
    cam.right = 45 * k;
    cam.top = 45 * k;
    cam.bottom = -45 * k;
    cam.far = 500 * k;
    cam.updateProjectionMatrix();
  }, [cx, cz, k]);

  return (
    <directionalLight
      ref={lightRef}
      castShadow
      position={[cx + 28 * k, 42 * k, cz + 24 * k]}
      intensity={intensity}
      shadow-mapSize={[2048, 2048]}
    />
  );
}

/** Cadrage de la vue d'ensemble : tout le site, depuis le sud. */
function overviewPose(site) {
  const k = siteScale(site);
  const [cx, cz] = site?.center || [0, 0];
  return { target: new THREE.Vector3(cx, 0, cz), position: new THREE.Vector3(cx, 34 * k, cz + 42 * k) };
}

function CameraNavigator({ cameraTarget, site }) {
  const controlsRef = useRef();
  const { camera } = useThree();
  const desiredTarget = useRef(new THREE.Vector3(0, 0, 0));
  const desiredCameraPos = useRef(null);
  const framedRadius = useRef(0);
  const k = siteScale(site);

  useEffect(() => {
    camera.far = 250 * k;
    camera.updateProjectionMatrix();
  }, [camera, k]);

  useEffect(() => {
    if (!cameraTarget) return;
    if (cameraTarget.type === 'overview') {
      const pose = overviewPose(site);
      desiredTarget.current.copy(pose.target);
      desiredCameraPos.current = pose.position;
      framedRadius.current = site?.radius || 0;
    } else if (cameraTarget.position) {
      const [x, y, z] = cameraTarget.position;
      desiredTarget.current.set(x, y, z);
      // Recul proportionnel à la taille de l'élément (UT, zone, bâtiment)
      const offsetDist = Math.max(13, (cameraTarget.radius || 0) * 1.85);
      const offsetHeight = offsetDist * 0.73;
      desiredCameraPos.current = new THREE.Vector3(
        x + offsetDist * 0.45,
        y + offsetHeight,
        z + offsetDist
      );
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraTarget]);

  // Premier chargement ou changement notable de l'emprise : recadrer la vue d'ensemble
  useEffect(() => {
    if (!site || cameraTarget?.type !== 'overview') return;
    if (Math.abs(site.radius - framedRadius.current) < framedRadius.current * 0.1) return;
    const pose = overviewPose(site);
    desiredTarget.current.copy(pose.target);
    desiredCameraPos.current = pose.position;
    framedRadius.current = site.radius;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [site]);

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
      maxDistance={85 * k}
    />
  );
}

function CampusGround({ visualMode, site, companyName, companyLogo, rootEntity, isSelected, onSelectRoot, showLabels }) {
  const k = siteScale(site);
  const [cx, cz] = site?.center || [0, 0];
  const [hx, hz] = site?.hub || [0, 0];
  // Le terrain porte aussi la route départementale, jusque dans le brouillard
  const groundSize = Math.max(160, 2 * (site?.radius || 0) + 110, site?.road ? site.road.to - site.road.from : 0);
  return (
    <group>
      {/* Terrain autour du site industriel (l'enceinte pavée est dessinée par CampusScenery) */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[cx, -0.02, cz]}
        receiveShadow
      >
        <planeGeometry args={[groundSize, groundSize]} />
        <meshStandardMaterial
          color={visualMode === 'whitebox' ? '#e2e8f0' : '#ffffff'}
          map={visualMode === 'whitebox' ? null : getTexture('grass', groundSize / 4, groundSize / 4)}
          roughness={0.9}
        />
      </mesh>

      {/* Grille métrique de référence */}
      <Grid
        position={[cx, 0.01, cz]}
        args={[90 * k, 90 * k]}
        cellSize={2}
        cellThickness={0.6}
        cellColor={visualMode === 'whitebox' ? '#cbd5e1' : '#1e293b'}
        sectionSize={10}
        sectionThickness={1.2}
        sectionColor={visualMode === 'whitebox' ? '#94a3b8' : '#334155'}
        fadeDistance={85 * k}
        fadeStrength={1}
      />

      {/* Voirie, rond-point, éclairage, végétation et clôture d'enceinte */}
      {visualMode !== 'whitebox' && (
        <CampusScenery site={site} companyName={companyName} companyLogo={companyLogo} />
      )}

      {/* Totem central de l'entité mère, au milieu du rond-point */}
      {rootEntity && (
        <group
          position={[hx, 0, hz]}
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
