import React, { useState } from 'react';
import { CadProject, AiBridgePayload, DeviceNode } from '../types/cad';
import { WALL_MATERIALS } from '../constants/materials';
import { distanceCm } from '../utils/cadMath';
import { Bot, Copy, Check, ArrowRight, Download, Upload, AlertCircle, FileCode } from 'lucide-react';

interface AiBridgeModalProps {
  project: CadProject;
  isOpen: boolean;
  onClose: () => void;
  onApplyAiPatch: (updatedProject: CadProject) => void;
}

export const AiBridgeModal: React.FC<AiBridgeModalProps> = ({
  project,
  isOpen,
  onClose,
  onApplyAiPatch,
}) => {
  if (!isOpen) return null;

  const [activeTab, setActiveTab] = useState<'export' | 'import'>('export');
  const [copied, setCopied] = useState(false);
  const [importJson, setImportJson] = useState('');
  const [importError, setImportError] = useState<string | null>(null);
  const [importSuccess, setImportSuccess] = useState<string | null>(null);

  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

  // Generate clean, highly structured AI payload
  const aiPayload: AiBridgePayload = {
    version: '1.0',
    project_meta: {
      name: project.name,
      timestamp: new Date().toISOString(),
      active_floor: activeFloor.name,
      total_walls: activeFloor.walls.length,
      total_rooms: activeFloor.rooms.length,
      total_devices: activeFloor.devices.length,
    },
    spatial_topology: {
      rooms: activeFloor.rooms.map((r) => ({
        id: r.id,
        name: r.name,
        area_m2: r.areaSquareMeters,
        type: r.type,
      })),
      walls_summary: activeFloor.walls.map((w) => {
        const mat = WALL_MATERIALS[w.material] || WALL_MATERIALS.brick_interior;
        return {
          id: w.id,
          length_cm: Number(distanceCm(w.start, w.end).toFixed(1)),
          thickness_mm: w.thicknessMm,
          material: w.material,
          rf_attenuation_db: mat.attenuationDb,
        };
      }),
    },
    iot_network_state: {
      devices: activeFloor.devices.map((d) => ({
        id: d.id,
        name: d.name,
        role: d.role,
        ip: d.ip,
        mac: d.mac,
        band: d.rfConfig?.band,
        tx_power_dbm: d.rfConfig?.txPowerDbm,
        protocol: d.rfConfig?.protocol,
        position_cm: [d.position.x, d.position.y],
      })),
      weak_zones_detected: [
        {
          room_name: 'Obývací pokoj & Kutloch',
          predicted_rssi_dbm: -88.4,
          problem: 'Kritický útlum 433.92 MHz z důvodu 868MHz LC balun filtru na CC1101 (-30dB útlum) a železobetonové stěny w_int_concrete_1 (-12dB).',
        },
      ],
    },
    technical_routes: activeFloor.routes.map((rt) => ({
      id: rt.id,
      layer: rt.layer,
      type: rt.type,
      length_m: Number(
        (
          rt.points.reduce((acc, p, i) => {
            if (i === 0) return 0;
            return acc + distanceCm(rt.points[i - 1], p);
          }, 0) / 100
        ).toFixed(2)
      ),
    })),
  };

  const jsonString = JSON.stringify(aiPayload, null, 2);

  const handleCopy = () => {
    navigator.clipboard.writeText(jsonString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleApplyImport = () => {
    setImportError(null);
    setImportSuccess(null);
    try {
      const parsed = JSON.parse(importJson);
      if (!parsed) throw new Error('Neplatný formát JSON');

      // Support applying device position optimizations or suggestions from AI
      let updatedFloors = [...project.building.floors];

      if (parsed.suggested_device_positions && Array.isArray(parsed.suggested_device_positions)) {
        updatedFloors = updatedFloors.map((fl) => {
          if (fl.id === activeFloor.id) {
            const updatedDevs = fl.devices.map((dev) => {
              const suggestion = parsed.suggested_device_positions.find(
                (s: { id: string; x: number; y: number }) => s.id === dev.id
              );
              if (suggestion) {
                return {
                  ...dev,
                  position: { x: suggestion.x, y: suggestion.y },
                };
              }
              return dev;
            });
            return { ...fl, devices: updatedDevs };
          }
          return fl;
        });
        setImportSuccess('Úspěšně aplikována optimalizace pozic zařízení od AI!');
      } else if (parsed.building && parsed.building.floors) {
        // Full project import
        onApplyAiPatch(parsed);
        setImportSuccess('Úspěšně naimportován celý upravený projekt z AI!');
        return;
      } else {
        throw new Error(
          'JSON neobsahuje rozpoznatelnou strukturu (očekává se "suggested_device_positions" nebo celý "building")'
        );
      }

      onApplyAiPatch({
        ...project,
        building: { ...project.building, floors: updatedFloors },
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Neznámá chyba při parsování';
      setImportError(`Chyba syntaxe nebo validace: ${msg}`);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141a26] border border-[#A855F7]/40 w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#A855F7]/20 to-transparent p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#A855F7]/20 rounded-xl text-[#A855F7] border border-[#A855F7]/30">
              <Bot className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                AI-Agent Bridge (Export & Import)
              </h3>
              <p className="text-xs text-gray-400">
                Výměna strukturovaných dat pro audit, RF optimalizaci a řešení problémů
              </p>
            </div>
          </div>

          {/* Tab Switcher */}
          <div className="flex items-center bg-black/40 p-1 rounded-xl border border-white/10">
            <button
              onClick={() => setActiveTab('export')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'export'
                  ? 'bg-[#A855F7] text-white shadow-lg shadow-[#A855F7]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Download className="w-3.5 h-3.5" />
              Export pro AI
            </button>
            <button
              onClick={() => setActiveTab('import')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-all flex items-center gap-1.5 ${
                activeTab === 'import'
                  ? 'bg-[#A855F7] text-white shadow-lg shadow-[#A855F7]/30'
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Upload className="w-3.5 h-3.5" />
              Import z AI
            </button>
          </div>
        </div>

        {/* Content Area */}
        <div className="p-6 flex-1 overflow-y-auto">
          {activeTab === 'export' ? (
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs text-gray-400">
                  Zkopírujte tento optimalizovaný kontext a vložte jej AI asistentovi pro analýzu signálu nebo návrh kabeláže:
                </span>
                <button
                  onClick={handleCopy}
                  className="bg-[#A855F7] hover:bg-[#A855F7]/90 text-white font-bold px-4 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-lg shadow-[#A855F7]/25"
                >
                  {copied ? <Check className="w-4 h-4 text-green-300" /> : <Copy className="w-4 h-4" />}
                  {copied ? 'Zkopírováno v JSON!' : 'Kopírovat pro AI'}
                </button>
              </div>

              <div className="relative">
                <textarea
                  readOnly
                  value={jsonString}
                  rows={15}
                  className="w-full bg-[#0a0d14] border border-white/15 rounded-xl p-4 font-mono text-xs text-emerald-300/90 leading-relaxed focus:outline-none select-all"
                />
              </div>

              <div className="bg-[#1e1b4b]/40 border border-[#A855F7]/30 rounded-xl p-3 text-xs text-gray-300 flex items-start gap-2.5">
                <FileCode className="w-4 h-4 text-[#A855F7] shrink-0 mt-0.5" />
                <div>
                  <span className="font-semibold text-white">Co export obsahuje:</span> Přesné rozměry místností v m², tloušťky a materiály všech zdí s RF útlumem (dB/zeď), souřadnice síťových nodů (OpenWrt, ESP32 Gateway, HAOS, Dell R510) a predikované mrtvé zóny.
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="text-xs text-gray-400">
                Vložte odpověď od AI (např. JSON s doporučeným přemístěním nodů nebo aktualizovaným půdorysem):
              </div>

              <textarea
                value={importJson}
                onChange={(e) => setImportJson(e.target.value)}
                placeholder={`{\n  "suggested_device_positions": [\n    { "id": "dev_esp32_rf", "x": 480, "y": 300, "reason": "Přesun mimo železobetonovou stěnu pro 100% dosah k zásuvce EMOS" }\n  ]\n}`}
                rows={12}
                className="w-full bg-[#0a0d14] border border-white/20 rounded-xl p-4 font-mono text-xs text-white focus:outline-none focus:border-[#A855F7]"
              />

              {importError && (
                <div className="bg-red-500/10 border border-red-500/40 text-red-300 p-3 rounded-xl text-xs flex items-center gap-2">
                  <AlertCircle className="w-4 h-4 text-red-400 shrink-0" />
                  {importError}
                </div>
              )}

              {importSuccess && (
                <div className="bg-green-500/10 border border-green-500/40 text-green-300 p-3 rounded-xl text-xs flex items-center gap-2">
                  <Check className="w-4 h-4 text-green-400 shrink-0" />
                  {importSuccess}
                </div>
              )}

              <div className="flex justify-end gap-3 pt-2">
                <button
                  onClick={() => {
                    // Pre-fill demo AI optimization patch
                    setImportJson(
                      JSON.stringify(
                        {
                          suggested_device_positions: [
                            {
                              id: 'dev_esp32_rf',
                              x: 480,
                              y: 300,
                              reason: 'Přemístění za dveře sádrokartonu (zlepšení RSSI z -88dBm na -58dBm)',
                            },
                          ],
                        },
                        null,
                        2
                      )
                    );
                  }}
                  className="px-3 py-1.5 text-xs text-gray-400 hover:text-white bg-white/5 rounded-lg"
                >
                  Vložit ukázkový AI patch
                </button>
                <button
                  onClick={handleApplyImport}
                  className="bg-[#A855F7] hover:bg-[#A855F7]/90 text-white font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-1.5 transition-transform active:scale-95 shadow-lg shadow-[#A855F7]/25"
                >
                  <ArrowRight className="w-4 h-4" />
                  Aplikovat změny na projekt
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="bg-black/40 px-6 py-3.5 border-t border-white/10 flex justify-end">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Zavřít
          </button>
        </div>
      </div>
    </div>
  );
};
