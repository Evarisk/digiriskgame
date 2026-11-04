import React from 'react';
import {
  Workstation,
  Desk,
  OfficeChair,
  FilingCabinet,
  Shelving,
  Plant,
  Bench,
  PalletRack,
  Pallet,
  LoadedPallet,
  Carton,
  Barrel,
  GasBottle,
  IBCTank,
  PalletJack,
  Extinguisher,
  FirstAidKit,
  SafetyShower,
  Bollard,
  SafetyGuardrail,
  FloorZone,
  SafetySign,
  Forklift,
  Car,
  Van,
  SemiTrailer,
  TruckTractor,
  Tree,
  StreetLamp,
} from '../3d/models/kit';
import { FacadeWindows, MansardRoof, Belfry, MairieSign, Flagpole, Fountain, Planter, TownLamp, Steps } from '../3d/models/civicProps';
import {
  MarianneBust,
  Portrait,
  Fireplace,
  Chandelier,
  GrandfatherClock,
  CouncilTable,
  StyleArmchair,
  AntiqueDesk,
  WoodenCounter,
  RegisterShelf,
  OldSafe,
  Carpet,
  WorkUnitZone,
} from '../3d/models/heritageProps';
import { ServerRack, Copier, KitchenRange, InoxWorktable, DishStation, CanteenTable, TractorMower } from '../3d/models/servicesProps';
import { Stairs } from '../3d/models/stairsProps';
import { DigiRiskCardGame } from '../3d/models/cardGameProps';
import { StationModel, CriticalBeacon } from '../3d/WorkstationProps';
import MergeStatic from '../3d/models/MergeStatic';
import { ELEMENT_KINDS, RISK_LEVELS, defaultParams } from '../../services/editorCatalog';
import { TRUCK } from '../../services/siteLayout';

/**
 * Modèle 3D d'un élément de l'éditeur (voir services/editorCatalog.js), origine au sol, face à +Z.
 * La géométrie statique est fusionnée (MergeStatic) ; les parties animées des postes restent animées.
 */
function Model({ kind, color, params, level, guard }) {
  const def = ELEMENT_KINDS[kind];
  if (def?.archetype) return <StationModel archetype={def.archetype} accent={color} />;
  switch (kind) {
    case 'workstation':
      return <Workstation chair={color} />;
    case 'workstation_dual':
      return <Workstation screens={2} chair={color} />;
    case 'desk':
      return <Desk top={color} />;
    case 'chair':
      return <OfficeChair color={color} />;
    case 'cabinet':
      return <FilingCabinet color={color} />;
    case 'shelving':
      return <Shelving color={color} />;
    case 'plant':
      return <Plant />;
    case 'bench':
      return <Bench />;
    case 'rack':
      return <PalletRack bays={params.bays} levels={params.levels} />;
    case 'pallet':
      return <Pallet />;
    case 'loaded_pallet':
      return <LoadedPallet color={color} />;
    case 'carton':
      return <Carton color={color} />;
    case 'barrel':
      return <Barrel color={color} />;
    case 'gas':
      return <GasBottle color={color} />;
    case 'ibc':
      return <IBCTank />;
    case 'palletjack':
      return <PalletJack color={color} />;
    case 'extinguisher':
      return <Extinguisher />;
    case 'firstaid':
      return <FirstAidKit />;
    case 'shower':
      return <SafetyShower />;
    case 'bollard':
      return <Bollard />;
    case 'guardrail':
      return <SafetyGuardrail length={params.length} />;
    case 'floorzone':
      return <FloorZone width={params.width} depth={params.depth} color={color} line={0.07} />;
    case 'sign_warning':
    case 'sign_mandatory':
    case 'sign_prohibition':
    case 'sign_fire':
    case 'sign_firstaid':
      return <SafetySign kind={kind.slice(5)} />;
    case 'forklift':
      return <Forklift color={color} />;
    case 'car':
      return <Car color={color} />;
    case 'van':
      return <Van color={color} />;
    case 'truck':
      // Semi-remorque attelée, centrée sur sa longueur (cabine vers +X)
      return (
        <group position={[-TRUCK.front / 2, 0, 0]}>
          <SemiTrailer />
          <TruckTractor position={[TRUCK.tractor, 0, 0]} color={color} />
        </group>
      );
    case 'tree':
      return <Tree />;
    case 'conifer':
      return <Tree variant="conifer" />;
    case 'lamp':
      return <StreetLamp />;
    case 'facade_windows':
      return <FacadeWindows length={params.length} floors={params.floors} firstLevel={params.firstLevel} baseLevel={level} />;
    case 'stairs':
      return <Stairs width={params.width} length={params.length} color={color} guard={guard} />;
    case 'grand_stairs':
      return <Stairs grand width={params.width} length={params.length} color={color} guard={guard} />;
    case 'roof_mansard':
      return (
        <group position={[0, params.elevation, 0]}>
          <MansardRoof width={params.width} depth={params.depth} height={params.height} color={color} />
        </group>
      );
    case 'belfry':
      return (
        <group position={[0, params.elevation, 0]}>
          <Belfry />
        </group>
      );
    case 'sign_mairie':
      return (
        <group position={[0, params.elevation, 0]}>
          <MairieSign />
        </group>
      );
    case 'flag_fr':
      return <Flagpole flag="fr" />;
    case 'flag_eu':
      return <Flagpole flag="eu" />;
    case 'fountain':
      return <Fountain />;
    case 'planter':
      return <Planter color={color} />;
    case 'townlamp':
      return <TownLamp color={color} />;
    case 'steps':
      return <Steps width={params.width} />;
    case 'ut_zone':
      return <WorkUnitZone width={params.width} depth={params.depth} color={color} />;
    case 'marianne_bust':
      return <MarianneBust />;
    case 'portrait':
      return (
        <group position={[0, params.elevation, 0]}>
          <Portrait />
        </group>
      );
    case 'fireplace':
      return <Fireplace />;
    case 'chandelier':
      return (
        <group position={[0, params.elevation, 0]}>
          <Chandelier rod={params.rod} />
        </group>
      );
    case 'grandfather_clock':
      return <GrandfatherClock />;
    case 'council_table':
      return <CouncilTable length={params.length} />;
    case 'style_armchair':
      return <StyleArmchair />;
    case 'antique_desk':
      return <AntiqueDesk screens={params.screens} />;
    case 'wooden_counter':
      return <WoodenCounter length={params.length} screens={params.screens} />;
    case 'copier':
      return <Copier />;
    case 'card_game':
      return (
        <group position={[0, params.elevation, 0]}>
          <DigiRiskCardGame />
        </group>
      );
    case 'register_shelf':
      return <RegisterShelf />;
    case 'old_safe':
      return <OldSafe />;
    case 'carpet':
      return <Carpet width={params.width} depth={params.depth} />;
    case 'server_rack':
      return <ServerRack />;
    case 'kitchen_range':
      return <KitchenRange />;
    case 'inox_worktable':
      return <InoxWorktable />;
    case 'dish_station':
      return <DishStation />;
    case 'canteen_table':
      return <CanteenTable />;
    case 'tractor_mower':
      return <TractorMower color={color} />;
    default:
      return null;
  }
}

/** `upperHidden` : le niveau supérieur n'est pas affiché (garde-corps de trémie d'un escalier masqué). */
export default function ElementModel({ element, upperHidden = false }) {
  const def = ELEMENT_KINDS[element.kind];
  const params = { ...defaultParams(element.kind), ...element.params };
  const risk = def?.risk ? RISK_LEVELS[element.risk] || RISK_LEVELS.low : null;
  const color = risk ? risk.color : element.color;
  const level = element.level || 0;
  const guard = !upperHidden;
  return (
    <>
      <MergeStatic deps={[element.kind, color, JSON.stringify(params), level, guard]}>
        <Model kind={element.kind} color={color} params={params} level={level} guard={guard} />
      </MergeStatic>
      {/* Gyrophare à l'angle du poste, ou de la zone d'unité de travail (taille réglable) */}
      {element.risk === 'crit' && <CriticalBeacon position={def?.archetype ? [2.15, 0, -1.75] : [params.width / 2 - 0.25, 0, -params.depth / 2 + 0.25]} />}
    </>
  );
}
