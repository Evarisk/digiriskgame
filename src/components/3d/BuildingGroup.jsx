import React, { useState } from 'react';
import { Html, Edges } from '@react-three/drei';
import WorkUnitZone from './WorkUnitZone';
import BuildingShell, { SHELL_HEADER_HEIGHT, getBuildingDoorZ } from './models/buildingShells';
import { FloorZone, WalkwayStrip, WalkwayNode } from './models/kit';
import MergeStatic from './models/MergeStatic';
import { getTexture } from './models/textures';

/**
 * Réseau de couloirs piétons balisés (norme INRS : bande verte + bordures jaunes + chevrons)
 * à l'intérieur d'un bâtiment, reliant la Porte Latérale, la Porte Principale Sud et chaque UT.
 */
function BuildingWalkways({ width, depth, outward = [1, 1], children = [] }) {
  const [ox] = outward;
  const y = 0.172;
  const doorZ = getBuildingDoorZ(depth);
  const sideDoorEdgeX = -ox * (width / 2 + 0.15);
  const southDoorEdgeZ = depth / 2 + 0.15;

  const utXs = children.map((u) => u.layout3D.localPosition[0]);
  const minUtX = utXs.length ? Math.min(...utXs, 0) : -3.1;
  const maxUtX = utXs.length ? Math.max(...utXs, 0) : 3.1;
  const corridorMinX = ox > 0 ? sideDoorEdgeX : minUtX;
  const corridorMaxX = ox < 0 ? sideDoorEdgeX : maxUtX;

  // Bâtiment à 1 rangée d'UT (ex. GP2 Atelier Production, depth = 11.4)
  if (depth < 14) {
    return (
      <group>
        {/* Couloir transversal principal depuis la porte latérale */}
        <WalkwayStrip from={[corridorMinX, doorZ]} to={[corridorMaxX, doorZ]} y={y} />
        {/* Seuil zébré de la porte latérale */}
        <WalkwayStrip
          from={[-ox * (width / 2 - 0.55), doorZ]}
          to={[-ox * (width / 2 + 0.45), doorZ]}
          y={y + 0.002}
          zebra
        />
        {/* Allée centrale Nord-Sud depuis la porte principale Sud */}
        <WalkwayStrip from={[0, southDoorEdgeZ]} to={[0, 0.4]} y={y} />
        {/* Seuil zébré de la porte principale Sud */}
        <WalkwayStrip from={[0, depth / 2 - 0.55]} to={[0, depth / 2 + 0.45]} y={y + 0.002} zebra />
        <WalkwayNode position={[0, doorZ]} y={y} />

        {/* Embranchements vers l'entrée de chaque Unité de Travail */}
        {children.map((ut) => {
          const [ux, , uz] = ut.layout3D.localPosition;
          return (
            <React.Fragment key={`wk-${ut.id}`}>
              <WalkwayNode position={[ux, doorZ]} y={y} />
              <WalkwayStrip from={[ux, doorZ]} to={[ux, uz + 2.35]} y={y} arrows={false} />
            </React.Fragment>
          );
        })}
      </group>
    );
  }

  // Bâtiment à 2 rangées d'UT (ex. GP1 Bureaux, GP3 Peinture, GP4 Logistique, depth = 16.8)
  const frontZ = depth / 2 - 1.6; // +6.8
  const isThreeCols = children.length > 4;
  const aisleXs = isThreeCols ? [-3.1, 3.1] : [0];

  return (
    <group>
      {/* Couloir transversal central (z = +0.4) relié à la porte piétonne latérale */}
      <WalkwayStrip from={[corridorMinX, doorZ]} to={[corridorMaxX, doorZ]} y={y} />
      {/* Seuil zébré de la porte latérale */}
      <WalkwayStrip
        from={[-ox * (width / 2 - 0.55), doorZ]}
        to={[-ox * (width / 2 + 0.45), doorZ]}
        y={y + 0.002}
        zebra
      />

      {/* Couloir transversal avant Sud (z = +6.8) */}
      <WalkwayStrip from={[minUtX, frontZ]} to={[maxUtX, frontZ]} y={y} />

      {/* Allées Nord-Sud reliant le couloir central et le couloir avant */}
      {aisleXs.map((ax) => (
        <React.Fragment key={`aisle-ns-${ax}`}>
          <WalkwayStrip
            from={[ax, isThreeCols ? doorZ : -2.3]}
            to={[ax, frontZ]}
            y={y}
          />
          <WalkwayNode position={[ax, doorZ]} y={y} />
          <WalkwayNode position={[ax, frontZ]} y={y} />
        </React.Fragment>
      ))}

      {/* Entrée principale Sud (x = 0, de la façade Sud jusqu'au couloir avant) */}
      <WalkwayStrip from={[0, southDoorEdgeZ]} to={[0, frontZ]} y={y} />
      <WalkwayStrip from={[0, depth / 2 - 0.55]} to={[0, depth / 2 + 0.45]} y={y + 0.002} zebra />
      <WalkwayNode position={[0, frontZ]} y={y} />

      {/* Embranchements vers chaque poste de travail */}
      {children.map((ut) => {
        const [ux, , uz] = ut.layout3D.localPosition;
        if (uz > 0) {
          return (
            <React.Fragment key={`wk-${ut.id}`}>
              <WalkwayNode position={[ux, frontZ]} y={y} />
              <WalkwayStrip from={[ux, frontZ]} to={[ux, uz + 2.35]} y={y} arrows={false} />
            </React.Fragment>
          );
        }
        return <WalkwayNode key={`wk-${ut.id}`} position={[ux, doorZ]} y={y} />;
      })}
    </group>
  );
}

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
  showLabels = true,
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

      {/* Enveloppe architecturale du bâtiment & cheminements piétons internes balisés */}
      {visualMode === 'whitebox' ? (
        /* Mode Étape 2 : Boîte blanche englobante en fil de fer + couloirs piétons */
        <group>
          <mesh position={[0, height / 2 + 0.1, 0]} userData={{ noCollide: true }}>
            <boxGeometry args={[width, height, depth]} />
            <meshStandardMaterial
              color="#ffffff"
              transparent
              opacity={0.12}
              depthWrite={false}
            />
            <Edges scale={1} color={themeColor} />
          </mesh>
          <BuildingWalkways
            width={width}
            depth={depth}
            outward={building.layout3D.outward}
            children={building.children}
          />
        </group>
      ) : (
        /* Mode Étape 3 : enveloppe métier (bureaux, usine, atelier peinture, entrepôt) */
        <MergeStatic deps={[archetype, building.layout3D.finish, width, height, depth, themeColor, showRoof, building.children.length]}>
          <BuildingShell
            archetype={archetype}
            width={width}
            height={height}
            depth={depth}
            themeColor={themeColor}
            outward={building.layout3D.outward}
            finish={building.layout3D.finish}
            showRoof={showRoof}
            highlight={hoveredBuilding || isBuildingSelected}
          />
          {/* Couloirs piétons industriels balisés (vert/jaune + chevrons + seuils de portes) */}
          <BuildingWalkways
            width={width}
            depth={depth}
            outward={building.layout3D.outward}
            children={building.children}
          />
          {/* Marquage au sol des zones de sécurité autour des postes (bâtiments industriels) */}
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
      {showLabels && (
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
      )}

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
          showLabels={showLabels}
        />
      ))}
    </group>
  );
}
