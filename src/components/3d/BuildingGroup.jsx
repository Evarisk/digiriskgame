import React, { useState } from 'react';
import { Html, Edges } from '@react-three/drei';
import WorkUnitZone from './WorkUnitZone';

/**
 * Représentation 3D d'un Groupement DigiRisk (Bâtiment / Site).
 * Contient ses sous-espaces (Unités de Travail) et affiche la synthèse globale du bâtiment.
 */
export default function BuildingGroup({
  building,
  visualMode,
  cotationMode,
  selectedElement,
  activeRisk,
  onSelectElement,
  showRoof,
}) {
  const [hoveredBuilding, setHoveredBuilding] = useState(false);

  const [bx, by, bz] = building.layout3D.position;
  const [width, height, depth] = building.layout3D.size;
  const themeColor = building.layout3D.themeColor || '#3b82f6';

  const scaleObj =
    cotationMode === 'brute'
      ? building.stats.scaleBrute
      : building.stats.scaleResiduelle;
  const maxScore =
    cotationMode === 'brute'
      ? building.stats.maxBrute
      : building.stats.maxResiduelle;

  const isBuildingSelected = selectedElement?.id === building.id;

  const handleBuildingClick = (e) => {
    e.stopPropagation();
    onSelectElement(building);
  };

  return (
    <group position={[bx, by, bz]}>
      {/* Socle / Fondation du Bâtiment (Groupement) */}
      <mesh
        position={[0, 0.08, 0]}
        receiveShadow
        onClick={handleBuildingClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHoveredBuilding(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHoveredBuilding(false);
        }}
      >
        <boxGeometry args={[width, 0.16, depth]} />
        <meshStandardMaterial
          color={visualMode === 'whitebox' ? '#e2e8f0' : '#0f172a'}
          roughness={0.75}
          metalness={0.15}
        />
        <Edges
          scale={1.001}
          color={isBuildingSelected ? '#ffffff' : themeColor}
        />
      </mesh>

      {/* Bordure de sécurité périmétrique du bâtiment */}
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[width - 0.35, depth - 0.35]} />
        <meshStandardMaterial
          color={visualMode === 'whitebox' ? '#f1f5f9' : '#111827'}
          roughness={0.85}
        />
      </mesh>

      {/* Enveloppe architecturale du bâtiment */}
      {visualMode === 'whitebox' ? (
        /* Mode Étape 2 : Boîte blanche englobante en fil de fer */
        <mesh position={[0, height / 2 + 0.1, 0]}>
          <boxGeometry args={[width, height, depth]} />
          <meshStandardMaterial
            color="#ffffff"
            transparent
            opacity={0.12}
            depthWrite={false}
          />
          <Edges scale={1} color={themeColor} />
        </mesh>
      ) : (
        /* Mode Étape 3 : Piliers industriels, parois vitrées et charpente */
        <group>
          {/* 4 Piliers d'angle */}
          {[
            [-width / 2 + 0.25, -depth / 2 + 0.25],
            [width / 2 - 0.25, -depth / 2 + 0.25],
            [-width / 2 + 0.25, depth / 2 - 0.25],
            [width / 2 - 0.25, depth / 2 - 0.25],
          ].map(([px, pz], idx) => (
            <mesh key={idx} position={[px, height / 2, pz]} castShadow>
              <boxGeometry args={[0.38, height, 0.38]} />
              <meshStandardMaterial color="#334155" metalness={0.6} roughness={0.3} />
            </mesh>
          ))}

          {/* Mur arrière semi-vitré avec bandeau couleur Groupement */}
          <mesh position={[0, height / 2, -depth / 2 + 0.08]}>
            <boxGeometry args={[width - 0.4, height * 0.85, 0.12]} />
            <meshStandardMaterial
              color={themeColor}
              transparent
              opacity={0.14}
              depthWrite={false}
            />
            <Edges color={themeColor} />
          </mesh>

          {/* Bandeau supérieur d'enseigne */}
          <mesh
            position={[0, height - 0.25, -depth / 2 + 0.15]}
            onClick={handleBuildingClick}
          >
            <boxGeometry args={[width, 0.45, 0.35]} />
            <meshStandardMaterial
              color={themeColor}
              emissive={themeColor}
              emissiveIntensity={hoveredBuilding || isBuildingSelected ? 0.65 : 0.25}
            />
          </mesh>

          {/* Toiture optionnelle (masquée par défaut en vue éclatée pour inspecter les UT) */}
          {showRoof && (
            <mesh position={[0, height + 0.15, 0]} castShadow>
              <boxGeometry args={[width + 0.4, 0.25, depth + 0.4]} />
              <meshStandardMaterial
                color="#1e293b"
                transparent
                opacity={0.55}
              />
              <Edges color={themeColor} />
            </mesh>
          )}
        </group>
      )}

      {/* Enseigne Holographique du Groupement (Bâtiment) */}
      <Html
        position={[0, height + 1.15, -depth / 2]}
        center
        distanceFactor={32}
        zIndexRange={[20, 0]}
      >
        <div
          onClick={handleBuildingClick}
          className={`building-header-card ${isBuildingSelected ? 'selected' : ''}`}
          style={{
            borderColor: isBuildingSelected ? '#ffffff' : themeColor,
          }}
        >
          <span className="building-ref" style={{ background: themeColor }}>
            {building.ref}
          </span>
          <div className="building-title-block">
            <div className="building-name">{building.label}</div>
            <div className="building-sub">
              {building.children.length} UT • {building.stats.totalRisks} risques
              {building.directRisks.length > 0
                ? ` (dont ${building.directRisks.length} globaux)`
                : ''}
            </div>
          </div>
          <span
            className="building-max-pill"
            style={{
              background: scaleObj.bgBadge || scaleObj.color,
              color: scaleObj.scoreTextColor || scaleObj.color,
              borderColor: scaleObj.borderBadge || scaleObj.color,
            }}
          >
            Max {maxScore}
          </span>
        </div>
      </Html>

      {/* Unités de Travail (Ateliers / Postes) rattachées à ce Groupement */}
      {building.children.map((ut) => (
        <WorkUnitZone
          key={ut.id}
          ut={ut}
          visualMode={visualMode}
          cotationMode={cotationMode}
          isSelected={selectedElement?.id === ut.id}
          activeRisk={activeRisk}
          onSelect={onSelectElement}
        />
      ))}
    </group>
  );
}
