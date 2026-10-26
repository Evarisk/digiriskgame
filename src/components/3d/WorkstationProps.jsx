import React, { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Box, Cylinder, PALETTE, DYNAMIC } from './models/kit';
import MergeStatic from './models/MergeStatic';
import {
  AdminOffice,
  SalesOffice,
  DesignOffice,
  ItSupport,
  RoadSales,
  TradeShow,
  MeetingRoom,
} from './models/officeStations';
import {
  SawCutting,
  Shear,
  DrillPress,
  Welding,
  Machining,
  ForkliftArea,
  GenericWorkshop,
} from './models/productionStations';
import {
  PaintBooth,
  CuringOven,
  HangingLine,
  Wastewater,
  Unloading,
  ChemicalStorage,
} from './models/surfaceStations';
import { Courier, AirFreight, SeaFreight, WarehouseStorage } from './models/logisticsStations';

/**
 * Étape 3 — Équipements 3D métiers de chaque Unité de Travail (UT).
 * L'archétype est déduit du libellé DigiRisk (voir services/archetypes.js) ;
 * chaque modèle tient dans la dalle de l'UT (≈ 4,4 × 3,6) et utilise la couleur
 * de cotation (`riskColor`) pour le marquage au sol de sa zone dangereuse.
 */
const STATION_MODELS = {
  admin_office: AdminOffice,
  sales_office: SalesOffice,
  design_office: DesignOffice,
  it_support: ItSupport,
  road_sales: RoadSales,
  trade_show: TradeShow,
  meeting_room: MeetingRoom,
  saw_cutting: SawCutting,
  shear: Shear,
  drill_press: DrillPress,
  welding: Welding,
  machining: Machining,
  forklift: ForkliftArea,
  paint_booth: PaintBooth,
  curing_oven: CuringOven,
  hanging_line: HangingLine,
  wastewater: Wastewater,
  unloading: Unloading,
  chemical_storage: ChemicalStorage,
  courier: Courier,
  air_freight: AirFreight,
  sea_freight: SeaFreight,
  warehouse_storage: WarehouseStorage,
  workshop: GenericWorkshop,
};

export default function WorkstationProps({ archetype, riskColor, isCritical }) {
  const Station = STATION_MODELS[archetype] || GenericWorkshop;

  return (
    // Le sol des modèles (y = 0) correspond au dessus de la dalle de l'UT
    <group position={[0, 0.12, 0]}>
      {/* Géométrie statique fusionnée (un maillage par matériau) pour limiter les draw calls */}
      <MergeStatic deps={[archetype, riskColor]}>
        <Station accent={riskColor} />
      </MergeStatic>

      {/* Gyrophare d'alerte sur mât si cotation critique (>= 81) */}
      {isCritical && <CriticalBeacon position={[2.15, 0, -1.75]} />}
    </group>
  );
}

function CriticalBeacon(props) {
  const headRef = useRef();
  useFrame(({ clock }) => {
    if (headRef.current) headRef.current.rotation.y = clock.getElapsedTime() * 4;
  });
  return (
    <group {...props}>
      <Cylinder position={[0, 0.95, 0]} radius={0.03} height={1.9} color={PALETTE.darkSteel} metal={0.6} />
      <Box position={[0, 0.02, 0]} size={[0.2, 0.04, 0.2]} color={PALETTE.darkSteel} />
      <group ref={headRef} userData={DYNAMIC} position={[0, 2.02, 0]}>
        <mesh raycast={() => null}>
          <cylinderGeometry args={[0.14, 0.17, 0.26, 12]} />
          <meshStandardMaterial color="#ef4444" emissive="#ef4444" emissiveIntensity={2.2} />
        </mesh>
        <Box position={[0.12, 0, 0]} size={[0.06, 0.18, 0.2]} color="#fecaca" glow={3} shadow={false} />
        <pointLight color="#ef4444" intensity={1.8} distance={4.5} />
      </group>
    </group>
  );
}
