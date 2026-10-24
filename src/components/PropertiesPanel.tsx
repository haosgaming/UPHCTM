import React, { useState } from 'react';
import { 
  CadProject, 
  Wall, 
  DeviceNode, 
  Room, 
  WallMaterialType, 
  LayerId,
  FrequencyBand 
} from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { INVENTORY_CATALOG } from '../constants/inventoryHardware';
import { distanceCm } from '../utils/cadMath';
import { 
  Ruler, 
  Trash2, 
  Radio, 
  Wifi, 
  Cpu, 
  Zap, 
  Layers,
  FileText,
  Sliders,
  Eye,
  EyeOff,
  Flame,
  Network,
  Info,
  CheckCircle2
} from 'lucide-react';

interface PropertiesPanelProps {
  project: CadProject;
  selectedWallId: string | null;
  selectedDeviceId: string | null;
  selectedRoomId: string | null;
  activeMaterial: WallMaterialType;
  wallThicknessMm: number;
  deviceToPlace: Omit<DeviceNode, 'id' | 'position'> | null;
  onChangeActiveMaterial: (mat: WallMaterialType) => void;
  onChangeWallThickness: (thMm: number) => void;
  onSetDeviceToPlace: (dev: Omit<DeviceNode, 'id' | 'position'> | null) => void;
  onRequestLaserModal: (wall: Wall) => void;
  onOpenDocDrawer: (item: { title: string; markdown: string }) => void;
  onUpdateProject: (updated: CadProject, commitToHistory?: boolean) => void;
  onDeleteWall: (id: string) => void;
  onDeleteDevice: (id: string) => void;
}

export const PropertiesPanel: React.FC<PropertiesPanelProps> = ({
  project,
  selectedWallId,
  selectedDeviceId,
  selectedRoomId,
  activeMaterial,
  wallThicknessMm,
  deviceToPlace,
  onChangeActiveMaterial,
  onChangeWallThickness,
  onSetDeviceToPlace,
  onRequestLaserModal,
  onOpenDocDrawer,
  onUpdateProject,
  onDeleteWall,
  onDeleteDevice,
}) => {
  const [activeTab, setActiveTab] = useState<'inspector' | 'layers' | 'hardware' | 'rf'>('inspector');

  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];
  const selectedWall = activeFloor.walls.find((w) => w.id === selectedWallId);
  const selectedDevice = activeFloor.devices.find((d) => d.id === selectedDeviceId);
  const selectedRoom = activeFloor.rooms.find((r) => r.id === selectedRoomId);

  const getLayerIcon = (layerId: LayerId) => {
    switch (layerId) {
      case 'rf_iot': return <Radio className="w-4 h-4 text-[#00F0FF]" />;
      case 'ethernet_data': return <Network className="w-4 h-4 text-[#3B82F6]" />;
      case 'electrical': return <Zap className="w-4 h-4 text-[#F59E0B]" />;
      case 'hvac_plumbing': return <Flame className="w-4 h-4 text-[#10B981]" />;
    }
  };

  return (
    <div className="w-84 bg-[#101522] border-l border-white/10 flex flex-col h-full text-xs text-gray-300 shrink-0 select-none shadow-2xl">
      {/* 4 Clean Navigation Tabs */}
      <div className="flex border-b border-white/10 bg-[#0d121c] p-1 gap-1">
        <button
          onClick={() => setActiveTab('inspector')}
          className={`flex-1 py-2 px-1 text-center font-semibold rounded-lg transition-all ${
            activeTab === 'inspector'
              ? 'bg-[#182030] text-[#00F0FF] border border-[#00F0FF]/30 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Prvek
        </button>
        <button
          onClick={() => setActiveTab('layers')}
          className={`flex-1 py-2 px-1 text-center font-semibold rounded-lg transition-all ${
            activeTab === 'layers'
              ? 'bg-[#182030] text-[#00F0FF] border border-[#00F0FF]/30 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Vrstvy
        </button>
        <button
          onClick={() => setActiveTab('hardware')}
          className={`flex-1 py-2 px-1 text-center font-semibold rounded-lg transition-all ${
            activeTab === 'hardware'
              ? 'bg-[#182030] text-[#00F0FF] border border-[#00F0FF]/30 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          Katalog
        </button>
        <button
          onClick={() => setActiveTab('rf')}
          className={`flex-1 py-2 px-1 text-center font-semibold rounded-lg transition-all ${
            activeTab === 'rf'
              ? 'bg-[#182030] text-[#00F0FF] border border-[#00F0FF]/30 shadow-sm'
              : 'text-gray-400 hover:text-white hover:bg-white/5'
          }`}
        >
          RF Pokrytí
        </button>
      </div>

      {/* Tab Content Body */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {/* TAB 1: INSPEKTOR PRVKŮ */}
        {activeTab === 'inspector' && (
          <div className="space-y-4">
            {selectedWall ? (
              <div className="bg-[#141b29] border border-white/10 rounded-xl p-4 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Ruler className="w-4 h-4 text-[#00F0FF]" />
                    Vybraná stěna
                  </span>
                  <button
                    onClick={() => onDeleteWall(selectedWall.id)}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Odstranit stěnu z projektu"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Délka:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {distanceCm(selectedWall.start, selectedWall.end).toFixed(1)} cm
                    </span>
                    <div className="text-gray-500 text-[10px] font-mono">
                      {Math.round(distanceCm(selectedWall.start, selectedWall.end) * 10)} mm
                    </div>
                  </div>
                  <div className="bg-black/30 p-2.5 rounded-lg border border-white/5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Tloušťka:</span>
                    <span className="font-mono font-bold text-white text-sm">
                      {selectedWall.thicknessMm} mm
                    </span>
                    <div className="text-gray-500 text-[10px]">
                      Výška: {selectedWall.heightMm} mm
                    </div>
                  </div>
                </div>

                <button
                  onClick={() => onRequestLaserModal(selectedWall)}
                  className="w-full bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-bold py-2 rounded-xl flex items-center justify-center gap-2 transition-all shadow-md shadow-[#00F0FF]/20"
                >
                  <Ruler className="w-4 h-4" />
                  Zadat přesnou kótu z dálkoměru
                </button>

                <div>
                  <label className="block text-gray-400 text-[11px] font-medium mb-1.5">Materiál konstrukce:</label>
                  <select
                    value={selectedWall.material}
                    onChange={(e) => {
                      const newMat = e.target.value as WallMaterialType;
                      const updatedFloors = project.building.floors.map((fl) => {
                        if (fl.id === activeFloor.id) {
                          return {
                            ...fl,
                            walls: fl.walls.map((w) =>
                              w.id === selectedWall.id
                                ? { ...w, material: newMat, thicknessMm: WALL_MATERIALS[newMat].defaultThicknessMm }
                                : w
                            ),
                          };
                        }
                        return fl;
                      });
                      onUpdateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, true);
                    }}
                    className="w-full bg-[#0a0f18] border border-white/20 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00F0FF]"
                  >
                    {Object.values(WALL_MATERIALS).map((m) => (
                      <option key={m.id} value={m.id}>
                        {m.name}
                      </option>
                    ))}
                  </select>
                </div>

                {/* RF Attenuation Table */}
                <div className="bg-[#0a0f18] p-3 rounded-xl border border-white/5 space-y-1.5 text-[11px]">
                  <div className="text-[#00F0FF] font-semibold">RF útlum materiálu při prostupu:</div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-gray-400">Sub-GHz 433 MHz:</span>
                    <span className="font-mono text-white font-bold">{WALL_MATERIALS[selectedWall.material].attenuationDb.rf433} dB</span>
                  </div>
                  <div className="flex justify-between py-0.5 border-b border-white/5">
                    <span className="text-gray-400">Zigbee / WiFi 2.4 GHz:</span>
                    <span className="font-mono text-emerald-400 font-bold">{WALL_MATERIALS[selectedWall.material].attenuationDb.rf2400} dB</span>
                  </div>
                  <div className="flex justify-between py-0.5">
                    <span className="text-gray-400">WiFi 5 GHz / 6 GHz:</span>
                    <span className="font-mono text-amber-400 font-bold">{WALL_MATERIALS[selectedWall.material].attenuationDb.rf5000} dB</span>
                  </div>
                </div>
              </div>
            ) : selectedDevice ? (
              <div className="bg-[#141b29] border border-white/10 rounded-xl p-4 space-y-3.5 shadow-lg">
                <div className="flex items-center justify-between border-b border-white/10 pb-2.5">
                  <span className="font-bold text-white text-xs flex items-center gap-2">
                    <Cpu className="w-4 h-4 text-[#00F0FF]" />
                    Vybrané zařízení
                  </span>
                  <button
                    onClick={() => onDeleteDevice(selectedDevice.id)}
                    className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded-lg transition-colors"
                    title="Odstranit zařízení"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>

                <div>
                  <div className="font-bold text-white text-sm">{selectedDevice.name}</div>
                  <div className="text-gray-400 text-[11px] capitalize mt-0.5">Role: {selectedDevice.role}</div>
                </div>

                <div className="bg-black/30 p-3 rounded-xl border border-white/5 space-y-1.5 font-mono text-xs">
                  {selectedDevice.ip && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">IP adresa:</span>
                      <span className="text-[#00F0FF]">{selectedDevice.ip}</span>
                    </div>
                  )}
                  {selectedDevice.mac && (
                    <div className="flex justify-between">
                      <span className="text-gray-400">MAC:</span>
                      <span className="text-gray-300">{selectedDevice.mac}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span className="text-gray-400">Montážní výška:</span>
                    <span className="text-white">{selectedDevice.elevationMm} mm</span>
                  </div>
                </div>

                {selectedDevice.notesMarkdown && (
                  <button
                    onClick={() =>
                      onOpenDocDrawer({
                        title: selectedDevice.name,
                        markdown: selectedDevice.notesMarkdown || '',
                      })
                    }
                    className="w-full bg-white/10 hover:bg-white/15 text-white py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Otevřít technické poznámky
                  </button>
                )}
              </div>
            ) : selectedRoom ? (
              <div className="bg-[#141b29] border border-white/10 rounded-xl p-4 space-y-3.5 shadow-lg">
                <div className="border-b border-white/10 pb-2.5">
                  <span className="font-bold text-white text-xs">Vybraná místnost</span>
                  <h3 className="text-sm font-bold text-[#00F0FF] mt-1">{selectedRoom.name}</h3>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Výměra:</span>
                    <span className="font-mono font-bold text-white text-base">{selectedRoom.areaSquareMeters} m²</span>
                  </div>
                  <div className="bg-black/30 p-3 rounded-xl border border-white/5">
                    <span className="text-gray-400 text-[10px] uppercase font-bold block">Světlá výška:</span>
                    <span className="font-mono font-bold text-white text-base">{selectedRoom.floorHeightMm} mm</span>
                  </div>
                </div>

                {selectedRoom.notesMarkdown && (
                  <button
                    onClick={() =>
                      onOpenDocDrawer({
                        title: selectedRoom.name,
                        markdown: selectedRoom.notesMarkdown || '',
                      })
                    }
                    className="w-full bg-white/10 hover:bg-white/15 text-white py-2 rounded-xl flex items-center justify-center gap-2 transition-colors font-medium"
                  >
                    <FileText className="w-4 h-4" />
                    Dokumentace k místnosti
                  </button>
                )}
              </div>
            ) : (
              <div className="space-y-4">
                <div className="bg-[#141b29] border border-white/10 rounded-xl p-4 space-y-3 shadow-lg">
                  <span className="font-bold text-white text-xs block">Výchozí nastavení pro kreslení zdí:</span>
                  <div>
                    <label className="block text-gray-400 text-[11px] mb-1">Materiál:</label>
                    <select
                      value={activeMaterial}
                      onChange={(e) => {
                        const m = e.target.value as WallMaterialType;
                        onChangeActiveMaterial(m);
                        onChangeWallThickness(WALL_MATERIALS[m].defaultThicknessMm);
                      }}
                      className="w-full bg-[#0a0f18] border border-white/20 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00F0FF]"
                    >
                      {Object.values(WALL_MATERIALS).map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-gray-400">Tloušťka zdiva:</span>
                    <span className="font-mono font-bold text-white">{wallThicknessMm} mm</span>
                  </div>
                </div>

                <div className="text-gray-400 text-[11px] italic p-3 text-center border border-dashed border-white/10 rounded-xl">
                  Kliknutím na stěnu, uzel nebo místnost zobrazíte technické kóty a parametry.
                </div>
              </div>
            )}
          </div>
        )}

        {/* TAB 2: VRSTVY ROZVODŮ */}
        {activeTab === 'layers' && (
          <div className="space-y-3">
            <span className="text-gray-400 text-xs font-semibold block">Profesní technické vrstvy:</span>
            <div className="space-y-2">
              {LAYER_DEFINITIONS.map((def) => {
                const isVisible = project.visibleLayers[def.id];
                const isActive = project.activeLayer === def.id;
                const devCount = activeFloor.devices.filter((d) => d.layer === def.id).length;
                const routes = activeFloor.routes.filter((r) => r.layer === def.id);
                const totalMeters = (
                  routes.reduce((acc, rt) => {
                    return (
                      acc +
                      rt.points.reduce((subAcc, p, i) => {
                        if (i === 0) return 0;
                        return subAcc + distanceCm(rt.points[i - 1], p);
                      }, 0) / 100
                    );
                  }, 0)
                ).toFixed(1);

                return (
                  <div
                    key={def.id}
                    className={`bg-[#141b29] border rounded-xl p-3 space-y-2 transition-all ${
                      isActive ? 'border-[#00F0FF]/50 shadow-md' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getLayerIcon(def.id)}
                        <span className="font-bold text-white text-xs">{def.shortName}</span>
                      </div>
                      <button
                        onClick={() => {
                          const updated = {
                            ...project.visibleLayers,
                            [def.id]: !project.visibleLayers[def.id],
                          };
                          onUpdateProject({ ...project, visibleLayers: updated }, true);
                        }}
                        className={`p-1.5 rounded-lg transition-colors ${
                          isVisible ? 'text-[#00F0FF] bg-[#00F0FF]/15' : 'text-gray-500 bg-white/5'
                        }`}
                        title={isVisible ? 'Skrýt vrstvu' : 'Zobrazit vrstvu'}
                      >
                        {isVisible ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                      </button>
                    </div>

                    <div className="text-[11px] text-gray-400">{def.description}</div>

                    <div className="flex items-center justify-between text-[11px] pt-1 border-t border-white/5 font-mono">
                      <span>Prvků: <strong className="text-white">{devCount}</strong></span>
                      <span>Délka tras: <strong className="text-[#00F0FF]">{totalMeters} m</strong></span>
                    </div>

                    <button
                      onClick={() => onUpdateProject({ ...project, activeLayer: def.id }, true)}
                      className={`w-full py-1.5 rounded-lg text-xs font-semibold transition-all ${
                        isActive
                          ? 'bg-[#00F0FF] text-black font-bold'
                          : 'bg-white/5 hover:bg-white/10 text-gray-300'
                      }`}
                    >
                      {isActive ? 'Aktivní vrstva pro kreslení' : 'Přepnout na tuto vrstvu'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 3: KATALOG ZAŘÍZENÍ */}
        {activeTab === 'hardware' && (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-gray-400 text-xs font-semibold">Předkonfigurovaný hardware:</span>
              {deviceToPlace && (
                <button
                  onClick={() => onSetDeviceToPlace(null)}
                  className="text-red-400 hover:underline text-[11px]"
                >
                  Zrušit
                </button>
              )}
            </div>

            <div className="space-y-2">
              {INVENTORY_CATALOG.map((cat, idx) => {
                const isSelected = deviceToPlace?.name === cat.name;
                return (
                  <div
                    key={idx}
                    className={`bg-[#141b29] border rounded-xl p-3 space-y-2 transition-all ${
                      isSelected ? 'border-[#00F0FF] bg-[#00F0FF]/10' : 'border-white/10'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      {getLayerIcon(cat.layer)}
                      <div className="font-bold text-white text-xs truncate flex-1">{cat.name}</div>
                    </div>

                    <div className="text-[11px] text-gray-400 font-mono space-y-0.5">
                      {cat.ip && <div>IP: <span className="text-[#00F0FF]">{cat.ip}</span></div>}
                      {cat.rfConfig && <div>RF: <span className="text-white">{cat.rfConfig.protocol} ({cat.rfConfig.band.toUpperCase()})</span></div>}
                    </div>

                    <button
                      onClick={() => onSetDeviceToPlace(isSelected ? null : cat)}
                      className={`w-full py-1.5 rounded-lg text-xs font-bold transition-all ${
                        isSelected
                          ? 'bg-[#00F0FF] text-black'
                          : 'bg-white/10 hover:bg-white/15 text-white'
                      }`}
                    >
                      {isSelected ? 'Klikněte do půdorysu pro vložení' : '+ Vložit do půdorysu'}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* TAB 4: RF POKRYTÍ */}
        {activeTab === 'rf' && (
          <div className="space-y-4">
            <div className="bg-[#141b29] border border-white/10 rounded-xl p-3.5 space-y-3">
              <span className="font-bold text-white text-xs block">Parametry rádiové simulace</span>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1.5 font-medium">Frekvenční pásmo:</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {[
                    { id: 'rf433' as const, label: '433 MHz Sub-GHz' },
                    { id: 'rf868' as const, label: '868 MHz EmberZ' },
                    { id: 'rf2400' as const, label: '2.4 GHz WiFi/Zigbee' },
                    { id: 'rf5000' as const, label: '5 GHz WiFi 6' },
                  ].map((b) => (
                    <button
                      key={b.id}
                      onClick={() =>
                        onUpdateProject({
                          ...project,
                          rfSimulation: { ...project.rfSimulation, activeBand: b.id },
                        }, true)
                      }
                      className={`py-2 px-2 rounded-xl text-[11px] font-semibold border transition-all ${
                        project.rfSimulation.activeBand === b.id
                          ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                          : 'border-white/10 bg-black/30 text-gray-400 hover:text-white'
                      }`}
                    >
                      {b.label}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-gray-400 text-[11px] mb-1 font-medium">Vysílací zdroj (TX Node):</label>
                <select
                  value={project.rfSimulation.sourceDeviceId}
                  onChange={(e) =>
                    onUpdateProject({
                      ...project,
                      rfSimulation: { ...project.rfSimulation, sourceDeviceId: e.target.value },
                    }, true)
                  }
                  className="w-full bg-[#0a0f18] border border-white/20 rounded-xl p-2.5 text-white focus:outline-none focus:border-[#00F0FF]"
                >
                  {activeFloor.devices.map((d) => (
                    <option key={d.id} value={d.id}>
                      {d.name} {d.rfConfig ? `(${d.rfConfig.protocol})` : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Signal Legend */}
            <div className="bg-[#141b29] border border-white/10 rounded-xl p-3.5 space-y-2 text-xs">
              <span className="font-bold text-white block">Legenda síly signálu (RSSI):</span>
              <div className="space-y-1.5 font-mono text-[11px]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#00F0FF]" />
                    <span>Výborný</span>
                  </div>
                  <span className="text-[#00F0FF]">&gt; -50 dBm</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#10B981]" />
                    <span>Dobrý</span>
                  </div>
                  <span className="text-emerald-400">-50 až -65 dBm</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#F59E0B]" />
                    <span>Vyhovující</span>
                  </div>
                  <span className="text-amber-400">-65 až -75 dBm</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#EF4444]" />
                    <span>Kritický</span>
                  </div>
                  <span className="text-red-400">-75 až -88 dBm</span>
                </div>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-full bg-[#1e1b4b]" />
                    <span>Mrtvá zóna</span>
                  </div>
                  <span className="text-purple-400">&lt; -88 dBm</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
