import { DeviceNode, CadProject } from '../types/cad';

export const INVENTORY_CATALOG: Omit<DeviceNode, 'id' | 'position'>[] = [
  {
    name: 'ESP32-S3 433MHz Gateway (CC1101 M115)',
    layer: 'rf_iot',
    elevationMm: 1400,
    ip: '192.168.1.109',
    mac: '30:ED:A0:BD:31:F4',
    role: 'gateway',
    rfConfig: {
      band: 'rf433',
      frequencyMhz: 433.92,
      txPowerDbm: 10,
      protocol: 'EV1527 / RC-Switch Protocol 3',
      attenuationPenaltyDb: 30, // 868MHz LC balun filtr tlumí 433MHz o ~30dB!
    },
    details: {
      framework: 'ESP-IDF v5.5+ (Xtensa LX7 dual-core, 16MB Flash, 8MB PSRAM)',
      cc1101_spi: 'CLK: GPIO38, MISO: GPIO37, MOSI: GPIO35, CS: GPIO21',
      gdo_pins: 'GDO0 TX: GPIO40, GDO2 RX: GPIO47',
      rmt_limit: 'rmt_symbols: 64 TX / 128 RX',
    },
    notesMarkdown: `### ESP32-S3 433MHz Sub-GHz Gateway
- **Hardware:** ESP32-S3-WROOM-1-N16R8 CAM + CC1101 M115
- **Varování:** Fyzický balun filtr je laděn na 868 MHz. Na 433.92 MHz je útlum 25–35 dB, dosah vysílání je cca 15–50 cm.
- **Příjem (RX):** Plně funkční pro EMOS P0065 i klíčenky.`,
  },
  {
    name: 'ROUTERBE3600 (OpenWrt)',
    layer: 'ethernet_data',
    elevationMm: 2100,
    ip: '192.168.1.1',
    role: 'router_ap',
    rfConfig: {
      band: 'rf5000',
      frequencyMhz: 5180,
      txPowerDbm: 23,
      protocol: 'WiFi 7 / 802.11be',
    },
    details: {
      firmware: 'OpenWrt 24.10 Snapshot',
      uplink: 'Starlink Gen2 Bypass WAN',
      dns: '192.168.1.50 (AdGuard Home)',
    },
    notesMarkdown: `Hlavní L3 směrovač OpenWrt BE3600. Dual-band WiFi 2.4/5GHz.`,
  },
  {
    name: 'Home Assistant MiniPC (BARE-METAL HAOS)',
    layer: 'rf_iot',
    elevationMm: 1200,
    ip: '192.168.1.110:8123',
    mac: 'B0:5C:DA:3B:05:A9',
    role: 'server',
    rfConfig: {
      band: 'rf2400',
      frequencyMhz: 2405, // Zigbee CH 11
      txPowerDbm: 20,
      protocol: 'Zigbee ZHA (EmberZNet na Sonoff Dongle-E)',
    },
    details: {
      os: 'HAOS 18.3, Core 2026.10.2, Supervisor 2026.10.2',
      coordinator: 'Sonoff ZBDongle-E (EFR32MG21, EZSP/EmberZNet)',
    },
    notesMarkdown: `Hlavní řídicí uzel Home Assistant. Běží na něm regulace topení, Generic Thermostat i Zigbee síť.`,
  },
  {
    name: 'Dell PowerEdge R510 (Proxmox VE 7.4)',
    layer: 'ethernet_data',
    elevationMm: 600,
    ip: '192.168.1.108',
    mac: '78:2B:CB:19:0D:FD',
    role: 'server',
    details: {
      cpu: '2x Intel Xeon L5640 (Westmere-EP, absence AVX/AVX2!)',
      kernel: 'Linux 5.15 Bullseye',
      lxc_services: 'CT 103: AdGuard Home (192.168.1.50)',
    },
    notesMarkdown: `Proxmox hypervizor 11. generace Dell R510. Pozor na absenci instrukcí AVX u novějších kontejnerů.`,
  },
  {
    name: 'TrueNAS SCALE 27.0 (truenas2)',
    layer: 'ethernet_data',
    elevationMm: 800,
    ip: '192.168.1.115',
    role: 'server',
    details: {
      pool: 'ZFS RAID-Z2',
      shares: 'NFS / SMB pro automatické zálohy CAD projektů a HA snímačů',
    },
  },
  {
    name: 'CARSPA MKS1000-12 Střídač (solar-bridge)',
    layer: 'electrical',
    elevationMm: 1600,
    role: 'inverter',
    details: {
      protocol: 'Voltronic PI30 přes RJ45 RS-232, 2400 baud 8N1',
      bridge: 'ESP32-DevKitV1 na GPIO17 (TX) a GPIO18 (RX) s MAX3232',
    },
    notesMarkdown: `Ostrovní FVE střídač Carspa. RS-232 komunikace s ESP32 bridge.`,
  },
  {
    name: 'Spínač pohonu EP8 (switch.ep8)',
    layer: 'electrical',
    elevationMm: 1100,
    role: 'relay',
    details: {
      target: 'Oběhové čerpadlo okruhu EP8',
      entity_id: 'switch.ep8',
      thermostat: 'climate.ep8_topenicko',
    },
  },
  {
    name: 'Termostatická hlavice Kutloch',
    layer: 'hvac_plumbing',
    elevationMm: 450,
    role: 'sensor',
    rfConfig: {
      band: 'rf2400',
      frequencyMhz: 2405,
      txPowerDbm: 10,
      protocol: 'Zigbee 3.0',
    },
    details: {
      entity_id: 'climate.lukaskuv_kutloch_termostaticka_hlavice_1',
    },
  },
  {
    name: 'Tuya Snímač Teploty a Vlhkosti',
    layer: 'rf_iot',
    elevationMm: 1500,
    role: 'sensor',
    rfConfig: {
      band: 'rf2400',
      frequencyMhz: 2405,
      txPowerDbm: 8,
      protocol: 'Zigbee 3.0 / Tuya',
    },
    details: {
      temp_entity: 'sensor.smart_temperature_humidity_sensor_teplota',
      hum_entity: 'sensor.smart_temperature_humidity_sensor_vlhkost_vzduchu',
      battery_entity: 'sensor.smart_temperature_humidity_sensor_baterie',
    },
  },
  {
    name: 'RF Zásuvka EMOS P0065 #1',
    layer: 'rf_iot',
    elevationMm: 300,
    role: 'end_device',
    rfConfig: {
      band: 'rf433',
      frequencyMhz: 433.92,
      txPowerDbm: 0,
      protocol: 'EV1527 / RC-Switch Protocol 3',
    },
    details: {
      address: 'RC-Switch protocol 3, pulse length ~350us',
      control_via: 'ESP32-S3 433MHz Gateway (192.168.1.109)',
    },
  },
];

export const INITIAL_PROJECT: CadProject = {
  id: 'proj_default_local',
  name: 'Projekt Bydlení & IoT Topologie',
  createdAt: '2026-10-24T00:00:00Z',
  updatedAt: '2026-10-24T00:00:00Z',
  unit: 'cm',
  gridSnapCm: 10, // 10cm krok rastru
  activeFloorId: 'floor_1',
  activeLayer: 'rf_iot',
  visibleLayers: {
    rf_iot: true,
    ethernet_data: true,
    electrical: true,
    hvac_plumbing: true,
  },
  rfSimulation: {
    activeBand: 'rf433',
    sourceDeviceId: 'dev_esp32_rf',
    gridResolutionCm: 25,
    cutoffDbm: -95,
  },
  building: {
    floors: [
      {
        id: 'floor_1',
        level: 1,
        name: '1. Nadzemní podlaží (1.NP)',
        ceilingHeightMm: 2650,
        walls: [
          // Obvodové nosné zdi (440mm cihla)
          {
            id: 'w_ext_south',
            start: { x: 100, y: 100 },
            end: { x: 1000, y: 100 },
            thicknessMm: 380,
            heightMm: 2650,
            material: 'brick_exterior',
            openings: [{ id: 'op_win1', type: 'window', positionRatio: 0.35, widthMm: 1500, heightMm: 1400 }],
          },
          {
            id: 'w_ext_east',
            start: { x: 1000, y: 100 },
            end: { x: 1000, y: 700 },
            thicknessMm: 380,
            heightMm: 2650,
            material: 'brick_exterior',
            openings: [{ id: 'op_win2', type: 'window', positionRatio: 0.5, widthMm: 1200, heightMm: 1400 }],
          },
          {
            id: 'w_ext_north',
            start: { x: 1000, y: 700 },
            end: { x: 100, y: 700 },
            thicknessMm: 380,
            heightMm: 2650,
            material: 'brick_exterior',
            openings: [],
          },
          {
            id: 'w_ext_west',
            start: { x: 100, y: 700 },
            end: { x: 100, y: 100 },
            thicknessMm: 380,
            heightMm: 2650,
            material: 'brick_exterior',
            openings: [{ id: 'op_door_main', type: 'door', positionRatio: 0.25, widthMm: 900, heightMm: 2050 }],
          },

          // Vnitřní nosná zeď - Železobeton (250mm) oddělující serverovnu a technickou místnost
          {
            id: 'w_int_concrete_1',
            start: { x: 420, y: 100 },
            end: { x: 420, y: 450 },
            thicknessMm: 250,
            heightMm: 2650,
            material: 'reinforced_concrete',
            openings: [{ id: 'op_door_server', type: 'door', positionRatio: 0.6, widthMm: 800, heightMm: 2000 }],
          },

          // Vnitřní příčková cihla (140mm)
          {
            id: 'w_int_brick_1',
            start: { x: 420, y: 450 },
            end: { x: 100, y: 450 },
            thicknessMm: 140,
            heightMm: 2650,
            material: 'brick_interior',
            openings: [{ id: 'op_door_tech', type: 'door', positionRatio: 0.45, widthMm: 800, heightMm: 2000 }],
          },

          // Sádrokartonová příčka (100mm) v obytné zóně
          {
            id: 'w_int_sdk_1',
            start: { x: 420, y: 450 },
            end: { x: 1000, y: 450 },
            thicknessMm: 100,
            heightMm: 2650,
            material: 'plasterboard',
            openings: [{ id: 'op_door_living', type: 'door', positionRatio: 0.7, widthMm: 800, heightMm: 2000 }],
          },
        ],
        rooms: [
          {
            id: 'room_server',
            name: 'Serverovna / Rack Node',
            wallIds: ['w_ext_south', 'w_int_concrete_1', 'w_int_brick_1', 'w_ext_west'],
            areaSquareMeters: 11.2,
            floorHeightMm: 2650,
            color: '#1e293b',
            type: 'server_room',
            notesMarkdown: `### Centrální IT Rozvaděč & Hypervizor
- Dell PowerEdge R510 (192.168.1.108)
- Home Assistant Bare-metal MiniPC (192.168.1.110)
- TrueNAS SCALE (192.168.1.115)
- Napájeno ze zálohovaného okruhu FVE.`,
          },
          {
            id: 'room_tech_fve',
            name: 'Technická místnost & FVE',
            wallIds: ['w_ext_west', 'w_int_brick_1', 'w_ext_north'],
            areaSquareMeters: 8.0,
            floorHeightMm: 2650,
            color: '#334155',
            type: 'utility_boiler',
            notesMarkdown: `### Energetický uzel & Topení
- Střídač Carspa MKS1000-12 s RS232 solar-bridge
- Spínací relé otopného okruhu switch.ep8
- Rozvaděč podlahového topení a oběhové čerpadlo.`,
          },
          {
            id: 'room_living',
            name: 'Obývací pokoj & Kutloch',
            wallIds: ['w_int_concrete_1', 'w_ext_south', 'w_ext_east', 'w_int_sdk_1'],
            areaSquareMeters: 20.3,
            floorHeightMm: 2650,
            color: '#0f172a',
            type: 'living',
            notesMarkdown: `### Hlavní obytná zóna
- Zigbee TRV Kutloch (climate.lukaskuv_kutloch_termostaticka_hlavice_1)
- Tuya senzor teploty a vlhkosti.`,
          },
          {
            id: 'room_corridor',
            name: 'Chodba & Vstup',
            wallIds: ['w_int_sdk_1', 'w_ext_north', 'w_ext_east'],
            areaSquareMeters: 14.5,
            floorHeightMm: 2650,
            color: '#1e293b',
            type: 'corridor',
          },
        ],
        devices: [
          {
            id: 'dev_esp32_rf',
            name: 'ESP32-S3 433MHz Gateway',
            layer: 'rf_iot',
            position: { x: 260, y: 250 },
            elevationMm: 1400,
            ip: '192.168.1.109',
            mac: '30:ED:A0:BD:31:F4',
            role: 'gateway',
            rfConfig: {
              band: 'rf433',
              frequencyMhz: 433.92,
              txPowerDbm: 10,
              protocol: 'EV1527 Sub-GHz (CC1101 M115)',
              attenuationPenaltyDb: 30,
            },
          },
          {
            id: 'dev_ha_baremetal',
            name: 'Home Assistant Bare-metal',
            layer: 'rf_iot',
            position: { x: 300, y: 160 },
            elevationMm: 1100,
            ip: '192.168.1.110:8123',
            mac: 'B0:5C:DA:3B:05:A9',
            role: 'server',
            rfConfig: {
              band: 'rf2400',
              frequencyMhz: 2405,
              txPowerDbm: 20,
              protocol: 'Zigbee ZHA (EmberZNet)',
            },
          },
          {
            id: 'dev_dell_r510',
            name: 'Dell PowerEdge R510 (PVE 7.4)',
            layer: 'ethernet_data',
            position: { x: 200, y: 160 },
            elevationMm: 600,
            ip: '192.168.1.108',
            mac: '78:2B:CB:19:0D:FD',
            role: 'server',
          },
          {
            id: 'dev_router_openwrt',
            name: 'OpenWrt Router BE3600',
            layer: 'ethernet_data',
            position: { x: 350, y: 200 },
            elevationMm: 2100,
            ip: '192.168.1.1',
            role: 'router_ap',
            rfConfig: {
              band: 'rf5000',
              frequencyMhz: 5180,
              txPowerDbm: 23,
              protocol: 'WiFi 7 (802.11be)',
            },
          },
          {
            id: 'dev_fve_carspa',
            name: 'Carspa MKS1000-12 (solar-bridge)',
            layer: 'electrical',
            position: { x: 220, y: 550 },
            elevationMm: 1600,
            role: 'inverter',
          },
          {
            id: 'dev_relay_ep8',
            name: 'Spínač relé switch.ep8',
            layer: 'electrical',
            position: { x: 280, y: 600 },
            elevationMm: 1200,
            role: 'relay',
          },
          {
            id: 'dev_trv_kutloch',
            name: 'TRV Hlavice Kutloch',
            layer: 'hvac_plumbing',
            position: { x: 880, y: 220 },
            elevationMm: 450,
            role: 'sensor',
            rfConfig: {
              band: 'rf2400',
              frequencyMhz: 2405,
              txPowerDbm: 10,
              protocol: 'Zigbee 3.0',
            },
          },
          {
            id: 'dev_tuya_sensor',
            name: 'Tuya Snímač Teploty & Vlhkosti',
            layer: 'rf_iot',
            position: { x: 700, y: 350 },
            elevationMm: 1500,
            role: 'sensor',
            rfConfig: {
              band: 'rf2400',
              frequencyMhz: 2405,
              txPowerDbm: 8,
              protocol: 'Zigbee 3.0',
            },
          },
          {
            id: 'dev_emos_p0065',
            name: 'RF Zásuvka EMOS P0065 (Kutloch)',
            layer: 'rf_iot',
            position: { x: 920, y: 380 },
            elevationMm: 300,
            role: 'end_device',
            rfConfig: {
              band: 'rf433',
              frequencyMhz: 433.92,
              txPowerDbm: 0,
              protocol: 'EV1527',
            },
          },
        ],
        routes: [
          {
            id: 'route_eth_backbone',
            layer: 'ethernet_data',
            name: 'Páteřní Cat6a: Dell R510 -> OpenWrt -> Zásuvka Kutloch',
            type: 'cat6a',
            installationMethod: 'in_wall',
            elevationMm: 300,
            points: [
              { x: 200, y: 160 },
              { x: 350, y: 200 },
              { x: 420, y: 450 },
              { x: 880, y: 450 },
              { x: 880, y: 220 },
            ],
            connectedDeviceIds: ['dev_dell_r510', 'dev_router_openwrt'],
          },
          {
            id: 'route_power_fve',
            layer: 'electrical',
            name: 'FVE AC 230V Záloha: Carspa -> Serverový rozvaděč',
            type: 'power_230v',
            installationMethod: 'in_wall',
            elevationMm: 2200,
            points: [
              { x: 220, y: 550 },
              { x: 220, y: 450 },
              { x: 220, y: 160 },
            ],
            connectedDeviceIds: ['dev_fve_carspa', 'dev_dell_r510'],
          },
          {
            id: 'route_heating_ep8',
            layer: 'hvac_plumbing',
            name: 'Otopný okruh EP8: Čerpadlo -> Radiátory Kutloch',
            type: 'heating_pipe',
            installationMethod: 'in_floor',
            elevationMm: -50,
            points: [
              { x: 280, y: 600 },
              { x: 420, y: 600 },
              { x: 750, y: 450 },
              { x: 880, y: 220 },
            ],
            connectedDeviceIds: ['dev_relay_ep8', 'dev_trv_kutloch'],
          },
        ],
      },
    ],
  },
};
