import React from 'react';
import { LayerId, CadProject } from '../types/cad';
import { LAYER_DEFINITIONS } from '../constants/materials';
import { Radio, Network, Zap, Flame, Eye, EyeOff, CheckCircle2 } from 'lucide-react';

interface LayersPanelProps {
  project: CadProject;
  onUpdateProject: (updated: CadProject) => void;
}

export const LayersPanel: React.FC<LayersPanelProps> = ({ project, onUpdateProject }) => {
  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

  const getIcon = (iconName: string) => {
    switch (iconName) {
      case 'Radio':
        return <Radio className="w-4 h-4 text-[#00F0FF]" />;
      case 'Network':
        return <Network className="w-4 h-4 text-[#3B82F6]" />;
      case 'Zap':
        return <Zap className="w-4 h-4 text-[#F59E0B]" />;
      case 'Flame':
        return <Flame className="w-4 h-4 text-[#10B981]" />;
      default:
        return <Radio className="w-4 h-4 text-gray-400" />;
    }
  };

  const toggleLayerVisibility = (layerId: LayerId) => {
    const updatedVisible = {
      ...project.visibleLayers,
      [layerId]: !project.visibleLayers[layerId],
    };
    onUpdateProject({
      ...project,
      visibleLayers: updatedVisible,
    });
  };

  const setActiveLayer = (layerId: LayerId) => {
    onUpdateProject({
      ...project,
      activeLayer: layerId,
    });
  };

  return (
    <div className="bg-[#141a26]/95 border-b border-white/10 px-4 py-2.5 flex items-center justify-between gap-4 overflow-x-auto text-xs">
      <div className="flex items-center gap-2 text-gray-400 shrink-0 font-medium">
        <span>Vrstvy projektu:</span>
      </div>

      <div className="flex items-center gap-2">
        {LAYER_DEFINITIONS.map((def) => {
          const isVisible = project.visibleLayers[def.id];
          const isActive = project.activeLayer === def.id;

          const deviceCount = activeFloor.devices.filter((d) => d.layer === def.id).length;
          const routeCount = activeFloor.routes.filter((r) => r.layer === def.id).length;

          return (
            <div
              key={def.id}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-xl border transition-all ${
                isActive
                  ? 'border-white/30 bg-white/10 shadow-md'
                  : 'border-white/5 bg-black/20 hover:border-white/15'
              }`}
            >
              {/* Active layer selector radio */}
              <button
                onClick={() => setActiveLayer(def.id)}
                className="flex items-center gap-1.5 text-left focus:outline-none"
                title={`Nastavit jako aktivní vrstvu pro kreslení: ${def.name}`}
              >
                {getIcon(def.icon)}
                <span className={`font-semibold ${isActive ? 'text-white' : 'text-gray-300'}`}>
                  {def.shortName}
                </span>
                <span className="text-[10px] bg-white/10 px-1.5 py-0.2 rounded-full text-gray-400">
                  {deviceCount} zař.
                </span>
              </button>

              {/* Visibility toggle button */}
              <button
                onClick={() => toggleLayerVisibility(def.id)}
                className={`p-1 rounded-md transition-colors ml-1 ${
                  isVisible ? 'text-gray-300 hover:text-white' : 'text-gray-600 hover:text-gray-400'
                }`}
                title={isVisible ? 'Skrýt vrstvu' : 'Zobrazit vrstvu'}
              >
                {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
};
