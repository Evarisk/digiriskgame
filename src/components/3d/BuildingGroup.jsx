import React, { useState } from 'react';
import { Html, Edges } from '@react-three/drei';
import WorkUnitZone from './WorkUnitZone';
import BuildingShell, { SHELL_HEADER_HEIGHT } from './models/buildingShells';
import { FloorZone } from './models/kit';
import MergeStatic from './models/MergeStatic';
import { getTexture } from './models/textures';

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
  const archetype = building.layout3D.archetype || 'factory';

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
      <mesh position={[0, 0.17, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[width - 0.35, depth - 0.35]} />
        <meshStandardMaterial
          color={visualMode === 'whitebox' ? '#f1f5f9' : archetype === 'office' ? '#a8b2bf' : '#ffffff'}
          map={
            visualMode === 'whitebox'
              ? null
              : getTexture(archetype === 'office' ? 'concrete' : 'epoxy', (width - 0.35) / 3, (depth - 0.35) / 3)
          }
          roughness={0.6}
          metalness={0.1}
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
        /* Mode Étape 3 : enveloppe métier (bureaux, usine, atelier peinture, entrepôt) */
        <MergeStatic deps={[archetype, width, height, depth, themeColor, showRoof, building.children.length]}>
          <BuildingShell
            archetype={archetype}
            width={width}
            height={height}
            depth={depth}
            themeColor={themeColor}
            outward={building.layout3D.outward}
            showRoof={showRoof}
            highlight={hoveredBuilding || isBuildingSelected}
          />
          {/* Marquage au sol des allées de circulation autour des postes (bâtiments industriels) */}
          {archetype !== 'office' &&
            building.children.map((ut) => (
              <FloorZone
                key={`aisle-${ut.id}`}
                position={[ut.layout3D.localPosition[0], 0.17, ut.layout3D.localPosition[2]]}
                width={ut.layout3D.size[0] + 0.7}
                depth={ut.layout3D.size[2] + 0.7}
                line={0.08}
                color="#eab308"
              />
            ))}
        </MergeStatic>
      )}

      {/* Enseigne Holographique du Groupement (Bâtiment) */}
      <Html
        position={[
          0,
          visualMode === 'whitebox'
            ? height + 1.15
            : SHELL_HEADER_HEIGHT[archetype] || height + 1.15,
          -depth / 2,
        ]}
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
            {building.directRiskSigns?.length > 0 && (
              <div className="building-signs-row">
                {building.directRiskSigns.map((sign) => (
                  <img
                    key={sign.id || sign.ref}
                    src={sign.iconUrl}
                    alt={sign.categoryName}
                    title={`[${sign.ref}] ${sign.categoryName} — ${sign.description}`}
                    className="sign-mini-picto"
                  />
                ))}
              </div>
            )}
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
