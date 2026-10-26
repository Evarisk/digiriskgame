import React, { useState, useRef, useEffect } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html, Edges } from '@react-three/drei';
import WorkstationProps from './WorkstationProps';

/**
 * Représentation 3D interactive d'une Unité de Travail (UT) rattachée à un Groupement.
 * Teintée dynamiquement selon la cotation DigiRisk (Gris, Orange, Rouge, Noir/Critique)
 * et projette en hologramme 3D la photo du risque sur l'unité de travail.
 */
export default function WorkUnitZone({
  ut,
  visualMode, // 'detailed' | 'whitebox'
  cotationMode, // 'residuelle' | 'brute'
  isSelected,
  activeRisk,
  onSelect,
  showLabels = true,
}) {
  const [hovered, setHovered] = useState(false);
  const [photoCycleIdx, setPhotoCycleIdx] = useState(0);
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

  // Risques avec photo rattachés à cette UT
  const risksWithPhoto = (ut.directRisks || []).filter((r) => r.photoUrl);

  // Défilement automatique des photos de risques quand l'UT est sélectionnée
  useEffect(() => {
    if (!isSelected || risksWithPhoto.length <= 1) return;
    const timer = setInterval(() => {
      setPhotoCycleIdx((prev) => (prev + 1) % risksWithPhoto.length);
    }, 3800);
    return () => clearInterval(timer);
  }, [isSelected, risksWithPhoto.length]);

  // Risque dont la photo est projetée au-dessus de l'UT
  const activeUtRisk =
    activeRisk && activeRisk.fkElement === ut.id && activeRisk.photoUrl
      ? activeRisk
      : (isSelected || hovered) && risksWithPhoto.length > 0
      ? risksWithPhoto[photoCycleIdx % risksWithPhoto.length]
      : null;

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
          <ringGeometry
            args={[
              Math.min(sizeW, sizeD) * 0.46,
              Math.min(sizeW, sizeD) * 0.52,
              32,
            ]}
          />
          <meshBasicMaterial
            color={isSelected ? '#38bdf8' : edgeColor}
            transparent
            opacity={0.85}
          />
        </mesh>
      )}

      {/* Volume 3D & Équipements de l'atelier */}
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
          <mesh position={[0, sizeH / 2 + 0.12, 0]} userData={{ noCollide: true }}>
            <boxGeometry args={[sizeW * 0.94, sizeH * 0.85, sizeD * 0.94]} />
            <meshStandardMaterial
              color={riskColor}
              transparent
              opacity={
                isSelected ? 0.12 : hovered ? 0.1 : isCritical ? 0.1 : 0.035
              }
              depthWrite={false}
            />
            <Edges scale={1.0} color={isSelected ? '#ffffff' : edgeColor} />
          </mesh>

          {/* Équipements 3D spécifiques au métier de l'UT */}
          <WorkstationProps
            archetype={ut.archetype}
            riskColor={edgeColor}
            isCritical={isCritical}
          />
        </group>
      )}

      {/* Hologramme HTML flottant au-dessus de l'Unité de Travail + Projection Photo Risque */}
      {showLabels && (
        <Html
          position={[0, sizeH + (activeUtRisk ? 1.35 : 0.55), 0]}
          center
          distanceFactor={25}
          zIndexRange={[15, 0]}
        >
          <div className="ut-hologram-stack" onClick={handleClick}>
            {/* Projection Holographique de la photo du risque sur l'UT */}
            {activeUtRisk && (
              <div
                key={activeUtRisk.id}
                className="ut-photo-hologram"
                style={{
                  borderColor:
                    activeUtRisk.scaleResiduelle?.borderBadge || edgeColor,
                }}
              >
                <div className="ut-photo-hologram-media">
                  <img
                    src={activeUtRisk.photoUrl}
                    alt={activeUtRisk.description}
                    className="ut-photo-hologram-img"
                    onError={(e) => {
                      const fallback = activeUtRisk.photoFallbackPath
                        ? `./api-proxy.php?photo=${encodeURIComponent(
                            activeUtRisk.photoFallbackPath
                          )}`
                        : null;
                      if (fallback && !e.currentTarget.dataset.retried) {
                        e.currentTarget.dataset.retried = '1';
                        e.currentTarget.src = fallback;
                      }
                    }}
                  />
                  <div className="hologram-scanline" />
                  <span
                    className="ut-photo-risk-tag"
                    style={{
                      background: activeUtRisk.scaleResiduelle?.color || riskColor,
                      color: activeUtRisk.scaleResiduelle?.textColor || '#fff',
                    }}
                  >
                    {activeUtRisk.ref} • {activeUtRisk.cotationResiduelle}/100
                  </span>
                </div>
                <div className="ut-photo-caption">{activeUtRisk.description}</div>
                <div className="hologram-beam" />
              </div>
            )}

            {/* Badge principal de l'Unité de Travail */}
            <div
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
                {ut.stats.totalTasks > 0
                  ? ` • ${ut.stats.totalTasks} action(s)`
                  : ''}
              </div>
              {ut.directRiskSigns?.length > 0 && (
                <div className="ut-signs-row">
                  {ut.directRiskSigns.map((sign) => (
                    <img
                      key={sign.id || sign.ref}
                      src={sign.iconUrl}
                      alt={sign.categoryName}
                      title={`[${sign.ref}] ${sign.categoryName} — ${sign.description}`}
                      className="sign-mini-picto ut-sign"
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        </Html>
      )}
    </group>
  );
}
