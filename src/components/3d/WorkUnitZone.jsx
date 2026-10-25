import React, { useState, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Edges } from '@react-three/drei';
import WorkstationProps from './WorkstationProps';

/**
 * Représentation 3D interactive d'une Unité de Travail (UT) rattachée à un Groupement.
 * Teintée dynamiquement selon la cotation DigiRisk (Vert/Gris, Orange, Rouge, Noir/Critique).
 */
export default function WorkUnitZone({
  ut,
  visualMode, // 'detailed' | 'whitebox'
  cotationMode, // 'residuelle' | 'brute'
  isSelected,
  onSelect,
}) {
  const [hovered, setHovered] = useState(false);
  const pulseRingRef = useRef();

  const [posX, posY, posZ] = ut.layout3D.localPosition;
  const [sizeW, sizeH, sizeD] = ut.layout3D.size;

  const scaleObj =
    cotationMode === 'brute' ? ut.stats.scaleBrute : ut.stats.scaleResiduelle;
  const maxScore =
    cotationMode === 'brute' ? ut.stats.maxBrute : ut.stats.maxResiduelle;
  const riskColor = scaleObj.color;
  const edgeColor = scaleObj.strokeColor || scaleObj.color;
  const isCritical = maxScore >= 81;

  useFrame(({ clock }) => {
    if (pulseRingRef.current) {
      const t = clock.getElapsedTime();
      const s = 1 + Math.sin(t * 3.5) * 0.04;
      pulseRingRef.current.scale.set(s, 1, s);
    }
  });

  const handlePointerOver = (e) => {
    e.stopPropagation();
    setHovered(true);
    document.body.style.cursor = 'pointer';
  };

  const handlePointerOut = (e) => {
    e.stopPropagation();
    setHovered(false);
    document.body.style.cursor = 'auto';
  };

  const handleClick = (e) => {
    e.stopPropagation();
    onSelect(ut);
  };

  return (
    <group position={[posX, posY, posZ]}>
      {/* Dalle au sol de l'atelier (UT) teintée par la criticité */}
      <mesh
        position={[0, 0.05, 0]}
        receiveShadow
        onPointerOver={handlePointerOver}
        onPointerOut={handlePointerOut}
        onClick={handleClick}
      >
        <boxGeometry args={[sizeW, 0.14, sizeD]} />
        <meshStandardMaterial
          color={hovered || isSelected ? riskColor : '#1e293b'}
          emissive={riskColor}
          emissiveIntensity={isSelected ? 0.55 : hovered ? 0.4 : 0.16}
          roughness={0.5}
          metalness={0.2}
        />
        <Edges
          scale={1.002}
          threshold={15}
          color={isSelected ? '#ffffff' : edgeColor}
        />
      </mesh>

      {/* Anneau lumineux périmétrique si sélectionné ou critique */}
      {(isSelected || isCritical) && (
        <mesh
          ref={pulseRingRef}
          position={[0, 0.14, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[Math.min(sizeW, sizeD) * 0.46, Math.min(sizeW, sizeD) * 0.52, 32]} />
          <meshBasicMaterial
            color={isSelected ? '#38bdf8' : edgeColor}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Mode Étape 2 : Boîtes blanches (Cubes simples) vs Mode Étape 3 : Assets 3D métiers */}
      {visualMode === 'whitebox' ? (
        <mesh
          position={[0, sizeH / 2 + 0.12, 0]}
          castShadow
          receiveShadow
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          <boxGeometry args={[sizeW * 0.86, sizeH * 0.85, sizeD * 0.84]} />
          <meshStandardMaterial
            color="#f8fafc"
            emissive={riskColor}
            emissiveIntensity={hovered || isSelected ? 0.45 : 0.22}
            roughness={0.35}
          />
          <Edges scale={1.0} color={edgeColor} />
        </mesh>
      ) : (
        <group
          onPointerOver={handlePointerOver}
          onPointerOut={handlePointerOut}
          onClick={handleClick}
        >
          {/* Volume holographique semi-transparent englobant l'atelier */}
          <mesh position={[0, sizeH / 2 + 0.12, 0]}>
            <boxGeometry args={[sizeW * 0.94, sizeH * 0.85, sizeD * 0.94]} />
            <meshStandardMaterial
              color={riskColor}
              transparent
              opacity={isCritical ? 0.42 : isSelected ? 0.18 : hovered ? 0.14 : 0.08}
              depthWrite={false}
            />
            <Edges
              scale={1.0}
              color={isSelected ? '#ffffff' : edgeColor}
            />
          </mesh>

          {/* Équipements 3D spécifiques au métier de l'UT */}
          <WorkstationProps
            archetype={ut.archetype}
            riskColor={edgeColor}
            isCritical={isCritical}
          />
        </group>
      )}

      {/* Hologramme HTML flottant au-dessus de l'Unité de Travail */}
      <Html
        position={[0, sizeH + 0.55, 0]}
        center
        distanceFactor={26}
        zIndexRange={[10, 0]}
      >
        <div
          onClick={handleClick}
          className={`ut-floating-badge ${isSelected ? 'selected' : ''} ${
            isCritical ? 'critical-pulse' : ''
          }`}
          style={{
            borderColor: isSelected ? '#ffffff' : edgeColor,
          }}
        >
          <div className="ut-badge-top">
            <span
              className="ut-ref"
              style={{
                background: riskColor,
                color: scaleObj.textColor || '#ffffff',
                border: isCritical ? '1px solid #cbd5e1' : 'none',
              }}
            >
              {ut.ref}
            </span>
            <span
              className="ut-score"
              style={{ color: scaleObj.scoreTextColor || edgeColor }}
            >
              {maxScore}/100
            </span>
          </div>
          <div className="ut-label">{ut.label}</div>
          <div className="ut-meta">
            {ut.stats.totalRisks} risque{ut.stats.totalRisks > 1 ? 's' : ''}
            {ut.stats.totalTasks > 0 ? ` • ${ut.stats.totalTasks} action(s)` : ''}
          </div>
        </div>
      </Html>
    </group>
  );
}
