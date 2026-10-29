import React, { useMemo, useState } from 'react';
import { Html, Edges } from '@react-three/drei';
import WorkUnitZone from './WorkUnitZone';
import BuildingShell, { SHELL_HEADER_HEIGHT } from './models/buildingShells';
import { FloorZone, FirstAidKit, WalkwayStrip, WalkwayNode } from './models/kit';
import MergeStatic from './models/MergeStatic';
import { getTexture } from './models/textures';
import { StationModel } from './WorkstationProps';
import { EquipmentOwner } from './equipment/equipment';
import { sideDoorZ } from '../../services/siteLayout';

/**
 * Équipements métier de toutes les UT du bâtiment, fusionnés ensemble : un maillage par matériau pour
 * le bâtiment entier (et non par poste), si bien que le nombre de draw calls ne croît plus avec le
 * nombre d'UT. Les pièces animées et les zones de survol des équipements restent à part.
 */
function BuildingStations({ workUnits, cotationMode }) {
  const owners = useMemo(() => new Map(workUnits.map((ut) => [ut.id, { id: ut.id, ref: ut.ref, label: ut.label }])), [workUnits]);
  const stations = workUnits.map((ut) => {
    const scale = cotationMode === 'brute' ? ut.stats.scaleBrute : ut.stats.scaleResiduelle;
    return { ut, accent: scale.strokeColor || scale.color };
  });
  const mergeKey = stations.map(({ ut, accent }) => `${ut.id}:${ut.archetype}:${accent}:${ut.layout3D.localPosition.join(',')}`).join('|');

  return (
    <MergeStatic deps={[mergeKey]}>
      {stations.map(({ ut, accent }) => {
        const [x, y, z] = ut.layout3D.localPosition;
        return (
          // Le sol des modèles (y = 0) correspond au dessus de la dalle de l'UT
          <group key={ut.id} position={[x, y + 0.12, z]}>
            <EquipmentOwner.Provider value={owners.get(ut.id)}>
              <StationModel archetype={ut.archetype} accent={accent} />
            </EquipmentOwner.Provider>
          </group>
        );
      })}
    </MergeStatic>
  );
}

const FLOOR_TEXTURE = { office: 'concrete', yard: 'asphalt' };

/**
 * Réseau de couloirs piétons balisés (norme INRS : bande verte + bordures jaunes + chevrons)
 * à l'intérieur d'un bâtiment, calculé par le plan du site (services/siteLayout.js) : allées
 * devant chaque rangée de postes et entre les colonnes, embranchements vers chaque UT, seuils
 * zébrés des portes latérale et principale (arrêtés au nu de la dalle).
 */
function BuildingWalkways({ walkways }) {
  if (!walkways) return null;
  const y = 0.172;
  return (
    <group>
      {walkways.strips.map((s) => (
        <WalkwayStrip
          key={`${s.from}-${s.to}`}
          from={s.from}
          to={s.to}
          y={s.zebra ? y + 0.002 : y}
          arrows={Boolean(s.arrows)}
          zebra={Boolean(s.zebra)}
        />
      ))}
      {walkways.nodes.map((n) => (
        <WalkwayNode key={`${n}`} position={n} y={y} />
      ))}
    </group>
  );
}

/**
 * Représentation 3D d'un Groupement DigiRisk (Bâtiment / Site) ou de la zone extérieure des UT
 * rattachées à la racine. Contient ses postes (Unités de Travail, y compris celles des
 * sous-groupements, repérés par une zone au sol) et affiche la synthèse globale du bâtiment.
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

  const workUnits = building.workUnits || [];
  const [ox] = building.layout3D.outward;
  const equipmentOwner = useMemo(() => ({ id: building.id, ref: building.ref, label: building.label }), [building.id, building.ref, building.label]);
  const aisleKey = workUnits.map((ut) => ut.layout3D.localPosition.join(',')).join(';');
  const isBuildingSelected = selectedElement?.id === (building.selectTarget || building).id;

  const handleBuildingClick = (e) => {
    e.stopPropagation();
    onSelectElement(building.selectTarget || building);
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
              : getTexture(FLOOR_TEXTURE[archetype] || 'epoxy', (width - 0.35) / 3, (depth - 0.35) / 3)
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
          <BuildingWalkways walkways={building.layout3D.walkways} />
        </group>
      ) : (
        /* Mode Étape 3 : enveloppe métier (bureaux, usine, atelier peinture, entrepôt) */
        <MergeStatic deps={[archetype, building.layout3D.finish, width, height, depth, themeColor, showRoof, aisleKey, building.layout3D.outward.join()]}>
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
            truck={false}
          />
          {/* Couloirs piétons industriels balisés (vert/jaune + chevrons + seuils de portes) */}
          <BuildingWalkways walkways={building.layout3D.walkways} />
          {/* Trousse de secours à côté de la porte latérale, tournée vers l'intérieur */}
          <EquipmentOwner.Provider value={equipmentOwner}>
            <FirstAidKit
              position={[-ox * (width / 2 - 0.7), 0.16, sideDoorZ(depth) - 1.5]}
              rotation={[0, (ox * Math.PI) / 2, 0]}
            />
          </EquipmentOwner.Provider>
          {/* Marquage au sol des zones de sécurité autour des postes (bâtiments industriels) */}
          {archetype !== 'office' &&
            workUnits.map((ut) => (
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

      {/* Équipements métier des postes (fusionnés à l'échelle du bâtiment) */}
      {visualMode !== 'whitebox' && <BuildingStations workUnits={workUnits} cotationMode={cotationMode} />}

      {/* Zones des sous-groupements (rangées de postes regroupées) */}
      {(building.zones || []).map((zone) => (
        <SubGroupZone
          key={zone.id}
          zone={zone}
          cotationMode={cotationMode}
          isSelected={selectedElement?.id === zone.id}
          onSelect={onSelectElement}
          showLabels={showLabels}
        />
      ))}

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
                {workUnits.length} UT • {building.stats.totalRisks} risques
                {building.zones?.length > 0 ? ` • ${building.zones.length} sous-groupement${building.zones.length > 1 ? 's' : ''}` : ''}
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

      {/* Unités de Travail (Ateliers / Postes) rattachées à ce Groupement ou à ses sous-groupements */}
      {workUnits.map((ut) => (
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

/**
 * Zone au sol d'un sous-groupement : liseré aux couleurs du bâtiment, voile cliquable
 * (sélection du sous-groupement) et étiquette avec sa cotation maximale.
 */
function SubGroupZone({ zone, cotationMode, isSelected, onSelect, showLabels }) {
  const [hovered, setHovered] = useState(false);
  const [x, , z] = zone.layout3D.localPosition;
  const [w, , d] = zone.layout3D.size;
  const color = zone.layout3D.themeColor || '#3b82f6';
  const scale = cotationMode === 'brute' ? zone.stats.scaleBrute : zone.stats.scaleResiduelle;
  const maxScore = cotationMode === 'brute' ? zone.stats.maxBrute : zone.stats.maxResiduelle;

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(zone);
  };

  return (
    <group position={[x, 0, z]}>
      <mesh
        position={[0, 0.176, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        userData={{ noCollide: true }}
        onClick={handleClick}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={(e) => {
          e.stopPropagation();
          setHovered(false);
        }}
      >
        <planeGeometry args={[w, d]} />
        <meshStandardMaterial color={color} transparent opacity={isSelected ? 0.3 : hovered ? 0.22 : 0.1} depthWrite={false} />
      </mesh>
      <FloorZone position={[0, 0.17, 0]} width={w} depth={d} line={0.14} color={isSelected ? '#ffffff' : color} />

      {showLabels && (
        <Html position={[-w / 2 + 0.4, 0.4, d / 2 - 0.3]} distanceFactor={22} zIndexRange={[12, 0]}>
          <div className={`subgroup-tag ${isSelected ? 'selected' : ''}`} style={{ borderColor: color }} onClick={handleClick}>
            <span className="subgroup-ref" style={{ background: color }}>
              {zone.ref}
            </span>
            <span className="subgroup-label">{zone.label}</span>
            <span className="subgroup-score" style={{ color: scale.scoreTextColor || scale.color }}>
              {maxScore}
            </span>
          </div>
        </Html>
      )}
    </group>
  );
}
