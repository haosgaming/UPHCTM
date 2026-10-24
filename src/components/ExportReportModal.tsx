import React, { useState } from 'react';
import { CadProject, LayerId } from '../types/cad';
import { LAYER_DEFINITIONS, WALL_MATERIALS } from '../constants/materials';
import { distanceCm } from '../utils/cadMath';
import { Printer, X, Check, FileDown, CheckSquare, Square, Layers } from 'lucide-react';

interface ExportReportModalProps {
  project: CadProject;
  isOpen: boolean;
  onClose: () => void;
}

export const ExportReportModal: React.FC<ExportReportModalProps> = ({
  project,
  isOpen,
  onClose,
}) => {
  if (!isOpen) return null;

  const [selectedLayers, setSelectedLayers] = useState<Record<LayerId, boolean>>({
    rf_iot: true,
    ethernet_data: true,
    electrical: true,
    hvac_plumbing: true,
  });

  const [reportTitle, setReportTitle] = useState(
    'Technická dokumentace rozvodů a stavebního půdorysu'
  );
  const [recipient, setRecipient] = useState<
    'all' | 'installer_plumbing' | 'technician_data' | 'electrician'
  >('all');

  const activeFloor =
    project.building.floors.find((f) => f.id === project.activeFloorId) ||
    project.building.floors[0];

  const handlePresetSelect = (type: 'all' | 'installer_plumbing' | 'technician_data' | 'electrician') => {
    setRecipient(type);
    if (type === 'all') {
      setSelectedLayers({ rf_iot: true, ethernet_data: true, electrical: true, hvac_plumbing: true });
      setReportTitle('Kompletní technická dokumentace a stavební půdorys');
    } else if (type === 'installer_plumbing') {
      setSelectedLayers({ rf_iot: false, ethernet_data: false, electrical: false, hvac_plumbing: true });
      setReportTitle('Instalatérský plán: Voda, Otopná soustava EP8 a Kanalizace');
    } else if (type === 'technician_data') {
      setSelectedLayers({ rf_iot: false, ethernet_data: true, electrical: false, hvac_plumbing: false });
      setReportTitle('Telekomunikační plán: Datové rozvody Cat6a, Rack a L2/L3 topologie');
    } else if (type === 'electrician') {
      setSelectedLayers({ rf_iot: false, ethernet_data: false, electrical: true, hvac_plumbing: false });
      setReportTitle('Elektroinstalační plán: 230V Silové okruhy a FVE střídač Carspa');
    }
  };

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
      <div className="bg-[#141a26] border border-white/20 w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-white/10 flex items-center justify-between bg-black/40">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00F0FF]/20 text-[#00F0FF] rounded-xl border border-[#00F0FF]/30">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white">Tiskový report & Export do PDF</h3>
              <p className="text-xs text-gray-400">
                Generování specializovaného technického výkresu dle profesí
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white p-1 rounded-lg hover:bg-white/10"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Configuration Bar */}
        <div className="p-5 bg-black/20 border-b border-white/10 space-y-4">
          <div>
            <label className="block text-xs text-gray-400 mb-1.5 font-medium">
              Rychlé předvolby pro profese:
            </label>
            <div className="grid grid-cols-4 gap-2">
              <button
                onClick={() => handlePresetSelect('all')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  recipient === 'all'
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                    : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                Všechny vrstvy
              </button>
              <button
                onClick={() => handlePresetSelect('installer_plumbing')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  recipient === 'installer_plumbing'
                    ? 'border-[#10B981] bg-[#10B981]/20 text-[#10B981]'
                    : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                Pro Instalatéra (Voda/Topení)
              </button>
              <button
                onClick={() => handlePresetSelect('technician_data')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  recipient === 'technician_data'
                    ? 'border-[#3B82F6] bg-[#3B82F6]/20 text-[#3B82F6]'
                    : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                Pro Síťaře (Ethernet/Rack)
              </button>
              <button
                onClick={() => handlePresetSelect('electrician')}
                className={`py-2 px-3 rounded-xl border text-xs font-semibold transition-all ${
                  recipient === 'electrician'
                    ? 'border-[#F59E0B] bg-[#F59E0B]/20 text-[#F59E0B]'
                    : 'border-white/10 bg-black/40 text-gray-400 hover:text-white'
                }`}
              >
                Pro Elektrikáře (230V/FVE)
              </button>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs">
            <span className="text-gray-400">Zahrnout vrstvy do tisku:</span>
            {LAYER_DEFINITIONS.map((l) => (
              <label
                key={l.id}
                className="flex items-center gap-1.5 cursor-pointer text-gray-300 hover:text-white"
              >
                <input
                  type="checkbox"
                  checked={selectedLayers[l.id]}
                  onChange={() =>
                    setSelectedLayers({
                      ...selectedLayers,
                      [l.id]: !selectedLayers[l.id],
                    })
                  }
                  className="rounded border-white/20 text-[#00F0FF] focus:ring-0"
                />
                <span>{l.shortName}</span>
              </label>
            ))}
          </div>
        </div>

        {/* Printable Preview Sheet */}
        <div className="flex-1 p-6 overflow-y-auto bg-gray-900/50 print:bg-white print:text-black">
          <div className="bg-[#0f172a] text-gray-100 p-8 rounded-xl border border-white/10 space-y-6 shadow-2xl max-w-3xl mx-auto">
            {/* Header Sheet */}
            <div className="border-b border-white/20 pb-4 flex justify-between items-start">
              <div>
                <h1 className="text-lg font-bold text-white">{reportTitle}</h1>
                <p className="text-xs text-gray-400 mt-1">
                  Objekt: {project.name} | Podlaží: {activeFloor.name} | Datum:{' '}
                  {new Date().toLocaleDateString('cs-CZ')}
                </p>
              </div>
              <div className="text-right text-[11px] text-gray-400">
                <div>Jednotky výkresu: {project.unit.toUpperCase()}</div>
                <div>Měřítko rastru: {project.gridSnapCm} cm</div>
              </div>
            </div>

            {/* Rooms Table */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#00F0FF] mb-2">
                Přehled místností a ploch
              </h2>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-1.5">Místnost</th>
                    <th className="py-1.5">Typ prostoru</th>
                    <th className="py-1.5">Plocha (m²)</th>
                    <th className="py-1.5">Výška stropu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeFloor.rooms.map((r) => (
                    <tr key={r.id}>
                      <td className="py-2 font-medium text-white">{r.name}</td>
                      <td className="py-2 text-gray-400 capitalize">{r.type}</td>
                      <td className="py-2 font-mono text-[#00F0FF]">{r.areaSquareMeters} m²</td>
                      <td className="py-2 font-mono text-gray-300">{r.floorHeightMm} mm</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Hardware & Technical Endpoints */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#10B981] mb-2">
                Instalované uzly a technologické prvky (dle vybraných vrstev)
              </h2>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-1.5">Zařízení</th>
                    <th className="py-1.5">Profese / Vrstva</th>
                    <th className="py-1.5">Výška montáže</th>
                    <th className="py-1.5">IP / Adresa / Protokol</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeFloor.devices
                    .filter((d) => selectedLayers[d.layer])
                    .map((d) => (
                      <tr key={d.id}>
                        <td className="py-2 font-semibold text-white">{d.name}</td>
                        <td className="py-2 text-gray-400">
                          {LAYER_DEFINITIONS.find((l) => l.id === d.layer)?.shortName}
                        </td>
                        <td className="py-2 font-mono text-gray-300">{d.elevationMm} mm</td>
                        <td className="py-2 font-mono text-emerald-400">
                          {d.ip || d.rfConfig?.protocol || d.role}
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {/* Technical Routes / Cable lengths */}
            <div>
              <h2 className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] mb-2">
                Trasy rozvodů a výměry
              </h2>
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-white/10 text-gray-400">
                    <th className="py-1.5">Název trasy</th>
                    <th className="py-1.5">Typ vedení</th>
                    <th className="py-1.5">Způsob uložení</th>
                    <th className="py-1.5">Odhadovaná délka</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-white/5">
                  {activeFloor.routes
                    .filter((rt) => selectedLayers[rt.layer])
                    .map((rt) => {
                      const lenM = (
                        rt.points.reduce((acc, p, i) => {
                          if (i === 0) return 0;
                          return acc + distanceCm(rt.points[i - 1], p);
                        }, 0) / 100
                      ).toFixed(2);
                      return (
                        <tr key={rt.id}>
                          <td className="py-2 font-semibold text-white">{rt.name}</td>
                          <td className="py-2 text-gray-300 uppercase font-mono">{rt.type}</td>
                          <td className="py-2 text-gray-400">
                            {rt.installationMethod === 'in_wall'
                              ? 'Ve zdi (drážka)'
                              : rt.installationMethod === 'in_floor'
                              ? 'V podlaze / mazanině'
                              : 'V liště'}
                          </td>
                          <td className="py-2 font-mono text-amber-400 font-bold">{lenM} m</td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Footer actions */}
        <div className="p-4 bg-black/40 border-t border-white/10 flex justify-between items-center">
          <span className="text-xs text-gray-400">
            Tip: Výstup lze přímo vytisknout nebo uložit do PDF přes systémový dialog tisku.
          </span>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-xs text-gray-400 hover:text-white"
            >
              Zavřít
            </button>
            <button
              onClick={handlePrint}
              className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-bold px-5 py-2 rounded-xl text-xs flex items-center gap-2 transition-transform active:scale-95 shadow-lg shadow-[#00F0FF]/25"
            >
              <Printer className="w-4 h-4" />
              Tisknout / Uložit do PDF
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
