import React, { useState } from 'react';
import { Wall, WallMaterialType } from '../types/cad';
import { WALL_MATERIALS } from '../constants/materials';
import { distanceCm } from '../utils/cadMath';
import { Ruler, Check, X, ShieldAlert, Sparkles, MoveHorizontal } from 'lucide-react';

interface LaserMeasureModalProps {
  wall: Wall;
  isOpen: boolean;
  onClose: () => void;
  onApply: (updatedWall: Wall) => void;
}

export const LaserMeasureModal: React.FC<LaserMeasureModalProps> = ({
  wall,
  isOpen,
  onClose,
  onApply,
}) => {
  if (!isOpen) return null;

  const currentLenCm = distanceCm(wall.start, wall.end);
  const currentLenMm = Math.round(currentLenCm * 10);

  const [unit, setUnit] = useState<'mm' | 'cm'>('mm');
  const [inputValue, setInputValue] = useState<string>(
    unit === 'mm' ? currentLenMm.toString() : currentLenCm.toFixed(1)
  );
  const [thicknessMm, setThicknessMm] = useState<number>(wall.thicknessMm);
  const [material, setMaterial] = useState<WallMaterialType>(wall.material);
  const [anchor, setAnchor] = useState<'start' | 'end' | 'center'>('start');

  const handleApply = () => {
    const numeric = parseFloat(inputValue);
    if (isNaN(numeric) || numeric <= 0) return;

    const targetLengthCm = unit === 'mm' ? numeric / 10 : numeric;
    if (currentLenCm === 0) return;

    let newStart = { ...wall.start };
    let newEnd = { ...wall.end };

    const dx = wall.end.x - wall.start.x;
    const dy = wall.end.y - wall.start.y;
    const angle = Math.atan2(dy, dx);

    if (anchor === 'start') {
      newEnd = {
        x: Number((wall.start.x + Math.cos(angle) * targetLengthCm).toFixed(1)),
        y: Number((wall.start.y + Math.sin(angle) * targetLengthCm).toFixed(1)),
      };
    } else if (anchor === 'end') {
      newStart = {
        x: Number((wall.end.x - Math.cos(angle) * targetLengthCm).toFixed(1)),
        y: Number((wall.end.y - Math.sin(angle) * targetLengthCm).toFixed(1)),
      };
    } else {
      // Center
      const midX = (wall.start.x + wall.end.x) / 2;
      const midY = (wall.start.y + wall.end.y) / 2;
      const halfL = targetLengthCm / 2;
      newStart = {
        x: Number((midX - Math.cos(angle) * halfL).toFixed(1)),
        y: Number((midY - Math.sin(angle) * halfL).toFixed(1)),
      };
      newEnd = {
        x: Number((midX + Math.cos(angle) * halfL).toFixed(1)),
        y: Number((midY + Math.sin(angle) * halfL).toFixed(1)),
      };
    }

    onApply({
      ...wall,
      start: newStart,
      end: newEnd,
      thicknessMm: Number(thicknessMm),
      material,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
      <div className="bg-[#141a26] border border-[#00F0FF]/40 w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in-95">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#00F0FF]/20 to-transparent p-5 border-b border-white/10 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2.5 bg-[#00F0FF]/20 rounded-xl text-[#00F0FF] border border-[#00F0FF]/30">
              <Ruler className="w-5 h-5" />
            </div>
            <div>
              <h3 className="text-base font-bold text-white tracking-wide">
                Laserový dálkoměr – Kalibrace kóty
              </h3>
              <p className="text-xs text-gray-400">
                Přímé zadání exaktní fyzické délky z laseru
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

        {/* Content */}
        <div className="p-6 space-y-5">
          {/* Target Length Input with Unit Switch */}
          <div>
            <div className="flex items-center justify-between text-xs text-gray-400 mb-1.5">
              <span>Naměřená délka z dálkoměru:</span>
              <div className="flex items-center bg-black/40 p-0.5 rounded-md border border-white/10">
                <button
                  type="button"
                  onClick={() => {
                    setUnit('mm');
                    setInputValue(Math.round(currentLenCm * 10).toString());
                  }}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    unit === 'mm' ? 'bg-[#00F0FF] text-black font-bold' : 'text-gray-400'
                  }`}
                >
                  Milimetry (mm)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setUnit('cm');
                    setInputValue(currentLenCm.toFixed(1));
                  }}
                  className={`px-2 py-0.5 text-xs rounded transition-colors ${
                    unit === 'cm' ? 'bg-[#00F0FF] text-black font-bold' : 'text-gray-400'
                  }`}
                >
                  Centimetry (cm)
                </button>
              </div>
            </div>

            <div className="relative">
              <input
                type="number"
                step={unit === 'mm' ? '1' : '0.1'}
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                autoFocus
                className="w-full bg-[#0a0d14] border-2 border-[#00F0FF]/60 rounded-xl px-4 py-3 text-2xl font-mono text-white focus:outline-none focus:border-[#00F0FF] pr-16 shadow-inner"
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm font-bold text-[#00F0FF]">
                {unit}
              </span>
            </div>
            <div className="text-[11px] text-gray-400 mt-1 flex items-center gap-1">
              Původní délka ve výkresu: <span className="text-white font-mono">{currentLenCm.toFixed(1)} cm ({currentLenMm} mm)</span>
            </div>
          </div>

          {/* Anchor Fixation */}
          <div>
            <label className="block text-xs text-gray-400 mb-1.5">
              Kotevní bod při úpravě délky:
            </label>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => setAnchor('start')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  anchor === 'start'
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                    : 'border-white/10 bg-black/30 text-gray-400 hover:text-white'
                }`}
              >
                Fixovat Začátek [A]
              </button>
              <button
                type="button"
                onClick={() => setAnchor('center')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  anchor === 'center'
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                    : 'border-white/10 bg-black/30 text-gray-400 hover:text-white'
                }`}
              >
                Rozšířit ze Středu
              </button>
              <button
                type="button"
                onClick={() => setAnchor('end')}
                className={`py-2 px-3 rounded-lg border text-xs font-medium transition-all ${
                  anchor === 'end'
                    ? 'border-[#00F0FF] bg-[#00F0FF]/20 text-[#00F0FF]'
                    : 'border-white/10 bg-black/30 text-gray-400 hover:text-white'
                }`}
              >
                Fixovat Konec [B]
              </button>
            </div>
          </div>

          {/* Material & Thickness */}
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Materiál stěny:</label>
              <select
                value={material}
                onChange={(e) => {
                  const m = e.target.value as WallMaterialType;
                  setMaterial(m);
                  setThicknessMm(WALL_MATERIALS[m].defaultThicknessMm);
                }}
                className="w-full bg-[#0a0d14] border border-white/20 rounded-lg px-3 py-2 text-xs text-white focus:outline-none focus:border-[#00F0FF]"
              >
                {Object.values(WALL_MATERIALS).map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs text-gray-400 mb-1.5">Tloušťka zdi (mm):</label>
              <input
                type="number"
                value={thicknessMm}
                onChange={(e) => setThicknessMm(Number(e.target.value))}
                className="w-full bg-[#0a0d14] border border-white/20 rounded-lg px-3 py-2 text-xs text-white font-mono focus:outline-none focus:border-[#00F0FF]"
              />
            </div>
          </div>

          {/* Attenuation Info preview */}
          <div className="bg-black/30 rounded-xl p-3 border border-white/5 text-[11px] text-gray-400">
            <span className="text-[#00F0FF] font-semibold">RF útlum materiálu: </span>
            Sub-GHz 433 MHz: <span className="text-white font-mono">{WALL_MATERIALS[material].attenuationDb.rf433} dB</span> | 
            2.4 GHz: <span className="text-white font-mono">{WALL_MATERIALS[material].attenuationDb.rf2400} dB</span> | 
            5 GHz: <span className="text-white font-mono">{WALL_MATERIALS[material].attenuationDb.rf5000} dB</span>
          </div>
        </div>

        {/* Footer */}
        <div className="bg-black/40 px-6 py-4 border-t border-white/10 flex items-center justify-end gap-3">
          <button
            onClick={onClose}
            className="px-4 py-2 text-xs text-gray-400 hover:text-white transition-colors"
          >
            Zrušit
          </button>
          <button
            onClick={handleApply}
            className="bg-[#00F0FF] hover:bg-[#00F0FF]/90 text-black font-bold px-5 py-2 rounded-xl text-xs transition-transform active:scale-95 shadow-lg shadow-[#00F0FF]/25 flex items-center gap-1.5"
          >
            <Check className="w-4 h-4" />
            Aplikovat rozměr
          </button>
        </div>
      </div>
    </div>
  );
};
