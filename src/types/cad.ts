export type LayerId = 'rf_iot' | 'ethernet_data' | 'electrical' | 'hvac_plumbing';

export type WallMaterialType = 
  | 'plasterboard'    // Sádrokarton (100-125mm)
  | 'brick_interior'  // Vnitřní příčková cihla (115-150mm)
  | 'brick_exterior'  // Obvodová nosná cihla (300-450mm)
  | 'reinforced_concrete' // Železobeton (200-300mm)
  | 'insulating_glass'    // Izolační trojsklo (40mm)
  | 'wood_interior';      // Dřevěná příčka / dveře (40-80mm)

export interface WallMaterialDef {
  id: WallMaterialType;
  name: string;
  defaultThicknessMm: number; // v mm
  color: string;
  threeColor: number;
  roughness: number;
  attenuationDb: {
    rf433: number;   // CC1101 Sub-GHz 433.92 MHz
    rf868: number;   // 868 MHz (Zigbee / LoRa / CC1101 balun)
    rf2400: number;  // 2.4 GHz (WiFi 802.11b/g/n, Zigbee ZHA, BLE)
    rf5000: number;  // 5 GHz (WiFi 5/6/7)
  };
}

export interface Point2D {
  x: number; // v cm od počátku projektu
  y: number; // v cm od počátku projektu
}

export interface WallOpening {
  id: string;
  type: 'door' | 'window';
  positionRatio: number; // 0.0 až 1.0 podél stěny
  widthMm: number;
  heightMm: number;
}

export interface Wall {
  id: string;
  start: Point2D;
  end: Point2D;
  thicknessMm: number; // přesná tloušťka z laserového dálkoměru
  heightMm: number;
  material: WallMaterialType;
  openings: WallOpening[];
  routingChannels?: {
    id: string;
    layer: LayerId;
    depthMm: number; // hloubka drážky ve zdi
    label: string;
  }[];
}

export interface Room {
  id: string;
  name: string;
  wallIds: string[]; // uzavřený okruh stěn
  areaSquareMeters: number;
  floorHeightMm: number;
  color: string;
  notesMarkdown?: string;
  type: 'server_room' | 'living' | 'corridor' | 'utility_boiler' | 'office' | 'bedroom' | 'bathroom';
}

export type FrequencyBand = 'rf433' | 'rf868' | 'rf2400' | 'rf5000';

export interface DeviceNode {
  id: string;
  name: string;
  layer: LayerId;
  position: Point2D; // v cm
  elevationMm: number; // výška nad podlahou v mm (např. 1500mm na stěně, 2400mm na stropě)
  mac?: string;
  ip?: string;
  role: 'gateway' | 'router_ap' | 'end_device' | 'server' | 'switch' | 'inverter' | 'relay' | 'sensor';
  rfConfig?: {
    band: FrequencyBand;
    txPowerDbm: number; // např. 10 dBm u CC1101, 20 dBm u WiFi AP
    frequencyMhz: number;
    protocol: string; // např. 'EmberZNet', 'EV1527', 'WiFi 6', 'BLE 5.2'
    attenuationPenaltyDb?: number; // např. 30dB kvůli 868MHz filtru na 433MHz
  };
  details?: Record<string, string | number>;
  notesMarkdown?: string;
}

export interface TechnicalRoute {
  id: string;
  layer: LayerId;
  name: string;
  points: Point2D[];
  elevationMm: number;
  type: 'cat6a' | 'fiber' | 'power_230v' | 'heating_pipe' | 'water_cold' | 'water_hot' | 'drainage';
  installationMethod: 'in_wall' | 'in_floor' | 'surface_trunking' | 'tray_ceiling';
  connectedDeviceIds: string[];
}

export interface CadProject {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  unit: 'mm' | 'cm';
  gridSnapCm: number;
  building: {
    floors: {
      id: string;
      level: number;
      name: string;
      ceilingHeightMm: number;
      walls: Wall[];
      rooms: Room[];
      devices: DeviceNode[];
      routes: TechnicalRoute[];
    }[];
  };
  activeFloorId: string;
  activeLayer: LayerId;
  visibleLayers: Record<LayerId, boolean>;
  rfSimulation: {
    activeBand: FrequencyBand;
    sourceDeviceId: string;
    gridResolutionCm: number;
    cutoffDbm: number;
  };
}

export interface AiBridgePayload {
  version: '1.0';
  project_meta: {
    name: string;
    timestamp: string;
    active_floor: string;
    total_walls: number;
    total_rooms: number;
    total_devices: number;
  };
  spatial_topology: {
    rooms: {
      id: string;
      name: string;
      area_m2: number;
      type: string;
    }[];
    walls_summary: {
      id: string;
      length_cm: number;
      thickness_mm: number;
      material: WallMaterialType;
      rf_attenuation_db: Record<FrequencyBand, number>;
    }[];
  };
  iot_network_state: {
    devices: {
      id: string;
      name: string;
      role: string;
      ip?: string;
      mac?: string;
      band?: string;
      tx_power_dbm?: number;
      protocol?: string;
      position_cm: [number, number];
    }[];
    weak_zones_detected?: {
      room_name: string;
      predicted_rssi_dbm: number;
      problem: string;
    }[];
  };
  technical_routes: {
    id: string;
    layer: LayerId;
    type: string;
    length_m: number;
  }[];
}
