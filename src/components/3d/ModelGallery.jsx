import React from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, Html } from '@react-three/drei';
import WorkstationProps from './WorkstationProps';
import BuildingShell from './models/buildingShells';
import { StudioEnvironment } from './DigitalTwinCanvas';

/**
 * Galerie de revue des modèles 3D (outil de développement) : http://localhost:5173/?galerie
 * Filtres : ?galerie=bureaux | production | peinture | logistique | batiments | <archétype> (ex. welding)
 */

const FAMILIES = {
  bureaux: ['admin_office', 'sales_office', 'design_office', 'it_support', 'road_sales', 'trade_show', 'meeting_room'],
  production: ['saw_cutting', 'shear', 'drill_press', 'welding', 'machining', 'forklift', 'workshop'],
  peinture: ['paint_booth', 'curing_oven', 'hanging_line', 'wastewater', 'unloading', 'chemical_storage'],
  logistique: ['courier', 'air_freight', 'sea_freight', 'warehouse_storage'],
};

const BUILDINGS = ['office', 'factory', 'paint', 'logistics'];
const THEME = { office: '#3b82f6', factory: '#f59e0b', paint: '#8b5cf6', logistics: '#06b6d4' };

export default function ModelGallery({ filter = '' }) {
  const showBuildings = filter === 'batiments';
  const all = Object.values(FAMILIES).flat();
  const archetypes = FAMILIES[filter] || (all.includes(filter) ? [filter] : all);
  const cols = showBuildings ? 2 : Math.min(4, archetypes.length);
  const cellW = showBuildings ? 34 : 6;
  const cellD = showBuildings ? 30 : 5.5;
  const items = showBuildings ? BUILDINGS : archetypes;
  const rows = Math.ceil(items.length / cols);
  const span = Math.max(cols * cellW, rows * cellD);

  return (
    <div style={{ position: 'fixed', inset: 0, background: '#090d16' }}>
      <Canvas shadows camera={{ position: [span * 0.15, span * 0.62, span * 0.8], fov: 45, near: 0.5, far: 400 }}>
        <color attach="background" args={['#090d16']} />
        <ambientLight intensity={0.55} />
        <directionalLight castShadow position={[28, 42, 24]} intensity={1.35} shadow-mapSize={[2048, 2048]} shadow-camera-left={-60} shadow-camera-right={60} shadow-camera-top={60} shadow-camera-bottom={-60} />
        <hemisphereLight skyColor="#38bdf8" groundColor="#0f172a" intensity={0.35} />
        <StudioEnvironment />
        <OrbitControls makeDefault target={[0, 0, 0]} />
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.02, 0]} receiveShadow>
          <planeGeometry args={[400, 400]} />
          <meshStandardMaterial color="#0b1120" roughness={0.9} />
        </mesh>
        {items.map((item, i) => {
          const x = ((i % cols) - (cols - 1) / 2) * cellW;
          const z = (Math.floor(i / cols) - (rows - 1) / 2) * cellD;
          return showBuildings ? (
            <group key={item} position={[x, 0, z]}>
              <mesh position={[0, 0.08, 0]} receiveShadow>
                <boxGeometry args={[18, 0.16, 16.8]} />
                <meshStandardMaterial color="#0f172a" />
              </mesh>
              <BuildingShell archetype={item} width={18} height={4.8} depth={16.8} themeColor={THEME[item]} outward={[1, -1]} />
              <GalleryLabel position={[0, 12, -8.4]} text={item} />
            </group>
          ) : (
            <group key={item} position={[x, 0.15, z]}>
              <mesh position={[0, 0.05, 0]} receiveShadow>
                <boxGeometry args={[4.8, 0.14, 4.0]} />
                <meshStandardMaterial color="#1e293b" />
              </mesh>
              <WorkstationProps archetype={item} riskColor="#f97316" isCritical={false} />
              <GalleryLabel position={[0, 2.9, -2]} text={item} />
            </group>
          );
        })}
      </Canvas>
    </div>
  );
}

function GalleryLabel({ position, text }) {
  return (
    <Html position={position} center>
      <div style={{ padding: '2px 8px', borderRadius: 6, background: 'rgba(15,23,42,0.85)', color: '#e2e8f0', font: '600 12px Inter, sans-serif', whiteSpace: 'nowrap' }}>
        {text}
      </div>
    </Html>
  );
}
