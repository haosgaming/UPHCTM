import React, { useState } from 'react';
import { 
  CadProject, 
  Wall, 
  DeviceNode, 
  WallMaterialType 
} from './types/cad';
import { INITIAL_PROJECT } from './constants/inventoryHardware';
import { useProjectHistory } from './hooks/useProjectHistory';
import { Cad2DCanvas, CadTool } from './components/Cad2DCanvas';
import { Cad3DViewer } from './components/Cad3DViewer';
import { PropertiesPanel } from './components/PropertiesPanel';
import { LaserMeasureModal } from './components/LaserMeasureModal';
import { AiBridgeModal } from './components/AiBridgeModal';
import { DocumentationDrawer } from './components/DocumentationDrawer';
import { ExportReportModal } from './components/ExportReportModal';
import { 
  Box, 
  Radio, 
  Ruler, 
  Bot, 
  Printer, 
  FolderOpen, 
  MousePointer, 
  Square, 
  Activity, 
  ShieldCheck, 
  Sparkles,
  HardDrive,
  Undo2,
  Redo2,
  Hand,
  Cpu
} from 'lucide-react';

export default function App() {
  const {
    project,
    canUndo,
    canRedo,
    pastCount,
    futureCount,
    updateProject,
    undo,
    redo,
    resetProject,
  } = useProjectHistory(INITIAL_PROJECT);

  // View Mode: 2D Floorplan, 3D Spatial Model, RF Signal Simulation
  const [viewMode, setViewMode] = useState<'2d_cad' | '3d_view' | 'rf_heatmap'>('2d_cad');

  // CAD interactive tool state
  const [activeTool, setActiveTool] = useState<CadTool>('select');
  const [selectedWallId, setSelectedWallId] = useState<string | null>(null);
  const [selectedDeviceId, setSelectedDeviceId] = useState<string | null>(null);
  const [selectedRoomId, setSelectedRoomId] = useState<string | null>(null);

  // Active drawing presets
  const [activeMaterial, setActiveMaterial] = useState<WallMaterialType>('brick_interior');
  const [wallThicknessMm, setWallThicknessMm] = useState<number>(140);
  const [deviceToPlace, setDeviceToPlace] = useState<Omit<DeviceNode, 'id' | 'position'> | null>(null);

  // Modals state
  const [laserModalWall, setLaserModalWall] = useState<Wall | null>(null);
  const [isAiBridgeOpen, setIsAiBridgeOpen] = useState(false);
  const [isExportReportOpen, setIsExportReportOpen] = useState(false);
  const [docDrawer, setDocDrawer] = useState<{ isOpen: boolean; title: string; markdown: string } | null>(null);

  const activeFloor = project.building.floors.find((f) => f.id === project.activeFloorId) || project.building.floors[0];

  const handleSelectTool = (tool: CadTool) => {
    setActiveTool(tool);
    if (tool !== 'place_device') {
      setDeviceToPlace(null);
    }
  };

  const handleDevicePlaceSelect = (dev: Omit<DeviceNode, 'id' | 'position'> | null) => {
    setDeviceToPlace(dev);
    if (dev) {
      setActiveTool('place_device');
    } else {
      setActiveTool('select');
    }
  };

  const handleDeleteWall = (wallId: string) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          walls: fl.walls.filter((w) => w.id !== wallId),
          rooms: fl.rooms.map((r) => ({
            ...r,
            wallIds: r.wallIds.filter((id) => id !== wallId),
          })),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, true);
    setSelectedWallId(null);
  };

  const handleDeleteDevice = (devId: string) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          devices: fl.devices.filter((d) => d.id !== devId),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, true);
    setSelectedDeviceId(null);
  };

  const handleApplyLaserDimension = (updatedWall: Wall) => {
    const updatedFloors = project.building.floors.map((fl) => {
      if (fl.id === activeFloor.id) {
        return {
          ...fl,
          walls: fl.walls.map((w) => (w.id === updatedWall.id ? updatedWall : w)),
        };
      }
      return fl;
    });
    updateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, true);
  };

  const handleSaveJsonFile = () => {
    const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${project.name.toLowerCase().replace(/\s+/g, '_')}_zaloha.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleLoadJsonFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const parsed = JSON.parse(event.target?.result as string);
        if (parsed.building && parsed.building.floors) {
          resetProject(parsed);
        }
      } catch (err) {
        alert('Soubor nemá platný formát projektu CAD-IoT.');
      }
    };
    reader.readAsText(file);
  };

  return (
    <div className="flex flex-col h-screen w-screen overflow-hidden bg-[#080c14] text-gray-200 font-sans select-none">
      {/* 1. Horní hlavní navigační lišta */}
      <header className="h-14 bg-[#101522] border-b border-white/10 px-4 flex items-center justify-between shrink-0 shadow-xl z-30">
        {/* Identita aplikace */}
        <div className="flex items-center gap-3">
          <div className="p-2 bg-[#00F0FF]/15 border border-[#00F0FF]/40 rounded-xl text-[#00F0FF] shadow-md shadow-[#00F0FF]/20">
            <Radio className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-bold text-sm text-white tracking-wide">
                CAD-IoT Spatial Planner
              </span>
              <span className="text-[10px] bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full font-semibold flex items-center gap-1">
                <ShieldCheck className="w-3 h-3" />
                Lokální provoz
              </span>
            </div>
            <p className="text-[11px] text-gray-400">
              {project.name} • {activeFloor.name}
            </p>
          </div>
        </div>

        {/* Přepínač hlavních režimů zobrazení */}
        <div className="flex items-center bg-[#0a0f18] p-1 rounded-xl border border-white/10">
          <button
            onClick={() => setViewMode('2d_cad')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === '2d_cad'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Ruler className="w-4 h-4" />
            Půdorys 2D
          </button>
          <button
            onClick={() => setViewMode('3d_view')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === '3d_view'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Box className="w-4 h-4" />
            Model 3D
          </button>
          <button
            onClick={() => setViewMode('rf_heatmap')}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold flex items-center gap-2 transition-all ${
              viewMode === 'rf_heatmap'
                ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/25'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            <Activity className="w-4 h-4" />
            RF Pokrytí
          </button>
        </div>

        {/* Historie kroků (Undo / Redo) & Akce projektu */}
        <div className="flex items-center gap-2">
          {/* Undo / Redo */}
          <div className="flex items-center bg-[#0a0f18] p-1 rounded-xl border border-white/10 gap-0.5">
            <button
              onClick={undo}
              disabled={!canUndo}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                canUndo
                  ? 'text-gray-200 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                  : 'text-gray-600 cursor-not-allowed opacity-40'
              }`}
              title={`Zpět (Undo) [Ctrl+Z]${pastCount > 0 ? ` (${pastCount} kroků)` : ''}`}
            >
              <Undo2 className="w-4 h-4 text-[#00F0FF]" />
              <span className="text-[11px] hidden xl:inline">Zpět</span>
            </button>
            <button
              onClick={redo}
              disabled={!canRedo}
              className={`p-1.5 rounded-lg text-xs font-medium flex items-center gap-1 transition-all ${
                canRedo
                  ? 'text-gray-200 hover:text-white hover:bg-white/10 active:scale-95 cursor-pointer'
                  : 'text-gray-600 cursor-not-allowed opacity-40'
              }`}
              title={`Vpřed (Redo) [Ctrl+Y]${futureCount > 0 ? ` (${futureCount} kroků)` : ''}`}
            >
              <Redo2 className="w-4 h-4 text-[#F59E0B]" />
              <span className="text-[11px] hidden xl:inline">Vpřed</span>
            </button>
          </div>

          {/* AI Bridge */}
          <button
            onClick={() => setIsAiBridgeOpen(true)}
            className="bg-[#A855F7]/15 hover:bg-[#A855F7]/25 text-[#A855F7] border border-[#A855F7]/40 px-3 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 transition-all shadow-md active:scale-95"
            title="Export a import dat pro AI agenty"
          >
            <Bot className="w-4 h-4" />
            <span className="hidden sm:inline">AI Bridge</span>
          </button>

          {/* Tisk / PDF */}
          <button
            onClick={() => setIsExportReportOpen(true)}
            className="bg-white/5 hover:bg-white/10 text-gray-200 border border-white/10 px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition-colors"
            title="Vytvořit tiskový report a PDF"
          >
            <Printer className="w-4 h-4" />
            <span className="hidden sm:inline">Tisk & PDF</span>
          </button>

          {/* Uložit JSON */}
          <button
            onClick={handleSaveJsonFile}
            className="bg-white/5 hover:bg-white/10 text-emerald-400 border border-white/10 p-2 rounded-xl transition-colors"
            title="Uložit záložní soubor projektu (JSON)"
          >
            <HardDrive className="w-4 h-4" />
          </button>

          {/* Načíst JSON */}
          <label
            className="bg-white/5 hover:bg-white/10 text-amber-400 border border-white/10 p-2 rounded-xl transition-colors cursor-pointer"
            title="Otevřít projekt ze souboru JSON"
          >
            <FolderOpen className="w-4 h-4" />
            <input
              type="file"
              accept=".json"
              onChange={handleLoadJsonFile}
              className="hidden"
            />
          </label>
        </div>
      </header>

      {/* 2. Hlavní pracovní plocha */}
      <div className="flex flex-1 overflow-hidden relative">
        {/* Levé nástrojové CAD menu (pouze ve 2D a RF režimu) */}
        {viewMode !== '3d_view' && (
          <aside className="w-16 bg-[#0e131d] border-r border-white/10 flex flex-col items-center py-3 gap-2 z-20 shrink-0">
            {/* Výběr */}
            <button
              onClick={() => handleSelectTool('select')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'select'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Výběr prvků a manipulace [V]"
            >
              <MousePointer className="w-5 h-5" />
            </button>

            {/* Posun pohledu (Ruka) */}
            <button
              onClick={() => handleSelectTool('pan')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'pan'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Volný posun plátna (Ruka) [H nebo držte Mezerník]"
            >
              <Hand className="w-5 h-5" />
            </button>

            {/* Kreslení zdi */}
            <button
              onClick={() => handleSelectTool('wall')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'wall'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Kreslení zdi [W]"
            >
              <Ruler className="w-5 h-5" />
            </button>

            {/* Obdélníková místnost */}
            <button
              onClick={() => handleSelectTool('rect_room')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'rect_room'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Vložit obdélníkovou místnost [R]"
            >
              <Square className="w-5 h-5" />
            </button>

            {/* Laserový dálkoměr */}
            <button
              onClick={() => handleSelectTool('laser_measure')}
              className={`p-3 rounded-xl transition-all ${
                activeTool === 'laser_measure'
                  ? 'bg-[#00F0FF] text-black shadow-lg shadow-[#00F0FF]/30'
                  : 'text-gray-400 hover:text-white hover:bg-white/10'
              }`}
              title="Laserový dálkoměr – zadání přesné kóty [L]"
            >
              <Sparkles className="w-5 h-5 text-amber-400" />
            </button>

            <div className="w-8 h-px bg-white/10 my-1" />

            {/* Přepínač jednotek (cm / mm) */}
            <button
              onClick={() =>
                updateProject({
                  ...project,
                  unit: project.unit === 'mm' ? 'cm' : 'mm',
                }, true)
              }
              className="px-2 py-1 bg-black/40 border border-white/10 rounded text-[10px] font-mono font-bold text-[#00F0FF] hover:bg-white/10 transition-colors"
              title="Přepnout zobrazení kót (cm / mm)"
            >
              {project.unit.toUpperCase()}
            </button>
          </aside>
        )}

        {/* Centrální plátno / prohlížeč */}
        <main className="flex-1 relative overflow-hidden bg-[#080c14]">
          {viewMode === '3d_view' ? (
            <Cad3DViewer project={project} />
          ) : (
            <Cad2DCanvas
              project={project}
              activeTool={activeTool}
              selectedWallId={selectedWallId}
              selectedDeviceId={selectedDeviceId}
              selectedRoomId={selectedRoomId}
              activeMaterial={activeMaterial}
              wallThicknessMm={wallThicknessMm}
              deviceToPlace={deviceToPlace}
              showHeatmap={viewMode === 'rf_heatmap'}
              onSelectWall={setSelectedWallId}
              onSelectDevice={setSelectedDeviceId}
              onSelectRoom={setSelectedRoomId}
              onUpdateProject={updateProject}
              onRequestLaserModal={(wall) => setLaserModalWall(wall)}
            />
          )}
        </main>

        {/* Pravý multifunkční panel (Inspektor, Vrstvy, Hardware, RF) */}
        <PropertiesPanel
          project={project}
          selectedWallId={selectedWallId}
          selectedDeviceId={selectedDeviceId}
          selectedRoomId={selectedRoomId}
          activeMaterial={activeMaterial}
          wallThicknessMm={wallThicknessMm}
          deviceToPlace={deviceToPlace}
          onChangeActiveMaterial={setActiveMaterial}
          onChangeWallThickness={setWallThicknessMm}
          onSetDeviceToPlace={handleDevicePlaceSelect}
          onRequestLaserModal={(wall) => setLaserModalWall(wall)}
          onOpenDocDrawer={(item) =>
            setDocDrawer({ isOpen: true, title: item.title, markdown: item.markdown })
          }
          onUpdateProject={updateProject}
          onDeleteWall={handleDeleteWall}
          onDeleteDevice={handleDeleteDevice}
        />
      </div>

      {/* Modální dialogy */}
      {laserModalWall && (
        <LaserMeasureModal
          wall={laserModalWall}
          isOpen={!!laserModalWall}
          onClose={() => setLaserModalWall(null)}
          onApply={handleApplyLaserDimension}
        />
      )}

      {isAiBridgeOpen && (
        <AiBridgeModal
          project={project}
          isOpen={isAiBridgeOpen}
          onClose={() => setIsAiBridgeOpen(false)}
          onApplyAiPatch={(patched) => updateProject(patched)}
        />
      )}

      {isExportReportOpen && (
        <ExportReportModal
          project={project}
          isOpen={isExportReportOpen}
          onClose={() => setIsExportReportOpen(false)}
        />
      )}

      {docDrawer?.isOpen && (
        <DocumentationDrawer
          isOpen={docDrawer.isOpen}
          title={docDrawer.title}
          initialMarkdown={docDrawer.markdown}
          onClose={() => setDocDrawer(null)}
          onSave={(updatedMd) => {
            const updatedFloors = project.building.floors.map((fl) => {
              if (fl.id === activeFloor.id) {
                return {
                  ...fl,
                  devices: fl.devices.map((d) =>
                    d.name === docDrawer.title ? { ...d, notesMarkdown: updatedMd } : d
                  ),
                  rooms: fl.rooms.map((r) =>
                    r.name === docDrawer.title ? { ...r, notesMarkdown: updatedMd } : r
                  ),
                };
              }
              return fl;
            });
            updateProject({ ...project, building: { ...project.building, floors: updatedFloors } }, true);
          }}
        />
      )}
    </div>
  );
}
