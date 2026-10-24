import React from 'react';
import { 
  CadProject, 
  Wall, 
  DeviceNode, 
  Room, 
  WallMaterialType, 
  FrequencyBand 
} from '../types/cad';
import { WALL_MATERIALS, LAYER_DEFINITIONS } from '../constants/materials';
import { INVENTORY_CATALOG } from '../constants/inventoryHardware';
import { distanceCm } from '../utils/cadMath';
import { 
  Ruler, 
  Trash2, 
  Plus, 
  Radio, 
  Wifi, 
  Cpu, 
  Zap, 
  AlertTriangle, 
  CheckCircle, 
  Info,
  Layers,
  FileText
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
  onUpdateProject: (updated: CadProject) => void;
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
  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

  const selectedWall = activeFloor.walls.find((w) => w.id === selectedWallId);
  const selectedDevice = activeFloor.devices.find((d) => d.id === selectedDeviceId);
  const selectedRoom = activeFloor.rooms.find((r) => r.id === selectedRoomId);

  return (
    <div className="w-80 bg-[#10141e] border-l border-white/10 flex flex-col h-full text-xs text-gray-300 overflow-y-auto">
      {/* 1. Entity Inspector Section */}
      <div className="p-4 border-b border-white/10 space-y-4">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider text-[11px] text-[#00F0FF] flex items-center gap-1.5">
            <Layers className="w-3.5 h-3.5" />
            Vlastnosti výběru
          </span>
          {selectedWall && (
            <button
              onClick={() => onDeleteWall(selectedWall.id)}
              className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
              title="Smazat stěnu"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
          {selectedDevice && (
            <button
              onClick={() => onDeleteDevice(selectedDevice.id)}
              className="text-red-400 hover:text-red-300 p-1 hover:bg-red-500/10 rounded transition-colors"
              title="Smazat zařízení"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>

        {/* Selected Wall Inspector */}
        {selectedWall ? (
          <div className="space-y-3 bg-black/30 p-3 rounded-xl border border-white/5">
            <div className="flex items-center justify-between">
              <span className="text-gray-400">Délka stěny:</span>
              <span className="font-mono font-bold text-white text-sm">
                {distanceCm(selectedWall.start, selectedWall.end).toFixed(1)} cm
              </span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-gray-400">V milimetrech (mm):</span>
              <span className="font-mono text-[#00F0FF]">
                {Math.round(distanceCm(selectedWall.start, selectedWall.end) * 10)} mm
              </span>
            </div>

            <button
              onClick={() => onRequestLaserModal(selectedWall)}
              className="w-full bg-[#00F0FF]/15 hover:bg-[#00F0FF]/25 border border-[#00F0FF]/50 text-[#00F0FF] font-semibold py-2 rounded-lg flex items-center justify-center gap-2 transition-all active:scale-95"
            >
              <Ruler className="w-4 h-4" />
              Zadat kótu dálkoměrem (Laser)
            </button>

            <div>
              <label className="block text-gray-400 text-[11px] mb-1">Materiál:</label>
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
                  onUpdateProject({ ...project, building: { ...project.building, floors: updatedFloors } });
                }}
                className="w-full bg-[#0a0d14] border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-[#00F0FF]"
              >
                {Object.values(WALL_MATERIALS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-gray-400">Tloušťka zdi:</span>
              <span className="font-mono text-white">{selectedWall.thicknessMm} mm</span>
            </div>

            {/* RF attenuation box */}
            <div className="bg-[#0a0d14] p-2.5 rounded-lg border border-white/5 space-y-1 text-[11px]">
              <div className="text-gray-400 font-medium">RF útlum stěny:</div>
              <div className="flex justify-between">
                <span>433.92 MHz:</span>
                <span className="text-[#00F0FF] font-mono">
                  {WALL_MATERIALS[selectedWall.material].attenuationDb.rf433} dB
                </span>
              </div>
              <div className="flex justify-between">
                <span>2.4 GHz (WiFi/Zigbee):</span>
                <span className="text-emerald-400 font-mono">
                  {WALL_MATERIALS[selectedWall.material].attenuationDb.rf2400} dB
                </span>
              </div>
              <div className="flex justify-between">
                <span>5 GHz:</span>
                <span className="text-amber-400 font-mono">
                  {WALL_MATERIALS[selectedWall.material].attenuationDb.rf5000} dB
                </span>
              </div>
            </div>
          </div>
        ) : selectedDevice ? (
          /* Selected Device Inspector */
          <div className="space-y-3 bg-black/30 p-3 rounded-xl border border-white/5">
            <div>
              <span className="text-gray-400 text-[11px]">Zařízení:</span>
              <div className="font-bold text-white text-sm">{selectedDevice.name}</div>
            </div>

            {selectedDevice.ip && (
              <div className="flex justify-between">
                <span className="text-gray-400">IP adresa:</span>
                <span className="font-mono text-[#00F0FF]">{selectedDevice.ip}</span>
              </div>
            )}
            {selectedDevice.mac && (
              <div className="flex justify-between">
                <span className="text-gray-400">MAC adresa:</span>
                <span className="font-mono text-gray-300">{selectedDevice.mac}</span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-gray-400">Výška nad podlahou:</span>
              <span className="font-mono text-white">{selectedDevice.elevationMm} mm</span>
            </div>

            {selectedDevice.rfConfig && (
              <div className="bg-[#0a0d14] p-2.5 rounded-lg border border-white/5 space-y-1 text-[11px]">
                <div className="text-[#00F0FF] font-semibold flex items-center gap-1">
                  <Radio className="w-3.5 h-3.5" /> RF Parametry vysílače
                </div>
                <div className="flex justify-between">
                  <span>Pásmo:</span>
                  <span className="text-white font-mono">{selectedDevice.rfConfig.band.toUpperCase()}</span>
                </div>
                <div className="flex justify-between">
                  <span>Výkon TX:</span>
                  <span className="text-white font-mono">{selectedDevice.rfConfig.txPowerDbm} dBm</span>
                </div>
                <div className="flex justify-between">
                  <span>Protokol:</span>
                  <span className="text-gray-300">{selectedDevice.rfConfig.protocol}</span>
                </div>
                {selectedDevice.rfConfig.attenuationPenaltyDb ? (
                  <div className="text-amber-400 text-[10px] pt-1">
                    ⚠️ Hardwarový útlum filtru: -{selectedDevice.rfConfig.attenuationPenaltyDb} dB!
                  </div>
                ) : null}
              </div>
            )}

            {selectedDevice.notesMarkdown && (
              <button
                onClick={() =>
                  onOpenDocDrawer({
                    title: selectedDevice.name,
                    markdown: selectedDevice.notesMarkdown || '',
                  })
                }
                className="w-full bg-white/10 hover:bg-white/15 text-white py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Zobrazit technickou dokumentaci
              </button>
            )}
          </div>
        ) : selectedRoom ? (
          /* Selected Room Inspector */
          <div className="space-y-3 bg-black/30 p-3 rounded-xl border border-white/5">
            <div>
              <span className="text-gray-400 text-[11px]">Místnost:</span>
              <div className="font-bold text-white text-sm">{selectedRoom.name}</div>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Plocha:</span>
              <span className="font-mono font-bold text-[#00F0FF]">{selectedRoom.areaSquareMeters} m²</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-400">Světlá výška:</span>
              <span className="font-mono text-white">{selectedRoom.floorHeightMm} mm</span>
            </div>

            {selectedRoom.notesMarkdown && (
              <button
                onClick={() =>
                  onOpenDocDrawer({
                    title: selectedRoom.name,
                    markdown: selectedRoom.notesMarkdown || '',
                  })
                }
                className="w-full bg-white/10 hover:bg-white/15 text-white py-1.5 rounded-lg flex items-center justify-center gap-1.5 transition-colors"
              >
                <FileText className="w-3.5 h-3.5" />
                Poznámky k místnosti
              </button>
            )}
          </div>
        ) : (
          <div className="text-gray-500 italic p-3 text-center border border-dashed border-white/10 rounded-xl">
            Klikněte na stěnu, uzel nebo místnost pro zobrazení kót a technických detailů.
          </div>
        )}
      </div>

      {/* 2. Drawing Material Defaults */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <span className="font-bold text-white uppercase tracking-wider text-[11px] text-gray-400">
          Nástroj Zdi – Výchozí materiál
        </span>

        <div>
          <select
            value={activeMaterial}
            onChange={(e) => {
              const m = e.target.value as WallMaterialType;
              onChangeActiveMaterial(m);
              onChangeWallThickness(WALL_MATERIALS[m].defaultThicknessMm);
            }}
            className="w-full bg-[#0a0d14] border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-[#00F0FF]"
          >
            {Object.values(WALL_MATERIALS).map((m) => (
              <option key={m.id} value={m.id}>
                {m.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex items-center justify-between">
          <span className="text-gray-400">Tloušťka (mm):</span>
          <input
            type="number"
            value={wallThicknessMm}
            onChange={(e) => onChangeWallThickness(Number(e.target.value))}
            className="w-24 bg-[#0a0d14] border border-white/20 rounded-lg px-2 py-1 text-white font-mono text-right"
          />
        </div>
      </div>

      {/* 3. Hardware Catalog Quick Place */}
      <div className="p-4 border-b border-white/10 space-y-3">
        <div className="flex items-center justify-between">
          <span className="font-bold text-white uppercase tracking-wider text-[11px] text-[#00F0FF] flex items-center gap-1.5">
            <Cpu className="w-3.5 h-3.5" />
            Inventář hardware
          </span>
          {deviceToPlace && (
            <button
              onClick={() => onSetDeviceToPlace(null)}
              className="text-[10px] text-red-400 hover:underline"
            >
              Zrušit umisťování
            </button>
          )}
        </div>

        <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
          {INVENTORY_CATALOG.map((cat, idx) => {
            const isSelectedForPlacing = deviceToPlace?.name === cat.name;
            return (
              <button
                key={idx}
                onClick={() => onSetDeviceToPlace(isSelectedForPlacing ? null : cat)}
                className={`w-full text-left p-2 rounded-lg border transition-all flex items-start gap-2 ${
                  isSelectedForPlacing
                    ? 'border-[#00F0FF] bg-[#00F0FF]/15 text-white'
                    : 'border-white/5 bg-black/20 text-gray-300 hover:border-white/15'
                }`}
              >
                <div className="mt-0.5">
                  {cat.layer === 'rf_iot' ? (
                    <Radio className="w-3.5 h-3.5 text-[#00F0FF]" />
                  ) : cat.layer === 'ethernet_data' ? (
                    <Wifi className="w-3.5 h-3.5 text-[#3B82F6]" />
                  ) : cat.layer === 'electrical' ? (
                    <Zap className="w-3.5 h-3.5 text-[#F59E0B]" />
                  ) : (
                    <Cpu className="w-3.5 h-3.5 text-[#10B981]" />
                  )}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="font-medium truncate text-[11px]">{cat.name}</div>
                  <div className="text-[10px] text-gray-500 font-mono truncate">
                    {cat.ip || cat.rfConfig?.protocol || cat.role}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* 4. RF Simulation Controller */}
      <div className="p-4 space-y-3">
        <span className="font-bold text-white uppercase tracking-wider text-[11px] text-purple-400 flex items-center gap-1.5">
          <Radio className="w-3.5 h-3.5" />
          RF Simulace šíření signálu
        </span>

        <div>
          <label className="block text-gray-400 text-[11px] mb-1">Frekvenční pásmo:</label>
          <div className="grid grid-cols-2 gap-1.5">
            {[
              { id: 'rf433' as const, label: '433 MHz (Sub-GHz)' },
              { id: 'rf868' as const, label: '868 MHz (CC1101)' },
              { id: 'rf2400' as const, label: '2.4 GHz (WiFi/Zigbee)' },
              { id: 'rf5000' as const, label: '5 GHz (WiFi 6/7)' },
            ].map((b) => (
              <button
                key={b.id}
                onClick={() =>
                  onUpdateProject({
                    ...project,
                    rfSimulation: { ...project.rfSimulation, activeBand: b.id },
                  })
                }
                className={`py-1.5 px-2 rounded-lg text-[10px] font-semibold border transition-all ${
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
          <label className="block text-gray-400 text-[11px] mb-1">Vysílací zdroj (TX Node):</label>
          <select
            value={project.rfSimulation.sourceDeviceId}
            onChange={(e) =>
              onUpdateProject({
                ...project,
                rfSimulation: { ...project.rfSimulation, sourceDeviceId: e.target.value },
              })
            }
            className="w-full bg-[#0a0d14] border border-white/20 rounded-lg p-2 text-white focus:outline-none focus:border-[#00F0FF]"
          >
            {activeFloor.devices.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name} {d.rfConfig ? `(${d.rfConfig.protocol})` : ''}
              </option>
            ))}
          </select>
        </div>

        {/* Heatmap Legend */}
        <div className="bg-black/30 p-2.5 rounded-xl border border-white/5 space-y-1 text-[10px]">
          <div className="text-gray-400 font-medium">Legenda síly signálu (RSSI):</div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#00F0FF]" />
            <span>Výborný (&gt; -50 dBm)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#10B981]" />
            <span>Dobrý (-50 až -65 dBm)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#F59E0B]" />
            <span>Hraniční (-65 až -75 dBm)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#EF4444]" />
            <span>Slabý / Kritický (-75 až -88 dBm)</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="w-3 h-3 rounded bg-[#1e1b4b]" />
            <span>Mrtvá zóna (&lt; -88 dBm)</span>
          </div>
        </div>
      </div>
    </div>
  );
};
